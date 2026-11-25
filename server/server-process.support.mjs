// Test support: runs the server's entry as `/brain view` runs it, and calls the server it leaves running over HTTP.
import { after } from 'node:test'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// Every server a test started, so none outlives the run: the entry leaves its server detached.
const started = new Set()
after(() => started.forEach((pid) => { try { process.kill(pid) } catch { /* already gone */ } }))

// A port nothing listens on now.
export const freePort = () => new Promise((resolve) => {
  const s = createServer()
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => resolve(port))
  })
})

// The `.brain/` folder of a repository, holding the `BRAIN.md` and, when `repos` (slug to clone path) is given, `repos/repos.json`.
export const tempBrain = (repos) => {
  const path = join(mkdtempSync(join(tmpdir(), 'alper-brain-')), 'work', '.brain')
  mkdirSync(join(path, 'repos'), { recursive: true })
  writeFileSync(join(path, 'BRAIN.md'), '# Brain\n')
  if (repos) writeFileSync(join(path, 'repos', 'repos.json'), JSON.stringify(repos))
  return path
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A fresh folder to stand for the user's home, so no test reads or writes the real `~/.alper-brain/`.
export const tempHome = () => mkdtempSync(join(tmpdir(), 'alper-home-'))

// Runs the entry to its exit, and resolves with its exit code and what it printed; the server it leaves running is stopped at the
// end of the run. `port` 0 asks for a free port, and `null` leaves `--port` out, so the entry takes the port from the home's config; `idle` is
// the server's idle time in milliseconds; `pluginVersion` makes the server answer as another version of the plugin; `watch: 'poll'`
// turns recursive watching off, so the server rereads each brain on a timer; `brain` is the path the entry adds to the server's list.
export const run = ({ home, port = 0, idle, pluginVersion, watch, brain } = {}) => new Promise((resolve, reject) => {
  const args = [join(here, 'main.mjs'), ...(port === null ? [] : ['--port', String(port)]), '--home', home]
  if (idle !== undefined) args.push('--idle', String(idle))
  if (pluginVersion !== undefined) args.push('--plugin-version', pluginVersion)
  if (watch !== undefined) args.push('--watch', watch)
  if (brain !== undefined) args.push('--brain', brain)
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const timer = setTimeout(() => { child.kill(); reject(new Error('the entry did not exit within 15 seconds')) }, 15000)
  let out = ''
  let err = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (err += d))
  child.on('error', reject)
  child.on('close', (code) => {
    clearTimeout(timer)
    if (code === 0) started.add(JSON.parse(readFileSync(join(home, '.alper-brain', 'server.json'), 'utf8')).pid)
    resolve({ code, out, err })
  })
})

// Runs the entry and takes the server it leaves running: its url, port and pid, the pid from its own `/health`.
export const start = async ({ home = tempHome(), ...options } = {}) => {
  const { code, out, err } = await run({ home, ...options })
  if (code !== 0) throw new Error(`the entry exited with ${code}: ${err}`)
  const url = out.trim()
  const port = Number(new URL(url).port)
  const { pid } = JSON.parse((await call(port, { path: '/health' })).body)
  started.add(pid)
  return { url, port, pid, home }
}

export const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Resolves with whether the process `pid` has exited within `ms`.
export const exitsWithin = async (pid, ms) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (!alive(pid)) return true
    await sleep(50)
  }
  return !alive(pid)
}

// Stops a server started by `start` and resolves once it has exited.
export const stop = async ({ pid }) => {
  process.kill(pid)
  await exitsWithin(pid, 5000)
}

// node:http, since fetch cannot set the Host header. `body` is sent as JSON, `text` as it is.
export const call = (port, { method = 'GET', path = '/', headers = {}, body, text } = {}) => new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port, method, path, headers, agent: false }, (res) => {
    let out = ''
    res.on('data', (d) => (out += d))
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: out }))
  })
  req.on('error', reject)
  req.end(text ?? (body === undefined ? undefined : JSON.stringify(body)))
})

// The write token the page is served with.
export const tokenOf = async (port) => (await call(port)).body.match(/<meta name="brain-token" content="([^"]*)">/)[1]

// Opens `GET /api/events` and resolves once the server has answered. `next(ms)` resolves with the data of the next `change` event
// that no call has taken yet, and rejects when none comes within `ms`; `received()` is every one that has come; `close()` ends it.
export const events = (port) => new Promise((resolve, reject) => {
  const arrived = []
  let taken = 0
  let wake = () => {}
  const req = request({ host: '127.0.0.1', port, path: '/api/events', agent: false }, (res) => {
    let buffer = ''
    res.setEncoding('utf8')
    res.on('data', (d) => {
      buffer += d
      for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
        const frame = buffer.slice(0, end).split('\n')
        buffer = buffer.slice(end + 2)
        const data = frame.find((l) => l.startsWith('data: '))
        if (frame.includes('event: change') && data) arrived.push(JSON.parse(data.slice(6)))
      }
      wake()
    })
    res.on('error', () => {})
    resolve({
      status: res.statusCode,
      received: () => [...arrived],
      close: () => req.destroy(),
      next: async (ms = 5000) => {
        const end = Date.now() + ms
        while (taken >= arrived.length) {
          const left = end - Date.now()
          if (left <= 0) throw new Error(`no change event within ${ms} ms`)
          await new Promise((r) => { wake = r; setTimeout(r, left) })
        }
        return arrived[taken++]
      },
    })
  })
  req.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e) })
  req.end()
})
