// Run: node --test server/main.test.mjs
// The server process, started by its entry as `/brain view` starts it and driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { connect } from 'node:net'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, exitsWithin, start } from './server-process.support.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const plugin = JSON.parse(readFileSync(join(here, '../.claude-plugin/plugin.json'), 'utf8'))
const page = readFileSync(join(here, '../skills/brain/brain.html'), 'utf8')

test('GET /health answers the name, the plugin version and the server pid', async () => {
  const { pid, port } = await start()
  const res = await call(port, { path: '/health' })
  assert.deepEqual(JSON.parse(res.body), { name: 'alper-brain', version: plugin.version, pid })
})

// Resolves with the error code of a TCP connect, or 'connected'.
const tryConnect = (host, port) => new Promise((resolve) => {
  const s = connect({ host, port, timeout: 2000 })
  s.on('connect', () => { s.destroy(); resolve('connected') })
  s.on('timeout', () => { s.destroy(); resolve('timeout') })
  s.on('error', (e) => resolve(e.code))
})

test('the pid /health answers is the server process: stopping that process closes the port', async () => {
  const { port } = await start()
  const { pid } = JSON.parse((await call(port, { path: '/health' })).body)
  process.kill(pid)
  await exitsWithin(pid, 5000)
  // Windows frees a killed process's listening socket a moment after the process is gone.
  let last = await tryConnect('127.0.0.1', port)
  const end = Date.now() + 3000
  while (last === 'connected' && Date.now() < end) last = await tryConnect('127.0.0.1', port)
  assert.equal(last, 'ECONNREFUSED')
})

test('refuses a connection on ::1 and on every non-loopback address of this machine', async () => {
  const { port } = await start()
  const others = ['::1', ...Object.values(networkInterfaces()).flat().filter((a) => !a.internal).map((a) => a.address)]
  const results = await Promise.all(others.map((a) => tryConnect(a, port)))
  assert.deepEqual(results.filter((r) => r === 'connected'), [])
})

test('a foreign Host header gets 403', async () => {
  const { port } = await start()
  const res = await call(port, { path: '/health', headers: { host: `evil.example:${port}` } })
  assert.equal(res.status, 403)
})

test('Host 127.0.0.1:<port> and localhost:<port> are served', async () => {
  const { port } = await start()
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`]
  const statuses = await Promise.all(hosts.map((host) => call(port, { path: '/health', headers: { host } }).then((r) => r.status)))
  assert.deepEqual(statuses, [200, 200])
})

const tokenOf = (html) => html.match(/<meta name="brain-token" content="([^"]*)">/)?.[1]

test('GET / serves brain.html with the token written into it', async () => {
  const { port } = await start()
  const res = await call(port)
  assert.deepEqual(
    { status: res.status, type: res.headers['content-type'], page: res.body.includes('<title>Brain</title>'), token: (tokenOf(res.body) ?? '').length >= 32 },
    { status: 200, type: 'text/html; charset=utf-8', page: true, token: true },
  )
})

test('each start writes a different token', async () => {
  const [a, b] = await Promise.all([start(), start()])
  const [pa, pb] = await Promise.all([call(a.port), call(b.port)])
  assert.notEqual(tokenOf(pa.body), tokenOf(pb.body))
})

test('no response carries a CORS header', async () => {
  const { port } = await start()
  const responses = [
    await call(port),
    await call(port, { path: '/health', headers: { origin: 'https://evil.example' } }),
    await call(port, { path: '/health', headers: { host: 'evil.example' } }),
    await call(port, { method: 'OPTIONS', path: '/health', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } }),
  ]
  assert.deepEqual(responses.flatMap((r) => Object.keys(r.headers).filter((h) => h.startsWith('access-control-'))), [])
})

test('POST, PUT and DELETE without a token get 403', async () => {
  const { port } = await start()
  const statuses = await Promise.all(['POST', 'PUT', 'DELETE'].map((method) => call(port, { method, path: '/api/brains' }).then((r) => r.status)))
  assert.deepEqual(statuses, [403, 403, 403])
})

test('a write with a wrong token gets 403', async () => {
  const { port } = await start()
  const res = await call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': 'wrong' } })
  assert.equal(res.status, 403)
})

test("a write with the page's token is past the token check", async () => {
  const { port } = await start()
  const token = tokenOf((await call(port)).body)
  const res = await call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': token } })
  assert.notEqual(res.status, 403)
})

test('every server file imports only node: modules and its own files', () => {
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.mjs') ? [join(dir, e.name)] : [])
  const specifiers = files(here).flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => `${f.slice(here.length + 1)}: ${m[1]}`))
  assert.deepEqual(specifiers.filter((s) => !/: (node:|\.)/.test(s)), [])
})

// The server runs detached with no console, so a child process it starts opens a console window of its own on Windows unless it is hidden.
test('every process a server file starts sets windowsHide: true', () => {
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.mjs') && !e.name.endsWith('.test.mjs') ? [join(dir, e.name)] : [])
  // the text of a call's arguments, from its opening parenthesis to the matching one
  const argumentsAt = (text, open) => {
    let depth = 0
    for (let i = open; i < text.length; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')' && --depth === 0) return text.slice(open, i + 1)
    }
    return text.slice(open)
  }
  const unhidden = files(here).flatMap((f) => {
    const text = readFileSync(f, 'utf8')
    return [...text.matchAll(/(?<![.\w])(?:spawn|spawnSync|execFile|execFileSync|exec|execSync|fork)\(/g)]
      .filter((m) => !/windowsHide:\s*true/.test(argumentsAt(text, m.index + m[0].length - 1)))
      .map((m) => `${f.slice(here.length + 1)}:${text.slice(0, m.index).split('\n').length}: ${m[0]}`)
  })
  assert.deepEqual(unhidden, [])
})
