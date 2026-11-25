// Run: node --test server/application/use-cases/remove-brain.use-case.test.mjs
// The remove use case, over the in-memory brain list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inMemoryBrainList } from '../../infrastructure/driven/in-memory-brain-list.adapter.mjs'
import { removeBrain } from './remove-brain.use-case.mjs'

const a = { id: 'a', name: 'a', path: '/a' }
const b = { id: 'b', name: 'b', path: '/b' }

test('removes the brain of that id and keeps the others', () => {
  const brainList = inMemoryBrainList([a, b])
  removeBrain({ brainList })('a')
  assert.deepEqual(brainList.all(), [b])
})

test('an id nobody has changes nothing', () => {
  const brainList = inMemoryBrainList([a, b])
  removeBrain({ brainList })('zzz')
  assert.deepEqual(brainList.all(), [a, b])
})
