// Run: node --test skills/brain/scripts/git-read.test.mjs
// Runs brain.html's GIT READER block in Node, over a directory-handle shim of a real clone, and checks what it reads
// against git's own answers: refs loose and packed, commits loose and from a pack with deltas, and the graph lanes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The working tree may hold CRLF line endings (git's core.autocrlf); the blocks are read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
const block = /\/\/ =+ GIT READER\n([\s\S]*?)<\/script>/.exec(html)[1]
const GitRead = new Function(`${block}\nreturn GitRead;`)()

// The File System Access API's directory handle, as much of it as the reader uses, over a folder on disk.
const fileHandle = (path, name) => ({ kind: 'file', name, getFile: async () => new File([readFileSync(path)], name, { lastModified: statSync(path).mtimeMs }) })
const dirHandle = (path, name = path) => ({
  kind: 'directory', name,
  async getDirectoryHandle(n) { const p = join(path, n); if (!statSync(p, { throwIfNoEntry: false })?.isDirectory()) throw new Error('NotFoundError'); return dirHandle(p, n) },
  async getFileHandle(n) { const p = join(path, n); if (!statSync(p, { throwIfNoEntry: false })?.isFile()) throw new Error('NotFoundError'); return fileHandle(p, n) },
  async *entries() { for (const e of readdirSync(path, { withFileTypes: true })) yield [e.name, e.isDirectory() ? dirHandle(join(path, e.name), e.name) : fileHandle(join(path, e.name), e.name)] },
})

// A clone with a fixed author, each commit a minute after the last (or all in one second, when sameTime).
const clone = ({ sameTime = false } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-git-read-'))
  let minute = 0
  const git = (...a) => {
    const date = `2026-11-01T10:${String(minute).padStart(2, '0')}:00+00:00`
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Ana', GIT_AUTHOR_EMAIL: 'ana@t', GIT_COMMITTER_NAME: 'Ana', GIT_COMMITTER_EMAIL: 'ana@t', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
    const r = spawnSync('git', ['-C', root, '-c', 'core.autocrlf=false', '-c', 'gc.auto=0', ...a], { encoding: 'utf8', env })
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}${r.stdout}`)
    return r.stdout.trim()
  }
  git('init', '-q', '-b', 'main')
  // a long shared message makes commits near-copies of each other, so a repack stores some as deltas
  const long = 'Context that every commit repeats, so the pack stores them as deltas. '.repeat(40)
  const commit = (title) => { writeFileSync(join(root, `${title.replace(/\W/g, '-')}.txt`), title); git('add', '-A'); git('commit', '-q', '-m', title, '-m', long); if (!sameTime) minute++; return git('rev-parse', 'HEAD') }
  return { root, git, commit }
}

// main with three commits; the spec's branch off it and a milestone branch off that; main moves on; the milestone is
// merged back into the spec's branch.
const history = (opts) => {
  const c = clone(opts)
  c.commit('one'); c.commit('two'); c.commit('three')
  c.git('checkout', '-q', '-b', 'sdd/001-x/spec')
  c.git('checkout', '-q', '-b', 'sdd/001-x/M001')
  c.commit('m1 a'); c.commit('m1 b')
  c.git('checkout', '-q', 'main'); c.commit('four')
  c.git('checkout', '-q', 'sdd/001-x/spec'); c.commit('spec setup')
  c.git('merge', '-q', '--no-ff', 'sdd/001-x/M001', '-m', 'merge m1')
  c.git('remote', 'add', 'origin', 'git@github.com:acme/x.git')
  return c
}

const gitLog = (c) => c.git('log', '--all', '--format=%H %ct %P|%s').split('\n').map((l) => {
  const [head, subject] = l.split('|'), [sha, time, ...parents] = head.split(' ')
  return { sha, time: Number(time) * 1000, parents: parents.filter(Boolean), subject }
})
const check = async (c) => {
  const repo = await GitRead.open(dirHandle(c.root))
  for (const want of gitLog(c)) {
    const got = await repo.commit(want.sha)
    assert.deepEqual({ sha: got.sha, time: got.time, parents: got.parents, subject: got.subject }, want)
    assert.equal(got.author, 'Ana')
  }
  return repo
}

test('reads every commit from loose objects as git log does', async () => { await check(history()) })

test('reads every commit from a pack whose commits are stored as deltas', async () => {
  const c = history()
  c.git('repack', '-adfq', '--window=50', '--depth=50')
  const pack = readdirSync(join(c.root, '.git/objects/pack')).find((f) => f.endsWith('.idx'))
  const deltas = c.git('verify-pack', '-v', join(c.root, '.git/objects/pack', pack)).split('\n').filter((l) => / commit .* [0-9a-f]{40}$/.test(l))
  assert.ok(deltas.length > 0, 'the repack stored no commit as a delta, so the delta path went untested')
  await check(c)
})

test('reads branches loose and packed, HEAD, and the origin url; sig moves when a branch does', async () => {
  const c = history()
  c.git('update-ref', 'refs/remotes/origin/main', c.git('rev-parse', 'main~1'))
  c.git('pack-refs', '--all')
  c.git('branch', 'loose-one', 'main')
  const repo = await GitRead.open(dirHandle(c.root))
  const r = await repo.refs()
  const want = c.git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes').split('\n').sort()
  assert.deepEqual(r.branches.map((b) => `${b.ref} ${b.sha}`).sort(), want)
  assert.deepEqual(r.head, { ref: 'refs/heads/sdd/001-x/spec', branch: 'sdd/001-x/spec', sha: c.git('rev-parse', 'HEAD') })
  assert.equal(r.branches.find((b) => b.name === 'origin/main').remote, true)
  assert.equal(await repo.remoteUrl(), 'git@github.com:acme/x.git')
  c.commit('five')
  assert.notEqual((await repo.refs()).sig, r.sig)
  assert.equal((await repo.refs()).sig, (await repo.refs()).sig)
})

test('walks the newest commits from the tips and lays them out in lanes', async () => {
  const c = history()
  const repo = await GitRead.open(dirHandle(c.root))
  const tips = ['main', 'sdd/001-x/spec', 'sdd/001-x/M001'].map((b) => c.git('rev-parse', b))
  const { commits, more } = await repo.walk(tips, 6)
  assert.equal(more, true)
  assert.deepEqual(commits.map((x) => x.subject), ['merge m1', 'spec setup', 'four', 'm1 b', 'm1 a', 'three'])
  const rows = GitRead.layout(commits)
  // each parent shown continues in the lane its column of out names, and each row's commit is in the lane above it
  rows.forEach((row, i) => {
    const shown = row.c.parents.filter((p) => commits.some((x) => x.sha === p))
    assert.deepEqual(row.parentCols.map((k) => row.out[k]), shown)
    if (i && rows[i - 1].out.includes(row.c.sha)) assert.equal(rows[i - 1].out[row.col], row.c.sha)
  })
  assert.equal(rows.at(-1).cut, true)
  assert.equal(rows[0].parentCols.length, 2)
})

test('puts every commit before its parents when they were made in the same second', async () => {
  const c = history({ sameTime: true })
  const repo = await GitRead.open(dirHandle(c.root))
  const { commits } = await repo.walk(['main', 'sdd/001-x/spec'].map((b) => c.git('rev-parse', b)), 80)
  assert.equal(commits.length, 8)
  const at = new Map(commits.map((x, i) => [x.sha, i]))
  for (const x of commits) for (const p of x.parents) assert.ok(at.get(p) > at.get(x.sha), `${x.subject} comes after its parent`)
})

test('finds where a branch forked, as git merge-base does', async () => {
  const c = history()
  const repo = await GitRead.open(dirHandle(c.root))
  const at = (r) => c.git('rev-parse', r)
  assert.equal(await repo.mergeBase(at('sdd/001-x/spec'), at('main')), c.git('merge-base', 'sdd/001-x/spec', 'main'))
  assert.equal(await repo.mergeBase(at('sdd/001-x/M001'), at('sdd/001-x/spec')), at('sdd/001-x/M001'))
  assert.equal(await repo.mergeBase(at('main'), at('main')), at('main'))
})

test('leaves out commits older than since, but those it keeps', async () => {
  const c = history()
  const repo = await GitRead.open(dirHandle(c.root))
  const fork = await repo.commit(c.git('merge-base', 'sdd/001-x/spec', 'main'))
  const { commits, more } = await repo.walk([c.git('rev-parse', 'sdd/001-x/spec'), c.git('rev-parse', 'main')], { since: fork.time + 1, keep: new Set([fork.sha]) })
  assert.deepEqual(commits.map((x) => x.subject), ['merge m1', 'spec setup', 'four', 'm1 b', 'm1 a', 'three'])
  assert.equal(more, true)
})

test('names a worktree and a folder with no git', async () => {
  const c = history()
  const wt = mkdtempSync(join(tmpdir(), 'brain-git-wt-'))
  c.git('worktree', 'add', '-q', join(wt, 'w'), 'main~1')
  await assert.rejects(GitRead.open(dirHandle(join(wt, 'w'))), /worktree/)
  await assert.rejects(GitRead.open(dirHandle(wt)), /no-git/)
})
