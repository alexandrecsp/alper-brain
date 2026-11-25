// Run: node --test server/infrastructure/driven/fs-brain-files.adapter.test.mjs
// The brain files port over node:fs: its watcher leaves alone what the brain's .gitignore ignores.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fsBrainFiles } from './fs-brain-files.adapter.mjs'

const brainWith = (gitignore) => {
  const host = mkdtempSync(join(tmpdir(), 'brain-files-'))
  const root = join(host, '.brain')
  mkdirSync(join(root, 'locks'), { recursive: true })
  mkdirSync(join(root, 'notes', 'authored'), { recursive: true })
  writeFileSync(join(root, 'BRAIN.md'), '---\nkind: standalone\n---\n')
  writeFileSync(join(root, '.gitignore'), gitignore)
  return { host, root }
}

test('the watcher reports a change to a note, and none to a file the .gitignore ignores', async () => {
  const { host, root } = brainWith('locks/\n')
  let calls = 0
  const stop = fsBrainFiles().watch(root, () => { calls++ })
  try {
    await sleep(200)
    writeFileSync(join(root, 'locks', 'a.lock'), 'x')
    await sleep(700)
    const afterIgnored = calls
    writeFileSync(join(root, 'notes', 'authored', 'a.md'), '# a\n')
    await sleep(700)
    assert.deepEqual({ afterIgnored, afterNote: calls > 0 }, { afterIgnored: 0, afterNote: true })
  } finally {
    stop()
    rmSync(host, { recursive: true, force: true })
  }
})
