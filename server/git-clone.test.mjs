// Run: node --test server/git-clone.test.mjs
// A clone's refs, commits and remote url, read through the real `git` over the server process driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brainLinking, clone, cloneAt, gitReadOf, history, post, read, worktreeOf } from './git-clone.support.mjs'

const linked = (c) => brainLinking({ app: c.root })

test('refs returns the head and every local and remote-tracking branch that git lists', async () => {
  const c = history()
  const { status, json } = await read(await linked(c), 'app', 'refs')
  const listed = c.git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes').split('\n')
  assert.deepEqual(
    { status, head: json.head, branches: json.branches.map((b) => `${b.remote ? 'refs/remotes' : 'refs/heads'}/${b.name} ${b.sha}`).sort() },
    { status: 200, head: { branch: 'sdd/001-x/spec', sha: c.git('rev-parse', 'HEAD') }, branches: listed.sort() },
  )
})

const byName = (a, b) => (a.name < b.name ? -1 : 1)

test("refs equals GitRead's refs for the same clone", async () => {
  const c = history()
  const want = await (await gitReadOf(c.root)).refs()
  const { json } = await read(await linked(c), 'app', 'refs')
  assert.deepEqual(
    { head: json.head, branches: json.branches.sort(byName) },
    { head: { branch: want.head.branch, sha: want.head.sha }, branches: want.branches.map(({ name, sha, remote }) => ({ name, sha, remote })).sort(byName) },
  )
})

test("commit equals GitRead's commit for every commit of the clone, merges included", async () => {
  const c = history()
  const repo = await gitReadOf(c.root)
  const shas = c.git('log', '--all', '--format=%H').split('\n')
  const server = await linked(c)
  const got = []
  const want = []
  for (const sha of shas) {
    got.push((await read(server, 'app', `commit?sha=${sha}`)).json)
    want.push(await repo.commit(sha))
  }
  assert.deepEqual(got, want)
})

test('commit of a sha the clone lacks answers 404', async () => {
  const { status } = await read(await linked(history()), 'app', `commit?sha=${'0'.repeat(40)}`)
  assert.equal(status, 404)
})

test('sig changes after a new commit on the checked-out branch', async () => {
  const c = history()
  const server = await linked(c)
  const before = (await read(server, 'app', 'refs')).json.sig
  c.commit('five')
  assert.notEqual((await read(server, 'app', 'refs')).json.sig, before)
})

test('sig changes after a new commit on a branch that is not checked out', async () => {
  const c = history()
  const server = await linked(c)
  const before = (await read(server, 'app', 'refs')).json.sig
  c.git('checkout', '-q', 'loose-one')
  c.commit('five')
  c.git('checkout', '-q', 'sdd/001-x/spec')
  assert.notEqual((await read(server, 'app', 'refs')).json.sig, before)
})

test('sig stays the same while no ref moves', async () => {
  const server = await linked(history())
  assert.equal((await read(server, 'app', 'refs')).json.sig, (await read(server, 'app', 'refs')).json.sig)
})

// Whether the git on this machine can keep refs in a reftable (git 2.45 and later).
const reftable = spawnSync('git', ['init', '-q', '--ref-format=reftable', join(mkdtempSync(join(tmpdir(), 'alper-probe-')), 'r')], { windowsHide: true }).status === 0

// What git itself lists of a clone, in the shape the server answers.
const gitsAnswer = (c) => ({
  head: { branch: c.git('symbolic-ref', '--short', 'HEAD'), sha: c.git('rev-parse', 'HEAD') },
  commit: c.git('log', '-1', '--format=%H %P|%ct|%an|%s').split('|'),
})

test('a worktree clone answers refs and commit as git does', async () => {
  const wt = worktreeOf(history())
  const server = await linked(wt)
  const { head } = (await read(server, 'app', 'refs')).json
  const { json: commit } = await read(server, 'app', `commit?sha=${head.sha}`)
  const want = gitsAnswer(wt)
  assert.deepEqual(
    { head, commit: [`${commit.sha} ${commit.parents.join(' ')}`, String(commit.time / 1000), commit.author, commit.subject] },
    { head: want.head, commit: want.commit },
  )
})

test('a reftable clone answers refs and commit as git does', { skip: !reftable && 'this git cannot keep refs in a reftable' }, async () => {
  const c = clone({ init: ['init', '-q', '-b', 'main', '--ref-format=reftable'] })
  c.commit('one'); c.commit('two')
  c.git('branch', 'other')
  const server = await linked(c)
  const { head, branches } = (await read(server, 'app', 'refs')).json
  const { json: commit } = await read(server, 'app', `commit?sha=${head.sha}`)
  const want = gitsAnswer(c)
  assert.deepEqual(
    { head, branches: branches.map((b) => b.name).sort(), commit: [`${commit.sha} ${commit.parents.join(' ')}`, String(commit.time / 1000), commit.author, commit.subject] },
    { head: want.head, branches: ['main', 'other'], commit: want.commit },
  )
})

test('remote-url returns the origin url', async () => {
  const { json } = await read(await linked(history()), 'app', 'remote-url')
  assert.deepEqual(json, { url: 'git@github.com:acme/x.git' })
})

test('remote-url returns null for a clone without an origin', async () => {
  const c = clone()
  c.commit('one')
  const { json } = await read(await linked(c), 'app', 'remote-url')
  assert.deepEqual(json, { url: null })
})

test('an unlinked slug answers 404', async () => {
  const { status } = await read(await linked(history()), 'other', 'refs')
  assert.equal(status, 404)
})

test('a linked folder that is not a clone answers 422', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'alper-plain-'))
  const { status } = await read(await brainLinking({ app: folder }), 'app', 'refs')
  assert.equal(status, 422)
})

test('a linked folder inside a clone, not its top, answers 422', async () => {
  const c = history()
  mkdirSync(join(c.root, 'sub'))
  const { status } = await read(await brainLinking({ app: join(c.root, 'sub') }), 'app', 'commit?sha=' + c.git('rev-parse', 'HEAD'))
  assert.equal(status, 422)
})

// Every branch's tip and the HEAD, as the page names them to `walk`.
const tipsOf = (c) => [...new Set(c.git('for-each-ref', '--format=%(objectname)', 'refs/heads', 'refs/remotes').split('\n').concat(c.git('rev-parse', 'HEAD')))]

test("walk equals GitRead's walk for every branch tip and the default options", async () => {
  const c = history()
  const tips = tipsOf(c)
  const want = await (await gitReadOf(c.root)).walk(tips)
  const { status, json } = await post(await linked(c), 'app', 'walk', { tips })
  assert.deepEqual({ status, json }, { status: 200, json: want })
})

test("walk with a max below the history equals GitRead's walk and says there is more", async () => {
  const c = history()
  const tips = tipsOf(c)
  const want = await (await gitReadOf(c.root)).walk(tips, { max: 5 })
  const { json } = await post(await linked(c), 'app', 'walk', { tips, max: 5 })
  assert.deepEqual({ json, more: json.more }, { json: want, more: true })
})

test("walk with since and keep equals GitRead's walk, the kept older commit included", async () => {
  const c = history()
  const tips = tipsOf(c)
  const since = Date.parse('2026-11-01T10:03:00+00:00')
  const fork = c.git('rev-parse', 'main~1')
  const want = await (await gitReadOf(c.root)).walk(tips, { since, keep: new Set([fork]) })
  const { json } = await post(await linked(c), 'app', 'walk', { tips, since, keep: [fork] })
  assert.deepEqual({ json, kept: json.commits.some((x) => x.sha === fork), more: json.more }, { json: want, kept: true, more: true })
})

test('merge-base returns what git merge-base prints', async () => {
  const c = history()
  const [a, b] = [c.git('rev-parse', 'sdd/001-x/M001'), c.git('rev-parse', 'main')]
  const { status, json } = await read(await linked(c), 'app', `merge-base?a=${a}&b=${b}`)
  assert.deepEqual({ status, json }, { status: 200, json: { sha: c.git('merge-base', a, b) } })
})

test('merge-base of two unrelated histories returns null', async () => {
  const c = history()
  c.git('checkout', '-q', '--orphan', 'unrelated')
  const root = c.commit('alone')
  const { status, json } = await read(await linked(c), 'app', `merge-base?a=${root}&b=${c.git('rev-parse', 'main')}`)
  assert.deepEqual({ status, json }, { status: 200, json: { sha: null } })
})

test("refs of a clone named in a clusters brain's .local/repos.json are the clone's own", async () => {
  const c = history()
  const { status, json } = await read(await brainLinking({ app: c.root }), 'app', 'refs')
  assert.deepEqual({ status, head: json.head }, { status: 200, head: { branch: 'sdd/001-x/spec', sha: c.git('rev-parse', 'HEAD') } })
})
