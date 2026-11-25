// Run: node --test server/view-brain.test.mjs
// The entry's `--brain` option, over the server process driven over HTTP: what `/brain view` runs with the active brain.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { basename, dirname } from 'node:path'
import { call, freePort, run, tempBrain, tempHome } from './server-process.support.mjs'

const brainsOn = async (port) => JSON.parse((await call(port, { path: '/api/brains' })).body)

test('an entry run with --brain lists that brain and prints the URL that opens it', async () => {
  const brain = tempBrain()
  const res = await run({ home: tempHome(), brain })
  const port = Number(new URL(res.out.trim()).port)
  const [listed] = await brainsOn(port)
  assert.deepEqual(
    { code: res.code, url: res.out.trim(), listed: { name: listed.name, path: listed.path, status: listed.status } },
    { code: 0, url: `http://127.0.0.1:${port}/#/b/${listed.id}`, listed: { name: basename(dirname(brain)), path: brain, status: 'ok' } },
  )
})

test('a second entry run with the same brain reuses the running server and lists the brain once', async () => {
  const home = tempHome()
  const brain = tempBrain()
  const port = await freePort()
  const first = await run({ home, port, brain })
  const second = await run({ home, port, brain })
  assert.deepEqual({ codes: [first.code, second.code], urls: second.out, listed: (await brainsOn(port)).length }, { codes: [0, 0], urls: first.out, listed: 1 })
})

test('an entry run with --brain exits with a code other than 0 and prints no URL when another program holds the port', async () => {
  const other = createHttpServer((req, res) => res.end('hello'))
  await new Promise((resolve) => other.listen(0, '127.0.0.1', resolve))
  const res = await run({ home: tempHome(), port: other.address().port, brain: tempBrain() })
  other.close()
  assert.deepEqual({ failed: res.code !== 0, out: res.out }, { failed: true, out: '' })
})
