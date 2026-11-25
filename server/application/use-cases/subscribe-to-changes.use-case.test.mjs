// Run: node --test server/application/use-cases/subscribe-to-changes.use-case.test.mjs
// Subscribing to a brain's changes, at the application seam over the in-memory adapters.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { inMemoryBrainFiles } from '../../infrastructure/driven/in-memory-brain-files.adapter.mjs'
import { inMemoryBrainList } from '../../infrastructure/driven/in-memory-brain-list.adapter.mjs'
import { brainCopies } from '../services/brain-copies.service.mjs'
import { readBrainFiles } from './read-brain-files.use-case.mjs'
import { subscribeToChanges } from './subscribe-to-changes.use-case.mjs'
import { writeBrainFile } from './write-brain-file.use-case.mjs'

const root = resolve('/brains/work')
const wired = () => {
  const brainList = inMemoryBrainList([{ id: 'b1', name: 'work', path: root }])
  const brainFiles = inMemoryBrainFiles({ [root]: { 'notes/a.md': '# A\n' } })
  const copies = brainCopies({ brainList, brainFiles })
  return { subscribe: subscribeToChanges({ brainCopies: copies }), read: readBrainFiles({ brainCopies: copies }), write: writeBrainFile({ brainList, brainFiles }) }
}

test('a subscriber is told a written file, and the brain then reads with it', () => {
  const { subscribe, read, write } = wired()
  const told = []
  subscribe((change) => told.push(change))
  write('b1', 'notes/b.md', '# B\n')
  assert.deepEqual({ told, files: read('b1').files }, {
    told: [{ brain: 'b1', changed: { 'notes/b.md': '# B\n' }, times: {} }],
    files: { 'notes/a.md': '# A\n', 'notes/b.md': '# B\n' },
  })
})

test('a subscriber that has unsubscribed is told nothing', () => {
  const { subscribe, write } = wired()
  const told = []
  subscribe((change) => told.push(change))()
  write('b1', 'notes/b.md', '# B\n')
  assert.deepEqual(told, [])
})
