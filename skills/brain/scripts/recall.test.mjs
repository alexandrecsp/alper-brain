// Run: node --test skills/brain/scripts/recall.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'recall.mjs')
const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const note = (fm, body = 'A fact.') => `---\n${Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}\n`
const card = (slug, summary) => `---\nslug: ${slug}\nremote: local only\n---\n\n${summary}\n`

// A clusters brain's `.brain/` folder on `api` and `web`, with notes of both layers, a contract between them, a draft and a research note.
// An authored note sits in its repository's folder for a repos list of one slug, else in notes/shared/.
const noteHome = (repos) => (/^\[[\w-]+\]$/.test(repos) ? `notes/repos/${repos.slice(1, -1)}` : 'notes/shared')
const brain = () => {
  const b = join(mkdtempSync(join(tmpdir(), 'brain-recall-')), '.brain')
  put(join(b, 'BRAIN.md'), '---\nkind: standalone\n---\n\n# Brain\n')
  put(join(b, 'repos/api.md'), card('api', 'Charges customers and emits invoice events.'))
  put(join(b, 'repos/web.md'), card('web', 'The customer web app.'))
  put(join(b, '.local/repos.json'), '{}')
  const authored = (name, fm, body) => put(join(b, `${noteHome(fm.repos)}/${name}.md`), note({ name, ...fm }, body))
  authored('api-retry-keys', { description: 'Billing retries reuse the idempotency key', type: 'how-to', layer: 'application', repos: '[api]' },
    'A retried charge sends the first idempotency key, so the provider never bills twice.')
  authored('api-refund-limit', { description: 'Refunds above 500 wait for finance', type: 'decision', layer: 'business', repos: '[api]' },
    'Finance approves every large refund.')
  authored('web-dark-mode', { description: 'The web app follows the system theme', type: 'decision', layer: 'application', repos: '[web]' },
    'The theme follows the operating system.')
  authored('invoice-event-contract', { description: 'The invoice event api emits and web reads', type: 'contract', layer: 'application', repos: '[api, web]' },
    'An unrelated body about schemas.')
  put(join(b, 'notes/repos/api/api-invoices.md'), note({ name: 'api-invoices', description: 'Customers receive an invoice per charge', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, '.local/drafts/api-retry-window.md'), note({ name: 'api-retry-window', description: 'Retries stop after a day', type: 'how-to', layer: 'application', repos: '[api]', target: 'notes/repos/api/api-retry-window.md', action: 'record' }))
  put(join(b, 'notes/research/api-market.md'), note({ name: 'api-market', description: 'Payment providers compared', type: 'concept', layer: 'business' }))
  return b
}
const recall = (b, ...args) => {
  const r = spawnSync(process.execPath, [script, b, ...args], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}
const section = (out, head) => {
  const lines = out.split('\n')
  const at = lines.findIndex((l) => l.startsWith(head))
  const end = lines.findIndex((l, i) => i > at && !l.startsWith('  '))
  return lines.slice(at + 1, end < 0 ? undefined : end)
}
const paths = (lines) => lines.map((l) => l.trim().split(' · ')[0]).filter((p) => p !== 'none' && !p.startsWith('…'))

test('without --repo, lists every card with its summary, every contract, and every note and draft', () => {
  const r = recall(brain())
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(section(r.out, 'cards:'), ['  api · Charges customers and emits invoice events.', '  web · The customer web app.'])
  assert.deepEqual(paths(section(r.out, 'contracts')), ['notes/shared/invoice-event-contract.md'])
  assert.match(r.out, /^notes: 5 of 5$/m)
})

test('lists a draft at its .local/drafts/ path, and never lists a research note', () => {
  const r = recall(brain())
  assert.match(r.out, /^ {2}\.local\/drafts\/api-retry-window\.md · draft record → notes\/repos\/api\/api-retry-window\.md/m)
  assert.doesNotMatch(r.out, /api-market|notes\/research/)
})

test('--repo keeps the notes on that repository, lists the contracts on it, and drops the cards', () => {
  const r = recall(brain(), '--repo', 'web')
  assert.equal(r.status, 0, r.err)
  assert.doesNotMatch(r.out, /^cards:/m)
  assert.deepEqual(paths(section(r.out, 'contracts on web')), ['notes/shared/invoice-event-contract.md'])
  assert.deepEqual(paths(section(r.out, 'notes')), ['notes/repos/web/web-dark-mode.md'])
})

test('--layer keeps that layer and a note with no layer yet, while a contract is listed under either layer', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-unlayered.md'), note({ name: 'api-unlayered', description: 'Not migrated yet', type: 'how-to', repos: '[api]' }))
  const r = recall(b, '--repo', 'api', '--layer', 'business')
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(paths(section(r.out, 'contracts on api')), ['notes/shared/invoice-event-contract.md'])
  assert.deepEqual(paths(section(r.out, 'notes (business)')), ['notes/repos/api/api-invoices.md', 'notes/repos/api/api-refund-limit.md', 'notes/repos/api/api-unlayered.md'])
})

test('--query ranks the matching notes best first and leaves out the ones it does not match', () => {
  const r = recall(brain(), '--query', 'retried charge idempotency')
  assert.equal(r.status, 0, r.err)
  const listed = paths(section(r.out, 'notes'))
  assert.equal(listed[0], 'notes/repos/api/api-retry-keys.md')
  assert.ok(!listed.includes('notes/repos/web/web-dark-mode.md'))
  assert.match(r.out, /^notes: \d+ of \d+ matching, best first$/m)
})

test('--query reaches a term note by the words its avoid line names', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-invoice.md'), note({ name: 'api-invoice', description: 'A request for payment sent after delivery', type: 'concept', layer: 'business', explored: 'a1b2c3d', avoid: '[statement, payment request]' }))
  const r = recall(b, '--query', 'statement')
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(paths(section(r.out, 'notes')), ['notes/repos/api/api-invoice.md'])
})

test('several --query phrasings fuse, so a note only one phrasing reaches still lists', () => {
  const r = recall(brain(), '--query', 'idempotency key', '--query', 'system theme')
  const listed = paths(section(r.out, 'notes'))
  assert.ok(listed.includes('notes/repos/api/api-retry-keys.md'))
  assert.ok(listed.includes('notes/repos/web/web-dark-mode.md'))
  assert.match(r.out, /fused from 2 queries/)
})

test('--top cuts the ranked list and says how to see more', () => {
  const r = recall(brain(), '--query', 'invoice refund retries theme', '--top', '1')
  assert.equal(paths(section(r.out, 'notes')).length, 1)
  assert.match(r.out, /… \d+ more: run again with --top 2/)
})

test('leaves out a superseded decision and lists the decision that replaced it', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-refund-v1.md'), note({ name: 'api-refund-v1', description: 'Refunds were manual spreadsheets', type: 'decision', layer: 'business', repos: '[api]', status: 'superseded', supersededBy: 'api-refund-limit' }))
  const r = recall(b, '--repo', 'api', '--query', 'manual spreadsheets')
  const lines = section(r.out, 'notes')
  assert.deepEqual(paths(lines), ['notes/repos/api/api-refund-limit.md'])
  assert.match(lines[0], /supersedes api-refund-v1$/)
})

test('--legacy lists the notes whose type or layer FORMAT.md does not describe', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-gotcha.md'), note({ name: 'api-gotcha', description: 'Old', type: 'gotcha', repos: '[api]' }))
  const r = recall(b, '--legacy')
  assert.equal(r.status, 0)
  assert.equal(r.out.trim(), 'notes/repos/api/api-gotcha.md · type gotcha, layer missing')
})

test('rejects an unknown layer with a usage error', () => {
  const r = recall(brain(), '--layer', 'domain')
  assert.equal(r.status, 2)
  assert.match(r.err, /--layer takes business or application/)
})

// ---- Terms: the brain's `notes/domain/` over the `api` and `web` repositories of brain()

const term = (name, description, pairings, repos) =>
  note({ name, description, type: 'term', layer: 'business', repos }, `A definition.\n\n## Pairings\n${pairings.join('\n')}\n`)
const termBrain = () => {
  const b = brain()
  put(join(b, 'notes/domain/customer.md'), term('customer', 'Who buys from the business', [
    '- api: `Customer`, narrower. Only who has paid. Avoid: `buyer`.',
    '- web: `Client`, same.',
  ], '[api, web]'))
  put(join(b, 'notes/domain/ledger-account.md'), term('ledger-account', 'A book of debits and credits', ['- api: `Account`, same.'], '[api]'))
  put(join(b, 'notes/domain/user-account.md'), term('user-account', 'A login of a person', ['- web: `Account`, narrower.'], '[web]'))
  return b
}

test('--query ranks a term by a pairing word above a note that only repeats the word', () => {
  const b = termBrain()
  put(join(b, 'notes/repos/web/web-sdk.md'), note({ name: 'web-sdk', description: 'The sdk', type: 'how-to', layer: 'application', repos: '[web]' }, 'The client library.'))
  const r = recall(b, '--query', 'Client')
  assert.equal(paths(section(r.out, 'notes'))[0], 'notes/domain/customer.md')
})

test('--query ranks a term by a word a pairing avoids above a note that only repeats the word', () => {
  const b = termBrain()
  put(join(b, 'notes/repos/web/web-sdk.md'), note({ name: 'web-sdk', description: 'The sdk', type: 'how-to', layer: 'application', repos: '[web]' }, 'The buyer library.'))
  const r = recall(b, '--query', 'buyer')
  assert.equal(paths(section(r.out, 'notes'))[0], 'notes/domain/customer.md')
})

test('--type term --repo lists the terms paired with that repository and no other', () => {
  const r = recall(termBrain(), '--type', 'term', '--repo', 'api')
  assert.deepEqual(paths(section(r.out, 'notes (term)')), ['notes/domain/customer.md', 'notes/domain/ledger-account.md'])
})

test('with --repo, a term line shows that repository\'s word and degree', () => {
  const r = recall(termBrain(), '--type', 'term', '--repo', 'api')
  const line = section(r.out, 'notes (term)').find((l) => l.includes('customer.md'))
  assert.match(line, / · api: Customer \(narrower\) · /)
  assert.doesNotMatch(line, /Client/)
})

test('a query word that is the pairing word of two terms prints one homonym line naming each', () => {
  const r = recall(termBrain(), '--query', 'account')
  assert.deepEqual(r.out.split('\n').filter((l) => l.startsWith('homonym:')), ['homonym: account → ledger-account (api), user-account (web)'])
})

test('the homonym line sits before the notes line', () => {
  const lines = recall(termBrain(), '--query', 'account').out.split('\n')
  assert.ok(lines.findIndex((l) => l.startsWith('homonym:')) < lines.findIndex((l) => l.startsWith('notes')))
})

test('a query word that is the pairing word of one term prints no homonym line', () => {
  const r = recall(termBrain(), '--query', 'customer')
  assert.doesNotMatch(r.out, /^homonym:/m)
})

test('--legacy lists a business concept', () => {
  const b = termBrain()
  put(join(b, 'notes/repos/api/api-invoice.md'), note({ name: 'api-invoice', description: 'A request for payment', type: 'concept', layer: 'business', repos: '[api]' }))
  const r = recall(b, '--legacy')
  assert.match(r.out, /^notes\/repos\/api\/api-invoice\.md · business concept$/m)
})

test('--legacy leaves out an explored business concept, but lists one with an avoid line', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-retry-job.md'), note({ name: 'api-retry-job', description: 'A nightly job retries charges', type: 'concept', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/repos/api/api-invoice.md'), note({ name: 'api-invoice', description: 'A request for payment', type: 'concept', layer: 'business', explored: 'a1b2c3d', avoid: '[statement]' }))
  const r = recall(b, '--legacy')
  assert.doesNotMatch(r.out, /api-retry-job/)
  assert.match(r.out, /^notes\/repos\/api\/api-invoice\.md · business concept$/m)
})

test('--legacy lists an explored note whose Sources names a glossary, a glossary map or an ADR, and no other', () => {
  const b = brain()
  const explored = (name, sources) => put(join(b, `notes/repos/api/${name}.md`), note({ name, description: 'Mirror', type: 'concept', layer: 'application', explored: 'a1b2c3d' }, `A mirror.\n\nSources: ${sources}`))
  explored('api-glossary', '`GLOSSARY.md`')
  explored('api-glossary-map', '`src/a.ts`, `GLOSSARY-MAP.md`')
  explored('api-adr', '`docs/adr/0001-queues.md`')
  explored('api-code', '`src/a.ts`')
  const r = recall(b, '--legacy')
  assert.deepEqual(r.out.trim().split('\n'), [
    'notes/repos/api/api-adr.md · sources name a glossary or an ADR',
    'notes/repos/api/api-glossary-map.md · sources name a glossary or an ADR',
    'notes/repos/api/api-glossary.md · sources name a glossary or an ADR',
  ])
})
