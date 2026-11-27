// Run: node --test skills/brain/scripts/migrate-layout.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fwd, kindOf } from './layout.mjs'

const script = join(dirname(fileURLToPath(import.meta.url)), 'migrate-layout.mjs')
const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const links = { api: 'C:/work/api' }
const CARD = '---\nslug: api\nremote: local only\n---\n\nThe api repository.\n'

// Runs git in a folder with a fixed author; returns its trimmed output.
const git = (dir, ...a) => {
  const r = spawnSync('git', ['-C', dir, '-c', 'core.autocrlf=false', '-c', 'user.name=Ana', '-c', 'user.email=ana@t', ...a], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim()
}
const commit = (dir, title) => { git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', title) }

// The old brain's team files, by layout, under `at`.
const notesTeam = (at) => {
  put(join(at, 'BRAIN.md'), '# Second brain\n\nOur notes.\n')
  put(join(at, 'timeline.json'), '{ "version": 1, "commits": [\n] }\n')
  put(join(at, 'notes/authored/retry.md'), 'retry\n')
  put(join(at, 'notes/repos/api/REPO.md'), CARD)
  put(join(at, 'notes/repos/api/explored/x.md'), 'x v1\n')
}
const legacyTeam = (at) => {
  put(join(at, 'BRAIN.md'), '# Second brain\n\nOur notes.\n')
  put(join(at, 'timeline.json'), '{ "version": 1, "commits": [\n] }\n')
  put(join(at, 'shared/retry.md'), 'retry\n')
  put(join(at, 'repos/api/REPO.md'), CARD)
  put(join(at, 'repos/api/limit.md'), 'limit\n')
  put(join(at, 'repos/api/explored/x.md'), 'x v1\n')
}
// The old brain's pipeline work, in its `.brain/` (or `.sdd/`) folder.
const pipeline = (dir) => {
  put(join(dir, 'drafts/d.md'), 'draft\n')
  put(join(dir, 'links.json'), JSON.stringify(links))
  put(join(dir, 'config.json'), '{}\n')
  put(join(dir, 'specs/001-x/spec.md'), 'spec\n')
  put(join(dir, 'research/r.md'), 'research\n')
  put(join(dir, 'tours/api/t.md'), 'tour\n')
  put(join(dir, 'refactors/api/r.md'), 'refactor\n')
  put(join(dir, 'snapshots/api/s.txt'), 'snapshot\n')
  put(join(dir, 'prototypes/p.html'), '<p>\n')
  put(join(dir, 'explore/api/area/a.md'), 'scratch\n')
  put(join(dir, 'locks/l.lock'), 'lock\n')
  put(join(dir, 'handoff/h.md'), 'handoff\n')
}

// A temporary git repository holding a brain of an old kind; returns the folder to migrate.
const brainOf = (kind) => {
  const folder = mkdtempSync(join(tmpdir(), `brain-migrate-${kind}-`))
  git(folder, 'init', '-q')
  if (kind === 'standalone') {
    notesTeam(folder); pipeline(join(folder, '.brain')); put(join(folder, 'CLAUDE.md'), 'agent\n')
    put(join(folder, '.gitignore'), '.brain/\n')
  }
  if (kind === 'legacy') {
    legacyTeam(folder); pipeline(join(folder, '.brain')); put(join(folder, 'CLAUDE.md'), 'agent\n')
    put(join(folder, '.gitignore'), '.brain/\n')
  }
  if (kind === 'sdd') {
    notesTeam(folder); pipeline(join(folder, '.sdd')); put(join(folder, 'CLAUDE.md'), 'agent\n')
    put(join(folder, '.gitignore'), '.sdd/\n')
  }
  if (kind === 'embedded') {
    put(join(folder, 'CLAUDE.md'), 'agent\n'); put(join(folder, 'src/app.js'), 'code\n')
    const b = join(folder, 'brain')
    notesTeam(b); pipeline(join(b, '.brain')); put(join(b, '.gitignore'), '.brain/\n')
  }
  if (kind === 'local') {
    put(join(folder, 'CLAUDE.md'), 'agent\n'); put(join(folder, 'src/app.js'), 'code\n')
    writeFileSync(join(folder, '.git/info/exclude'), '# local\n.brain-local/\n')
    const b = join(folder, '.brain-local')
    mkdirSync(b)
    git(b, 'init', '-q')
    notesTeam(b); pipeline(join(b, '.brain')); put(join(b, '.gitignore'), '.brain/\n')
    commit(b, 'Creates the second brain')
  }
  commit(folder, 'Creates the second brain')
  // `team` is the old brain's folder and `repo` the git repository holding it, before and after the move.
  const team = { embedded: join(folder, 'brain'), local: join(folder, '.brain-local') }[kind] ?? folder
  return { folder, team, repo: kind === 'local' ? team : folder, repoAfter: kind === 'local' ? join(folder, '.brain') : folder }
}

// Every file under a folder, as sorted relative paths with forward slashes, with no `.git`.
const files = (dir, rel = '') => readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((e) =>
  e.name === '.git' ? [] : e.isDirectory() ? files(dir, `${rel}${e.name}/`) : [`${rel}${e.name}`]).sort()
const migrate = (folder, ...args) => {
  const r = spawnSync(process.execPath, [script, folder, ...args], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}

// Every file of an older kind's brain once one run has taken it through both moves, under the host.
const NEW_BRAIN = [
  '.brain/.gitignore', '.brain/BRAIN.md',
  '.brain/.local/config.json', '.brain/.local/drafts/d.md', '.brain/.local/explore/api/area/a.md', '.brain/.local/handoff/h.md',
  '.brain/.local/locks/l.lock', '.brain/.local/repos.json', '.brain/.local/specs/001-x/spec.md',
  '.brain/docs/prototypes/p.html', '.brain/docs/repos/api/r-refactors.md', '.brain/docs/repos/api/t-tour.md',
  '.brain/notes/repos/api/x.md', '.brain/notes/research/r.md', '.brain/notes/shared/retry.md', '.brain/repos/api.md',
]

test('a standalone brain ends in the clusters layout after one run', () => {
  const { folder } = brainOf('standalone')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', ...NEW_BRAIN].sort())
})

test('an embedded brain ends in the clusters layout after one run', () => {
  const { folder } = brainOf('embedded')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', 'src/app.js', ...NEW_BRAIN].sort())
})

test('a local brain ends in the clusters layout after one run', () => {
  const { folder } = brainOf('local')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', 'src/app.js', ...NEW_BRAIN].sort())
})

test('a legacy brain ends in the clusters layout after one run', () => {
  const { folder } = brainOf('legacy')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', '.brain/notes/shared/limit.md', ...NEW_BRAIN].sort())
})

test('a brain with a .sdd folder ends in the clusters layout after one run', () => {
  const { folder } = brainOf('sdd')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', ...NEW_BRAIN].sort())
})

for (const kind of ['standalone', 'embedded', 'local']) {
  test(`git log --follow lists a moved note's earlier commits in a ${kind} brain`, () => {
    const { folder, team, repo, repoAfter } = brainOf(kind)
    put(join(team, 'notes/repos/api/explored/x.md'), 'x v2\n')
    commit(repo, 'Updates x')
    assert.equal(migrate(folder).status, 0)
    commit(repoAfter, 'Moves the brain')
    const note = kind === 'local' ? 'notes/repos/api/x.md' : '.brain/notes/repos/api/x.md'
    assert.deepEqual(git(repoAfter, 'log', '--follow', '--format=%s', '--', note).split('\n'), ['Moves the brain', 'Updates x', 'Creates the second brain'])
  })
}

test('a tracked note moves with git mv, so the index holds it as a rename', () => {
  const { folder } = brainOf('standalone')
  assert.equal(migrate(folder).status, 0)
  const renames = git(folder, 'diff', '--cached', '--name-status').split('\n').filter((l) => l.startsWith('R'))
  assert.ok(renames.some((l) => l.endsWith('notes/repos/api/explored/x.md\t.brain/notes/repos/api/x.md')), renames.join('\n'))
})

for (const kind of ['standalone', 'embedded', 'local']) {
  test(`BRAIN.md holds kind ${kind} after the move`, () => {
    const { folder } = brainOf(kind)
    assert.equal(migrate(folder).status, 0)
    assert.equal(kindOf(join(folder, '.brain')), kind)
  })
}

test('the new .gitignore ignores the machine-only paths and not the team\'s', () => {
  const { folder } = brainOf('standalone')
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual(git(join(folder, '.brain'), 'ls-files', '-o', '-i', '--exclude-standard').split('\n').sort(), [
    '.local/config.json', '.local/drafts/d.md', '.local/explore/api/area/a.md', '.local/handoff/h.md', '.local/locks/l.lock',
    '.local/repos.json', '.local/specs/001-x/spec.md',
  ])
})

test('repos.json holds what links.json held', () => {
  const { folder } = brainOf('standalone')
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual(JSON.parse(readFileSync(join(folder, '.brain/.local/repos.json'), 'utf8')), links)
})

test('timeline.json is deleted', () => {
  const { folder } = brainOf('standalone')
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual([existsSync(join(folder, 'timeline.json')), git(folder, 'ls-files', 'timeline.json')], [false, ''])
})

test("a local brain's host exclude names .brain/ and not .brain-local/", () => {
  const { folder } = brainOf('local')
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual(readFileSync(join(folder, '.git/info/exclude'), 'utf8').trim().split(/\r?\n/), ['# local', '.brain/'])
})

test("an embedded brain's run prints the agent-file line", () => {
  const { folder } = brainOf('embedded')
  const r = migrate(folder)
  assert.ok(r.out.split(/\r?\n/).includes("- `.brain/`: this repository's second brain (see `.brain/BRAIN.md`). Before changing code, invoke the `brain` skill to recall its notes."), r.out)
})

// Every file of a folder with its text, and the host's exclude file, to compare a folder before and after a run.
const snapshot = (dir) => ({
  files: Object.fromEntries(files(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')])),
  exclude: readFileSync(join(dir, '.git/info/exclude'), 'utf8'),
})

for (const kind of ['standalone', 'embedded', 'local']) {
  test(`--dry-run prints the plan and changes no file of a ${kind} brain`, () => {
    const { folder } = brainOf(kind)
    const before = snapshot(folder)
    const r = migrate(folder, '--dry-run')
    assert.deepEqual([r.status, /^move .*notes\/repos\/api\/explored\/x\.md -> .*notes\/exploration\/api\/x\.md$/m.test(r.out), snapshot(folder)], [0, true, before])
  })
}

// One run takes an older kind through both moves: the second run finds nothing.
for (const kind of ['standalone', 'embedded', 'local', 'legacy', 'sdd']) {
  test(`a run after the brain reaches the clusters layout reports nothing to move and changes no file of a ${kind} brain`, () => {
    const { folder } = brainOf(kind)
    assert.equal(migrate(folder).status, 0)
    const after = snapshot(folder)
    const r = migrate(folder)
    assert.deepEqual([r.status, r.out.startsWith('Nothing to move'), snapshot(folder)], [0, true, after])
  })
}

test("an embedded brain's tracked files move and go through git, so the host's index holds renames and the deletion", () => {
  const { folder } = brainOf('embedded')
  assert.equal(migrate(folder).status, 0)
  const staged = git(folder, 'diff', '--cached', '--name-status').split('\n')
  assert.deepEqual(
    {
      renamed: staged.some((l) => l.startsWith('R') && l.endsWith('brain/notes/repos/api/explored/x.md\t.brain/notes/repos/api/x.md')),
      deleted: staged.includes('D\tbrain/timeline.json'),
    },
    { renamed: true, deleted: true },
    staged.join('\n'),
  )
})

// A preload that logs the git commands the script spawns with whether each passes `windowsHide`, one JSON line per call.
const spawnLog = () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-migrate-spawns-'))
  const preload = join(dir, 'log-spawns.mjs')
  writeFileSync(preload, [
    "import cp from 'node:child_process'",
    "import { appendFileSync } from 'node:fs'",
    "import { syncBuiltinESMExports } from 'node:module'",
    'const real = cp.spawnSync',
    "cp.spawnSync = (command, args, options) => { appendFileSync(process.env.SPAWN_LOG, JSON.stringify({ command, hidden: options?.windowsHide === true }) + String.fromCharCode(10)); return real(command, args, options) }",
    'syncBuiltinESMExports()',
  ].join('\n'))
  return { preload: pathToFileURL(preload).href, log: join(dir, 'spawns.log') }
}

test('every git call of a local-brain move passes windowsHide', () => {
  const { folder } = brainOf('local')
  const { preload, log } = spawnLog()
  const r = spawnSync(process.execPath, ['--import', preload, script, folder], { encoding: 'utf8', env: { ...process.env, SPAWN_LOG: log } })
  assert.equal(r.status, 0, r.stderr)
  const calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((c) => c.command === 'git')
  assert.deepEqual({ spawned: calls.length >= 3, shown: calls.filter((c) => !c.hidden).length }, { spawned: true, shown: 0 })
})

// ---------- the one-folder move: today's layout into the clusters layout ----------

const OLD_IGNORE = ['config.json', 'notes/drafts/', 'repos/repos.json', 'repos/*/snapshots/', 'specs/', 'explore/', 'locks/', 'handoff/'].join('\n') + '\n'
const noteOn = (repos, text) => `---\nrepos: ${repos}\n---\n\n${text}\n`

// A brain root in today's layout: every kind of file the one-folder move places, the ignored ones included.
const oneFolderTeam = (root) => {
  put(join(root, 'BRAIN.md'), '---\nkind: standalone\n---\n\n# Second brain\n')
  put(join(root, '.gitignore'), OLD_IGNORE)
  put(join(root, 'notes/authored/retry.md'), noteOn('[api]', 'retry v1'))
  put(join(root, 'notes/authored/both.md'), noteOn('[api, web]', 'both'))
  put(join(root, 'notes/authored/loose.md'), '---\nname: loose\n---\n\nloose\n')
  put(join(root, 'notes/exploration/api/x.md'), '---\nexplored: abc\n---\n\nx\n')
  put(join(root, 'repos/api/REPO.md'), CARD)
  put(join(root, 'repos/api/tours/2026-01-02-0304.html'), 'tour\n')
  put(join(root, 'repos/api/refactors/2026-02-03-0405.html'), 'refactors\n')
  put(join(root, 'repos/api/pages/2026-03-04-0506-intro.html'), 'page\n')
  put(join(root, 'pages/overview.html'), 'overview\n')
  put(join(root, 'prototypes/p.html'), '<p>\n')
  put(join(root, 'research/r.md'), 'research\n')
  put(join(root, 'config.json'), '{}\n')
  put(join(root, 'repos/repos.json'), JSON.stringify(links))
  put(join(root, 'notes/drafts/d.md'), 'draft\n')
  put(join(root, 'specs/001-x/spec.md'), 'spec\n')
  put(join(root, 'specs/001-x/milestones/api/001-m/milestone.md'), 'milestone\n')
  put(join(root, 'specs/001-x/milestones/002-flat/milestone.md'), 'flat milestone\n')
  put(join(root, 'explore/api/area/a.md'), 'scratch\n')
  put(join(root, 'locks/api.json'), '{}\n')
  put(join(root, 'handoff/h.md'), 'handoff\n')
}

// A temporary host holding a brain in today's layout: `standalone` tracks it in the host's repository, `local` keeps it in a
// repository of its own that the host ignores. `repo` is the repository holding the brain's files.
const oneFolderBrain = (kind, extra = () => {}) => {
  const folder = mkdtempSync(join(tmpdir(), `brain-clusters-${kind}-`))
  git(folder, 'init', '-q')
  put(join(folder, 'CLAUDE.md'), 'agent\n')
  const root = join(folder, '.brain')
  oneFolderTeam(root)
  extra(root)
  if (kind === 'local') {
    writeFileSync(join(folder, '.git/info/exclude'), '.brain/\n')
    git(root, 'init', '-q')
    commit(root, 'Creates the second brain')
  }
  commit(folder, 'Creates the host')
  return { folder, root, repo: kind === 'local' ? root : folder }
}

const CLUSTERS = [
  '.brain/.gitignore', '.brain/BRAIN.md',
  '.brain/.local/config.json', '.brain/.local/drafts/d.md', '.brain/.local/explore/api/area/a.md', '.brain/.local/handoff/h.md',
  '.brain/.local/locks/api.json', '.brain/.local/repos.json', '.brain/.local/specs/001-x/002-flat/milestone.md',
  '.brain/.local/specs/001-x/api/001-m/milestone.md', '.brain/.local/specs/001-x/spec.md',
  '.brain/docs/prototypes/p.html', '.brain/docs/repos/api/2026-01-02-0304-tour.html', '.brain/docs/repos/api/2026-02-03-0405-refactors.html',
  '.brain/docs/repos/api/2026-03-04-0506-intro.html', '.brain/docs/shared/overview.html',
  '.brain/notes/repos/api/retry.md', '.brain/notes/repos/api/x.md', '.brain/notes/research/r.md', '.brain/notes/shared/both.md',
  '.brain/notes/shared/loose.md', '.brain/repos/api.md',
]

test('a one-folder brain, given its host, ends with every file at its new path and none at an old one', () => {
  const { folder } = oneFolderBrain('standalone')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', ...CLUSTERS].sort())
})

test('a one-folder brain, given its .brain folder, ends with every file at its new path and none at an old one', () => {
  const { folder, root } = oneFolderBrain('standalone')
  const r = migrate(root)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', ...CLUSTERS].sort())
})

test('a local one-folder brain, in a repository of its own, ends with every file at its new path', () => {
  const { folder } = oneFolderBrain('local')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', ...CLUSTERS].sort())
})

test('each tour and refactor report carries its kind in its file name, and a page keeps its name', () => {
  const { folder } = oneFolderBrain('standalone')
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual(readdirSync(join(folder, '.brain/docs/repos/api')).sort(), [
    '2026-01-02-0304-tour.html', '2026-02-03-0405-refactors.html', '2026-03-04-0506-intro.html',
  ])
})

test('the new .gitignore is the one line .local/', () => {
  const { folder } = oneFolderBrain('standalone')
  assert.equal(migrate(folder).status, 0)
  assert.equal(readFileSync(join(folder, '.brain/.gitignore'), 'utf8'), '.local/\n')
})

for (const kind of ['standalone', 'local']) {
  test(`git log --follow lists a moved authored note's earlier commits in a ${kind} brain`, () => {
    const { folder, root, repo } = oneFolderBrain(kind)
    put(join(root, 'notes/authored/retry.md'), noteOn('[api]', 'retry v2'))
    commit(repo, 'Updates retry')
    assert.equal(migrate(folder).status, 0)
    commit(repo, 'Moves the brain')
    const note = kind === 'local' ? 'notes/repos/api/retry.md' : '.brain/notes/repos/api/retry.md'
    assert.deepEqual(git(repo, 'log', '--follow', '--format=%s', '--', note).split('\n'), ['Moves the brain', 'Updates retry', kind === 'local' ? 'Creates the second brain' : 'Creates the host'])
  })
}

test("a one-folder brain's --dry-run prints the plan and changes no file", () => {
  const { folder } = oneFolderBrain('standalone')
  const before = snapshot(folder)
  const r = migrate(folder, '--dry-run')
  assert.deepEqual(
    [r.status, /^move .*notes\/authored\/retry\.md -> .*notes\/repos\/api\/retry\.md$/m.test(r.out), git(folder, 'status', '--porcelain'), snapshot(folder)],
    [0, true, '', before],
  )
})

test('a second run of the one-folder move reports nothing to move and changes no file', () => {
  const { folder } = oneFolderBrain('standalone')
  assert.equal(migrate(folder).status, 0)
  const after = snapshot(folder)
  const r = migrate(folder)
  assert.deepEqual([r.status, r.out.startsWith('Nothing to move'), snapshot(folder)], [0, true, after])
})

// ---------- the drafts and snapshots of the one-folder move ----------

const draftOf = (action, target, repos) => `---\naction: ${action}\ntarget: ${target}\n${repos ? `repos: ${repos}\n` : ''}---\n\nbody\n`
// Each draft's `target`, by the draft's file name, read from the brain's drafts folder.
const targetsOf = (folder) => Object.fromEntries(readdirSync(join(folder, '.brain/.local/drafts')).map((f) =>
  [f, /^target: (.*)$/m.exec(readFileSync(join(folder, '.brain/.local/drafts', f), 'utf8'))?.[1]]))
const withDrafts = (drafts) => (root) => { for (const [name, text] of Object.entries(drafts)) put(join(root, 'notes/drafts', name), text) }

test("a record draft naming one repository targets that repository's notes folder", () => {
  const { folder } = oneFolderBrain('standalone', withDrafts({ 'rec-one.md': draftOf('record', 'notes/authored/rec-one.md', '[api]') }))
  assert.equal(migrate(folder).status, 0)
  assert.equal(targetsOf(folder)['rec-one.md'], 'notes/repos/api/rec-one.md')
})

test('a record draft naming several repositories or none targets notes/shared/', () => {
  const { folder } = oneFolderBrain('standalone', withDrafts({
    'rec-many.md': draftOf('record', 'notes/authored/rec-many.md', '[api, web]'),
    'rec-none.md': draftOf('record', 'notes/authored/rec-none.md'),
  }))
  assert.equal(migrate(folder).status, 0)
  const targets = targetsOf(folder)
  assert.deepEqual([targets['rec-many.md'], targets['rec-none.md']], ['notes/shared/rec-many.md', 'notes/shared/rec-none.md'])
})

test('an update draft targets the new path of its note', () => {
  const { folder } = oneFolderBrain('standalone', withDrafts({
    // Each draft changes its note's `repos` line: its target is still where the note sits, which the consolidation then moves.
    'upd-one.md': draftOf('update', 'notes/authored/retry.md', '[api, web]'),
    'upd-many.md': draftOf('update', 'notes/authored/both.md', '[api]'),
  }))
  assert.equal(migrate(folder).status, 0)
  const targets = targetsOf(folder)
  assert.deepEqual([targets['upd-one.md'], targets['upd-many.md']], ['notes/repos/api/retry.md', 'notes/shared/both.md'])
})

test("a delete draft targets the new path of its note, explored notes included", () => {
  const { folder } = oneFolderBrain('standalone', withDrafts({
    'del-authored.md': draftOf('delete', 'notes/authored/loose.md'),
    'del-explored.md': draftOf('delete', 'notes/exploration/api/x.md'),
  }))
  assert.equal(migrate(folder).status, 0)
  const targets = targetsOf(folder)
  assert.deepEqual([targets['del-authored.md'], targets['del-explored.md']], ['notes/shared/loose.md', 'notes/repos/api/x.md'])
})

test('a draft whose target is in the legacy layout maps to its new path', () => {
  const { folder } = brainOf('legacy')
  put(join(folder, '.brain/drafts/upd-old.md'), draftOf('update', 'repos/api/limit.md', '[api]'))
  put(join(folder, '.brain/drafts/rec-old.md'), draftOf('record', 'shared/new.md', '[api]'))
  assert.equal(migrate(folder).status, 0)
  const targets = targetsOf(folder)
  assert.deepEqual([targets['upd-old.md'], targets['rec-old.md']], ['notes/shared/limit.md', 'notes/repos/api/new.md'])
})

test("a delete draft of a notes-era brain targets the new path of its explored note", () => {
  const { folder } = brainOf('standalone')
  put(join(folder, '.brain/drafts/del-old.md'), draftOf('delete', 'notes/repos/api/explored/x.md'))
  assert.equal(migrate(folder).status, 0)
  assert.equal(targetsOf(folder)['del-old.md'], 'notes/repos/api/x.md')
})

// A clone with one commit, and a snapshot of it that a skill left in the brain: a worktree of the clone at repos/api/snapshots.
const withSnapshot = (clone) => (root) => {
  mkdirSync(clone, { recursive: true })
  git(clone, 'init', '-q')
  put(join(clone, 'app.js'), 'code\n')
  commit(clone, 'Creates the clone')
  git(clone, 'worktree', 'add', '--detach', join(root, 'repos/api/snapshots'), 'HEAD')
  put(join(root, 'repos/repos.json'), JSON.stringify({ api: fwd(clone) }))
}
const cloneAt = () => join(mkdtempSync(join(tmpdir(), 'brain-clone-')), 'api')

test('a leftover snapshot is removed from the brain', () => {
  const clone = cloneAt()
  const { folder } = oneFolderBrain('standalone', withSnapshot(clone))
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual([existsSync(join(folder, '.brain/repos/api/snapshots')), existsSync(join(folder, '.brain/.local/snapshots'))], [false, false])
})

test("a leftover snapshot is removed through its clone's worktree list", () => {
  const clone = cloneAt()
  const { folder } = oneFolderBrain('standalone', withSnapshot(clone))
  assert.equal(migrate(folder).status, 0)
  assert.equal(git(clone, 'worktree', 'list').split('\n').length, 1)
})

test("an older kind's leftover snapshot is removed through its clone's worktree list, not moved with its brain", () => {
  const clone = cloneAt()
  const { folder } = brainOf('standalone')
  mkdirSync(clone, { recursive: true })
  git(clone, 'init', '-q')
  put(join(clone, 'app.js'), 'code\n')
  commit(clone, 'Creates the clone')
  rmSync(join(folder, '.brain/snapshots'), { recursive: true })
  git(clone, 'worktree', 'add', '--detach', join(folder, '.brain/snapshots/api'), 'HEAD')
  put(join(folder, '.brain/links.json'), JSON.stringify({ api: fwd(clone) }))
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual([git(clone, 'worktree', 'list').split('\n').length, existsSync(join(folder, '.brain/snapshots'))], [1, false])
})
