// Run: node --test skills/brain/scripts/brain-source.test.mjs
// Runs brain.html's BRAIN SOURCE block in Node, its folder source over a directory-handle shim of a real brain on disk,
// and checks what it reads and writes against the folder itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirHandle } from './directory-handle.support.mjs'

// The working tree may hold CRLF line endings (git's core.autocrlf); the blocks are read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
const block = /\/\/ =+ BRAIN SOURCE\n([\s\S]*?)<\/script>/.exec(html)[1]
const GitRead = new Function(`${/\/\/ =+ GIT READER\n([\s\S]*?)<\/script>/.exec(html)[1]}\nreturn GitRead;`)()
const BrainSource = new Function('GitRead', `${block}\nreturn BrainSource;`)(GitRead)

// What the page keeps in IndexedDB, in memory.
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v) } }

test('lists the brains its store keeps, as handles', async () => {
  const handle = dirHandle(mkdtempSync(join(tmpdir(), 'brain-source-')))
  const kept = [{ id: 'a1b2c3', name: 'team', handle }]
  assert.deepEqual(await BrainSource.folder({ kv: store({ brains: kept }) }).brains(), kept)
  assert.deepEqual(await BrainSource.folder({ kv: store() }).brains(), [])
})

// A brain in its `.brain/` folder, and files beside it, in its host folder, that the page leaves out.
const BRAIN = {
  '.brain/BRAIN.md': '# Brain\n',
  '.brain/.local/specs/001-x/spec.md': '# Spec: X\n',
  '.brain/.local/specs/001-x/api/001-first/milestone.md': '# Milestone 001: First\n',
  '.brain/.local/specs/001-x/sketch.png': 'not markdown',
  '.brain/notes/shared/rule.md': '---\ntype: rule\n---\nA rule.',
  '.brain/.local/drafts/d.md': '---\ntarget: notes/shared/d.md\n---\nA draft.',
  '.brain/notes/repos/api/e.md': '---\nexplored: abc1234\n---\nAn explored note.',
  '.brain/notes/research/r.md': 'a research note, not read',
  '.brain/notes/shared/other.txt': 'not markdown',
  '.brain/repos/api.md': '---\nremote: git@h:o/api.git\n---\nThe api.',
  '.brain/.local/repos.json': '{"api":"/work/api"}',
  'README.md': 'outside the brain',
  'src/code.md': 'outside the brain',
}
const FILES = ['.local/specs/001-x/spec.md', '.local/specs/001-x/api/001-first/milestone.md', 'notes/shared/rule.md', '.local/drafts/d.md', 'notes/repos/api/e.md', 'repos/api.md', '.local/repos.json']
const brain = (files = BRAIN, opts) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-source-'))
  for (const [p, text] of Object.entries(files)) { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), text) }
  return { root, entry: { id: 'b1', name: 'team', handle: dirHandle(root, opts) } }
}

test("files reads a brain's specs, notes, drafts and cards, keyed relative to .brain/", async () => {
  const { root, entry } = brain()
  const got = await BrainSource.folder({ kv: store() }).files(entry)
  assert.deepEqual(
    { status: got.status, files: Object.fromEntries(got.files), times: Object.fromEntries(got.times) },
    {
      status: 'ok',
      files: Object.fromEntries(FILES.map((p) => [p, BRAIN[`.brain/${p}`]])),
      times: Object.fromEntries(FILES.filter((p) => p.startsWith('.local/specs/')).map((p) => [p, Math.floor(statSync(join(root, '.brain', p)).mtimeMs)])),
    },
  )
})

test('files reads a brain whose handle is the .brain folder itself', async () => {
  const { root } = brain()
  const handle = dirHandle(join(root, '.brain'), {}, '.brain')
  const got = await BrainSource.folder({ kv: store() }).files({ id: 'b1', name: 'team', handle })
  assert.deepEqual([got.status, [...got.files.keys()].sort()], ['ok', [...FILES].sort()])
})

test('files reads a folder that holds BRAIN.md itself as the brain', async () => {
  const { entry } = brain(Object.fromEntries(Object.entries(BRAIN).filter(([p]) => p.startsWith('.brain/')).map(([p, text]) => [p.slice('.brain/'.length), text])))
  const got = await BrainSource.folder({ kv: store() }).files(entry)
  assert.deepEqual([got.status, [...got.files.keys()].sort()], ['ok', [...FILES].sort()])
})

test('edit creates a draft under .brain/.local/drafts', async () => {
  const { root, entry } = brain()
  await BrainSource.folder({ kv: store() }).edit(entry, '.local/drafts/new.md', () => 'a draft')
  assert.equal(readFileSync(join(root, '.brain/.local/drafts/new.md'), 'utf8'), 'a draft')
})

test('files reports a folder that is not readable or holds no BRAIN.md', async () => {
  const source = BrainSource.folder({ kv: store() })
  const locked = await source.files(brain(BRAIN, { permission: 'prompt' }).entry)
  const bare = await source.files(brain({ '.brain/notes/shared/rule.md': 'x' }).entry)
  assert.deepEqual([locked, bare].map((r) => [r.status, r.files.size, r.times.size]), [['denied', 0, 0], ['missing', 0, 0]])
})

test('edit applies its change to the file as it is on disk now, not as last read', async () => {
  const { root, entry } = brain()
  const source = BrainSource.folder({ kv: store() })
  const path = '.local/specs/001-x/spec.md', onDisk = join(root, '.brain', path)
  await source.files(entry)
  writeFileSync(onDisk, BRAIN['.brain/' + path] + 'written by a build\n')
  await source.edit(entry, path, (old) => old + 'mine\n')
  assert.equal(readFileSync(onDisk, 'utf8'), BRAIN['.brain/' + path] + 'written by a build\nmine\n')
})

test('edit creates a file that is missing, with its folders', async () => {
  const { root, entry } = brain({ '.brain/BRAIN.md': '# Brain\n' })
  let seen = 'unset'
  await BrainSource.folder({ kv: store() }).edit(entry, '.local/drafts/new.md', (old) => { seen = old; return 'a draft' })
  assert.deepEqual([seen, readFileSync(join(root, '.brain/.local/drafts/new.md'), 'utf8')], [undefined, 'a draft'])
})

test('edit refuses when write access is not granted', async () => {
  const { root, entry } = brain(BRAIN, { permission: 'prompt' })
  const path = '.local/specs/001-x/spec.md'
  await assert.rejects(BrainSource.folder({ kv: store() }).edit(entry, path, () => 'changed'), /not allowed to write/)
  assert.equal(readFileSync(join(root, '.brain', path), 'utf8'), BRAIN['.brain/' + path])
})

// A clone of two commits with a fixed author and date, and git's own answers about it.
const clone = () => {
  const root = mkdtempSync(join(tmpdir(), 'brain-source-clone-'))
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Ana', GIT_AUTHOR_EMAIL: 'ana@t', GIT_COMMITTER_NAME: 'Ana', GIT_COMMITTER_EMAIL: 'ana@t', GIT_AUTHOR_DATE: '2026-11-01T10:00:00+00:00', GIT_COMMITTER_DATE: '2026-11-01T10:00:00+00:00' }
  const git = (...a) => {
    const r = spawnSync('git', ['-C', root, '-c', 'gc.auto=0', ...a], { encoding: 'utf8', env })
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  git('init', '-q', '-b', 'main')
  for (const title of ['one', 'two']) { writeFileSync(join(root, `${title}.txt`), title); git('add', '-A'); git('commit', '-q', '-m', title) }
  git('branch', 'sdd/001-x/spec')
  return { root, git }
}
const repoEntry = { slug: 'api', path: '/work/api' }

test("open gives the granted clone's repo object, which answers as GitRead.open does", async () => {
  const c = clone(), handle = dirHandle(c.root)
  const source = BrainSource.folder({ kv: store() })
  await source.grant(repoEntry, handle)
  const opened = await source.open(repoEntry)
  const direct = await GitRead.open(handle), head = c.git('rev-parse', 'HEAD')
  assert.equal(opened.state, 'ok')
  assert.deepEqual(await opened.repo.refs(), await direct.refs())
  assert.deepEqual((await opened.repo.refs()).branches.map((b) => `${b.name} ${b.sha}`).sort(), c.git('for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads').split('\n').sort())
  assert.equal((await opened.repo.commit(head)).subject, c.git('log', '-1', '--format=%s'))
  assert.deepEqual(await opened.repo.commit(head), await direct.commit(head))
})

test('open says ungranted before a grant and denied when read permission is gone', async () => {
  const c = clone(), source = BrainSource.folder({ kv: store() })
  assert.deepEqual(await source.open(repoEntry), { state: 'ungranted' })
  await source.grant(repoEntry, dirHandle(c.root, { permission: 'prompt' }))
  assert.deepEqual(await source.open(repoEntry), { state: 'denied' })
})

test('open keeps its grants across sources over the same store', async () => {
  const c = clone(), kv = store()
  await BrainSource.folder({ kv }).grant(repoEntry, dirHandle(c.root))
  assert.equal((await BrainSource.folder({ kv }).open(repoEntry)).state, 'ok')
})

test('subscribe calls back on every tick until stopped', async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  let ticks = 0
  const stop = BrainSource.folder({ kv: store(), every: 10 }).subscribe(() => ticks++)
  await wait(80)
  stop()
  const after = ticks
  await wait(50)
  assert.ok(after >= 2, `ticked ${after} times`)
  assert.equal(ticks, after)
})

test('files reads a file under a layout path of two segments', async () => {
  const Moved = new Function('GitRead', `${block}\nreturn BrainSource;`)(GitRead)
  Moved.LAYOUT.specs = '.local/specs'
  const { entry } = brain({ '.brain/BRAIN.md': '# Brain\n', '.brain/.local/specs/001-x/spec.md': '# Spec: X\n' })
  const got = await Moved.folder({ kv: store() }).files(entry)
  assert.deepEqual([...got.files.keys()], ['.local/specs/001-x/spec.md'])
})
