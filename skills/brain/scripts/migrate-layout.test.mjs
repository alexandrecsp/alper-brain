// Run: node --test skills/brain/scripts/migrate-layout.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { kindOf } from './layout.mjs'

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

const NEW_BRAIN = [
  '.brain/.gitignore', '.brain/BRAIN.md', '.brain/config.json', '.brain/explore/api/area/a.md', '.brain/handoff/h.md',
  '.brain/locks/l.lock', '.brain/notes/authored/retry.md', '.brain/notes/drafts/d.md', '.brain/notes/exploration/api/x.md',
  '.brain/prototypes/p.html', '.brain/repos/api/REPO.md', '.brain/repos/api/refactors/r.md', '.brain/repos/api/snapshots/s.txt',
  '.brain/repos/api/tours/t.md', '.brain/repos/repos.json', '.brain/research/r.md', '.brain/specs/001-x/spec.md',
]

test('a standalone brain ends with every file at its new path', () => {
  const { folder } = brainOf('standalone')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', ...NEW_BRAIN].sort())
})

test('an embedded brain ends with every file at its new path', () => {
  const { folder } = brainOf('embedded')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', 'src/app.js', ...NEW_BRAIN].sort())
})

test('a local brain ends with every file at its new path', () => {
  const { folder } = brainOf('local')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', 'src/app.js', ...NEW_BRAIN].sort())
})

test('a legacy brain ends with every file at its new path', () => {
  const { folder } = brainOf('legacy')
  const r = migrate(folder)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(files(folder), ['CLAUDE.md', '.brain/notes/authored/limit.md', ...NEW_BRAIN].sort())
})

test('a brain with a .sdd folder ends with every file at its new path', () => {
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
    const note = kind === 'local' ? 'notes/exploration/api/x.md' : '.brain/notes/exploration/api/x.md'
    assert.deepEqual(git(repoAfter, 'log', '--follow', '--format=%s', '--', note).split('\n'), ['Moves the brain', 'Updates x', 'Creates the second brain'])
  })
}

test('a tracked note moves with git mv, so the index holds it as a rename', () => {
  const { folder } = brainOf('standalone')
  assert.equal(migrate(folder).status, 0)
  const renames = git(folder, 'diff', '--cached', '--name-status').split('\n').filter((l) => l.startsWith('R'))
  assert.ok(renames.some((l) => l.endsWith('notes/repos/api/explored/x.md\t.brain/notes/exploration/api/x.md')), renames.join('\n'))
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
    'config.json', 'explore/api/area/a.md', 'handoff/h.md', 'locks/l.lock', 'notes/drafts/d.md', 'repos/api/snapshots/s.txt',
    'repos/repos.json', 'specs/001-x/spec.md',
  ])
})

test('repos.json holds what links.json held', () => {
  const { folder } = brainOf('standalone')
  assert.equal(migrate(folder).status, 0)
  assert.deepEqual(JSON.parse(readFileSync(join(folder, '.brain/repos/repos.json'), 'utf8')), links)
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

for (const kind of ['standalone', 'embedded', 'local', 'legacy', 'sdd']) {
  test(`a second run reports nothing to move and changes no file of a ${kind} brain`, () => {
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
      renamed: staged.some((l) => l.startsWith('R') && l.endsWith('brain/notes/repos/api/explored/x.md\t.brain/notes/exploration/api/x.md')),
      deleted: staged.includes('D\tbrain/timeline.json'),
    },
    { renamed: true, deleted: true },
    staged.join('\n'),
  )
})
