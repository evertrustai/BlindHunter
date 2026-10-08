import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface DirEntry {
  name: string
  type: 'dir' | 'file'
  path: string
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
