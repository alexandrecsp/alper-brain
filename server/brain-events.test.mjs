// Run: node --test server/brain-events.test.mjs
// A brain's changes on disk, arriving over SSE, over the server process driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { alive, call, events, exitsWithin, start, tokenOf } from './server-process.support.mjs'

// A brain folder holding `files` (path to text), listed by a fresh server started with `options`.
const brainWith = async (files, options) => {
  const path = join(mkdtempSync(join(tmpdir(), 'alper-brain-')), 'work')
  const put = (name, text) => {
    mkdirSync(dirname(join(path, name)), { recursive: true })
    writeFileSync(join(path, name), text)
  }
  for (const [name, text] of Object.entries({ 'BRAIN.md': '# Brain\n', ...files })) put(name, text)
  const server = await start(options)
  const { id } = JSON.parse((await call(server.port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': await tokenOf(server.port) }, body: { path } })).body)
  return { ...server, id, path, put }
}

test('a file written on disk arrives as a change event with its new text', async () => {
  const { port, id, put } = await brainWith({ 'notes/a.md': '# A\n' })
  const stream = await events(port)
  put('notes/a.md', '# A, changed\n')
  assert.deepEqual(await stream.next(), { brain: id, changed: { 'notes/a.md': '# A, changed\n' }, times: {} })
})

test('a file deleted on disk arrives as a change event with null', async () => {
  const { port, id, path } = await brainWith({ 'notes/a.md': '# A\n', 'notes/b.md': '# B\n' })
  const stream = await events(port)
  rmSync(join(path, 'notes/a.md'))
  assert.deepEqual(await stream.next(), { brain: id, changed: { 'notes/a.md': null }, times: {} })
})

test('the files route returns the changed file after its event', async () => {
  const { port, id, put } = await brainWith({ 'notes/a.md': '# A\n' })
  const stream = await events(port)
  put('notes/new.md', '# New\n')
  await stream.next()
  const { files } = JSON.parse((await call(port, { path: `/api/brains/${id}/files` })).body)
  assert.deepEqual(files, { 'notes/a.md': '# A\n', 'notes/new.md': '# New\n' })
})

test("a changed spec file's event carries its time", async () => {
  const { port, id, path, put } = await brainWith({})
  const stream = await events(port)
  put('specs/001-a/spec.md', '# Spec\n')
  const event = await stream.next()
  const time = Math.floor(statSync(join(path, 'specs/001-a/spec.md')).mtimeMs)
  assert.deepEqual(event, { brain: id, changed: { 'specs/001-a/spec.md': '# Spec\n' }, times: { 'specs/001-a/spec.md': time } })
})

test('changes that land close together, each shortly after the last, arrive in one event', async () => {
  const { port, id, put } = await brainWith({})
  const stream = await events(port)
  for (const name of ['a', 'b', 'c']) {
    put(`notes/${name}.md`, `# ${name}\n`)
    await new Promise((r) => setTimeout(r, 60))
  }
  const first = await stream.next()
  await new Promise((r) => setTimeout(r, 700))
  const changed = { 'notes/a.md': '# a\n', 'notes/b.md': '# b\n', 'notes/c.md': '# c\n' }
  assert.deepEqual({ first, count: stream.received().length }, { first: { brain: id, changed, times: {} }, count: 1 })
})

test('with recursive watching off, a file written on disk arrives as a change event', async () => {
  const { port, id, put } = await brainWith({ 'notes/a.md': '# A\n' }, { watch: 'poll' })
  const stream = await events(port)
  put('notes/a.md', '# A, changed\n')
  assert.deepEqual(await stream.next(6000), { brain: id, changed: { 'notes/a.md': '# A, changed\n' }, times: {} })
})

test('with recursive watching off, a file deleted on disk arrives as a change event with null', async () => {
  const { port, id, path } = await brainWith({ 'notes/a.md': '# A\n', 'notes/b.md': '# B\n' }, { watch: 'poll' })
  const stream = await events(port)
  rmSync(join(path, 'notes/a.md'))
  assert.deepEqual(await stream.next(6000), { brain: id, changed: { 'notes/a.md': null }, times: {} })
})

test('the server stays up past the idle time while an SSE connection is open', async () => {
  const { port, pid } = await brainWith({}, { idle: 500 })
  const stream = await events(port)
  await new Promise((r) => setTimeout(r, 1500))
  assert.deepEqual({ alive: alive(pid), health: (await call(port, { path: '/health' })).status }, { alive: true, health: 200 })
  stream.close()
})

test('the server exits after the idle time once the SSE connection closes', async () => {
  const { port, pid } = await brainWith({}, { idle: 500 })
  const stream = await events(port)
  stream.close()
  assert.equal(await exitsWithin(pid, 3000), true)
})

test("a write under locks, explore or a repo's snapshots sends no change event", async () => {
  const { port, id, put } = await brainWith({
    '.brain/BRAIN.md': '# Brain\n',
    '.brain/.gitignore': 'locks/\nexplore/\nrepos/*/snapshots/\n',
    '.brain/repos/app/REPO.md': '# Card\n',
  })
  const stream = await events(port)
  put('.brain/locks/build.md', 'held\n')
  put('.brain/explore/app/area/n.md', 'scratch\n')
  put('.brain/repos/app/snapshots/s.md', 'snapshot\n')
  await new Promise((r) => setTimeout(r, 700))
  put('.brain/notes/authored/a.md', '# A\n')
  const first = await stream.next()
  await new Promise((r) => setTimeout(r, 300))
  assert.deepEqual({ first, count: stream.received().length }, { first: { brain: id, changed: { 'notes/authored/a.md': '# A\n' }, times: {} }, count: 1 })
})
