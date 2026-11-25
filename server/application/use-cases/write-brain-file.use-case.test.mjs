// Run: node --test server/application/use-cases/write-brain-file.use-case.test.mjs
// Reading and writing one file, at the application seam over the in-memory adapters.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { PathOutsideBrainError } from '../../domain/errors/path-outside-brain.error.mjs'
import { UnknownBrainError } from '../../domain/errors/unknown-brain.error.mjs'
import { inMemoryBrainFiles } from '../../infrastructure/driven/in-memory-brain-files.adapter.mjs'
import { inMemoryBrainList } from '../../infrastructure/driven/in-memory-brain-list.adapter.mjs'
import { readBrainFile } from './read-brain-file.use-case.mjs'
import { writeBrainFile } from './write-brain-file.use-case.mjs'

const root = resolve('/brains/work')
const wired = () => {
  const brainList = inMemoryBrainList([{ id: 'b1', name: 'work', path: root }])
  const brainFiles = inMemoryBrainFiles()
  return { read: readBrainFile({ brainList, brainFiles }), write: writeBrainFile({ brainList, brainFiles }) }
}

test('a written file reads back, and a file never written reads as null', () => {
  const { read, write } = wired()
  write('b1', 'notes/a.md', '# A\n')
  assert.deepEqual({ written: read('b1', 'notes/a.md'), missing: read('b1', 'notes/b.md') }, { written: '# A\n', missing: null })
})

test('a path outside the brain, or a brain that is not listed, is refused', () => {
  const { read, write } = wired()
  assert.deepEqual(
    [
      () => read('b1', '../other/a.md'),
      () => write('b1', '/etc/passwd', 'x'),
      () => write('b1', undefined, 'x'),
      () => read('nope', 'notes/a.md'),
    ].map((call) => { try { call() } catch (e) { return e.constructor } }),
    [PathOutsideBrainError, PathOutsideBrainError, PathOutsideBrainError, UnknownBrainError],
  )
})
