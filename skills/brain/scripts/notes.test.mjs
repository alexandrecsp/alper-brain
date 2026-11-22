// Run: node --test skills/brain/scripts/notes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cardOf, layoutOf, listOf, loadBrain, noteOf, parse, placeOf } from './notes.mjs'

const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const brain = () => {
  const b = mkdtempSync(join(tmpdir(), 'brain-notes-'))
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

test('places every path of both layouts, and nothing else', () => {
  assert.deepEqual(placeOf('notes/authored/api-retry.md'), { kind: 'authored', slug: null, layout: 'notes' })
  assert.deepEqual(placeOf('notes/repos/api/REPO.md'), { kind: 'card', slug: 'api', layout: 'notes' })
  assert.deepEqual(placeOf('notes/repos/api/explored/api-refunds.md'), { kind: 'explored', slug: 'api', layout: 'notes' })
  assert.deepEqual(placeOf('shared/invoice-contract.md'), { kind: 'authored', slug: null, layout: 'legacy' })
  assert.deepEqual(placeOf('repos/api/api-retry.md'), { kind: 'authored', slug: 'api', layout: 'legacy' })
  assert.deepEqual(placeOf('repos/api/REPO.md'), { kind: 'card', slug: 'api', layout: 'legacy' })
  assert.deepEqual(placeOf('repos/api/explored/api-refunds.md'), { kind: 'explored', slug: 'api', layout: 'legacy' })
  assert.equal(placeOf('notes/repos/api/api-retry.md'), null)
  assert.equal(placeOf('notes/authored/deep/x.md'), null)
  assert.equal(placeOf('.brain/drafts/x.md'), null)
})

test('a note takes its repository from its folder, else from its repos line, and its name from the file when it has none', () => {
  const explored = noteOf('notes/repos/api/explored/api-refunds.md', note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  assert.deepEqual(explored.repos, ['api'])
  assert.equal(explored.explored, true)
  const authored = noteOf('notes/authored/invoice-contract.md', note({ name: 'invoice-contract', type: 'contract', repos: '[api, web]' }))
  assert.deepEqual(authored.repos, ['api', 'web'])
  assert.equal(authored.explored, false)
  const legacy = noteOf('repos/api/api-retry.md', note({ type: 'how-to', repos: '[web]' }))
  assert.deepEqual(legacy.repos, ['api'])
  assert.equal(legacy.name, 'api-retry')
  const old = noteOf('notes/authored/api-v1.md', note({ name: 'api-v1', type: 'decision', status: 'superseded', supersededBy: 'api-v2' }))
  assert.equal(old.superseded, true)
  assert.equal(old.supersededBy, 'api-v2')
})

test('reads the notes/ layout: authored and explored notes, never a card, and drafts by their target', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/REPO.md'), card('api'))
  put(join(b, 'notes/repos/api/explored/api-refunds.md'), note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/authored/api-retry.md'), note({ name: 'api-retry', type: 'how-to', layer: 'application', repos: '[api]' }))
  put(join(b, '.brain/drafts/api-limits.md'), note({ name: 'api-limits', type: 'how-to', layer: 'application', repos: '[api]', target: 'notes/authored/api-limits.md', action: 'record' }))
  const { layout, slugs, notes, drafts } = loadBrain(b)
  assert.equal(layout, 'notes')
  assert.equal(layoutOf(b), 'notes')
  assert.equal(cardOf(b, 'api'), 'notes/repos/api/REPO.md')
  assert.deepEqual(slugs, ['api'])
  assert.deepEqual(notes.map((n) => n.path).sort(), ['notes/authored/api-retry.md', 'notes/repos/api/explored/api-refunds.md'])
  assert.equal(drafts.length, 1)
  assert.equal(drafts[0].path, '.brain/drafts/api-limits.md')
  assert.equal(drafts[0].target, 'notes/authored/api-limits.md')
  assert.equal(drafts[0].draft, 'record')
  assert.deepEqual(drafts[0].repos, ['api'])
})

test('reads the legacy layout: notes beside each card, explored notes, and shared/', () => {
  const b = brain()
  put(join(b, 'repos/api/REPO.md'), card('api'))
  put(join(b, 'repos/api/api-retry.md'), note({ name: 'api-retry', type: 'how-to', layer: 'application' }))
  put(join(b, 'repos/api/explored/api-refunds.md'), note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'shared/invoice-contract.md'), note({ name: 'invoice-contract', type: 'contract', layer: 'application', repos: '[api, web]' }))
  put(join(b, 'repos/ghost/ghost-note.md'), note({ name: 'ghost-note', type: 'how-to' }))
  const { layout, slugs, notes } = loadBrain(b)
  assert.equal(layout, 'legacy')
  assert.equal(cardOf(b, 'api'), 'repos/api/REPO.md')
  assert.deepEqual(slugs, ['api'])
  const byPath = Object.fromEntries(notes.map((n) => [n.path, n]))
  assert.deepEqual(Object.keys(byPath).sort(), ['repos/api/api-retry.md', 'repos/api/explored/api-refunds.md', 'shared/invoice-contract.md'])
  assert.deepEqual(byPath['repos/api/api-retry.md'].repos, ['api'])
  assert.equal(byPath['repos/api/explored/api-refunds.md'].explored, true)
  assert.deepEqual(byPath['shared/invoice-contract.md'].repos, ['api', 'web'])
})

test('a draft without an action is a record, and one without a target lands where it sits', () => {
  const b = brain()
  put(join(b, 'notes/authored/.gitkeep'), '')
  put(join(b, '.brain/drafts/api-x.md'), note({ name: 'api-x', type: 'how-to' }))
  const [d] = loadBrain(b).drafts
  assert.equal(d.draft, 'record')
  assert.equal(d.target, '.brain/drafts/api-x.md')
})
