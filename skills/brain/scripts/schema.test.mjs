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

// A brain in the `.brain/` layout with `api` and `web` registered, inside a git repository of its host, as a standalone
// brain is; `kind` is the line BRAIN.md carries, `own` makes the `.brain/` folder a git repository of its own.
const brain = ({ kind = 'standalone', own = false } = {}) => {
  const host = mkdtempSync(join(tmpdir(), 'brain-schema-'))
  const b = join(host, '.brain')
  put(join(b, 'BRAIN.md'), kind ? `---\nkind: ${kind}\n---\n\n# Brain\n` : '# Brain\n')
  for (const s of ['api', 'web']) put(join(b, `repos/${s}/REPO.md`), card(s))
  git(host)
  if (own) git(b)
  return b
}
const git = (cwd) => {
  const r = spawnSync('git', ['-C', cwd, 'init', '-q'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}
const schema = (b, ...files) => {
  const r = spawnSync(process.execPath, [script, b, ...files], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}
const good = { name: 'api-retry', description: 'Retries reuse the key', type: 'how-to', layer: 'application', repos: '[api]' }

test('passes a well-formed authored note, explored note and contract', () => {
  const b = brain()
  put(join(b, 'notes/authored/api-retry.md'), note(good))
  put(join(b, 'notes/exploration/api/api-refunds.md'), note({ name: 'api-refunds', description: 'Refunds within 30 days', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/authored/invoice-contract.md'), note({ name: 'invoice-contract', description: 'The invoice event', type: 'contract', layer: 'application', repos: '[api, web]' }))
  const r = schema(b)
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /^schema: ok, 4 files checked$/m)
})

test('rejects an explored note in an unregistered folder or without its SHA, and a repos line on one', () => {
  const b = brain()
  put(join(b, 'notes/exploration/ghost/ghost-x.md'), note({ name: 'ghost-x', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/exploration/api/api-refunds.md'), note({ name: 'api-refunds', description: 'X', type: 'feature', layer: 'business' }))
  put(join(b, 'notes/exploration/api/api-stray.md'), note({ name: 'api-stray', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d', repos: '[api]' }))
  const r = schema(b, ...['ghost/ghost-x', 'api/api-refunds', 'api/api-stray'].map((f) => join(b, `notes/exploration/${f}.md`)))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/exploration\/ghost\/ghost-x\.md: repository ghost is not registered/m)
  assert.match(r.out, /^notes\/exploration\/api\/api-refunds\.md: an explored note needs explored: /m)
  assert.match(r.out, /^notes\/exploration\/api\/api-stray\.md: repos belongs on an authored note only/m)
})

test('rejects a note outside notes/authored/ and notes/exploration/<slug>/ when named', () => {
  const b = brain()
  put(join(b, 'notes/exploration/api/deep/api-x.md'), note(good))
  const r = schema(b, join(b, 'notes/exploration/api/deep/api-x.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/exploration\/api\/deep\/api-x\.md: path notes\/exploration\/api\/deep\/api-x\.md is not notes\/authored\/<name>\.md or notes\/exploration\/<slug>\/<name>\.md$/m)
})

test('fails a BRAIN.md without a kind line', () => {
  const r = schema(brain({ kind: null }))
  assert.equal(r.status, 1)
  assert.match(r.out, /^BRAIN\.md: kind is missing; it is one of standalone, embedded, local$/m)
})

test('fails kind: local on a brain that is not a git repository of its own', () => {
  const r = schema(brain({ kind: 'local' }))
  assert.equal(r.status, 1)
  assert.match(r.out, /^BRAIN\.md: kind is local, but the brain is not a git repository of its own$/m)
})

test('fails kind: standalone on a brain that is a git repository of its own', () => {
  const r = schema(brain({ kind: 'standalone', own: true }))
  assert.equal(r.status, 1)
  assert.match(r.out, /^BRAIN\.md: kind is standalone, but the brain is a git repository of its own, which only a local brain is$/m)
})

test('passes kind: local on a brain that is a git repository of its own', () => {
  const r = schema(brain({ kind: 'local', own: true }))
  assert.equal(r.status, 0, r.out)
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
  put(join(b, 'notes/exploration/ghost/ghost-x.md'), note({ name: 'ghost-x', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  const r = schema(b, join(b, 'notes/authored/api-retry.md'), join(b, 'notes/exploration/ghost/ghost-x.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/authored\/api-retry\.md: repos names billing, which is not registered$/m)
  assert.match(r.out, /^notes\/exploration\/ghost\/ghost-x\.md: repository ghost is not registered/m)
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
  put(join(b, 'notes/exploration/api/api-refunds.md'), note({ name: 'api-refunds', description: 'X', type: 'feature', layer: 'application' }))
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
  put(join(b, 'notes/exploration/api/api-dup.md'), note({ name: 'api-dup', description: 'X', type: 'concept', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/authored/api-old.md'), note({ ...good, name: 'api-old', status: 'superseded' }))
  const r = schema(b)
  assert.equal(r.status, 1)
  assert.match(r.out, /api-retry\.md: name api-retries differs from the file name api-retry/)
  assert.match(r.out, /notes\/authored\/api-dup\.md: name api-dup is already taken by notes\/exploration\/api\/api-dup\.md/)
  assert.match(r.out, /api-old\.md: only a decision is superseded/)
  assert.match(r.out, /api-old\.md: a superseded decision needs supersededBy/)
})

test('checks a draft as the note it lands as, and needs its target and action', () => {
  const b = brain()
  put(join(b, 'notes/drafts/api-limits.md'), note({ ...good, name: 'api-limits', target: 'notes/authored/api-limits.md', action: 'update' }))
  put(join(b, 'notes/drafts/api-bad.md'), note({ ...good, name: 'api-bad', action: 'rewrite' }))
  put(join(b, 'notes/drafts/api-gone.md'), note({ target: 'notes/authored/api-gone.md', action: 'delete' }, 'Its subject is gone.'))
  const ok = schema(b, join(b, 'notes/drafts/api-limits.md'), join(b, 'notes/drafts/api-gone.md'))
  assert.equal(ok.status, 0, ok.out)
  const bad = schema(b, join(b, 'notes/drafts/api-bad.md'))
  assert.equal(bad.status, 1)
  assert.match(bad.out, /api-bad\.md: a draft needs target: /)
  assert.match(bad.out, /api-bad\.md: action is "rewrite"; it is one of record, update, supersede, delete/)
})
