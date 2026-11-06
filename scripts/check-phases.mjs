#!/usr/bin/env node
// Checks that the build pane and the brain page handle every Phase word build's Phase table defines
// (skills/build/SKILL.md, ## Phase): each one but `none` must be a quoted literal in hooks/sdd.ts's stageOf
// and a key of skills/brain/brain.html's PHASE_LABEL, so a new phase cannot ship that either one shows as idle.
// Run: node scripts/check-phases.mjs   (exits 1 and lists each phase a reader misses)
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const skill = read('skills/build/SKILL.md')
const table = /^## Phase\s*$([\s\S]*?)^## /m.exec(skill)?.[1] ?? ''
const phases = [...new Set(table.split('\n')
  .filter((line) => line.startsWith('| `'))
  .flatMap((line) => [...line.split('|')[1].matchAll(/`([a-z]+)`/g)].map((m) => m[1])))]
  .filter((p) => p !== 'none')
if (!phases.length) {
  console.log('No Phase table found in skills/build/SKILL.md under ## Phase')
  process.exit(1)
}

const stageOf = /export const stageOf[\s\S]*?\n}/.exec(read('hooks/sdd.ts'))?.[0] ?? ''
const labels = /const PHASE_LABEL = \{([^}]*)\}/.exec(read('skills/brain/brain.html'))?.[1] ?? ''
const keys = new Set([...labels.matchAll(/(\w+):/g)].map((m) => m[1]))

const missing = [
  ...phases.filter((p) => !stageOf.includes(`'${p}'`)).map((p) => `hooks/sdd.ts stageOf has no '${p}'`),
  ...phases.filter((p) => !keys.has(p)).map((p) => `skills/brain/brain.html PHASE_LABEL has no ${p}`),
]
if (missing.length) {
  console.log(missing.join('\n'))
  console.log(`\n${missing.length} gaps against build's Phase table: ${phases.join(', ')}`)
  process.exit(1)
}
console.log(`${phases.length} phases (${phases.join(', ')}), each handled by the pane and the page`)
