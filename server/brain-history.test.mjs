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
  b.write('notes/authored/x.md', noteText())
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
        changes: [{ note: 'x', path: 'notes/authored/x.md', action: 'recorded', type: 'decision', layer: 'business', kind: 'authored', repos: ['app'] }],
      }],
    },
  })
})

// The actions of the history's last commit's changes.
const lastActions = async (b) => (await b.history()).json.commits.at(-1).changes.map(({ path, action, from }) => ({ path, action, ...(from ? { from } : {}) }))

test('a changed note is updated', async () => {
  const b = await brainRepo()
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  b.write('notes/authored/x.md', noteText({ layer: 'application' }))
  b.commit('Changes x')
  assert.deepEqual(await lastActions(b), [{ path: 'notes/authored/x.md', action: 'updated' }])
})

test('a note set to superseded is superseded', async () => {
  const b = await brainRepo()
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  b.write('notes/authored/x.md', noteText({ status: 'superseded' }))
  b.commit('Supersedes x')
  assert.deepEqual(await lastActions(b), [{ path: 'notes/authored/x.md', action: 'superseded' }])
})

test('a removed note is deleted', async () => {
  const b = await brainRepo()
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  b.remove('notes/authored/x.md')
  b.commit('Removes x')
  const { json } = await b.history()
  assert.deepEqual(json.commits.at(-1).changes, [{ note: 'x', path: 'notes/authored/x.md', action: 'deleted', type: 'decision', layer: 'business', kind: 'authored', repos: ['app'] }])
})

test('a renamed note is moved and names its old path', async () => {
  const b = await brainRepo()
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  b.move('notes/authored/x.md', 'notes/authored/y.md')
  b.commit('Renames x')
  assert.deepEqual(await lastActions(b), [{ path: 'notes/authored/y.md', action: 'moved', from: 'notes/authored/x.md' }])
})

test('a brain inside a host repository gets paths relative to the brain', async () => {
  const b = await brainRepo({ host: true })
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  const { json } = await b.history()
  assert.deepEqual(json.commits.map((c) => c.changes.map((x) => x.path)), [['notes/authored/x.md']])
})

test('a commit that changes no note is left out', async () => {
  const b = await brainRepo()
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  b.write('repos/app/REPO.md', '# Card\n')
  b.write('specs/001-a/spec.md', '# Spec\n')
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
  b.write('notes/authored/x.md', noteText())
  b.commit('Records x')
  await b.history()
  b.write('notes/authored/y.md', noteText())
  b.commit('Records y')
  const { json } = await b.history()
  assert.deepEqual(json.commits.map((c) => c.title), ['Records x', 'Records y'])
})
