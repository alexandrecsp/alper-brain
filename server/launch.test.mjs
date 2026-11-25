// Run: node --test server/launch.test.mjs
// The entry's launch, takeover and idle shutdown, over the server process driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { call, exitsWithin, freePort, run, start, tempHome } from './server-process.support.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const plugin = JSON.parse(readFileSync(join(here, '../.claude-plugin/plugin.json'), 'utf8'))

const tokenOf = async (port) => (await call(port)).body.match(/<meta name="brain-token" content="([^"]*)">/)[1]

test('a started server writes its pid, port, version and token to server.json', async () => {
  const home = tempHome()
  const { pid, port } = await start({ home })
  const written = JSON.parse(readFileSync(join(home, '.alper-brain', 'server.json'), 'utf8'))
  assert.deepEqual(written, { pid, port, version: plugin.version, token: await tokenOf(port) })
})

test('POST /shutdown with the token answers 204 and stops the server', async () => {
  const { pid, port } = await start()
  const res = await call(port, { method: 'POST', path: '/shutdown', headers: { 'x-brain-token': await tokenOf(port) } })
  assert.deepEqual({ status: res.status, exited: await exitsWithin(pid, 5000) }, { status: 204, exited: true })
})

test('the server exits after the idle time with no request', async () => {
  const { pid } = await start({ idle: 500 })
  assert.equal(await exitsWithin(pid, 5000), true)
})

test('a request restarts the idle time', async () => {
  const { pid, port } = await start({ idle: 1000 })
  await new Promise((r) => setTimeout(r, 600))
  await call(port, { path: '/health' })
  const exitedEarly = await exitsWithin(pid, 700)
  assert.deepEqual({ exitedEarly, exitedLater: await exitsWithin(pid, 5000) }, { exitedEarly: false, exitedLater: true })
})

const health = async (port) => JSON.parse((await call(port, { path: '/health' })).body)

test('an entry of the same version prints the running server\'s URL and exits with code 0', async () => {
  const home = tempHome()
  const port = await freePort()
  const first = await start({ home, port })
  const second = await run({ home, port })
  assert.deepEqual({ code: second.code, out: second.out.trim(), pid: (await health(port)).pid }, { code: 0, out: first.url, pid: first.pid })
})

test('an entry reuses a running server of a newer version', async () => {
  const home = tempHome()
  const port = await freePort()
  const first = await start({ home, port, pluginVersion: '99.0.0' })
  const second = await run({ home, port })
  assert.deepEqual({ code: second.code, out: second.out.trim(), health: await health(port) }, { code: 0, out: first.url, health: { name: 'alper-brain', version: '99.0.0', pid: first.pid } })
})

test('a newer entry stops an older running server and takes its port', async () => {
  const home = tempHome()
  const port = await freePort()
  const older = await start({ home, port, pluginVersion: '0.0.1' })
  const newer = await run({ home, port })
  const now = await health(port)
  assert.deepEqual(
    { code: newer.code, out: newer.out.trim(), olderGone: await exitsWithin(older.pid, 5000), version: now.version, replaced: now.pid !== older.pid },
    { code: 0, out: older.url, olderGone: true, version: plugin.version, replaced: true },
  )
})

test('an entry exits with code 1, naming the port, when another program holds it', async () => {
  const other = createHttpServer((req, res) => res.end('hello'))
  await new Promise((resolve) => other.listen(0, '127.0.0.1', resolve))
  const { port } = other.address()
  const res = await run({ home: tempHome(), port })
  other.close()
  assert.deepEqual({ code: res.code, out: res.out, names: res.err.includes(`port ${port}`) }, { code: 1, out: '', names: true })
})

test("an entry run with no --port starts the server on the port of the home's config.json", async () => {
  const home = tempHome()
  const port = await freePort()
  mkdirSync(join(home, '.alper-brain'))
  writeFileSync(join(home, '.alper-brain', 'config.json'), JSON.stringify({ port }))
  const { code, out } = await run({ home, port: null })
  assert.deepEqual({ code, port: Number(new URL(out.trim()).port) }, { code: 0, port })
})

test('an entry run with a port in config.json that is not a port exits 1 and says why', async () => {
  const home = tempHome()
  mkdirSync(join(home, '.alper-brain'))
  writeFileSync(join(home, '.alper-brain', 'config.json'), '{ "port": "abc" }')
  const { code, out, err } = await run({ home, port: null })
  assert.deepEqual({ code, out, said: /"port" must be a whole number/.test(err) }, { code: 1, out: '', said: true })
})

test('an entry on a newly configured port stops the server running on the old one', async () => {
  const home = tempHome()
  mkdirSync(join(home, '.alper-brain'))
  const config = (port) => writeFileSync(join(home, '.alper-brain', 'config.json'), JSON.stringify({ port }))
  config(await freePort())
  const first = await run({ home, port: null })
  const oldPid = JSON.parse(readFileSync(join(home, '.alper-brain', 'server.json'), 'utf8')).pid
  const port = await freePort()
  config(port)
  const second = await run({ home, port: null })
  assert.deepEqual(
    { codes: [first.code, second.code], port: Number(new URL(second.out.trim()).port), oldExited: await exitsWithin(oldPid, 5000) },
    { codes: [0, 0], port, oldExited: true },
  )
})
