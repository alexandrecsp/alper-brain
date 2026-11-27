// Run: node --test server/application/use-cases/pick-brain.use-case.test.mjs
// The pick use case, over a folder picker that answers what the test says and the in-memory brain list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { basename, resolve } from 'node:path'
import { NoFolderPickerError } from '../../domain/errors/no-folder-picker.error.mjs'
import { NotABrainError } from '../../domain/errors/not-a-brain.error.mjs'
import { inMemoryBrainList } from '../../infrastructure/driven/in-memory-brain-list.adapter.mjs'
import { addBrain } from './add-brain.use-case.mjs'
import { pickBrain } from './pick-brain.use-case.mjs'

// `picked` is what the dialog answers: a path, null for a cancel, or an error it rejects with.
const setup = (picked) => {
  const brainList = inMemoryBrainList()
  const brainFolderOf = (path) => (path.endsWith('empty') ? null : path)
  const add = addBrain({ brainList, brainFolderOf, nameOf: (path) => basename(path), newId: () => 'id-1' })
  const folderPicker = { pick: async () => { if (picked instanceof Error) throw picked; return picked } }
  return { brainList, pick: pickBrain({ folderPicker, brainFolderOf, add }) }
}

test('the picked brain folder is added and its entry comes back', async () => {
  const path = resolve('/brains', 'work')
  const { brainList, pick } = setup(path)
  assert.deepEqual({ entry: await pick(), listed: brainList.all() }, { entry: { id: 'id-1', name: 'work', path, status: 'ok' }, listed: [{ id: 'id-1', name: 'work', path }] })
})

test('a cancelled dialog adds nothing and comes back null', async () => {
  const { brainList, pick } = setup(null)
  assert.deepEqual({ entry: await pick(), listed: brainList.all() }, { entry: null, listed: [] })
})

test('a picked folder holding no brain is refused and left off the list', async () => {
  const { brainList, pick } = setup(resolve('/brains', 'empty'))
  await assert.rejects(pick(), NotABrainError)
  assert.deepEqual(brainList.all(), [])
})

test('a machine with no dialog rejects with NoFolderPickerError', async () => {
  const { pick } = setup(new NoFolderPickerError('test'))
  await assert.rejects(pick(), NoFolderPickerError)
})
