// Run: node --test server/application/use-cases/add-brain.use-case.test.mjs
// The add use case, over the in-memory brain list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { nameOf } from '../../../skills/brain/scripts/layout.mjs'
import { inMemoryBrainList } from '../../infrastructure/driven/in-memory-brain-list.adapter.mjs'
import { addBrain } from './add-brain.use-case.mjs'

const folder = (...parts) => resolve('/brains', ...parts)
const setup = () => {
  const brainList = inMemoryBrainList()
  let n = 0
  return { brainList, add: addBrain({ brainList, brainFolderOf: (path) => (path.endsWith('empty') ? null : path), nameOf: (path) => basename(path), newId: () => `id-${++n}` }) }
}

test('adds a brain named by its folder, with the status its BRAIN.md gives', () => {
  const { brainList, add } = setup()
  const path = folder('work')
  const entry = add(path)
  assert.deepEqual({ entry, listed: brainList.all() }, { entry: { id: 'id-1', name: 'work', path, status: 'ok' }, listed: [{ id: 'id-1', name: 'work', path }] })
})

test('a folder without a BRAIN.md comes back with status missing', () => {
  const { add } = setup()
  assert.equal(add(folder('empty')).status, 'missing')
})

test('a listed path comes back as its first entry, and is not listed twice', () => {
  const { brainList, add } = setup()
  const first = add(folder('work'))
  assert.deepEqual({ second: add(folder('work')), count: brainList.all().length }, { second: first, count: 1 })
})

test('a clashing name gets a number suffix', () => {
  const { add } = setup()
  assert.deepEqual([add(folder('a', 'work')).name, add(folder('b', 'work')).name, add(folder('c', 'work')).name], ['work', 'work 2', 'work 3'])
})

test('a path that is not absolute is refused and leaves the list as it was', () => {
  const { brainList, add } = setup()
  assert.throws(() => add('work'), { name: 'Error', message: /absolute/ })
  assert.deepEqual(brainList.all(), [])
})

// A temporary repository `name` holding `.brain/`, with the origin `remote` when given; its `.brain/` path.
const brainFolder = (name, remote) => {
  const repo = join(mkdtempSync(join(tmpdir(), 'alper-brain-')), name)
  mkdirSync(join(repo, '.brain'), { recursive: true })
  if (remote) {
    execFileSync('git', ['init', '-q', repo], { windowsHide: true })
    execFileSync('git', ['-C', repo, 'remote', 'add', 'origin', remote], { windowsHide: true })
  }
  return join(repo, '.brain')
}
const realSetup = () => {
  const brainList = inMemoryBrainList()
  return addBrain({ brainList, brainFolderOf: (path) => path, nameOf, newId: () => 'id-1' })
}

test('a brain in .brain is named after its remote without .git', () => {
  assert.equal(realSetup()(brainFolder('work', 'git@github.com:acme/acme-notes.git')).name, 'acme-notes')
})

test('a brain in .brain with no remote is named after the folder holding it, never .brain', () => {
  assert.equal(realSetup()(brainFolder('work')).name, 'work')
})
