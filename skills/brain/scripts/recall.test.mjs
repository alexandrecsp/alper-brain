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

// A notes/ brain on `api` and `web`, with notes of both layers, a contract between them, and a draft.
const brain = () => {
  const b = mkdtempSync(join(tmpdir(), 'brain-recall-'))
  put(join(b, 'BRAIN.md'), '# Brain\n')
  put(join(b, 'notes/repos/api/REPO.md'), card('api', 'Charges customers and emits invoice events.'))
  put(join(b, 'notes/repos/web/REPO.md'), card('web', 'The customer web app.'))
  const authored = (name, fm, body) => put(join(b, `notes/authored/${name}.md`), note({ name, ...fm }, body))
  authored('api-retry-keys', { description: 'Billing retries reuse the idempotency key', type: 'how-to', layer: 'application', repos: '[api]' },
    'A retried charge sends the first idempotency key, so the provider never bills twice.')
  authored('api-refund-limit', { description: 'Refunds above 500 wait for finance', type: 'decision', layer: 'business', repos: '[api]' },
    'Finance approves every large refund.')
  authored('web-dark-mode', { description: 'The web app follows the system theme', type: 'decision', layer: 'application', repos: '[web]' },
    'The theme follows the operating system.')
  authored('invoice-event-contract', { description: 'The invoice event api emits and web reads', type: 'contract', layer: 'application', repos: '[api, web]' },
    'An unrelated body about schemas.')
  put(join(b, 'notes/repos/api/explored/api-invoices.md'), note({ name: 'api-invoices', description: 'Customers receive an invoice per charge', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, '.brain/drafts/api-retry-window.md'), note({ name: 'api-retry-window', description: 'Retries stop after a day', type: 'how-to', layer: 'application', repos: '[api]', target: 'notes/authored/api-retry-window.md', action: 'record' }))
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
  assert.deepEqual(paths(section(r.out, 'contracts')), ['notes/authored/invoice-event-contract.md'])
  assert.match(r.out, /^notes: 5 of 5$/m)
  assert.match(r.out, /\.brain\/drafts\/api-retry-window\.md · draft record → notes\/authored\/api-retry-window\.md/)
})

test('--repo keeps the notes on that repository, lists the contracts on it, and drops the cards', () => {
  const r = recall(brain(), '--repo', 'web')
  assert.equal(r.status, 0, r.err)
  assert.doesNotMatch(r.out, /^cards:/m)
  assert.deepEqual(paths(section(r.out, 'contracts on web')), ['notes/authored/invoice-event-contract.md'])
  assert.deepEqual(paths(section(r.out, 'notes')), ['notes/authored/web-dark-mode.md'])
})

test('--layer keeps that layer and a note with no layer yet, while a contract is listed under either layer', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-unlayered.md'), note({ name: 'api-unlayered', description: 'Not migrated yet', type: 'how-to', repos: '[api]' }))
  const r = recall(b, '--repo', 'api', '--layer', 'business')
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(paths(section(r.out, 'contracts on api')), ['notes/authored/invoice-event-contract.md'])
  assert.deepEqual(paths(section(r.out, 'notes (business)')), ['notes/authored/api-refund-limit.md', 'notes/authored/api-unlayered.md', 'notes/repos/api/explored/api-invoices.md'])
})

test('--query ranks the matching notes best first and leaves out the ones it does not match', () => {
  const r = recall(brain(), '--query', 'retried charge idempotency')
  assert.equal(r.status, 0, r.err)
  const listed = paths(section(r.out, 'notes'))
  assert.equal(listed[0], 'notes/authored/api-retry-keys.md')
  assert.ok(!listed.includes('notes/authored/web-dark-mode.md'))
  assert.match(r.out, /^notes: \d+ of \d+ matching, best first$/m)
})

test('several --query phrasings fuse, so a note only one phrasing reaches still lists', () => {
  const r = recall(brain(), '--query', 'idempotency key', '--query', 'system theme')
  const listed = paths(section(r.out, 'notes'))
  assert.ok(listed.includes('notes/authored/api-retry-keys.md'))
  assert.ok(listed.includes('notes/authored/web-dark-mode.md'))
  assert.match(r.out, /fused from 2 queries/)
})

test('--top cuts the ranked list and says how to see more', () => {
  const r = recall(brain(), '--query', 'invoice refund retries theme', '--top', '1')
  assert.equal(paths(section(r.out, 'notes')).length, 1)
  assert.match(r.out, /… \d+ more: run again with --top 2/)
})

test('leaves out a superseded decision and lists the decision that replaced it', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-refund-v1.md'), note({ name: 'api-refund-v1', description: 'Refunds were manual spreadsheets', type: 'decision', layer: 'business', repos: '[api]', status: 'superseded', supersededBy: 'api-refund-limit' }))
  const r = recall(b, '--repo', 'api', '--query', 'manual spreadsheets')
  const lines = section(r.out, 'notes')
  assert.deepEqual(paths(lines), ['notes/authored/api-refund-limit.md'])
  assert.match(lines[0], /supersedes api-refund-v1$/)
})

test('--legacy lists the notes whose type or layer FORMAT.md does not describe', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-gotcha.md'), note({ name: 'api-gotcha', description: 'Old', type: 'gotcha', repos: '[api]' }))
  const r = recall(b, '--legacy')
  assert.equal(r.status, 0)
  assert.equal(r.out.trim(), 'notes/authored/api-gotcha.md · type gotcha, layer missing')
})

test('rejects an unknown layer with a usage error', () => {
  const r = recall(brain(), '--layer', 'domain')
  assert.equal(r.status, 2)
  assert.match(r.err, /--layer takes business or application/)
})
