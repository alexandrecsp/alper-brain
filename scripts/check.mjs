#!/usr/bin/env node
// Runs every check that needs no model and no API key: the section references, the phases, the scripts' tests and
// the Agent Watcher pane's tests. Exits 1 when any fails. `.github/workflows/checks.yml` runs it on every push.
//   node scripts/check.mjs
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const tests = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tests(join(dir, e.name)) : e.name.endsWith('.test.mjs') ? [relative(root, join(dir, e.name))] : [],
  )

const checks = [
  ['section references', 'node', ['scripts/check-refs.mjs']],
  ['phases', 'node', ['scripts/check-phases.mjs']],
  ['script tests', 'node', ['--test', ...tests(join(root, 'skills'))]],
  ['Agent Watcher pane tests', 'claude', ['plugin', 'test', '.']],
]

let failed = 0
for (const [name, cmd, args] of checks) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
  if (r.error?.code === 'ENOENT' || (cmd === 'claude' && /not recognized|not found/.test(r.stderr ?? ''))) {
    console.log(`skip  ${name}: ${cmd} is not installed`)
    continue
  }
  const ok = r.status === 0
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`)
  if (!ok) {
    failed++
    console.log(`${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-30).join('\n'))
  }
}
process.exit(failed ? 1 : 0)
