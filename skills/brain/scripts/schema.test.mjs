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

// A brain in the clusters layout with `api` and `web` registered, inside a git repository of its host, as a standalone
// brain is; `kind` is the line BRAIN.md carries, `own` makes the `.brain/` folder a git repository of its own.
const brain = ({ kind = 'standalone', own = false } = {}) => {
  const host = mkdtempSync(join(tmpdir(), 'brain-schema-'))
  const b = join(host, '.brain')
  put(join(b, 'BRAIN.md'), kind ? `---\nkind: ${kind}\n---\n\n# Brain\n` : '# Brain\n')
  for (const s of ['api', 'web']) put(join(b, `repos/${s}.md`), card(s))
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
  put(join(b, 'notes/repos/api/api-retry.md'), note(good))
  put(join(b, 'notes/repos/api/api-refunds.md'), note({ name: 'api-refunds', description: 'Refunds within 30 days', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/shared/invoice-contract.md'), note({ name: 'invoice-contract', description: 'The invoice event', type: 'contract', layer: 'application', repos: '[api, web]' }))
  const r = schema(b)
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /^schema: ok, 4 files checked$/m)
})

test('passes an explored decision in either layer, and holds every other explored note to business', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-manual-sql.md'), note({ name: 'api-manual-sql', description: 'SQL is written by hand', type: 'decision', layer: 'application', explored: 'a1b2c3d' }))
  put(join(b, 'notes/repos/api/api-retry-job.md'), note({ name: 'api-retry-job', description: 'A nightly job retries charges', type: 'concept', layer: 'application', explored: 'a1b2c3d' }))
  const r = schema(b, ...['api-manual-sql', 'api-retry-job'].map((f) => join(b, `notes/repos/api/${f}.md`)))
  assert.equal(r.status, 1)
  assert.doesNotMatch(r.out, /api-manual-sql\.md:/)
  assert.match(r.out, /^notes\/repos\/api\/api-retry-job\.md: an explored note is business, unless it is a decision$/m)
})

test('holds avoid to a non-empty list on a concept note', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-invoice.md'), note({ name: 'api-invoice', description: 'A request for payment', type: 'concept', layer: 'business', repos: '[api]', avoid: '[bill, payment request]' }))
  put(join(b, 'notes/repos/api/api-empty.md'), note({ name: 'api-empty', description: 'X', type: 'concept', layer: 'business', repos: '[api]', avoid: '[]' }))
  put(join(b, 'notes/repos/api/api-howto.md'), note({ name: 'api-howto', description: 'X', type: 'how-to', layer: 'application', repos: '[api]', avoid: '[bill]' }))
  const r = schema(b, ...['api-invoice', 'api-empty', 'api-howto'].map((f) => join(b, `notes/repos/api/${f}.md`)))
  assert.equal(r.status, 1)
  assert.doesNotMatch(r.out, /api-invoice\.md:/)
  assert.match(r.out, /^notes\/repos\/api\/api-empty\.md: avoid is empty/m)
  assert.match(r.out, /^notes\/repos\/api\/api-howto\.md: avoid belongs on a concept note only/m)
})

test('rejects an explored note in an unregistered folder, and a repos line on one', () => {
  const b = brain()
  put(join(b, 'notes/repos/ghost/ghost-x.md'), note({ name: 'ghost-x', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/repos/api/api-stray.md'), note({ name: 'api-stray', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d', repos: '[api]' }))
  const r = schema(b, ...['ghost/ghost-x', 'api/api-stray'].map((f) => join(b, `notes/repos/${f}.md`)))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/repos\/ghost\/ghost-x\.md: repository ghost is not registered/m)
  assert.match(r.out, /^notes\/repos\/api\/api-stray\.md: repos belongs on an authored note only/m)
})

test('rejects an explored note outside its repository\'s folder', () => {
  const b = brain()
  put(join(b, 'notes/shared/api-refunds.md'), note({ name: 'api-refunds', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  const r = schema(b, join(b, 'notes/shared/api-refunds.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/shared\/api-refunds\.md: an explored note belongs in notes\/repos\/<slug>\/, its repository's folder$/m)
})

test('rejects an authored note outside the noteHome of its repos line', () => {
  const b = brain()
  put(join(b, 'notes/shared/api-retry.md'), note(good))
  put(join(b, 'notes/repos/web/api-retry-web.md'), note({ ...good, name: 'api-retry-web' }))
  put(join(b, 'notes/repos/api/invoice-contract.md'), note({ name: 'invoice-contract', description: 'The invoice event', type: 'contract', layer: 'application', repos: '[api, web]' }))
  const r = schema(b, join(b, 'notes/shared/api-retry.md'), join(b, 'notes/repos/web/api-retry-web.md'), join(b, 'notes/repos/api/invoice-contract.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/shared\/api-retry\.md: an authored note on api belongs in notes\/repos\/api\/$/m)
  assert.match(r.out, /^notes\/repos\/web\/api-retry-web\.md: an authored note on api belongs in notes\/repos\/api\/$/m)
  assert.match(r.out, /^notes\/repos\/api\/invoice-contract\.md: an authored note on api, web belongs in notes\/shared\/$/m)
})

test('rejects a note outside notes/repos/<slug>/ and notes/shared/ when named, and a research note', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/deep/api-x.md'), note(good))
  put(join(b, 'notes/research/api-x.md'), note(good))
  const r = schema(b, join(b, 'notes/repos/api/deep/api-x.md'), join(b, 'notes/research/api-x.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/repos\/api\/deep\/api-x\.md: path notes\/repos\/api\/deep\/api-x\.md is not notes\/repos\/<slug>\/<name>\.md or notes\/shared\/<name>\.md$/m)
  assert.match(r.out, /^notes\/research\/api-x\.md: path notes\/research\/api-x\.md is not /m)
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
  put(join(b, 'notes/repos/api/api-retry.md'), note({ ...good, repos: undefined }))
  const r = schema(b, join(b, 'notes/repos/api/api-retry.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/repos\/api\/api-retry\.md: an authored note needs repos: /m)
})

test('rejects a repos line naming an unregistered slug, and an explored note in an unregistered folder', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-retry.md'), note({ ...good, repos: '[api, billing]' }))
  put(join(b, 'notes/repos/ghost/ghost-x.md'), note({ name: 'ghost-x', description: 'X', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  const r = schema(b, join(b, 'notes/repos/api/api-retry.md'), join(b, 'notes/repos/ghost/ghost-x.md'))
  assert.equal(r.status, 1)
  assert.match(r.out, /^notes\/repos\/api\/api-retry\.md: repos names billing, which is not registered$/m)
  assert.match(r.out, /^notes\/repos\/ghost\/ghost-x\.md: repository ghost is not registered/m)
})

test('warns on a one-repository name without its slug, and still passes', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/retry-keys.md'), note({ ...good, name: 'retry-keys' }))
  const r = schema(b, join(b, 'notes/repos/api/retry-keys.md'))
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /^notes\/repos\/api\/retry-keys\.md: warn: name retry-keys does not start with api-/m)
  assert.match(r.out, /schema: ok, 1 file checked, 1 warning/)
})

test('rejects the type rules: a contract on one repository, an authored feature, an explored feature in the application layer', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-contract.md'), note({ name: 'api-contract', description: 'X', type: 'contract', layer: 'application', repos: '[api]' }))
  put(join(b, 'notes/repos/api/api-export.md'), note({ name: 'api-export', description: 'X', type: 'feature', layer: 'business', repos: '[api]' }))
  put(join(b, 'notes/repos/api/api-refunds.md'), note({ name: 'api-refunds', description: 'X', type: 'feature', layer: 'application', explored: 'a1b2c3d' }))
  const r = schema(b)
  assert.equal(r.status, 1)
  assert.match(r.out, /api-contract\.md: a contract names at least two repos/)
  assert.match(r.out, /api-export\.md: a feature is an explored note only/)
  assert.match(r.out, /api-refunds\.md: a feature is always business/)
})

test('rejects a name that differs from its file or is taken twice, and a superseded note that is no decision', () => {
  const b = brain()
  put(join(b, 'notes/repos/api/api-retry.md'), note({ ...good, name: 'api-retries' }))
  put(join(b, 'notes/repos/api/api-dup.md'), note({ ...good, name: 'api-dup' }))
  put(join(b, 'notes/repos/web/api-dup.md'), note({ name: 'api-dup', description: 'X', type: 'concept', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'notes/repos/api/api-old.md'), note({ ...good, name: 'api-old', status: 'superseded' }))
  const r = schema(b)
  assert.equal(r.status, 1)
  assert.match(r.out, /api-retry\.md: name api-retries differs from the file name api-retry/)
  assert.match(r.out, /notes\/repos\/api\/api-dup\.md: name api-dup is already taken by notes\/repos\/web\/api-dup\.md/)
  assert.match(r.out, /api-old\.md: only a decision is superseded/)
  assert.match(r.out, /api-old\.md: a superseded decision needs supersededBy/)
})

test('checks a draft as the note it lands as, and needs its target and action', () => {
  const b = brain()
  put(join(b, '.local/drafts/api-limits.md'), note({ ...good, name: 'api-limits', target: 'notes/repos/api/api-limits.md', action: 'update' }))
  put(join(b, '.local/drafts/api-bad.md'), note({ ...good, name: 'api-bad', action: 'rewrite' }))
  put(join(b, '.local/drafts/api-gone.md'), note({ target: 'notes/repos/api/api-gone.md', action: 'delete' }, 'Its subject is gone.'))
  const ok = schema(b, join(b, '.local/drafts/api-limits.md'), join(b, '.local/drafts/api-gone.md'))
  assert.equal(ok.status, 0, ok.out)
  const bad = schema(b, join(b, '.local/drafts/api-bad.md'))
  assert.equal(bad.status, 1)
  assert.match(bad.out, /api-bad\.md: a draft needs target: /)
  assert.match(bad.out, /api-bad\.md: action is "rewrite"; it is one of record, update, supersede, delete/)
})
