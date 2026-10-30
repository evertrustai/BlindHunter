import { promises as fs, realpathSync } from 'node:fs'
import path from 'node:path'
import { HOME } from '../config/paths.js'

export interface DirEntry {
  name: string
  type: 'dir' | 'file'
  path: string
}

/** Resolve to a real location, following symlinks; for a not-yet-existing path, resolve the
 *  nearest existing ancestor and re-append the rest (so a symlink anywhere is honored). */
function canonicalize(abs: string): string {
  try {
    return realpathSync(abs)
  } catch {
    const parent = path.dirname(abs)
    if (parent === abs) return abs
    return path.join(canonicalize(parent), path.basename(abs))
  }
}

/**
 * Reject any path inside BlindHunter's own config dir (~/.blindhunter holds credentials,
 * settings, transcripts). Mirrors the agent file-tool guard in registry.ts so the file-viewer
 * API can't be used to read stored secrets either. Canonicalized to defeat symlink escapes.
 */
export function assertOutsideConfig(p: string): void {
  const home = canonicalize(path.resolve(HOME))
  const target = canonicalize(path.resolve(p))
  const rel = path.relative(home, target)
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error('access denied: the BlindHunter config directory is off-limits')
  }
}

export async function readFile(p: string): Promise<string> {
  return fs.readFile(p, 'utf8')
}

export async function writeFile(p: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, content, 'utf8')
}

export async function editFile(p: string, oldStr: string, newStr: string): Promise<void> {
  const content = await fs.readFile(p, 'utf8')
  if (!content.includes(oldStr)) throw new Error('old_string not found in file')
  await fs.writeFile(p, content.replace(oldStr, newStr), 'utf8')
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif', '.svg'])
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}
/** Largest text file we'll load into the viewer (bytes); bigger files are truncated. */
export const MAX_VIEW_BYTES = 2_000_000

export function isImagePath(p: string): boolean {
  return IMAGE_EXT.has(path.extname(p).toLowerCase())
}
export function mimeFor(p: string): string {
  return MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream'
}

export interface FileView {
  path: string
  name: string
  kind: 'text' | 'image' | 'binary'
  size: number
  truncated: boolean
  content?: string
}

/** Read a file for the viewer: text (capped), an image marker, or a binary marker. */
export async function readForView(p: string): Promise<FileView> {
  const st = await fs.stat(p)
  if (!st.isFile()) throw new Error('not a file')
  const name = path.basename(p)
  if (isImagePath(p)) return { path: p, name, kind: 'image', size: st.size, truncated: false }

  const fh = await fs.open(p, 'r')
  try {
    const cap = Math.min(st.size, MAX_VIEW_BYTES)
    const buf = Buffer.alloc(cap)
    const { bytesRead } = await fh.read(buf, 0, cap, 0)
    const slice = buf.subarray(0, bytesRead)
    // A NUL byte in the head is a reliable "this is binary" signal.
    if (slice.includes(0)) return { path: p, name, kind: 'binary', size: st.size, truncated: false }
    return { path: p, name, kind: 'text', size: st.size, truncated: st.size > cap, content: slice.toString('utf8') }
  } finally {
    await fh.close()
  }
}

export async function listDir(dir: string): Promise<DirEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .map<DirEntry>((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      path: path.join(dir, e.name),
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
}
