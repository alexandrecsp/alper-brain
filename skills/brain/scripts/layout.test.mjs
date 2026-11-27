// Run: node --test skills/brain/scripts/layout.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { brainOfSpec, findBrain, kindOf, nameOf, noteHome, oldLayoutOf, pathsOf, specFolderOf } from './layout.mjs'

const put = (path, text = '') => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const folder = () => mkdtempSync(join(tmpdir(), 'brain-layout-')).split('\\').join('/')
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}

test('gives every path of the clusters layout under a .brain root', () => {
  const root = '/work/api/.brain'
  const c = pathsOf(root)
  assert.deepEqual(
    {
      root: c.root, brainMd: c.brainMd, gitignore: c.gitignore, repos: c.repos, card: c.card('api'),
      notes: c.notes, repoNotes: c.repoNotes('api'), sharedNotes: c.sharedNotes, research: c.research,
      docs: c.docs, repoDocs: c.repoDocs('api'), sharedDocs: c.sharedDocs, prototypes: c.prototypes,
      local: c.local, config: c.config, reposJson: c.reposJson, drafts: c.drafts, specs: c.specs,
      snapshots: c.snapshots('api'), explore: c.explore, locks: c.locks, handoff: c.handoff,
    },
    {
      root, brainMd: `${root}/BRAIN.md`, gitignore: `${root}/.gitignore`, repos: `${root}/repos`, card: `${root}/repos/api.md`,
      notes: `${root}/notes`, repoNotes: `${root}/notes/repos/api`, sharedNotes: `${root}/notes/shared`, research: `${root}/notes/research`,
      docs: `${root}/docs`, repoDocs: `${root}/docs/repos/api`, sharedDocs: `${root}/docs/shared`, prototypes: `${root}/docs/prototypes`,
      local: `${root}/.local`, config: `${root}/.local/config.json`, reposJson: `${root}/.local/repos.json`, drafts: `${root}/.local/drafts`,
      specs: `${root}/.local/specs`, snapshots: `${root}/.local/snapshots/api`, explore: `${root}/.local/explore`,
      locks: `${root}/.local/locks`, handoff: `${root}/.local/handoff`,
    },
  )
})

test('sends a note of one repository to its folder and any other note to notes/shared/', () => {
  const root = '/work/api/.brain'
  assert.deepEqual(
    [noteHome(root, ['api']), noteHome(root, ['api', 'web']), noteHome(root, [])],
    [`${root}/notes/repos/api`, `${root}/notes/shared`, `${root}/notes/shared`],
  )
})

test('finds the .brain folder of a folder holding .brain/BRAIN.md', () => {
  const f = folder()
  put(join(f, '.brain/BRAIN.md'), '---\nkind: standalone\n---\n')
  assert.equal(findBrain(f), `${f}/.brain`)
})

test('finds the same brain from the .brain folder itself', () => {
  const f = folder()
  put(join(f, '.brain/BRAIN.md'), '---\nkind: standalone\n---\n')
  assert.equal(findBrain(`${f}/.brain`), `${f}/.brain`)
})

test('finds no brain in a folder holding none', () => {
  assert.equal(findBrain(folder()), null)
})

test('reads the kind line of BRAIN.md', () => {
  const kinds = ['standalone', 'embedded', 'local'].map((kind) => {
    const root = `${folder()}/.brain`
    put(join(root, 'BRAIN.md'), `---\nname: x\nkind: ${kind}\n---\n\n# Brain\n`)
    return kindOf(root)
  })
  const bare = `${folder()}/.brain`
  put(join(bare, 'BRAIN.md'), '# Brain\n')
  const odd = `${folder()}/.brain`
  put(join(odd, 'BRAIN.md'), '---\nkind: shared\n---\n')
  assert.deepEqual([...kinds, kindOf(bare), kindOf(odd)], ['standalone', 'embedded', 'local', null, null])
})

test('names a brain after its remote\'s last segment without .git', () => {
  const names = ['git@github.com:acme/team-brain.git', 'https://github.com/acme/team-brain.git', 'https://github.com/acme/team-brain/'].map((url) => {
    const f = folder()
    put(join(f, '.brain/BRAIN.md'), '# Brain\n')
    git(f, 'init', '-q')
    git(f, 'remote', 'add', 'origin', url)
    return nameOf(`${f}/.brain`)
  })
  assert.deepEqual(names, ['team-brain', 'team-brain', 'team-brain'])
})

test('names a brain without a remote after the folder holding .brain', () => {
  const f = folder()
  put(join(f, '.brain/BRAIN.md'), '# Brain\n')
  git(f, 'init', '-q')
  assert.equal(nameOf(`${f}/.brain`), basename(f))
})

test('gives the brain root three levels above a spec folder', () => {
  assert.equal(brainOfSpec('/work/api/.brain/.local/specs/002-one-brain-folder'), '/work/api/.brain')
})

const SPEC = '/work/api/.brain/specs/003-x'

test('gives the spec folder of a spec path', () => {
  assert.equal(specFolderOf(`${SPEC}/spec.md`), SPEC)
})

test('gives the spec folder of a track path', () => {
  assert.equal(specFolderOf(`${SPEC}/milestones/api`), SPEC)
})

test('gives the spec folder of a milestone path', () => {
  assert.equal(specFolderOf(`${SPEC}/milestones/api/001-m/milestone.md`), SPEC)
})

test('gives the spec folder of a ticket path', () => {
  assert.equal(specFolderOf(`${SPEC}/milestones/api/001-m/001-t.md`), SPEC)
})

test('gives the spec folder of a flat-layout ticket path, and of a Windows path', () => {
  assert.deepEqual(
    [specFolderOf(`${SPEC}/milestones/001-m/001-t.md`), specFolderOf('C:\\specs\\app\\.brain\\specs\\003-x\\milestones\\001-m\\001-t.md')],
    [SPEC, 'C:/specs/app/.brain/specs/003-x'],
  )
})

test('detects each old layout by its kind', () => {
  const standalone = folder()
  put(join(standalone, 'BRAIN.md'), '# Brain\n')
  put(join(standalone, 'notes/authored/api-retry.md'), 'A fact.\n')
  put(join(standalone, '.brain/drafts/api-retry.md'), 'A draft.\n')
  const embedded = folder()
  put(join(embedded, 'brain/BRAIN.md'), '# Brain\n')
  put(join(embedded, 'brain/notes/authored/api-retry.md'), 'A fact.\n')
  const local = folder()
  put(join(local, '.brain-local/BRAIN.md'), '# Brain\n')
  const legacy = folder()
  put(join(legacy, 'BRAIN.md'), '# Brain\n')
  put(join(legacy, 'repos/api/REPO.md'), 'The api repository.\n')
  const sdd = folder()
  put(join(sdd, 'BRAIN.md'), '# Brain\n')
  put(join(sdd, 'notes/authored/api-retry.md'), 'A fact.\n')
  put(join(sdd, '.sdd/specs/001-x/spec.md'), '# X\n')
  assert.deepEqual(
    [standalone, embedded, local, legacy, sdd].map(oldLayoutOf),
    ['standalone', 'embedded', 'local', 'legacy', 'sdd'],
  )
})

test("detects today's one-folder brain, by the host or by its .brain, from each of its markers", () => {
  const markers = ['notes/authored/api-retry.md', 'notes/exploration/api/x.md', 'repos/api/REPO.md', 'specs/001-x/spec.md']
  const brains = markers.map((marker) => {
    const f = folder()
    put(join(f, '.brain/BRAIN.md'), '---\nkind: standalone\n---\n')
    put(join(f, '.brain', marker), 'x\n')
    return f
  })
  assert.deepEqual(
    [...brains.map(oldLayoutOf), ...brains.map((f) => oldLayoutOf(`${f}/.brain`))],
    Array(8).fill('one-folder'),
  )
})

test('detects a clusters brain as none', () => {
  const f = folder()
  put(join(f, '.brain/BRAIN.md'), '---\nkind: standalone\n---\n')
  put(join(f, '.brain/notes/shared/api-retry.md'), 'A fact.\n')
  put(join(f, '.brain/repos/api.md'), 'The api repository.\n')
  put(join(f, '.brain/.local/specs/001-x/spec.md'), '# X\n')
  assert.deepEqual([oldLayoutOf(f), oldLayoutOf(`${f}/.brain`), oldLayoutOf(folder())], [null, null, null])
})

test('gives the clusters paths for a root of any name', () => {
  const p = pathsOf('/work/api')
  assert.deepEqual([p.specs, p.config, p.reposJson, p.card('api'), p.drafts], ['/work/api/.local/specs', '/work/api/.local/config.json', '/work/api/.local/repos.json', '/work/api/repos/api.md', '/work/api/.local/drafts'])
})

test('holds no key of the one-folder layout', () => {
  const removed = ['authored', 'explorations', 'exploration', 'repoDir', 'tours', 'refactors', 'repoPages', 'pages']
  assert.deepEqual(removed.filter((key) => key in pathsOf('/work/api/.brain')), [])
})
