// Run: node --test skills/brain/scripts/prose.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'prose.mjs')
const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const dir = () => mkdtempSync(join(tmpdir(), 'brain-prose-'))
const prose = (...paths) => {
  const r = spawnSync(process.execPath, [script, ...paths], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}
const words = (n, word = 'word') => Array(n).fill(word).join(' ')
// A note: its frontmatter is lines 1 to 6, its description on line 3, its body from line 8.
const note = (body, description = 'Retries reuse the key.') =>
  `---\nname: api-retry\ndescription: ${description}\ntype: how-to\nlayer: application\n---\n\n${body}\n`
const findings = (out) => out.split('\n').filter((l) => /:\d+: /.test(l)).map((l) => l.replace(/^.*?:(\d+): /, '$1: '))

test('passes clean prose in a note', () => {
  const d = dir()
  put(join(d, 'api-retry.md'), note('A retried charge sends the first key. The provider answers with the first result.\n\n**Why:** the provider billed twice in March.\n**How to apply:** pass the stored key to every retry path.\n\nRelated: [[invoice-event-contract]]'))
  const r = prose(join(d, 'api-retry.md'))
  assert.equal(r.status, 0, r.out)
  assert.equal(r.out.trim(), 'prose: ok, 1 file checked')
})

test('flags a descriptive sentence over 25 words and a procedural one over 20, with the line of each', () => {
  const d = dir()
  put(join(d, 'api-retry.md'), note(`${words(25)}.\n\n${words(26)}.\n\n**How to apply:** ${words(20)}.\n\n**How to apply:** ${words(21)}.`, `${words(26)}.`))
  const r = prose(join(d, 'api-retry.md'))
  assert.equal(r.status, 1)
  assert.deepEqual(findings(r.out).map((f) => f.split(' sentence')[0]), ['3: descriptive', '10: descriptive', '14: procedural'])
  assert.match(r.out, /procedural sentence of 21 words, at most 20/)
})

test('counts a code span, a [[link]] and a criterion\'s ", proven at <seam>" ending as the rules say', () => {
  const d = dir()
  const span = '`a b c d e f g h i j`'
  put(join(d, 'api-retry.md'), note(`${words(23)} ${span} [[some long link name]].`))
  assert.equal(prose(join(d, 'api-retry.md')).status, 0)
  put(join(d, 'ticket.md'), `# Ticket 001: Retry\n\n## What to build\n\nA retry.\n\n## Acceptance criteria\n\n- [ ] ${words(20)}, proven at the retry service unit test seam.\n`)
  const r = prose(join(d, 'ticket.md'))
  assert.equal(r.status, 0, r.out)
})

test('flags a semicolon and a spaced dash between clauses', () => {
  const d = dir()
  put(join(d, 'api-retry.md'), note('The key is stored; the retry reads it.\n\nThe key is stored — the retry reads it.\n\nThe key is stored -- the retry reads it.'))
  const r = prose(join(d, 'api-retry.md'))
  assert.equal(r.status, 1)
  assert.deepEqual(findings(r.out).map((f) => f.split(' joins')[0]), ['8: "stored;"', '10: "—"', '12: "--"'])
})

test('flags each wordy phrase with its plain word, but not inside a code span', () => {
  const d = dir()
  put(join(d, 'api-retry.md'), note('We utilize the key in order to retry. Retries commence prior to noon.\n\nIt calls `utilize()` once.'))
  const r = prose(join(d, 'api-retry.md'))
  assert.equal(r.status, 1)
  assert.deepEqual(findings(r.out), ['8: "utilize": write use', '8: "in order to": write to', '8: "prior to": write before', '8: "commence": write start'])
})

test('flags a paragraph of more than six sentences, but not a list of seven items', () => {
  const d = dir()
  put(join(d, 'api-retry.md'), note(`${Array(7).fill('One fact.').join(' ')}\n\n**Rules:**\n${Array(7).fill('- One rule.').join('\n')}`))
  const r = prose(join(d, 'api-retry.md'))
  assert.equal(r.status, 1)
  assert.deepEqual(findings(r.out), ['8: paragraph of 7 sentences, at most 6'])
})

test('reads only the sections PROSE.md names: a spec\'s Solution, not its Implementation Decisions; a milestone\'s Done when as procedural', () => {
  const d = dir()
  put(join(d, 'spec.md'), `# Invoice export\n\n## Solution\n\n${words(26)}.\n\n## Implementation Decisions\n\n${words(40)}; ${words(3)}.\n`)
  const spec = prose(join(d, 'spec.md'))
  assert.equal(spec.status, 1)
  assert.deepEqual(findings(spec.out).map((f) => f.split(' sentence')[0]), ['5: descriptive'])
  put(join(d, 'milestone.md'), `# Milestone 001: Export\n\n**Delivers:** ${words(22)}.\n\n**Done when:** ${words(22)}.\n\n## Tickets\n\n${words(40)}.\n`)
  const ms = prose(join(d, 'milestone.md'))
  assert.deepEqual(findings(ms.out).map((f) => f.split(' sentence')[0]), ['5: procedural'])
})

test('skips a file of no shape PROSE.md names, and fails when it finds none', () => {
  const d = dir()
  put(join(d, 'README.md'), `# Readme\n\n${words(40)}; ${words(3)}.\n`)
  const r = prose(d)
  assert.equal(r.status, 1)
  assert.match(r.out, /^prose: no note, card, spec, milestone or ticket in /)
})

test('checks a .md file straight in repos/ as a card, and no other .md in a folder of that name', () => {
  const d = dir()
  const card = (summary) => `---\nslug: api\nremote: local only\n---\n\n${summary}\n`
  put(join(d, 'repos/api.md'), card(`${words(26)}.`))
  const r = prose(join(d, 'repos/api.md'))
  assert.equal(r.status, 1)
  assert.deepEqual(findings(r.out).map((f) => f.split(' sentence')[0]), ['6: descriptive'])
  put(join(d, 'repos/api/README.md'), card(`${words(26)}.`))
  assert.match(prose(join(d, 'repos/api/README.md')).out, /^prose: no note, card, spec, milestone or ticket in /)
})
