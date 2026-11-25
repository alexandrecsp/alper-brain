import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const server = join(dirname(fileURLToPath(import.meta.url)), '../../server.mjs')
const READY_TIMEOUT_MS = 10000

// Starts `server.mjs` with `args` detached from this process, so it outlives the entry, and resolves with its port once it has
// written its own `{ pid, port, version, token }` to `server.json`. It rejects when the server exits first, as when another
// program takes the port. Port 0 asks for a free port.
export const detachedServerStarter = ({ record, args }) => ({ port }) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [server, ...args, '--port', String(port)], { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  const timer = setInterval(() => {
    const written = record.read()
    if (written?.pid === child.pid) done(resolve, written.port)
  }, 50)
  const giveUp = setTimeout(() => done(reject, new Error('the server did not become ready')), READY_TIMEOUT_MS)
  const done = (settle, value) => {
    clearInterval(timer)
    clearTimeout(giveUp)
    settle(value)
  }
  child.on('error', (e) => done(reject, e))
  child.on('exit', (code) => done(reject, new Error(`the server exited with code ${code}`)))
})
