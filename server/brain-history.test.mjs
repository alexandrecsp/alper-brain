// Run: node --test server/brain-history.test.mjs
// A brain's history, read from its git log over the server process driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { cloneAt } from './git-clone.support.mjs'
import { call, start, tokenOf } from './server-process.support.mjs'

const noteText = ({ type = 'decision', layer = 'business', status } = {}) =>
  `---\ntype: ${type}\nlayer: ${layer}\nrepos: [app]\n${status ? `status: ${status}\n` : ''}---\n# Note\n`

// A brain in its own git repository, listed by a fresh server. `write(path, text)` and `remove(path)` change a file of the brain,
// `move(from, to)` renames one, and `commit(title)` commits everything; each commit is a minute after the last.
const brainRepo = async ({ host = false } = {}) => {
  const top = join(mkdtempSync(join(tmpdir(), 'alper-history-')), 'work')
  const root = host ? top : join(top, '.brain')
  const brain = join(top, '.brain')
  const repo = cloneAt(root)
  const write = (path, text) => {
    mkdirSync(dirname(join(brain, path)), { recursive: true })
    writeFileSync(join(brain, path), text)
  }
  write('BRAIN.md', '# Brain\n')
  const commit = (title) => {
    repo.git('add', '-A')
    repo.git('commit', '-q', '-m', title)
    return repo.git('rev-parse', 'HEAD')
  }
  const { port } = await start()
  const { id } = JSON.parse((await call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': await tokenOf(port) }, body: { path: brain } })).body)
  const history = async () => {
    const { status, body } = await call(port, { path: `/api/brains/${id}/history` })
    return { status, json: JSON.parse(body) }
  }
  return {
    write, commit, history, port,
    remove: (path) => rmSync(join(brain, path)),
    move: (from, to) => { mkdirSync(dirname(join(brain, to)), { recursive: true }); renameSync(join(brain, from), join(brain, to)) },
  }
}

test("history route returns the timeline's shape for a brain in git", async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', noteText())
  const sha = b.commit('Records x')
  const { status, json } = await b.history()
  assert.deepEqual({ status, json }, {
    status: 200,
    json: {
      version: 1,
      commits: [{
        sha: sha.slice(0, 7),
        date: '2026-11-01T10:00:00Z',
        author: 'Ana',
        title: 'Records x',
        changes: [{ note: 'x', path: 'notes/repos/app/x.md', action: 'recorded', type: 'decision', layer: 'business', kind: 'authored', repos: ['app'] }],
      }],
    },
  })
})

test('a note is explored by its explored line, whatever its folder', async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', `---
type: feature
layer: business
explored: a1b2c3d
repos: [app]
---
# Note
`)
  b.write('notes/shared/y.md', noteText())
  b.commit('Records x and y')
  const { json } = await b.history()
  assert.deepEqual(json.commits[0].changes.map(({ path, kind }) => ({ path, kind })), [
    { path: 'notes/repos/app/x.md', kind: 'explored' },
    { path: 'notes/shared/y.md', kind: 'authored' },
  ])
})

// The actions of the history's last commit's changes.
const lastActions = async (b) => (await b.history()).json.commits.at(-1).changes.map(({ path, action, from }) => ({ path, action, ...(from ? { from } : {}) }))

test('a changed note is updated', async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', noteText())
  b.commit('Records x')
  b.write('notes/repos/app/x.md', noteText({ layer: 'application' }))
  b.commit('Changes x')
  assert.deepEqual(await lastActions(b), [{ path: 'notes/repos/app/x.md', action: 'updated' }])
})

test('a note set to superseded is superseded', async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', noteText())
  b.commit('Records x')
  b.write('notes/repos/app/x.md', noteText({ status: 'superseded' }))
  b.commit('Supersedes x')
  assert.deepEqual(await lastActions(b), [{ path: 'notes/repos/app/x.md', action: 'superseded' }])
})

test('a removed note is deleted', async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', noteText())
  b.commit('Records x')
  b.remove('notes/repos/app/x.md')
  b.commit('Removes x')
  const { json } = await b.history()
  assert.deepEqual(json.commits.at(-1).changes, [{ note: 'x', path: 'notes/repos/app/x.md', action: 'deleted', type: 'decision', layer: 'business', kind: 'authored', repos: ['app'] }])
})

test('a renamed note is moved and names its old path', async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', noteText())
  b.commit('Records x')
  b.move('notes/repos/app/x.md', 'notes/repos/app/y.md')
  b.commit('Renames x')
  assert.deepEqual(await lastActions(b), [{ path: 'notes/repos/app/y.md', action: 'moved', from: 'notes/repos/app/x.md' }])
})

test('a brain inside a host repository gets paths relative to the brain', async () => {
  const b = await brainRepo({ host: true })
  b.write('notes/repos/app/x.md', noteText())
  b.commit('Records x')
  const { json } = await b.history()
  assert.deepEqual(json.commits.map((c) => c.changes.map((x) => x.path)), [['notes/repos/app/x.md']])
})

test('a commit that changes no note is left out', async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', noteText())
  b.commit('Records x')
  b.write('repos/app.md', '# Card\n')
  b.write('.local/specs/001-a/spec.md', '# Spec\n')
  b.commit('Adds a card and a spec')
  const { json } = await b.history()
  assert.deepEqual(json.commits.map((c) => c.title), ['Records x'])
})

test('an unknown brain id answers 404', async () => {
  const b = await brainRepo()
  const res = await call(b.port, { path: '/api/brains/none/history' })
  assert.deepEqual({ status: res.status, body: JSON.parse(res.body) }, { status: 404, body: { error: 'no brain is listed under the id "none"' } })
})

test('a note committed later shows in the next answer', async () => {
  const b = await brainRepo()
  b.write('notes/repos/app/x.md', noteText())
  b.commit('Records x')
  await b.history()
  b.write('notes/repos/app/y.md', noteText())
  b.commit('Records y')
  const { json } = await b.history()
  assert.deepEqual(json.commits.map((c) => c.title), ['Records x', 'Records y'])
})

test('a note moved into notes/repos/ by the layout move is moved and names its old path', async () => {
  const b = await brainRepo()
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  b.move('notes/authored/x.md', 'notes/repos/app/x.md')
  b.commit('Moves the brain into the clusters layout')
  assert.deepEqual(await lastActions(b), [{ path: 'notes/repos/app/x.md', action: 'moved', from: 'notes/authored/x.md' }])
})

test("a note recorded before the layout move keeps its changes from before it", async () => {
  const b = await brainRepo()
  b.write('notes/authored/x.md', noteText())
  b.write('notes/exploration/app/e.md', noteText())
  b.commit('Records x and e')
  b.write('notes/authored/x.md', noteText({ layer: 'application' }))
  b.commit('Changes x')
  b.move('notes/authored/x.md', 'notes/repos/app/x.md')
  b.move('notes/exploration/app/e.md', 'notes/repos/app/e.md')
  b.commit('Moves the brain into the clusters layout')
  b.write('notes/repos/app/x.md', noteText({ layer: 'business' }))
  b.commit('Changes x again')
  const { json } = await b.history()
  assert.deepEqual(json.commits.map((c) => ({ title: c.title, changes: c.changes.map(({ path, action }) => ({ path, action })) })), [
    { title: 'Records x and e', changes: [{ path: 'notes/authored/x.md', action: 'recorded' }, { path: 'notes/exploration/app/e.md', action: 'recorded' }] },
    { title: 'Changes x', changes: [{ path: 'notes/authored/x.md', action: 'updated' }] },
    { title: 'Moves the brain into the clusters layout', changes: [{ path: 'notes/repos/app/e.md', action: 'moved' }, { path: 'notes/repos/app/x.md', action: 'moved' }] },
    { title: 'Changes x again', changes: [{ path: 'notes/repos/app/x.md', action: 'updated' }] },
  ])
})

test('a change shows the same layer for a feature stored with its layer line and one without', async () => {
  const b = await brainRepo()
  const feature = (layerLine) => `---\ntype: feature\n${layerLine}explored: a1b2c3d\nrepos: [app]\n---\n# Note\n`
  b.write('notes/repos/app/old.md', feature('layer: business\n'))
  b.write('notes/repos/app/new.md', feature(''))
  b.commit('Records old and new')
  const { json } = await b.history()
  assert.deepEqual(json.commits[0].changes.map(({ note, layer }) => ({ note, layer })), [
    { note: 'new', layer: 'business' },
    { note: 'old', layer: 'business' },
  ])
})
