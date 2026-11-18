// Run: node --test skills/build/scripts/sdd.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendLine, assembleReview, commitKey, contextBlock, dispatch, findingMap, ids, land, mapRows, markFinding, next, readCap, resolveSpec, resumeStep, setLine, specState, squash, ticketDigest, toFix, unanswered, verify } from './sdd.mjs'

const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const milestone = ({ n, phase = 'none', squash = 'none', landed = 'none', buildsAfter = 'None', landsAfter = 'None', repo }) =>
  `# Milestone ${n}: M${n}\n\n**Delivers:** x\n\n**Done when:** y\n\n${repo ? `**Repo:** ${repo}\n\n` : `**Builds after:** ${buildsAfter}\n\n`}**Lands after:** ${landsAfter}\n\n**Phase:** ${phase}\n\n**Squash:** ${squash}\n\n**Landed:** ${landed}\n`
const ticket = ({ n, status = 'todo', deps = 'None', commit = 'none' }) =>
  `# Ticket ${n}: T${n}\n\n**Milestone:** 001 M\n\n**Status:** ${status}\n\n**Depends on:** ${deps}\n\n**Commit:** ${commit}\n\n## Notes\n`
const spec = (lines) => `# Invoice export\n\n**Repos:** api, web\n\n**Key:** None\n\n**Depends on:** None\n\n**Brain notes:** None\n${lines ?? ''}\n## Problem Statement\n`

const brain = () => {
  const b = mkdtempSync(join(tmpdir(), 'sdd-'))
  put(join(b, 'BRAIN.md'), '# Brain\n')
  return b
}

const twoTracks = (b, { apiM1 = {}, apiM2 = {}, webM1 = {}, webT = {} } = {}) => {
  const s = join(b, '.brain/specs/004-invoice-export')
  put(join(s, 'spec.md'), spec('\n**Base:** api@main, web@main\n'))
  const a1 = join(s, 'milestones/api/001-expand')
  put(join(a1, 'milestone.md'), milestone({ n: '001', ...apiM1 }))
  put(join(a1, '001-add-v2.md'), ticket({ n: '001', ...(apiM1.t ?? {}) }))
  const a2 = join(s, 'milestones/api/002-contract')
  put(join(a2, 'milestone.md'), milestone({ n: '002', landsAfter: 'web/001', ...apiM2 }))
  put(join(a2, '002-drop-v1.md'), ticket({ n: '002', deps: '001', ...(apiM2.t ?? {}) }))
  const w1 = join(s, 'milestones/web/001-migrate')
  put(join(w1, 'milestone.md'), milestone({ n: '001', buildsAfter: 'api/001', landsAfter: 'api/001', ...webM1 }))
  put(join(w1, '001-consume-v2.md'), ticket({ n: '001', ...webT }))
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

test('a fresh spec: api is dispatchable, web waits on the api milestone it builds after', () => {
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

test('reports a Depends on that names no ticket, and a Builds after that names no milestone or its own track', () => {
  let st = specState(twoTracks(brain(), { webT: { deps: '009' } }), { useGit: false })
  assert.match(st.problems[0], /web\/001 ticket 001: Depends on 009 names no ticket/)
  st = specState(twoTracks(brain(), { webM1: { buildsAfter: 'api/009' } }), { useGit: false })
  assert.match(st.problems[0], /web\/001: Builds after api\/009 names no milestone/)
  st = specState(twoTracks(brain(), { apiM2: { buildsAfter: 'api/001' } }), { useGit: false })
  assert.match(st.problems[0], /api\/002: Builds after api\/001 names its own track/)
})

test('a Builds after cycle through the tracks is a problem', () => {
  // web 001 builds after api 001, and api 001 after web 001
  const st = specState(twoTracks(brain(), { apiM1: { buildsAfter: 'web/001' } }), { useGit: false })
  assert.match(st.problems.join('\n'), /Builds after makes a cycle.*(api\/001.*web\/001|web\/001.*api\/001)/)
  assert.deepEqual(st.frontier, [])
})

test('a Builds after also orders the landing', () => {
  const st = specState(twoTracks(brain(), {
    apiM1: { phase: 'squash', squash: 'aaaaaaa', t: { status: 'done' } },
    webM1: { landsAfter: 'None', phase: 'squash', squash: 'ccccccc' },
    webT: { status: 'done' },
  }), { useGit: false })
  assert.deepEqual(ms(st, 'web', '001').buildsAfter, ['api/001'])
  assert.deepEqual(ms(st, 'web', '001').landsAfterOpen, ['api/001'])
  assert.equal(ms(st, 'web', '001').landable, false)
})

test("a ticket's Depends on another track's ticket, from before Builds after, holds its milestone and lists its migration", () => {
  const st = specState(twoTracks(brain(), { webM1: { buildsAfter: 'None' }, webT: { deps: 'api/002' } }), { useGit: false })
  assert.deepEqual(ms(st, 'web', '001').waitsOn, ['api/002'])
  assert.deepEqual(st.migrate, [{ milestone: 'web/001', buildsAfter: ['api/002'] }])
  assert.deepEqual(specState(twoTracks(brain()), { useGit: false }).migrate, [])
})

test('reads the flat layout, its track from each Repo line', () => {
  const b = brain()
  const s = join(b, '.brain/specs/002-old')
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
  put(join(b, '.brain/config.json'), '{ "parallelAgents": 2 }')
  assert.deepEqual(readCap(b), { cap: 2 })
  put(join(b, '.brain/config.json'), '{ "parallelAgents": 0 }')
  assert.equal(readCap(b).cap, 5)
  put(join(b, '.brain/config.json'), '{ nope')
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
  put(join(b, '.brain/links.json'), JSON.stringify({ api: repo }))
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
  put(join(b, '.brain/links.json'), JSON.stringify({ api: repo }))
  const m1 = join(s, 'milestones/api/001-expand/milestone.md')
  writeFileSync(m1, readFileSync(m1, 'utf8').replace('**Squash:** aaaaaaa', `**Squash:** ${sha}`))
  const t1 = join(s, 'milestones/api/001-expand/001-add-v2.md')
  writeFileSync(t1, readFileSync(t1, 'utf8').replace('**Commit:** none', `**Commit:** ${sha}`).replace('## Notes\n', '## Notes\n\n- The v2 event keeps the v1 field names.\n'))

  const d = ticketDigest(join(s, 'milestones/web/001-migrate/001-consume-v2.md'))
  assert.match(d, /^# Around ticket web\/001: T001/)
  assert.match(d, /## Milestone 001: M001\n\n\*\*Delivers:\*\* x\n\*\*Done when:\*\* y\n\*\*Builds after:\*\* api\/001\n\*\*Lands after:\*\* api\/001/)
  assert.match(d, /None: it is the first ticket/)
  assert.match(d, /## Milestones it builds after\n\n### api\/001: M001\n\n\*\*Delivers:\*\* x\n\*\*Squash:\*\* [0-9a-f]{40} · \*\*Root:\*\*/)
  assert.match(d, /Files its squash changed:\n\n```\n src\/export\.ts \| 1 \+/)
  assert.match(d, /Notes of api\/001 T001:\n\n- The v2 event keeps the v1 field names\./)

  const first = ticketDigest(join(s, 'milestones/api/001-expand/001-add-v2.md'), { useGit: false })
  assert.match(first, /None: it is the first ticket/)
  assert.match(ticketDigest(join(s, 'milestones/api/002-contract/002-drop-v1.md'), { useGit: false }), /### api\/001: T001/)
})

test('picks the findings to fix, and marks a finding', () => {
  const review = [
    '## Standards', '',
    '- **ST1** Hard violation. No in-memory adapter.',
    '- **ST2** Judgement call, **keep**. Plain strings match the ports.',
    '- **ST3** Judgement call, **fix**. Duplicated zod refine.',
    '- **ST4** Judgement call, **escalate**. Changes a seam.',
    '  **Answer:** skip it — the spec names it',
    '- **ST5** Judgement call, **escalate**. Renames a port.',
    '  **Answer:** fix it as proposed — no caller outside',
    '- **ST6** Judgement call, **escalate**. Unanswered.', '',
    '## Spec', '',
    '- **SP1** Missing: the extraction point is never compared.',
    '  **Fixed:** abc1234',
    '- **SP2** Scope creep, **keep**. Harmless test.', '',
    '### Checked and fine', '', 'Everything else; keep it.', '',
  ].join('\n')
  assert.deepEqual(toFix(review), ['ST1', 'ST3', 'ST5'])
  assert.deepEqual(unanswered(review), ['ST6'])
  let md = markFinding(review, 'ST3', 'Fixed', 'def5678')
  md = markFinding(md, 'ST1', 'Not fixed', 'needs a port change')
  assert.match(md, /- \*\*ST3\*\* Judgement call, \*\*fix\*\*\. Duplicated zod refine\.\n\n  \*\*Fixed:\*\* def5678\n- \*\*ST4\*\*/)
  assert.match(md, /- \*\*ST1\*\* Hard violation\. No in-memory adapter\.\n\n  \*\*Not fixed:\*\* needs a port change\n/)
  assert.match(markFinding(md, 'SP1', 'Fixed', 'fff0000'), /  \*\*Fixed:\*\* fff0000\n- \*\*SP2\*\*/)
  assert.deepEqual(toFix(md), ['ST5'])
  assert.throws(() => markFinding(md, 'ST9', 'Fixed', 'x'), /No finding ST9/)
  const paragraphs = '## Standards\n\n**ST1** (hard violation). Add adapters.\n\n**ST2** (judgement call). Move errors.\n'
  assert.match(markFinding(paragraphs, 'ST1', 'Fixed', 'abc'), /\*\*ST1\*\* \(hard violation\)\. Add adapters\.\n\n\*\*Fixed:\*\* abc\n\n\*\*ST2\*\*/)
})

test('assembles a review from its sub-agents files, numbering each axis straight on', () => {
  const r = assembleReview({
    title: 'Invoice export', fixed: 'api@aaa, web@bbb', head: 'api@ccc, web@ddd',
    summary: '## Summary\n\nStandards: 3 findings.\n',
    sections: [
      { axis: 'standards', slug: 'api', text: '- **ST1** Hard violation. A.\n- **ST2** Judgement call, **keep**. B, like ST1.\n' },
      { axis: 'standards', slug: 'web', text: '- **ST1** Judgement call, **fix**. C, unlike ST2 in api.\n' },
      { axis: 'spec', slug: null, text: '- **SP1** Missing. D.\n' },
    ],
  })
  assert.deepEqual(r.counts, { Standards: 3, Spec: 1 })
  assert.deepEqual(r.renumbered, ['web: ST1 → ST3'])
  assert.match(r.text, /^# Review: Invoice export\n\n\*\*Fixed point:\*\* api@aaa, web@bbb\n\n\*\*Head:\*\* api@ccc, web@ddd\n\n## Summary\n\nStandards: 3 findings\.\n\n## Standards\n\n### api\n\n- \*\*ST1\*\*/)
  assert.match(r.text, /### web\n\n- \*\*ST3\*\* Judgement call, \*\*fix\*\*\. C, unlike ST2 in api\.\n\n## Spec\n\n- \*\*SP1\*\* Missing\. D\.\n$/)
  assert.deepEqual(toFix(r.text), ['ST1', 'ST3', 'SP1'])
})

test('finds the commit key by the commit skill', () => {
  assert.equal(commitKey('None', 'api', null), null)
  assert.equal(commitKey('FUNC-12', 'api', 'commitKeyPattern: "FUNC-\\\\d+"\n'), 'FUNC-12')
  assert.equal(commitKey('FUNC-12', 'api', 'commitKeyPattern: null\n'), null)
  assert.equal(commitKey('api: FUNC-12, web: None', 'web', null), null)
  assert.equal(commitKey('api: FUNC-12, web: None', 'api', null), 'FUNC-12')
  assert.throws(() => commitKey('BAD', 'api', 'commitKeyPattern: "FUNC-\\\\d+"\n'), /does not fully match/)
})

test('squashes a milestone into the spec branch and verifies where a sub-agent wrote', () => {
  const b = brain()
  const s = twoTracks(b, { apiM1: { t: { status: 'done' } } })
  const repo = join(b, 'clones/api')
  mkdirSync(repo, { recursive: true })
  for (const [k, v] of Object.entries({ GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' })) process.env[k] = v
  const g = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).stdout.trim()
  g('init', '-q', '-b', 'main')
  writeFileSync(join(repo, 'f'), '1')
  g('add', '-A'); g('commit', '-qm', 'start')
  g('checkout', '-qb', 'sdd/004-invoice-export/spec')
  g('checkout', '-qb', 'sdd/004-invoice-export/M001')
  writeFileSync(join(repo, 'f'), '2')
  g('commit', '-qam', 'ticket 001')
  const ticketSha = g('rev-parse', 'HEAD')
  put(join(b, '.brain/links.json'), JSON.stringify({ api: repo }))
  const t1 = join(s, 'milestones/api/001-expand/001-add-v2.md')
  writeFileSync(t1, readFileSync(t1, 'utf8').replace('**Commit:** none', `**Commit:** ${ticketSha}`))

  assert.deepEqual(verify(t1).problems, [])
  assert.equal(verify(t1).status, 'done')
  writeFileSync(join(repo, 'stray'), 'x')
  assert.match(verify(t1, { commits: ['0000000'] }).problems.join('\n'), /0000000 is not in[\s\S]*uncommitted/)
  spawnSync('git', ['-C', repo, 'clean', '-qfd'])

  const m1 = join(s, 'milestones/api/001-expand')
  assert.throws(() => squash(m1, { title: 'x'.repeat(73) }), /72/)
  assert.throws(() => squash(m1, { title: 'x'.repeat(66), key: 'FUNC-1' }), /72/)
  const { sha } = squash(m1, { title: 'Adds the v2 export', details: ['Keeps v1 offered'] })
  assert.equal(g('rev-parse', '--abbrev-ref', 'HEAD'), 'sdd/004-invoice-export/spec')
  assert.equal(g('log', '-1', '--format=%B'), 'Adds the v2 export\n\n- Keeps v1 offered\n\nSdd-Milestone: 004-invoice-export/api/M001')
  const md = readFileSync(join(m1, 'milestone.md'), 'utf8')
  assert.match(md, /\*\*Phase:\*\* squash/)
  assert.ok(md.includes(`**Squash:** ${sha}`))
  assert.deepEqual(squash(m1, { title: 'again' }), { sha, already: true })
  writeFileSync(t1, readFileSync(t1, 'utf8').replace('**Status:** done', '**Status:** doing'))
  assert.match(verify(t1).problems.join('\n'), /the ticket is doing with Commit [0-9a-f]{40}, not done/)
  assert.match(verify(t1).problems.join('\n'), /is on sdd\/004-invoice-export\/spec, not sdd\/004-invoice-export\/M001/)
})

test('draws the Summary and the finding map from the findings files when no Summary is given', () => {
  const standards = '- **ST1** Hard violation. A port with no adapter.\n- **ST2** Judgement call, **keep**. Fine.\n\n## Map\n\n- `src/api.ts`: ST1; worst violation; calls `src/repo.ts`\n- `src/repo.ts`: ST2; worst judgement\n'
  assert.deepEqual(mapRows(standards).rows.map((r) => [r.path, r.ids, r.worst, r.calls]), [['src/api.ts', ['ST1'], 'violation', ['src/repo.ts']], ['src/repo.ts', ['ST2'], 'judgement', []]])
  const r = assembleReview({
    title: 'M', fixed: 'aaa', head: 'bbb', summary: null,
    sections: [
      { axis: 'standards', slug: null, text: standards },
      { axis: 'spec', slug: null, text: '- **SP1** Partial, **escalate**. The seam cannot be built as written.\n\n## Map\n\n- `src/api.ts`: SP1; worst escalate\n' },
    ],
  })
  assert.match(r.text, /## Summary\n\nStandards: 2 findings, 0 escalate; worst ST1, Hard violation\. A port with no adapter\. Spec: 1 finding, 1 escalate; worst SP1, Partial, escalate\. The seam/)
  assert.match(r.text, /```mermaid\nflowchart TD\n    m1\["src\/api\.ts<br>ST1, SP1"\]:::escalate\n    m2\["src\/repo\.ts<br>ST2"\]:::judgement\n    m1 --> m2\n/)
  assert.doesNotMatch(r.text, /## Map/)
  assert.equal(findingMap([]), '')
  const none = assembleReview({ title: 'M', fixed: 'a', head: 'b', summary: null, sections: [{ axis: 'standards', slug: null, text: 'No findings.\n' }] })
  assert.match(none.text, /## Summary\n\nStandards: no findings\. Spec: not run\.\n\n## Standards/)
})

const builtRepo = (b) => {
  const repo = join(b, 'clones/api')
  mkdirSync(join(repo, 'docs'), { recursive: true })
  for (const [k, v] of Object.entries({ GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' })) process.env[k] = v
  const g = (...a) => {
    const r = spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' })
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  g('init', '-q', '-b', 'main')
  writeFileSync(join(repo, 'docs/STRUCTURE.md'), '# Structure\n')
  writeFileSync(join(repo, 'test.sh'), 'grep -q ok f\n')
  writeFileSync(join(repo, 'f'), 'ok\n')
  g('add', '-A'); g('commit', '-qm', 'start')
  g('checkout', '-qb', 'sdd/004-invoice-export/spec')
  g('checkout', '-qb', 'sdd/004-invoice-export/M001')
  put(join(b, '.brain/links.json'), JSON.stringify({ api: repo, web: join(b, 'clones/web') }))
  put(join(b, 'notes/repos/api/REPO.md'), '---\nslug: api\nremote: local only\ncommitKeyPattern: null\nunit: sh test.sh\ne2e: none\n---\n\nApi.\n')
  put(join(b, 'notes/authored/invoice-event-contract.md'), '---\nname: invoice-event-contract\ndescription: x\ntype: contract\nlayer: application\nrepos: [api, web]\n---\n\nThe event.\n')
  put(join(b, 'notes/authored/api-retry.md'), '---\nname: api-retry\ndescription: x\ntype: gotcha\nlayer: application\nrepos: [api]\n---\n\nRetry.\n')
  return { repo, g }
}
const sl = (p) => p.replace(/\\/g, '/')

test('fills each agent its Context block, dispatches a builder, and moves on to the next ticket', () => {
  const b = brain()
  const s = twoTracks(b)
  const a1 = join(s, 'milestones/api/001-expand')
  put(join(a1, '002-more.md'), ticket({ n: '002', deps: '001' }))
  const { repo, g } = builtRepo(b)
  const t1 = join(a1, '001-add-v2.md')

  const builder = contextBlock(t1, 'builder')
  assert.match(builder, /^## Context\n- \*\*Brain:\*\* /)
  assert.ok(builder.includes(`- **Works in:** api at ${sl(repo)} (open), changes it`))
  assert.ok(builder.includes(`- **Docs:** ${sl(join(repo, 'docs/STRUCTURE.md'))}, `))
  assert.match(builder, /skills\/project-structure\/SKILL\.md, .*skills\/codebase-design\/SKILL\.md, .*skills\/build\/scripts\/sdd\.mjs\n/)
  assert.ok(builder.includes(`- **Spec:** ${sl(t1)}`))
  assert.ok(builder.includes('- **Branch:** sdd/004-invoice-export/M001'))
  assert.ok(builder.includes(`- **Writes:** files under ${sl(repo)}, the ticket file at ${sl(t1)}`))
  assert.match(builder, /\nRules:\n1\. Read and write every file by absolute path/)

  const arbiter = contextBlock(join(a1, 'milestone.md'), 'arbiter')
  assert.ok(arbiter.includes(`- **Works in:** api at ${sl(repo)} (linked), reads it`))
  assert.match(arbiter, /- \*\*Also reads:\*\* web at .*clones\/web \(linked\)\n/)
  assert.match(arbiter, /- \*\*Notes:\*\* .*invoice-event-contract\.md\n/)
  assert.doesNotMatch(arbiter, /api-retry/)
  assert.match(arbiter, /- \*\*Writes:\*\* nothing\n/)
  assert.match(contextBlock(join(a1, 'milestone.md'), 'reviewer', { writes: [join(a1, 'review.standards.md')] }), /SMELLS\.md[\s\S]*- \*\*Writes:\*\* the file at .*review\.standards\.md\n/)
  assert.throws(() => contextBlock(join(a1, 'milestone.md'), 'builder'), /a ticket/)

  const brief = dispatch(t1, 'builder')
  assert.match(brief, /^## Context\n- \*\*Works in:\*\* api at .* \(open\), changes it\n- The rest of this Context block, its rules included, is in .*001-expand\/\.context\/builder-001\.md: read it before anything else\.\n\n\*\*Ticket:\*\* .*001-add-v2\.md\n\*\*Milestone:\*\* .*milestone\.md\n\*\*Spec:\*\* .*spec\.md$/)
  assert.equal(readFileSync(join(a1, '.context/builder-001.md'), 'utf8'), `${builder}\n`)
  assert.match(readFileSync(t1, 'utf8'), /\*\*Status:\*\* doing/)

  writeFileSync(join(repo, 'f'), 'ok\nmore\n')
  g('commit', '-qam', 'ticket 001')
  const sha = g('rev-parse', 'HEAD')
  assert.match(next(t1, { commits: [sha] }).problems.join('\n'), /the ticket is doing/)
  writeFileSync(t1, readFileSync(t1, 'utf8').replace('**Status:** doing', '**Status:** done').replace('**Commit:** none', `**Commit:** ${sha}`))
  const r = next(t1, { commits: [sha] })
  assert.deepEqual(r.problems, [])
  assert.match(r.next, /002-more\.md$/)
  assert.match(r.brief, /\*\*Ticket:\*\* .*002-more\.md/)
  const t2 = join(a1, '002-more.md')
  assert.match(readFileSync(t2, 'utf8'), /\*\*Status:\*\* doing/)
  writeFileSync(t2, readFileSync(t2, 'utf8').replace('**Status:** doing', '**Status:** done').replace('**Commit:** none', `**Commit:** ${sha}`))
  assert.equal(next(t2).done, true)
  assert.deepEqual(track(specState(s), 'api').milestones[0].tickets.map((k) => k.file), ['001-add-v2.md', '002-more.md'])
})

test('lands a track: rebases, follows each squash, runs the suite, fast-forwards and records', () => {
  const b = brain()
  const s = twoTracks(b, { apiM1: { t: { status: 'done' } } })
  const { repo, g } = builtRepo(b)
  writeFileSync(join(repo, 'f'), 'ok\nv2\n')
  g('commit', '-qam', 'ticket 001')
  const m1 = join(s, 'milestones/api/001-expand')
  const { sha: first } = squash(m1, { title: 'Adds the v2 export' })
  g('checkout', '-q', 'main')
  writeFileSync(join(repo, 'other'), 'base moved\n')
  g('add', '-A'); g('commit', '-qm', 'base moves on')
  g('checkout', '-q', 'sdd/004-invoice-export/spec')
  const md = () => readFileSync(join(m1, 'milestone.md'), 'utf8')

  assert.deepEqual(land(s, 'api'), { landed: ['001'], stopped: null })
  const moved = g('rev-parse', 'main')
  assert.notEqual(moved, first)
  assert.equal(g('log', '-1', '--format=%s', 'main'), 'Adds the v2 export')
  assert.ok(md().includes(`**Squash:** ${moved}`))
  assert.ok(md().includes(`**Landed:** ${moved}`))
  assert.match(md(), /\*\*Phase:\*\* landed/)
  assert.match(readFileSync(join(s, 'spec.md'), 'utf8'), /\*\*Base:\*\* api@main, web@main\n\n\*\*Landings:\*\* api 001\n/)
  assert.equal(g('rev-parse', '--abbrev-ref', 'HEAD'), 'sdd/004-invoice-export/spec')
  assert.deepEqual(land(s, 'api'), { landed: [], stopped: null })
})

test('a landing stops on a failing suite at the tip, and folds the fix into the last squash', () => {
  const b = brain()
  const s = twoTracks(b, { apiM1: { t: { status: 'done' } } })
  const { repo, g } = builtRepo(b)
  writeFileSync(join(repo, 'f'), 'bad\n')
  g('commit', '-qam', 'ticket 001')
  const m1 = join(s, 'milestones/api/001-expand')
  squash(m1, { title: 'Breaks the suite' })
  const mainBefore = g('rev-parse', 'main')
  const r = land(s, 'api')
  assert.equal(r.stopped.at, 'tip')
  assert.equal(r.stopped.command, 'sh test.sh')
  assert.equal(g('rev-parse', '--abbrev-ref', 'HEAD'), 'sdd/004-invoice-export/spec')
  assert.equal(g('rev-parse', 'main'), mainBefore)
  assert.match(readFileSync(join(m1, 'milestone.md'), 'utf8'), /\*\*Landed:\*\* none/)

  writeFileSync(join(repo, 'f'), 'ok\nfixed\n')
  g('commit', '-qam', 'fixes the suite')
  assert.deepEqual(land(s, 'api', { fold: true }), { landed: ['001'], stopped: null })
  assert.equal(g('log', '-1', '--format=%s', 'main'), 'Breaks the suite')
  assert.equal(g('rev-list', '--count', 'main'), '2')
  assert.equal(readFileSync(join(repo, 'f'), 'utf8').replace(/\r/g, ''), 'ok\nfixed\n')
})
