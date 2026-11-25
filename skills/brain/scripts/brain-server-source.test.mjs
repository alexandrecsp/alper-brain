// Run: node --test skills/brain/scripts/brain-server-source.test.mjs
// Runs brain.html's BRAIN SOURCE block in Node, its server source against a real brain server driven over HTTP, and checks what
// it reads and writes against the brain's folder on disk.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirHandle } from './directory-handle.support.mjs'
import { EventSource } from './event-source.support.mjs'
import { cloneAt, gitReadOf, history, worktreeOf } from '../../../server/git-clone.support.mjs'
import { call, start, tokenOf } from '../../../server/server-process.support.mjs'

// The working tree may hold CRLF line endings (git's core.autocrlf); the blocks are read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
const block = /\/\/ =+ BRAIN SOURCE\n([\s\S]*?)<\/script>/.exec(html)[1]
const GitRead = new Function(`${/\/\/ =+ GIT READER\n([\s\S]*?)<\/script>/.exec(html)[1]}\nreturn GitRead;`)()
const BrainSource = new Function('GitRead', `${block}\nreturn BrainSource;`)(GitRead)

const store = () => ({ get: async () => undefined, set: async () => {} })

test('the page picks the server source over http: and the folder source over file:', () => {
  const kinds = ['http:', 'file:'].map((protocol) => BrainSource.forPage({ protocol, kv: store(), token: 't', fetch, EventSource: class {} }).kind)
  assert.deepEqual(kinds, ['server', 'folder'])
})

// toData, the page's turn from a brain's files into App's data.
const toData = (() => {
  const s = html.indexOf('// ---------- parsing:'), e = html.indexOf('// ---------- the brain list')
  return new Function('BrainSource', `${html.slice(s, e)}\nreturn toData;`)(BrainSource)
})()
// toData over what a source read of a brain: its files and times, and the timeline the source gives.
const dataOf = (name, { files, times, ...rest }) => toData(name, files, times, rest)

// A brain on disk, its folder holding BRAIN.md: the files the page reads, and files beside them that it leaves out.
const BRAIN = {
  'BRAIN.md': '# Brain\n',
  'specs/001-x/spec.md': '# Spec: X\n\n**Status:** doing\n',
  'specs/001-x/milestones/api/001-first/milestone.md': '# Milestone 001: First\n',
  'specs/001-x/sketch.png': 'not markdown',
  'notes/authored/rule.md': '---\ntype: rule\n---\nA rule.',
  'notes/drafts/d.md': '---\ntarget: notes/authored/d.md\nrepos: [api]\n---\nA draft.',
  'notes/exploration/api/e.md': '---\nexplored: abc1234\n---\nAn explored note.',
  'notes/other.txt': 'not markdown',
  'repos/api/REPO.md': '---\nremote: git@h:o/api.git\n---\nThe api.',
  'repos/repos.json': '{"api":"/work/api"}',
  'README.md': 'outside the set',
  'elsewhere/e.md': 'outside the set',
}
const writeBrain = (files = BRAIN) => {
  const root = join(mkdtempSync(join(tmpdir(), 'alper-brain-')), 'team')
  for (const [p, text] of Object.entries(files)) { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), text) }
  return root
}

// A brain server started fresh, with the page's server source over it.
const serve = async (options) => {
  const server = await start(options)
  const token = await tokenOf(server.port)
  return { ...server, token, source: BrainSource.server({ base: new URL(server.url).origin, token, fetch, EventSource }) }
}

// A server that lists one brain, the folder on disk `root`, and the entry the page holds for it.
// `setup(root)` runs on the folder before the server lists it.
const served = async (files, options, setup = () => {}) => {
  const root = writeBrain(files)
  setup(root)
  const server = await serve(options)
  const { id } = JSON.parse((await call(server.port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': server.token }, body: { path: root } })).body)
  return { ...server, root, entry: { id, name: 'team' } }
}

test('toData gives the same data from the server source as from the folder source', async () => {
  const { root, source, entry } = await served()
  const fromServer = await source.files(entry)
  const fromFolder = await BrainSource.folder({ kv: store() }).files({ id: 'b1', name: 'team', handle: dirHandle(root) })
  const [server, folder] = [dataOf('team', fromServer), dataOf('team', fromFolder)]
  assert.deepEqual(server, folder)
  assert.deepEqual([server.specs.length, server.notes.length, server.repos.length], [1, 3, 1])
})

test("toData reads a brain's specs, notes, drafts, cards and repos.json", () => {
  const files = new Map(Object.entries({
    'specs/001-x/spec.md': '# Spec: X\n\n**Status:** doing\n',
    'notes/authored/rule.md': '---\ntype: rule\n---\nA rule.',
    'notes/drafts/d.md': '---\ntarget: notes/authored/d.md\nrepos: [api]\n---\nA draft.',
    'repos/api/REPO.md': '---\nremote: git@h:o/api.git\n---\nThe api.',
    'repos/repos.json': '{"api":"/work/api"}',
  }))
  const data = toData('team', files, new Map())
  assert.deepEqual(
    { specs: data.specs.map((s) => [s.id, s.path]), notes: data.notes.map((n) => [n.id, n.path, n.draft]), repos: data.repos.map((r) => [r.slug, r.path]) },
    { specs: [['001-x', 'specs/001-x/spec.md']], notes: [['rule', 'notes/authored/rule.md', null], ['d', 'notes/authored/d.md', 'record']], repos: [['api', '/work/api']] },
  )
})

// Makes the brain in `root` a git repository of its own, with everything it holds committed as `title`.
const committed = (title) => (root) => {
  const repo = cloneAt(root)
  repo.git('add', '-A')
  repo.git('commit', '-q', '-m', title)
  return repo
}

test("the server source's timeline is the history route's commits", async () => {
  const { port, source, entry } = await served(BRAIN, undefined, committed('Records rule'))
  const route = JSON.parse((await call(port, { path: `/api/brains/${entry.id}/history` })).body)
  const { timeline } = dataOf('team', await source.files(entry))
  assert.deepEqual({ titles: timeline.commits.map((c) => c.title), commits: timeline.commits }, { titles: ['Records rule'], commits: route.commits })
})

test('a brain added by a typed path shows in the brain list', async () => {
  const { source } = await serve()
  const root = writeBrain()
  const added = await source.add(root)
  assert.deepEqual((await source.brains()).map(({ id, name, status }) => ({ id, name, status })), [{ id: added.id, name: 'team', status: 'ok' }])
})

test('a removed brain leaves the brain list', async () => {
  const { source } = await serve()
  const added = await source.add(writeBrain())
  await source.remove(added)
  assert.deepEqual(await source.brains(), [])
})

// The next call of a callback, as a promise.
const nextCall = (ms = 5000) => {
  let tell
  const arrived = new Promise((resolve, reject) => { tell = resolve; setTimeout(() => reject(new Error(`no call within ${ms} ms`)), ms).unref() })
  return { tell: (...args) => tell(args), arrived }
}

test('a file changed on disk reaches subscribe as a change event', async () => {
  const { source, entry, root } = await served({ ...BRAIN, 'notes/a.md': '# A\n' })
  const next = nextCall()
  const stop = source.subscribe(next.tell)
  await new Promise((r) => setTimeout(r, 300))
  writeFileSync(join(root, 'notes/a.md'), '# A, changed\n')
  const [event] = await next.arrived
  stop()
  assert.deepEqual(event, { brain: entry.id, changed: { 'notes/a.md': '# A, changed\n' }, times: {} })
})

test('a change event makes the server source fetch the history again', async () => {
  const { url, token, entry, root } = await served({ ...BRAIN, 'notes/a.md': '# A\n' })
  const requests = []
  const counting = (...args) => { requests.push(String(args[0])); return fetch(...args) }
  const source = BrainSource.server({ base: new URL(url).origin, token, fetch: counting, EventSource })
  const asked = () => requests.filter((u) => u.endsWith(`/api/brains/${entry.id}/history`)).length
  await source.files(entry)
  const afterFiles = asked()
  const next = nextCall()
  const stop = source.subscribe(next.tell)
  await new Promise((r) => setTimeout(r, 300))
  writeFileSync(join(root, 'notes/a.md'), '# A, changed\n')
  await next.arrived
  stop()
  assert.deepEqual([afterFiles, asked()], [1, 2])
})

test('a change reaches the page with no request made while it waits after it subscribes', async () => {
  const { url, token, entry, root } = await served({ ...BRAIN, 'notes/a.md': '# A\n' })
  const requests = []
  const counting = (...args) => { requests.push(String(args[0])); return fetch(...args) }
  const source = BrainSource.server({ base: new URL(url).origin, token, fetch: counting, EventSource })
  const next = nextCall()
  const stop = source.subscribe(next.tell)
  await new Promise((r) => setTimeout(r, 2500))
  const whileWaiting = [...requests]
  writeFileSync(join(root, 'notes/a.md'), '# A, changed\n')
  const [event] = await next.arrived
  stop()
  assert.deepEqual([whileWaiting, event.brain], [[], entry.id])
})

test('edit applies its change to the file as it is on disk now, not as last read', async () => {
  const { source, entry, root } = await served()
  const path = 'specs/001-x/spec.md'
  await source.files(entry)
  writeFileSync(join(root, path), BRAIN[path] + 'written by a build\n')
  await source.edit(entry, path, (old) => old + 'mine\n')
  assert.equal(readFileSync(join(root, path), 'utf8'), BRAIN[path] + 'written by a build\nmine\n')
})

test('edit writes through the server with no prompt, and a wrong token leaves the file as it was', async () => {
  const { url, source, entry, root } = await served()
  const path = 'notes/authored/rule.md'
  const stranger = BrainSource.server({ base: new URL(url).origin, token: 'not this start\'s token', fetch, EventSource })
  await assert.rejects(stranger.edit(entry, path, () => 'changed'), /did not write/)
  const afterWrong = readFileSync(join(root, path), 'utf8')
  await source.edit(entry, path, (old) => old + ' Edited.')
  assert.deepEqual({ afterWrong, afterRight: readFileSync(join(root, path), 'utf8') }, { afterWrong: BRAIN[path], afterRight: BRAIN[path] + ' Edited.' })
})

// ---------- clones: the page's Clones over the server source's repo objects ----------

// Clones, the page's block run in Node: `source` opens the clones, `brain` is the open brain, and the clock stands still at `now`.
const clonesBlock = html.slice(html.indexOf('// ---------- clones:'), html.indexOf('// ---------- reading, adding, removing'))
const NOW = Date.parse('2026-11-05T00:00:00Z')
const clonesOver = (source, brain) => {
  const window = { dispatchEvent: () => {} }
  const Clock = class extends Date { static now() { return NOW } }
  const Clones = new Function('source', 'state', 'window', 'location', 'document', 'Date', 'Event', 'BrainSource', 'GitRead', `${clonesBlock}\nreturn Clones;`)(
    source, { brain }, window, { hash: '#/b/team/specs/001-x' }, { hidden: false }, Clock, class {}, BrainSource, GitRead)
  return { Clones, window }
}

// What the Branches panel shows of one repository, once Clones has read it. GitRead's branches also carry the full ref (refs/heads/main), which
// the page never reads and the server leaves out, so it is dropped.
const SHOWN = ['state', 'branches', 'listed', 'head', 'base', 'fork', 'since', 'rows', 'more', 'ofSpec', 'labels', 'running']
const shownOf = async (source, brain, repo, mode) => {
  const { Clones, window } = clonesOver(source, brain)
  const redrawn = new Promise((resolve) => { window.dispatchEvent = resolve })
  Clones.watch([{ repo, spec: '001-x', base: null, mode, days: 30 }])
  await redrawn
  const view = Clones.view(repo)
  const plain = (v) => v === undefined ? v : JSON.parse(JSON.stringify(v, (k, x) => (k === 'ref' ? undefined : x instanceof Set ? { set: [...x] } : x instanceof Map ? { map: [...x] } : x)))
  return Object.fromEntries(SHOWN.map((k) => [k, plain(view[k])]))
}

// A brain on a fresh server that links the clones `repos` (slug to path), and the page's server source over it.
const linking = (repos) => served({ ...BRAIN, 'repos/repos.json': JSON.stringify(repos) })

// The same clone read by Clones in each source: over the server's repo objects, and over GitRead on the folder.
const bothViews = async (mode) => {
  const c = history()
  const { source, entry } = await linking({ app: c.root })
  const repo = { slug: 'app', path: c.root }
  const folder = { open: async () => ({ state: 'ok', repo: await gitReadOf(c.root) }) }
  return [await shownOf(source, entry, repo, mode), await shownOf(folder, entry, repo, mode)]
}

test('Clones in Simple mode over the server repo object build what GitRead gives', async () => {
  const [server, folder] = await bothViews('simple')
  assert.deepEqual(server, folder)
})

test('Clones in Explore mode over the server repo object build what GitRead gives', async () => {
  const [server, folder] = await bothViews('explore')
  assert.deepEqual(server, folder)
})

test('a linked clone opens in server mode with no grant stored', async () => {
  const c = history()
  const { url, token, entry } = await linking({ app: c.root })
  const touched = []
  const kv = { get: async (k) => touched.push(k), set: async (k) => touched.push(k) }
  const source = BrainSource.forPage({ protocol: 'http:', kv, token, fetch: (u, o) => fetch(new URL(u, url), o), EventSource })
  const opened = await source.open({ slug: 'app', path: c.root }, entry)
  assert.deepEqual({ state: opened.state, branch: (await opened.repo.refs()).head.branch, touched }, { state: 'ok', branch: 'sdd/001-x/spec', touched: [] })
})

test('a worktree clone shows its branches in server mode', async () => {
  const wt = worktreeOf(history())
  const { source, entry } = await linking({ app: wt.root })
  const shown = await shownOf(source, entry, { slug: 'app', path: wt.root }, 'simple')
  assert.deepEqual({ state: shown.state, head: shown.head.branch, listed: shown.listed.map((b) => b.name).includes('wt-branch') }, { state: 'ok', head: 'wt-branch', listed: true })
})

test('an unlinked repository gets no repo object and shows as unlinked', async () => {
  const { source, entry } = await linking({})
  const shown = await shownOf(source, entry, { slug: 'app' }, 'simple')
  assert.equal(shown.state, 'unlinked')
})

// repoBlock, the Overview's markup for one repository, run in Node over `Clones`; the branches that ask answer without the page's graph.
const repoBlockOver = (Clones) => new Function('Clones', 'viaServer', `${html.slice(html.indexOf('  function repoBlock('), html.indexOf('  // two repositories a page'))}\nreturn repoBlock;`)(Clones, true)
const ui = { esc: (s) => String(s), repoDot: () => '' }

test('an unlinked repository shows the /brain link hint and no button', async () => {
  const { source, entry } = await linking({})
  const { Clones, window } = clonesOver(source, entry)
  const redrawn = new Promise((resolve) => { window.dispatchEvent = resolve })
  const repo = { slug: 'app' }
  Clones.watch([{ repo, spec: '001-x', base: null, mode: 'simple', days: 30 }])
  await redrawn
  const shown = repoBlockOver(Clones)(repo, null, ui)
  assert.deepEqual({ hint: shown.includes('<span class="mono">/brain link</span>'), button: shown.includes('<button') }, { hint: true, button: false })
})

test('a clone unlinked after it was shown shows as unlinked, not as an error', async () => {
  const c = history()
  const { source, entry, root, url } = await linking({ app: c.root })
  const { Clones, window } = clonesOver(source, entry)
  const repo = { slug: 'app', path: c.root }
  let redrawn = new Promise((resolve) => { window.dispatchEvent = resolve })
  Clones.watch([{ repo, spec: '001-x', base: null, mode: 'simple', days: 30 }])
  await redrawn
  writeFileSync(join(root, 'repos/repos.json'), '{}')
  const refs = new URL(`/api/brains/${entry.id}/repos/app/refs`, url)
  for (let i = 0; i < 100 && (await fetch(refs)).status !== 404; i++) await new Promise((r) => setTimeout(r, 50))
  redrawn = new Promise((resolve) => { window.dispatchEvent = resolve })
  await Clones.tick()
  await redrawn
  assert.equal(Clones.view(repo).state, 'unlinked')
})
