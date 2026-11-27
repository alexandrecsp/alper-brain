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

test('places every path of the clusters layout by its repository, and nothing else', () => {
  assert.deepEqual(placeOf('notes/shared/invoice-contract.md'), { slug: null, card: false })
  assert.deepEqual(placeOf('repos/api.md'), { slug: 'api', card: true })
  assert.deepEqual(placeOf('notes/repos/api/api-refunds.md'), { slug: 'api', card: false })
  for (const other of ['notes/research/api-market.md', '.local/drafts/api-x.md', 'repos/api/REPO.md', 'repos/repos.json', 'notes/authored/api-x.md', 'notes/exploration/api/api-x.md', 'notes/repos/api/deep/x.md', 'notes/shared/deep/x.md']) assert.equal(placeOf(other), null, other)
})

test('an explored note takes its repository from its folder, an authored one from its repos line, and its name from the file when it has none', () => {
  const explored = noteOf('notes/repos/api/api-refunds.md', note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  assert.deepEqual(explored.repos, ['api'])
  assert.equal(explored.explored, true)
  const shared = noteOf('notes/shared/invoice-contract.md', note({ name: 'invoice-contract', type: 'contract', repos: '[api, web]' }))
  assert.deepEqual(shared.repos, ['api', 'web'])
  assert.equal(shared.explored, false)
  const own = noteOf('notes/repos/api/api-retry.md', note({ type: 'how-to', repos: '[web]' }))
  assert.deepEqual(own.repos, ['web'])
  assert.equal(own.name, 'api-retry')
  const old = noteOf('notes/repos/api/api-v1.md', note({ name: 'api-v1', type: 'decision', status: 'superseded', supersededBy: 'api-v2', repos: '[api]' }))
  assert.equal(old.superseded, true)
  assert.equal(old.supersededBy, 'api-v2')
})

test('a note with an explored line is explored in any folder, and one without it is authored', () => {
  const inShared = noteOf('notes/shared/api-refunds.md', note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d', repos: '[api]' }))
  assert.equal(inShared.explored, true)
  assert.deepEqual(inShared.repos, ['api'])
  const inRepo = noteOf('notes/repos/api/api-retry.md', note({ name: 'api-retry', type: 'how-to', layer: 'application', repos: '[api]' }))
  assert.equal(inRepo.explored, false)
})

test('reads the clusters layout: cards from repos/, notes of both folders, drafts from .local/drafts/, and never research', () => {
  const b = join(mkdtempSync(join(tmpdir(), 'brain-notes-')), '.brain')
  put(join(b, 'BRAIN.md'), '# Brain\n')
  put(join(b, '.local/repos.json'), '{}')
  put(join(b, 'repos/api.md'), card('api'))
  put(join(b, 'notes/repos/api/api-refunds.md'), note({ name: 'api-refunds', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/repos/api/api-retry.md'), note({ name: 'api-retry', type: 'how-to', layer: 'application', repos: '[api]' }))
  put(join(b, 'notes/shared/invoice-contract.md'), note({ name: 'invoice-contract', type: 'contract', layer: 'application', repos: '[api, web]' }))
  put(join(b, 'notes/research/api-market.md'), note({ name: 'api-market', type: 'concept', layer: 'business' }))
  put(join(b, '.local/drafts/api-limits.md'), note({ name: 'api-limits', type: 'how-to', layer: 'application', repos: '[api]', target: 'notes/repos/api/api-limits.md', action: 'record' }))
  const { slugs, notes, drafts } = loadBrain(b)
  assert.equal(cardOf(b, 'api'), 'repos/api.md')
  assert.deepEqual(slugs, ['api'])
  assert.deepEqual(notes.map((n) => n.path).sort(), ['notes/repos/api/api-refunds.md', 'notes/repos/api/api-retry.md', 'notes/shared/invoice-contract.md'])
  assert.deepEqual(notes.find((n) => n.explored).repos, ['api'])
  assert.deepEqual(drafts.map((d) => [d.path, d.target, d.draft]), [['.local/drafts/api-limits.md', 'notes/repos/api/api-limits.md', 'record']])
})

test('a draft without an action is a record, and one without a target lands where it sits', () => {
  const b = brain()
    put(join(b, '.local/drafts/api-x.md'), note({ name: 'api-x', type: 'how-to' }))
  const [d] = loadBrain(b).drafts
  assert.equal(d.draft, 'record')
  assert.equal(d.target, '.local/drafts/api-x.md')
})
