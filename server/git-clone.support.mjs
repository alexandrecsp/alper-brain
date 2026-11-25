// Test support: real temporary clones for the git tests, and `GitRead` (the page's reader, run in Node) to compare the server's answers with.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, start, tempBrain, tokenOf } from './server-process.support.mjs'

// The working tree may hold CRLF line endings (git's core.autocrlf); the block is read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'brain', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
const block = /\/\/ =+ GIT READER\n([\s\S]*?)<\/script>/.exec(html)[1]
export const GitRead = new Function(`${block}\nreturn GitRead;`)()

// The File System Access API's directory handle, as much of it as `GitRead` uses, over a folder on disk.
const fileHandle = (path, name) => ({ kind: 'file', name, getFile: async () => new File([readFileSync(path)], name, { lastModified: statSync(path).mtimeMs }) })
const dirHandle = (path, name = path) => ({
  kind: 'directory', name,
  async getDirectoryHandle(n) { const p = join(path, n); if (!statSync(p, { throwIfNoEntry: false })?.isDirectory()) throw new Error('NotFoundError'); return dirHandle(p, n) },
  async getFileHandle(n) { const p = join(path, n); if (!statSync(p, { throwIfNoEntry: false })?.isFile()) throw new Error('NotFoundError'); return fileHandle(p, n) },
  async *entries() { for (const e of readdirSync(path, { withFileTypes: true })) yield [e.name, e.isDirectory() ? dirHandle(join(path, e.name), e.name) : fileHandle(join(path, e.name), e.name)] },
})

// `GitRead`'s repo object for a plain clone at `root`.
export const gitReadOf = (root) => GitRead.open(dirHandle(root))

// A clone at `root` with a fixed author, each commit a minute after the last. `git(...)` runs git in it; `commit(title)` commits a new file.
export const cloneAt = (root, { init = ['init', '-q', '-b', 'main'] } = {}) => {
  let minute = 0
  const git = (...a) => {
    const date = `2026-11-01T10:${String(minute).padStart(2, '0')}:00+00:00`
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Ana', GIT_AUTHOR_EMAIL: 'ana@t', GIT_COMMITTER_NAME: 'Ana', GIT_COMMITTER_EMAIL: 'ana@t', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
    const r = spawnSync('git', ['-C', root, '-c', 'core.autocrlf=false', '-c', 'gc.auto=0', ...a], { encoding: 'utf8', env, windowsHide: true })
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}${r.stdout}`)
    return r.stdout.trim()
  }
  mkdirSync(root, { recursive: true })
  git(...init)
  const commit = (title) => {
    writeFileSync(join(root, `${title.replace(/\W/g, '-')}.txt`), title)
    git('add', '-A')
    git('commit', '-q', '-m', title)
    minute++
    return git('rev-parse', 'HEAD')
  }
  return { root, git, commit }
}

export const clone = (opts) => cloneAt(mkdtempSync(join(tmpdir(), 'alper-clone-')), opts)

// A worktree of `c`, on its own branch with its own commit.
export const worktreeOf = (c) => {
  const path = join(mkdtempSync(join(tmpdir(), 'alper-worktree-')), 'wt')
  c.git('worktree', 'add', '-q', '-b', 'wt-branch', path)
  const wt = cloneAt(path, { init: ['status', '-s'] })
  wt.commit('in worktree')
  return wt
}

// main with three commits; the spec's branch off it and a milestone branch off that; main moves on; the milestone is merged back
// into the spec's branch. An origin remote and a remote-tracking branch, with the refs packed, and one loose branch after.
export const history = (opts) => {
  const c = clone(opts)
  c.commit('one'); c.commit('two'); c.commit('three')
  c.git('checkout', '-q', '-b', 'sdd/001-x/spec')
  c.git('checkout', '-q', '-b', 'sdd/001-x/M001')
  c.commit('m1 a'); c.commit('m1 b')
  c.git('checkout', '-q', 'main'); c.commit('four')
  c.git('checkout', '-q', 'sdd/001-x/spec'); c.commit('spec setup')
  c.git('merge', '-q', '--no-ff', 'sdd/001-x/M001', '-m', 'merge m1')
  c.git('remote', 'add', 'origin', 'git@github.com:acme/x.git')
  c.git('update-ref', 'refs/remotes/origin/main', c.git('rev-parse', 'main~1'))
  c.git('pack-refs', '--all')
  c.git('branch', 'loose-one', 'main')
  return c
}

// A `.brain/` folder whose `repos/repos.json` links `repos` (slug to clone path), listed by a fresh server; resolves with its port and id.
export const brainLinking = async (repos) => {
  const path = tempBrain(repos)
  const { port } = await start()
  const { id } = JSON.parse((await call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': await tokenOf(port) }, body: { path } })).body)
  return { port, id }
}

// The JSON a git read answers, with its status.
export const read = async ({ port, id }, slug, route) => {
  const { status, body } = await call(port, { path: `/api/brains/${id}/repos/${slug}/${route}` })
  return { status, json: body ? JSON.parse(body) : undefined }
}

// The JSON a write to a git route answers, with its status.
export const post = async ({ port, id }, slug, route, body) => {
  const { status, body: text } = await call(port, { method: 'POST', path: `/api/brains/${id}/repos/${slug}/${route}`, headers: { 'x-brain-token': await tokenOf(port) }, body })
  return { status, json: text ? JSON.parse(text) : undefined }
}
