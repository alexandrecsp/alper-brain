// Run: node --test server/brain-files.test.mjs
// A brain's files, read and written over the server process driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { call, start, tokenOf } from './server-process.support.mjs'

// A brain folder holding `files` (path to text), listed by a fresh server; resolves with its port, id and folder.
const brainWith = async (files) => {
  const parent = mkdtempSync(join(tmpdir(), 'alper-brain-'))
  const path = join(parent, 'work')
  for (const [name, text] of Object.entries({ 'BRAIN.md': '# Brain\n', ...files })) {
    mkdirSync(dirname(join(path, name)), { recursive: true })
    writeFileSync(join(path, name), text)
  }
  const { port } = await start()
  const { id } = JSON.parse((await call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': await tokenOf(port) }, body: { path } })).body)
  return { port, id, path, parent }
}

const mtime = (path, name) => Math.floor(statSync(join(path, name)).mtimeMs)

test("file route returns a file's text", async () => {
  const { port, id } = await brainWith({ 'notes/shared/AREA.md': '# Area\n\nText with ünïcode.\n' })
  const res = await call(port, { path: `/api/brains/${id}/file?path=${encodeURIComponent('notes/shared/AREA.md')}` })
  assert.deepEqual({ status: res.status, body: res.body }, { status: 200, body: '# Area\n\nText with ünïcode.\n' })
})

test('file route answers 404 for a missing file', async () => {
  const { port, id } = await brainWith({})
  const res = await call(port, { path: `/api/brains/${id}/file?path=notes/none.md` })
  assert.equal(res.status, 404)
})

test('put writes the text and creates missing folders', async () => {
  const { port, id, path } = await brainWith({})
  const res = await call(port, {
    method: 'PUT',
    path: `/api/brains/${id}/file?path=${encodeURIComponent('.brain/.local/specs/002-new/milestones/m/001.md')}`,
    headers: { 'x-brain-token': await tokenOf(port) },
    text: '# New ünï\n',
  })
  const written = join(path, '.brain/.local/specs/002-new/milestones/m/001.md')
  assert.deepEqual({ status: res.status, text: existsSync(written) ? readFileSync(written, 'utf8') : null }, { status: 204, text: '# New ünï\n' })
})

test('a read of the file route with no path gets 400, not the file map', async () => {
  const { port, id } = await brainWith({ 'notes/shared/a.md': '# A\n' })
  const statuses = [
    (await call(port, { path: `/api/brains/${id}/file` })).status,
    (await call(port, { path: `/api/brains/${id}/file?path=` })).status,
  ]
  assert.deepEqual(statuses, [400, 400])
})

test("a path that leaves the brain's folder gets 400", async () => {
  const { port, id, parent } = await brainWith({})
  const token = await tokenOf(port)
  const at = (path) => `/api/brains/${id}/file?path=${encodeURIComponent(path)}`
  const outside = join(parent, 'outside.md')
  writeFileSync(outside, 'secret')
  const statuses = [
    (await call(port, { path: at('../outside.md') })).status,
    (await call(port, { path: at(outside) })).status,
    (await call(port, { method: 'PUT', path: at('../outside.md'), headers: { 'x-brain-token': token }, text: 'overwritten' })).status,
    (await call(port, { method: 'PUT', path: at('notes/../../new.md'), headers: { 'x-brain-token': token }, text: 'created' })).status,
  ]
  assert.deepEqual(
    { statuses, outside: readFileSync(outside, 'utf8'), created: existsSync(join(parent, 'new.md')) },
    { statuses: [400, 400, 400, 400], outside: 'secret', created: false },
  )
})

test("files route returns a clusters brain's specs with times, notes, drafts, cards and repos.json", async () => {
  const files = {
    '.brain/BRAIN.md': '# Brain\n',
    '.brain/.local/specs/001-a/spec.md': '# Spec\n',
    '.brain/.local/specs/001-a/milestones/m/001.md': '# Ticket\n',
    '.brain/notes/repos/app/a.md': '# A\n',
    '.brain/notes/shared/s.md': '# S\n',
    '.brain/.local/drafts/idea.md': '# Idea\n',
    '.brain/repos/app.md': '# Card\n',
    '.brain/.local/repos.json': '{"app":"/x"}',
    '.brain/notes/repos/app/image.png': 'not read',
    '.brain/.local/config.json': 'not read',
    '.brain/.local/snapshots/app/s.md': 'not read',
  }
  const { port, id, path } = await brainWith(files)
  const brain = join(path, '.brain')
  const { files: read, times } = JSON.parse((await call(port, { path: `/api/brains/${id}/files` })).body)
  assert.deepEqual(
    { files: read, times },
    {
      files: {
        '.local/specs/001-a/spec.md': '# Spec\n',
        '.local/specs/001-a/milestones/m/001.md': '# Ticket\n',
        'notes/repos/app/a.md': '# A\n',
        'notes/shared/s.md': '# S\n',
        '.local/drafts/idea.md': '# Idea\n',
        'repos/app.md': '# Card\n',
        '.local/repos.json': '{"app":"/x"}',
      },
      times: { '.local/specs/001-a/spec.md': mtime(brain, '.local/specs/001-a/spec.md'), '.local/specs/001-a/milestones/m/001.md': mtime(brain, '.local/specs/001-a/milestones/m/001.md') },
    },
  )
})

test('files route reads no research note, doc or file of an old layout', async () => {
  const { port, id } = await brainWith({
    '.brain/BRAIN.md': '# Brain\n',
    '.brain/notes/shared/s.md': '# S\n',
    '.brain/notes/research/r.md': '# R\n',
    '.brain/docs/repos/app/d.md': '# D\n',
    '.brain/docs/prototypes/p.md': '# P\n',
    '.brain/specs/001-a/spec.md': '# Spec\n',
    '.brain/notes/authored/a.md': '# A\n',
    '.brain/repos/app/REPO.md': '# Card\n',
  })
  const { files } = JSON.parse((await call(port, { path: `/api/brains/${id}/files` })).body)
  assert.deepEqual(files, { 'notes/shared/s.md': '# S\n' })
})
