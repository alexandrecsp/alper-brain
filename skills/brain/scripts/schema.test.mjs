// Run: node --test skills/brain/scripts/schema.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'schema.mjs')
const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const note = (fm, body = 'A fact.') => `---\n${Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}\n`
const card = (slug) => `---\nslug: ${slug}\nremote: local only\n---\n\nThe ${slug} repository.\n`

// A brain in the notes/ layout with the repositories `api` and `web` registered.
const brain = (layout = 'notes') => {
  const b = mkdtempSync(join(tmpdir(), 'brain-schema-'))
  put(join(b, 'BRAIN.md'), '# Brain\n')
  for (const s of ['api', 'web']) put(join(b, layout === 'notes' ? `notes/repos/${s}/REPO.md` : `repos/${s}/REPO.md`), card(s))
  return b
}
const schema = (b, ...files) => {
  const r = spawnSync(process.execPath, [script, b, ...files], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}
const good = { name: 'api-retry', description: 'Retries reuse the key', type: 'how-to', layer: 'application', repos: '[api]' }

test('passes a well-formed authored note, explored note and contract', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-retry.md'), note(good))
  put(join(b, 'notes/repos/api/explored/api-refunds.md'), note({ name: 'api-refunds', description: 'Refunds within 30 days', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/authored/invoice-contract.md'), note({ name: 'invoice-contract', description: 'The invoice event', type: 'contract', layer: 'application', repos: '[api, web]' }))
  const r = schema(b)
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /^schema: ok, 3 files checked$/m)
})

test('rejects an authored note without repos', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-retry.md'), note({ ...good, repos: undefined }))
  const r = schema(b, join(b, 'notes/authored/api-retry.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/authored\/api-retry\.md: an authored note needs repos: /m)
})

test('rejects a repos line naming an unregistered slug, and an explored note in an unregistered folder', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-retry.md'), note({ ...good, repos: '[api, billing]' }))
  put(join(b, 'notes/repos/ghost/explored/ghost-x.md'), note({ name: 'ghost-x', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  const r = schema(b, join(b, 'notes/authored/api-retry.md'), join(b, 'notes/repos/ghost/explored/ghost-x.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/authored\/api-retry\.md: repos names billing, which is not registered$/m)
  assert.match(r.out, /^notes\/repos\/ghost\/explored\/ghost-x\.md: repository ghost is not registered/m)
})

test('warns on a one-repository name without its slug, and still passes', () => {
  const b = brain()
  put(join(b, 'notes/authored/retry-keys.md'), note({ ...good, name: 'retry-keys' }))
  const r = schema(b, join(b, 'notes/authored/retry-keys.md'))
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /^notes\/authored\/retry-keys\.md: warn: name retry-keys does not start with api-/m)
  assert.match(r.out, /schema: ok, 1 file checked, 1 warning/)
})

test('rejects the type rules: a contract on one repository, an authored feature, an explored note without its SHA', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-contract.md'), note({ name: 'api-contract', description: 'X', type: 'contract', layer: 'application', repos: '[api]' }))
  put(join(b, 'notes/authored/api-export.md'), note({ name: 'api-export', description: 'X', type: 'feature', layer: 'business', repos: '[api]' }))
  put(join(b, 'notes/repos/api/explored/api-refunds.md'), note({ name: 'api-refunds', description: 'X', type: 'feature', layer: 'application' }))
  const r = schema(b)
  assert.equal(r.status, 1)
  assert.match(r.out, /api-contract\.md: a contract names at least two repos/)
  assert.match(r.out, /api-export\.md: a feature is an explored note only/)
  assert.match(r.out, /api-refunds\.md: an explored note needs explored: /)
  assert.match(r.out, /api-refunds\.md: a feature is always business/)
})

test('rejects a name that differs from its file or is taken twice, and a superseded note that is no decision', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-retry.md'), note({ ...good, name: 'api-retries' }))
  put(join(b, 'notes/authored/api-dup.md'), note({ ...good, name: 'api-dup' }))
  put(join(b, 'notes/repos/api/explored/api-dup.md'), note({ name: 'api-dup', description: 'X', type: 'concept', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/authored/api-old.md'), note({ ...good, name: 'api-old', status: 'superseded' }))
  const r = schema(b)
  assert.equal(r.status, 1)
  assert.match(r.out, /api-retry\.md: name api-retries differs from the file name api-retry/)
  assert.match(r.out, /notes\/authored\/api-dup\.md: name api-dup is already taken by notes\/repos\/api\/explored\/api-dup\.md/)
  assert.match(r.out, /api-old\.md: only a decision is superseded/)
  assert.match(r.out, /api-old\.md: a superseded decision needs supersededBy/)
})

test('checks a draft as the note it lands as, and needs its target and action', () => {
  const b = brain()
  put(join(b, '.brain/drafts/api-limits.md'), note({ ...good, name: 'api-limits', target: 'notes/authored/api-limits.md', action: 'update' }))
  put(join(b, '.brain/drafts/api-bad.md'), note({ ...good, name: 'api-bad', action: 'rewrite' }))
  put(join(b, '.brain/drafts/api-gone.md'), note({ target: 'notes/authored/api-gone.md', action: 'delete' }, 'Its subject is gone.'))
  const ok = schema(b, join(b, '.brain/drafts/api-limits.md'), join(b, '.brain/drafts/api-gone.md'))
  assert.equal(ok.status, 0, ok.out)
  const bad = schema(b, join(b, '.brain/drafts/api-bad.md'))
  assert.equal(bad.status, 1)
  assert.match(bad.out, /api-bad\.md: a draft needs target: /)
  assert.match(bad.out, /api-bad\.md: action is "rewrite"; it is one of record, update, supersede, delete/)
})

test('in the legacy layout, a shared/ note needs repos and a note beside its card takes none', () => {
  const b = brain('legacy')
  put(join(b, 'repos/api/api-retry.md'), note({ ...good, repos: undefined }))
  put(join(b, 'shared/invoice-contract.md'), note({ name: 'invoice-contract', description: 'X', type: 'contract', layer: 'application', repos: '[api, web]' }))
  const clean = schema(b)
  assert.equal(clean.status, 0, clean.out)
  put(join(b, 'shared/invoice-flow.md'), note({ name: 'invoice-flow', description: 'X', type: 'concept', layer: 'business' }))
  put(join(b, 'repos/web/web-x.md'), note({ name: 'web-x', description: 'X', type: 'concept', layer: 'business', repos: '[web]' }))
  const r = schema(b)
  assert.equal(r.status, 1)
  assert.match(r.out, /shared\/invoice-flow\.md: a shared note needs repos/)
  assert.match(r.out, /repos\/web\/web-x\.md: repos belongs on a shared\/ note only/)
})
