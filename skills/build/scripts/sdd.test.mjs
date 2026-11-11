// Run: node --test skills/build/scripts/sdd.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendLine, ids, readCap, resolveSpec, resumeStep, setLine, specState, ticketDigest, unanswered } from './sdd.mjs'

const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const milestone = ({ n, phase = 'none', squash = 'none', landed = 'none', landsAfter = 'None', repo }) =>
  `# Milestone ${n}: M${n}\n\n**Delivers:** x\n\n**Done when:** y\n\n${repo ? `**Repo:** ${repo}\n\n` : ''}**Lands after:** ${landsAfter}\n\n**Phase:** ${phase}\n\n**Squash:** ${squash}\n\n**Landed:** ${landed}\n`
const ticket = ({ n, status = 'todo', deps = 'None', commit = 'none' }) =>
  `# Ticket ${n}: T${n}\n\n**Milestone:** 001 M\n\n**Status:** ${status}\n\n**Depends on:** ${deps}\n\n**Commit:** ${commit}\n\n## Notes\n`
const spec = (lines) => `# Invoice export\n\n**Repos:** api, web\n\n**Key:** None\n\n**Depends on:** None\n\n**Brain notes:** None\n${lines ?? ''}\n## Problem Statement\n`

const brain = () => {
  const b = mkdtempSync(join(tmpdir(), 'sdd-'))
  put(join(b, 'BRAIN.md'), '# Brain\n')
  return b
}

const twoTracks = (b, { apiM1 = {}, apiM2 = {}, webM1 = {}, webT = {} } = {}) => {
  const s = join(b, '.sdd/specs/004-invoice-export')
  put(join(s, 'spec.md'), spec('\n**Base:** api@main, web@main\n'))
  const a1 = join(s, 'milestones/api/001-expand')
  put(join(a1, 'milestone.md'), milestone({ n: '001', ...apiM1 }))
  put(join(a1, '001-add-v2.md'), ticket({ n: '001', ...(apiM1.t ?? {}) }))
  const a2 = join(s, 'milestones/api/002-contract')
  put(join(a2, 'milestone.md'), milestone({ n: '002', landsAfter: 'web/001', ...apiM2 }))
  put(join(a2, '002-drop-v1.md'), ticket({ n: '002', deps: '001', ...(apiM2.t ?? {}) }))
  const w1 = join(s, 'milestones/web/001-migrate')
  put(join(w1, 'milestone.md'), milestone({ n: '001', landsAfter: 'api/001', ...webM1 }))
  put(join(w1, '001-consume-v2.md'), ticket({ n: '001', deps: 'api/001', ...webT }))
  return s
}

const track = (st, slug) => st.tracks.find((t) => t.slug === slug)
const ms = (st, slug, n) => track(st, slug).milestones.find((m) => m.n === n)

test('parses ids, resume steps and unanswered escalations', () => {
  assert.deepEqual(ids('003, web-app/002'), [{ track: null, n: '003' }, { track: 'web-app', n: '002' }])
  assert.deepEqual(ids('None'), [])
  assert.equal(resumeStep('none', false), 4)
  assert.equal(resumeStep('none', true), 6)
  assert.equal(resumeStep('ask', true), 7)
  assert.equal(resumeStep('waits', true), 9)
  assert.equal(resumeStep('squash', true), 10)
  const review = '## Standards\n\n- **ST1** greps a file. Judgement call, **escalate**.\n  **Answer:** skip it — fine\n- **ST2** long name. Hard violation.\n\n## Spec\n\n- **SP1** missing. **escalate**\n'
  assert.deepEqual(unanswered(review), ['SP1'])
})

test('a fresh spec: api is dispatchable, web waits on the api ticket it depends on', () => {
  const st = specState(twoTracks(brain()), { useGit: false })
  assert.equal(st.layout, 'tracks')
  assert.deepEqual(st.base, { api: 'main', web: 'main' })
  assert.equal(st.allTodo, true)
  assert.deepEqual(st.dispatchable, [{ track: 'api', milestone: '001', ticket: '001' }])
  assert.deepEqual(st.frontier, [{ track: 'api', milestone: '001' }])
  assert.deepEqual(ms(st, 'web', '001').waitsOn, ['api/001'])
  assert.equal(ms(st, 'web', '001').ready, false)
  assert.deepEqual(st.closingQueue, [])
  assert.deepEqual(st.unlinked, ['api', 'web'])
  assert.equal(st.cap, 5)
})

test('once api 001 squashes, web becomes ready and api 001 landable; api 002 waits for web 001 to land', () => {
  const st = specState(twoTracks(brain(), {
    apiM1: { phase: 'squash', squash: 'aaaaaaa', t: { status: 'done' } },
    apiM2: { phase: 'squash', squash: 'bbbbbbb', t: { status: 'done' } },
  }), { useGit: false })
  assert.equal(ms(st, 'web', '001').ready, true)
  assert.deepEqual(st.dispatchable, [{ track: 'web', milestone: '001', ticket: '001' }])
  assert.deepEqual(st.frontier, [{ track: 'web', milestone: '001' }])
  assert.deepEqual(track(st, 'api').landable, ['001'])
  assert.equal(ms(st, 'api', '002').landable, false)
  assert.deepEqual(ms(st, 'api', '002').landsAfterOpen, ['web/001'])
})

test('a milestone whose tickets are done queues at the step its Phase names', () => {
  const st = specState(twoTracks(brain(), { apiM1: { phase: 'decide', t: { status: 'done' } } }), { useGit: false })
  assert.deepEqual(st.closingQueue, [{ track: 'api', milestone: '001', resume: 7 }])
  assert.deepEqual(st.dispatchable, [])
  assert.deepEqual(st.frontier, [{ track: 'api', milestone: '001' }])
  assert.equal(st.noneOpen, false)
})

test("the frontier holds each track's next milestone that is ready or already started, and no later one", () => {
  // web 001 is not ready (api 001 is open), but an earlier call started its ticket, so it stays in the frontier
  const st = specState(twoTracks(brain(), { webT: { status: 'doing' } }), { useGit: false })
  assert.deepEqual(st.frontier, [{ track: 'api', milestone: '001' }, { track: 'web', milestone: '001' }])
  assert.deepEqual(st.dispatchable, [{ track: 'api', milestone: '001', ticket: '001' }])
})

test('reports a Depends on that names no ticket', () => {
  const st = specState(twoTracks(brain(), { webT: { deps: 'api/009' } }), { useGit: false })
  assert.match(st.problems[0], /api\/009 names no ticket/)
})

test('reads the flat layout, its track from each Repo line', () => {
  const b = brain()
  const s = join(b, '.sdd/specs/002-old')
  put(join(s, 'spec.md'), spec())
  put(join(s, 'milestones/001-a/milestone.md'), milestone({ n: '001', repo: 'api' }))
  put(join(s, 'milestones/001-a/001-t.md'), ticket({ n: '001' }))
  put(join(s, 'milestones/002-b/milestone.md'), milestone({ n: '002', repo: 'web' }))
  put(join(s, 'milestones/002-b/002-t.md'), ticket({ n: '002', deps: '001' }))
  const st = specState(s, { useGit: false })
  assert.equal(st.layout, 'flat')
  assert.deepEqual(st.tracks.map((t) => t.slug), ['api', 'web'])
  assert.deepEqual(ms(st, 'web', '002').waitsOn, ['api/001'])
})

test('resolves spec ids by SPEC-ID.md', () => {
  const b = brain()
  const s = twoTracks(b)
  for (const id of ['4', '004', 's04', '004-invoice-export', s]) assert.equal(resolveSpec(id, b), s)
  assert.throws(() => resolveSpec('7', b), /No spec folder/)
})

test('reads the cap by FORMAT.md Settings', () => {
  const b = brain()
  assert.deepEqual(readCap(b), { cap: 5 })
  put(join(b, '.sdd/config.json'), '{ "parallelAgents": 2 }')
  assert.deepEqual(readCap(b), { cap: 2 })
  put(join(b, '.sdd/config.json'), '{ "parallelAgents": 0 }')
  assert.equal(readCap(b).cap, 5)
  put(join(b, '.sdd/config.json'), '{ nope')
  assert.match(readCap(b).problem, /does not parse/)
})

test('sets and appends lines, creating them under another and skipping a repeated entry', () => {
  let md = spec('\n**Base:** api@main\n')
  md = setLine(md, 'Base', 'api@main, web@develop')
  assert.match(md, /^\*\*Base:\*\* api@main, web@develop$/m)
  assert.throws(() => setLine(md, 'Landings', 'api 001'), /no --after/)
  md = appendLine(md, 'Landings', 'api 001', '; ', 'Base')
  assert.match(md, /\*\*Base:\*\* api@main, web@develop\n\n\*\*Landings:\*\* api 001\n/)
  md = appendLine(md, 'Landings', 'web 001-002')
  assert.equal(appendLine(md, 'Landings', 'web 001-002'), md)
  assert.match(md, /^\*\*Landings:\*\* api 001; web 001-002$/m)
  assert.equal(setLine('**Phase:** none\n', 'Phase', 'review'), '**Phase:** review\n')
})

test('reads git through links.json: branches, cleanliness and squashes on the base', () => {
  const b = brain()
  const s = twoTracks(b)
  const repo = join(b, 'clones/api')
  mkdirSync(repo, { recursive: true })
  const g = (...a) => {
    const r = spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  g('init', '-q', '-b', 'main')
  writeFileSync(join(repo, 'f'), '1')
  g('add', '-A'); g('commit', '-qm', 'start')
  g('checkout', '-qb', 'sdd/004-invoice-export/spec')
  writeFileSync(join(repo, 'f'), '2')
  g('commit', '-qam', 'squash 001')
  const sha = g('rev-parse', 'HEAD')
  put(join(b, '.sdd/links.json'), JSON.stringify({ api: repo }))
  const m1 = join(s, 'milestones/api/001-expand/milestone.md')
  writeFileSync(m1, readFileSync(m1, 'utf8').replace('**Squash:** none', `**Squash:** ${sha}`))

  let st = specState(s)
  const api = track(st, 'api')
  assert.equal(api.repo.clean, true)
  assert.equal(api.repo.specBranch, true)
  assert.equal(api.repo.head, 'sdd/004-invoice-export/spec')
  assert.equal(api.next, '002')
  assert.equal(ms(st, 'api', '002').branch, false)
  assert.equal(ms(st, 'api', '001').onBase, false)
  assert.deepEqual(st.unlinked, ['web'])

  g('checkout', '-q', 'main'); g('merge', '-q', '--ff-only', sha)
  g('branch', 'sdd/004-invoice-export/M002')
  writeFileSync(join(repo, 'g'), 'dirty')
  st = specState(s)
  assert.equal(ms(st, 'api', '001').onBase, true)
  assert.equal(ms(st, 'api', '002').branch, true)
  assert.equal(track(st, 'api').repo.clean, false)
})

test('a ticket digest gives its milestone and the Notes and files of the tickets it builds on', () => {
  const b = brain()
  const s = twoTracks(b, { apiM1: { phase: 'squash', squash: 'aaaaaaa', t: { status: 'done' } } })
  const repo = join(b, 'clones/api')
  mkdirSync(repo, { recursive: true })
  const g = (...a) => spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' }).stdout.trim()
  g('init', '-q', '-b', 'main')
  mkdirSync(join(repo, 'src'))
  writeFileSync(join(repo, 'src/export.ts'), 'export const v2 = 1\n')
  g('add', '-A'); g('commit', '-qm', 'adds v2')
  const sha = g('rev-parse', 'HEAD')
  put(join(b, '.sdd/links.json'), JSON.stringify({ api: repo }))
  const t1 = join(s, 'milestones/api/001-expand/001-add-v2.md')
  writeFileSync(t1, readFileSync(t1, 'utf8').replace('**Commit:** none', `**Commit:** ${sha}`).replace('## Notes\n', '## Notes\n\n- The v2 event keeps the v1 field names.\n'))

  const d = ticketDigest(join(s, 'milestones/web/001-migrate/001-consume-v2.md'))
  assert.match(d, /^# Around ticket web\/001: T001/)
  assert.match(d, /## Milestone 001: M001\n\n\*\*Delivers:\*\* x\n\*\*Done when:\*\* y\n\*\*Lands after:\*\* api\/001/)
  assert.match(d, /### api\/001: T001\n\n\*\*Status:\*\* done · \*\*Commit:\*\* [0-9a-f]{40} · \*\*Root:\*\*/)
  assert.match(d, /Notes:\n\n- The v2 event keeps the v1 field names\./)
  assert.match(d, /src\/export\.ts \| 1 \+/)

  const first = ticketDigest(join(s, 'milestones/api/001-expand/001-add-v2.md'), { useGit: false })
  assert.match(first, /None: it is the first ticket/)
  assert.match(ticketDigest(join(s, 'milestones/api/002-contract/002-drop-v1.md'), { useGit: false }), /### api\/001: T001/)
})
