// Run: node --test skills/brain/scripts/notes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cardOf, listOf, loadBrain, noteOf, parse, placeOf } from './notes.mjs'

const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const brain = () => {
  const b = join(mkdtempSync(join(tmpdir(), 'brain-notes-')), '.brain')
  put(join(b, 'BRAIN.md'), '# Brain\n')
  return b
}
const note = (fm, body = 'A fact.') => `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}\n`
const card = (slug) => `---\nslug: ${slug}\nremote: local only\n---\n\nThe ${slug} repository.\n`

test('parses flat frontmatter, quoted values, CRLF endings and an Obsidian block list', () => {
  const { fm, body } = parse('---\r\nname: api-retry\r\ndescription: "Retries reuse the key"\r\naliases:\r\n  - replay\r\n  - double charge\r\nrepos: [api, web]\r\n---\r\n\r\nThe body.\r\n')
  assert.equal(fm.name, 'api-retry')
  assert.equal(fm.description, 'Retries reuse the key')
  assert.deepEqual(fm.aliases, ['replay', 'double charge'])
  assert.equal(fm.repos, '[api, web]')
  assert.equal(body, 'The body.')
  assert.deepEqual(listOf(fm.repos), ['api', 'web'])
  assert.deepEqual(listOf('a, "b"'), ['a', 'b'])
  assert.deepEqual(parse('No frontmatter here.'), { fm: {}, body: 'No frontmatter here.' })
})

test('places every path of the .brain layout, and nothing else', () => {
  assert.deepEqual(placeOf('notes/authored/api-retry.md'), { kind: 'authored', slug: null })
  assert.deepEqual(placeOf('repos/api/REPO.md'), { kind: 'card', slug: 'api' })
  assert.deepEqual(placeOf('notes/exploration/api/api-refunds.md'), { kind: 'explored', slug: 'api' })
  for (const old of ['notes/drafts/api-x.md', 'shared/invoice-contract.md', 'repos/api/api-retry.md', 'repos/api/explored/api-refunds.md', 'notes/exploration/api/deep/x.md', 'notes/authored/deep/x.md']) assert.equal(placeOf(old), null, old)
})

test('a note takes its repository from its folder, else from its repos line, and its name from the file when it has none', () => {
  const explored = noteOf('notes/exploration/api/api-refunds.md', note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  assert.deepEqual(explored.repos, ['api'])
  assert.equal(explored.explored, true)
  const authored = noteOf('notes/authored/invoice-contract.md', note({ name: 'invoice-contract', type: 'contract', repos: '[api, web]' }))
  assert.deepEqual(authored.repos, ['api', 'web'])
  assert.equal(authored.explored, false)
  const unnamed = noteOf('notes/authored/api-retry.md', note({ type: 'how-to', repos: '[web]' }))
  assert.deepEqual(unnamed.repos, ['web'])
  assert.equal(unnamed.name, 'api-retry')
  const old = noteOf('notes/authored/api-v1.md', note({ name: 'api-v1', type: 'decision', status: 'superseded', supersededBy: 'api-v2' }))
  assert.equal(old.superseded, true)
  assert.equal(old.supersededBy, 'api-v2')
})

test('reads the .brain layout: authored and explored notes, never a card or repos.json, and drafts from notes/drafts/', () => {
  const b = join(mkdtempSync(join(tmpdir(), 'brain-notes-')), '.brain')
  put(join(b, 'BRAIN.md'), '# Brain\n')
  put(join(b, 'repos/repos.json'), '{}')
  put(join(b, 'repos/api/REPO.md'), card('api'))
  put(join(b, 'notes/exploration/api/api-refunds.md'), note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/authored/api-retry.md'), note({ name: 'api-retry', type: 'how-to', layer: 'application', repos: '[api]' }))
  put(join(b, 'notes/drafts/api-limits.md'), note({ name: 'api-limits', type: 'how-to', layer: 'application', repos: '[api]', target: 'notes/authored/api-limits.md', action: 'record' }))
  const loaded = loadBrain(b)
  const { slugs, notes, drafts } = loaded
  assert.equal(cardOf(b, 'api'), 'repos/api/REPO.md')
  assert.deepEqual(slugs, ['api'])
  assert.deepEqual(notes.map((n) => n.path).sort(), ['notes/authored/api-retry.md', 'notes/exploration/api/api-refunds.md'])
  assert.deepEqual(notes.find((n) => n.explored).repos, ['api'])
  assert.deepEqual(drafts.map((d) => [d.path, d.target, d.draft]), [['notes/drafts/api-limits.md', 'notes/authored/api-limits.md', 'record']])
})

test('a draft without an action is a record, and one without a target lands where it sits', () => {
  const b = brain()
  put(join(b, 'notes/authored/.gitkeep'), '')
  put(join(b, 'notes/drafts/api-x.md'), note({ name: 'api-x', type: 'how-to' }))
  const [d] = loadBrain(b).drafts
  assert.equal(d.draft, 'record')
  assert.equal(d.target, 'notes/drafts/api-x.md')
})
