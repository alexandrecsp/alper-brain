// Run: node --test server/brain-list.test.mjs
// The brain list, over the server process driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { call, start, stop } from './server-process.support.mjs'

// A folder named `name` under a fresh parent, holding a BRAIN.md unless `brain` is false.
const folder = (name, { brain = true } = {}) => {
  const path = join(mkdtempSync(join(tmpdir(), 'alper-brain-')), name)
  mkdirSync(path)
  if (brain) writeFileSync(join(path, 'BRAIN.md'), '# Brain\n')
  return path
}

// The write token the page is served with.
const tokenOf = async (port) => (await call(port)).body.match(/<meta name="brain-token" content="([^"]*)">/)[1]

const add = async (port, path) =>
  call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': await tokenOf(port) }, body: { path } })
const list = async (port) => JSON.parse((await call(port, { path: '/api/brains' })).body)

test('a brain added by path shows in the list with its folder name and status ok', async () => {
  const { port } = await start()
  const path = folder('work')
  const added = JSON.parse((await add(port, path)).body)
  assert.deepEqual(
    { entry: { name: added.name, path: added.path, status: added.status, id: typeof added.id }, list: await list(port) },
    { entry: { name: 'work', path, status: 'ok', id: 'string' }, list: [added] },
  )
})

test('adding a listed path again returns the first entry', async () => {
  const { port } = await start()
  const path = folder('work')
  const first = JSON.parse((await add(port, path)).body)
  const second = JSON.parse((await add(port, path)).body)
  assert.deepEqual({ second, list: await list(port) }, { second: first, list: [first] })
})

test('a removed brain is no longer listed', async () => {
  const { port } = await start()
  const kept = JSON.parse((await add(port, folder('kept'))).body)
  const gone = JSON.parse((await add(port, folder('gone'))).body)
  const res = await call(port, { method: 'DELETE', path: `/api/brains/${gone.id}`, headers: { 'x-brain-token': await tokenOf(port) } })
  assert.deepEqual({ status: res.status, list: await list(port) }, { status: 204, list: [kept] })
})

test('a folder without BRAIN.md is listed with status missing', async () => {
  const { port } = await start()
  const added = JSON.parse((await add(port, folder('empty', { brain: false }))).body)
  assert.deepEqual({ added: added.status, listed: (await list(port)).map((b) => b.status) }, { added: 'missing', listed: ['missing'] })
})

test('the list is the same after the server restarts', async () => {
  const first = await start()
  await add(first.port, folder('one'))
  await add(first.port, folder('two', { brain: false }))
  const before = await list(first.port)
  await stop(first)
  const second = await start({ home: first.home })
  assert.deepEqual({ count: before.length, after: await list(second.port) }, { count: 2, after: before })
})

test('two folders of one name get a number suffix', async () => {
  const { port } = await start()
  await add(port, folder('work'))
  await add(port, folder('work'))
  await add(port, folder('work'))
  assert.deepEqual((await list(port)).map((b) => b.name), ['work', 'work 2', 'work 3'])
})

test('a POST without an absolute path gets 400', async () => {
  const { port } = await start()
  const token = await tokenOf(port)
  const post = (body) => call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': token }, body })
  const statuses = [(await post({})).status, (await post({ path: 'work' })).status, (await post({ path: 42 })).status]
  assert.deepEqual({ statuses, list: await list(port) }, { statuses: [400, 400, 400], list: [] })
})

// A repository folder named `name` whose `.brain/` holds the BRAIN.md; resolves with the repository's path.
const repoWithBrain = (name) => {
  const path = join(mkdtempSync(join(tmpdir(), 'alper-brain-')), name)
  mkdirSync(join(path, '.brain'), { recursive: true })
  writeFileSync(join(path, '.brain', 'BRAIN.md'), '# Brain\n')
  return path
}

test('adding the repository of a new-layout brain lists one brain at its .brain folder', async () => {
  const { port } = await start()
  const repo = repoWithBrain('work')
  const added = JSON.parse((await add(port, repo)).body)
  assert.deepEqual(
    { entry: { name: added.name, path: added.path, status: added.status }, list: (await list(port)).map(({ name, path, status }) => ({ name, path, status })) },
    { entry: { name: 'work', path: join(repo, '.brain'), status: 'ok' }, list: [{ name: 'work', path: join(repo, '.brain'), status: 'ok' }] },
  )
})

test('adding the .brain folder itself lists the same brain, and adding the repository after it lists no second', async () => {
  const { port } = await start()
  const repo = repoWithBrain('work')
  const first = JSON.parse((await add(port, join(repo, '.brain'))).body)
  const second = JSON.parse((await add(port, repo)).body)
  assert.deepEqual(
    { second, list: await list(port) },
    { second: first, list: [{ ...first, path: join(repo, '.brain'), status: 'ok' }] },
  )
})

test('a listed old root whose brain moved into .brain lists at the .brain folder with status ok', async () => {
  const { port } = await start()
  const root = folder('work')
  await add(port, root)
  mkdirSync(join(root, '.brain'), { recursive: true })
  renameSync(join(root, 'BRAIN.md'), join(root, '.brain', 'BRAIN.md'))
  assert.deepEqual((await list(port)).map(({ name, path, status }) => ({ name, path, status })), [{ name: 'work', path: join(root, '.brain'), status: 'ok' }])
})
