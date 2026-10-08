import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function run(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: false })
    let out = ''
    let err = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('close', (code) => resolve({ code: code ?? 0, out, err }))
    // ENOENT (tool not installed, e.g. zenity on a minimal Kali) — report as code 127, don't crash.
    child.on('error', (e) => resolve({ code: 127, out, err: String(e) }))
  })
}

// Uses the modern Windows Explorer folder chooser (IFileOpenDialog + FOS_PICKFOLDERS),
// with the classic FolderBrowserDialog as a fallback. `'@` must stay at column 0.
const WIN_SCRIPT = `$ErrorActionPreference = 'Stop'
$src = @'
using System;
using System.Runtime.InteropServices;
public static class BhFolderPicker {
  public static string Show(string title){
    IFileOpenDialog dialog = (IFileOpenDialog)new FileOpenDialog();
    dialog.SetOptions(FOS.PICKFOLDERS | FOS.FORCEFILESYSTEM);
    if (title != null) dialog.SetTitle(title);
    int hr = dialog.Show(IntPtr.Zero);
    if (hr < 0) return null;
    IShellItem item; dialog.GetResult(out item);
    string p; item.GetDisplayName(SIGDN.FILESYSPATH, out p);
    return p;
  }
  [ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")] private class FileOpenDialog {}
  [ComImport, Guid("d57c7288-d4ad-4768-be02-9d969532d960"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IFileOpenDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint c, IntPtr r);
    void SetFileTypeIndex(uint i);
    void GetFileTypeIndex(out uint i);
    void Advise(IntPtr p, out uint c);
    void Unadvise(uint c);
    void SetOptions(FOS fos);
    void GetOptions(out FOS fos);
    void SetDefaultFolder(IShellItem psi);
    void SetFolder(IShellItem psi);
    void GetFolder(out IShellItem ppsi);
    void GetCurrentSelection(out IShellItem ppsi);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void GetResult(out IShellItem ppsi);
  }
  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem ppsi);
    void GetDisplayName(SIGDN sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
    void GetAttributes(uint mask, out uint attribs);
    void Compare(IShellItem psi, uint hint, out int order);
  }
  [Flags] private enum FOS : uint { PICKFOLDERS = 0x20, FORCEFILESYSTEM = 0x40 }
  private enum SIGDN : uint { FILESYSPATH = 0x80058000 }
}
'@
try {
  Add-Type -TypeDefinition $src -Language CSharp | Out-Null
  $picked = [BhFolderPicker]::Show('Select a workspace folder')
  if ($picked) { [Console]::Out.Write($picked) }
} catch {
  Add-Type -AssemblyName System.Windows.Forms | Out-Null
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  $dlg.Description = 'Select a workspace folder'
  if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.SelectedPath) }
}
`

async function pickFolderWindows(): Promise<string | null> {
  const scriptPath = path.join(os.tmpdir(), 'blindhunter-folder-picker.ps1')
  await fs.writeFile(scriptPath, WIN_SCRIPT, 'utf8')
  const { out } = await run('powershell.exe', [
    '-STA',
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ])
  return out.trim() || null
}

/**
 * Open the host OS's native folder chooser and return the chosen absolute path
 * (or null if cancelled). Works when the server runs on the user's own machine.
 */
export async function pickFolderDialog(): Promise<string | null> {
  if (process.platform === 'win32') return pickFolderWindows()
  if (process.platform === 'darwin') {
    const { code, out } = await run('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Select a workspace folder")',
    ])
    return code === 0 ? out.trim() || null : null
  }
  // Linux: try zenity (GTK), then kdialog (KDE). Minimal distros (e.g. Kali) may have neither —
  // the in-app folder browser in the UI is the universal fallback that needs no native dialog.
  let r = await run('zenity', ['--file-selection', '--directory', '--title=Select a workspace folder'])
  if (r.code === 127) r = await run('kdialog', ['--getexistingdirectory', os.homedir()])
  return r.code === 0 ? r.out.trim() || null : null
}
