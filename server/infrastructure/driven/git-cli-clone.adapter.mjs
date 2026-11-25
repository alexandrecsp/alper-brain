import { execFile, spawn } from 'node:child_process'
import { walkCommits } from '../../application/services/walk-commits.service.mjs'
import { NotACloneError } from '../../domain/errors/not-a-clone.error.mjs'

const FULL_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/

// What git sees of the environment: none of the variables that would point it at another repository.
const gitEnv = () => {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...env } = process.env
  return env
}

// Runs `git -C <path> <args>`; resolves with its trimmed output, or null when it exits non-zero.
const git = (path, args) => new Promise((resolve) => {
  const env = gitEnv()
  execFile('git', ['-C', path, ...args], { encoding: 'utf8', windowsHide: true, env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => resolve(error ? null : stdout.trim()))
})

// A commit as `GitRead` gives it, from the commit object's own text.
const parseCommit = (sha, text) => {
  const cut = text.indexOf('\n\n')
  const commit = { sha, parents: [], author: '', time: 0, subject: cut < 0 ? '' : text.slice(cut + 2).split('\n')[0].trim() }
  for (const line of text.slice(0, cut < 0 ? text.length : cut).split('\n')) {
    if (line.startsWith('parent ')) commit.parents.push(line.slice(7).trim())
    else if (line.startsWith('author ')) commit.author = (/^author (.*?) </.exec(line) || [])[1] || ''
    else if (line.startsWith('committer ')) commit.time = Number((/> (\d+) [+-]\d{4}$/.exec(line) || [])[1] || 0) * 1000
  }
  return commit
}

// The commit objects of `shas` in one `git cat-file --batch`: each one's commit, or null where it is missing or no commit.
const commitsAt = (path, shas) => new Promise((resolve) => {
  const valid = shas.map((sha) => (FULL_SHA.test(sha ?? '') ? sha : null))
  const asked = valid.filter(Boolean)
  const done = (out) => resolve(valid.map((sha) => (sha && out.get(sha)) || null))
  if (asked.length === 0) return done(new Map())
  const child = spawn('git', ['-C', path, 'cat-file', '--batch'], { windowsHide: true, env: gitEnv(), stdio: ['pipe', 'pipe', 'ignore'] })
  const chunks = []
  child.stdout.on('data', (d) => chunks.push(d))
  child.on('error', () => done(new Map()))
  child.on('close', () => {
    const out = new Map()
    const buffer = Buffer.concat(chunks)
    for (let at = 0; at < buffer.length;) {
      const end = buffer.indexOf(0x0a, at)
      if (end < 0) break
      const [sha, type, size] = buffer.toString('utf8', at, end).split(' ')
      at = end + 1
      if (type === 'missing') continue
      if (type === 'commit') out.set(sha, parseCommit(sha, buffer.toString('utf8', at, at + Number(size))))
      at += Number(size) + 1
    }
    done(out)
  })
  child.stdin.on('error', () => {})
  child.stdin.end(`${asked.join('\n')}\n`)
})

const repoAt = (path) => ({
  async refs() {
    const symbolic = await git(path, ['symbolic-ref', '-q', 'HEAD'])
    const headSha = await git(path, ['rev-parse', '-q', '--verify', 'HEAD'])
    const listed = (await git(path, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes'])) ?? ''
    const lines = listed.split('\n').filter(Boolean).map((l) => l.split(' ')).filter(([ref]) => !ref.endsWith('/HEAD'))
    return {
      head: { branch: symbolic?.startsWith('refs/heads/') ? symbolic.slice('refs/heads/'.length) : null, sha: headSha },
      branches: lines.map(([ref, sha]) => ({ name: ref.replace(/^refs\/(heads|remotes)\//, ''), sha, remote: ref.startsWith('refs/remotes/') })),
      sig: [symbolic ?? 'detached', headSha ?? '', ...lines.map((l) => l.join(' ')).sort()].join('\n'),
    }
  },
  async commit(sha) {
    if (!FULL_SHA.test(sha ?? '')) return null
    const text = await git(path, ['cat-file', 'commit', sha])
    return text === null ? null : parseCommit(sha, text)
  },
  walk(tips, options) {
    return walkCommits((shas) => commitsAt(path, shas), tips, options)
  },
  async mergeBase(a, b) {
    if (!FULL_SHA.test(a ?? '') || !FULL_SHA.test(b ?? '')) return null
    return (await git(path, ['merge-base', a, b])) || null
  },
  async remoteUrl() {
    return (await git(path, ['config', '--get', 'remote.origin.url'])) || null
  },
})

// The git clone port by the `git` command. A folder is a clone when git finds a repository whose top is that very folder, a worktree's
// or a reftable clone's included.
export const gitCliClone = () => ({
  async open(path) {
    if ((await git(path, ['rev-parse', '--show-prefix'])) !== '') throw new NotACloneError(path)
    return repoAt(path)
  },
})
