// Run: node --test skills/brain/scripts/layout.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { brainOfSpec, findBrain, kindOf, nameOf, oldLayoutOf, pathsOf } from './layout.mjs'

const put = (path, text = '') => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const folder = () => mkdtempSync(join(tmpdir(), 'brain-layout-')).split('\\').join('/')
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}

test('gives every path of the layout tree under a .brain root', () => {
  const root = '/work/api/.brain'
  const p = pathsOf(root)
  assert.deepEqual(
    {
      brainMd: p.brainMd, gitignore: p.gitignore, config: p.config,
      notes: p.notes, authored: p.authored, exploration: p.exploration('api'), drafts: p.drafts,
      repos: p.repos, reposJson: p.reposJson, repoDir: p.repoDir('api'), card: p.card('api'),
      tours: p.tours('api'), refactors: p.refactors('api'), repoPages: p.repoPages('api'), snapshots: p.snapshots('api'),
      pages: p.pages, prototypes: p.prototypes, research: p.research, specs: p.specs, explore: p.explore,
      locks: p.locks, handoff: p.handoff,
    },
    {
      brainMd: `${root}/BRAIN.md`, gitignore: `${root}/.gitignore`, config: `${root}/config.json`,
      notes: `${root}/notes`, authored: `${root}/notes/authored`, exploration: `${root}/notes/exploration/api`, drafts: `${root}/notes/drafts`,
      repos: `${root}/repos`, reposJson: `${root}/repos/repos.json`, repoDir: `${root}/repos/api`, card: `${root}/repos/api/REPO.md`,
      tours: `${root}/repos/api/tours`, refactors: `${root}/repos/api/refactors`, repoPages: `${root}/repos/api/pages`, snapshots: `${root}/repos/api/snapshots`,
      pages: `${root}/pages`, prototypes: `${root}/prototypes`, research: `${root}/research`, specs: `${root}/specs`, explore: `${root}/explore`,
      locks: `${root}/locks`, handoff: `${root}/handoff`,
    },
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

test('gives the brain root two levels above a spec folder', () => {
  assert.equal(brainOfSpec('/work/api/.brain/specs/002-one-brain-folder'), '/work/api/.brain')
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

test('detects a new-layout brain as none', () => {
  const f = folder()
  put(join(f, '.brain/BRAIN.md'), '---\nkind: standalone\n---\n')
  put(join(f, '.brain/notes/authored/api-retry.md'), 'A fact.\n')
  assert.deepEqual([oldLayoutOf(f), oldLayoutOf(`${f}/.brain`), oldLayoutOf(folder())], [null, null, null])
})

test('gives the .brain paths for a root of any name', () => {
  const p = pathsOf('/work/api')
  assert.deepEqual([p.specs, p.config, p.reposJson, p.card('api'), p.drafts], ['/work/api/specs', '/work/api/config.json', '/work/api/repos/repos.json', '/work/api/repos/api/REPO.md', '/work/api/notes/drafts'])
})
