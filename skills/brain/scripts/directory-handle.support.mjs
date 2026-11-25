// Test support: the File System Access API's directory handle over a folder on disk, as much of it as the page's folder source uses.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// `permission` is what the browser answers about the folder: 'granted' or 'prompt'.
const fileHandle = (path, name) => ({
  kind: 'file', name,
  getFile: async () => new File([readFileSync(path)], name, { lastModified: Math.floor(statSync(path).mtimeMs) }),
  createWritable: async () => { let text = ''; return { write: async (t) => { text = t }, close: async () => writeFileSync(path, text) } },
})
export const dirHandle = (path, { permission = 'granted' } = {}, name = path) => {
  const opts = { permission }
  return {
    kind: 'directory', name,
    queryPermission: async () => opts.permission,
    requestPermission: async () => opts.permission,
    async getDirectoryHandle(n, { create } = {}) {
      const p = join(path, n)
      if (create) mkdirSync(p, { recursive: true })
      if (!statSync(p, { throwIfNoEntry: false })?.isDirectory()) throw new Error('NotFoundError')
      return dirHandle(p, opts, n)
    },
    async getFileHandle(n, { create } = {}) {
      const p = join(path, n)
      if (create && !statSync(p, { throwIfNoEntry: false })) writeFileSync(p, '')
      if (!statSync(p, { throwIfNoEntry: false })?.isFile()) throw new Error('NotFoundError')
      return fileHandle(p, n)
    },
    async *entries() { for (const e of readdirSync(path, { withFileTypes: true })) yield [e.name, e.isDirectory() ? dirHandle(join(path, e.name), opts, e.name) : fileHandle(join(path, e.name), e.name)] },
  }
}
