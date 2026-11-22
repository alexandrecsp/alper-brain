// Run: node --test skills/brain/scripts/timeline.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'timeline.mjs')
const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const note = (fm, body = 'A retried charge sends the first attempt\'s idempotency key, and the provider answers with the first result.') =>
  `---\n${Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}\n\n**Why:** the provider double-billed during the March outage.\n`
const card = (slug) => `---\nslug: ${slug}\nremote: local only\n---\n\nThe ${slug} repository.\n`

// A git repository holding a brain, with a commit helper that stamps a fixed author and date.
const brain = () => {
  const b = mkdtempSync(join(tmpdir(), 'brain-timeline-'))
  put(join(b, 'BRAIN.md'), '# Brain\n')
  let day = 0
  const git = (...a) => {
    const date = `2026-11-${String(day + 1).padStart(2, '0')}T10:00:00+02:00`
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Ana', GIT_AUTHOR_EMAIL: 'ana@t', GIT_COMMITTER_NAME: 'Ana', GIT_COMMITTER_EMAIL: 'ana@t', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
    const r = spawnSync('git', ['-C', b, '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8', env })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  git('init', '-q')
  const commit = (title) => { git('add', '-A'); git('commit', '-q', '-m', title); day++; return git('rev-parse', 'HEAD') }
  return { b, git, commit }
}
const timeline = (b) => {
  const r = spawnSync(process.execPath, [script, b], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr, json: r.status === 0 ? JSON.parse(readFileSync(join(b, 'timeline.json'), 'utf8')) : null }
}
const retry = { name: 'api-retry', description: 'Retries reuse the key', type: 'how-to', layer: 'application', repos: '[api]' }

test('writes the JSON FORMAT.md shows: one commit per line, a seven-character sha, a UTC date, and each change', () => {
  const { b, commit } = brain()
  put(join(b, 'notes/repos/api/REPO.md'), card('api'))
  put(join(b, 'notes/authored/api-retry.md'), note(retry))
  const sha = commit('Records the retry key')
  const r = timeline(b)
  assert.equal(r.status, 0, r.err)
  assert.deepEqual(r.json, { version: 1, commits: [{
    sha: sha.slice(0, 7), date: '2026-11-01T08:00:00Z', author: 'Ana', title: 'Records the retry key',
    changes: [{ note: 'api-retry', path: 'notes/authored/api-retry.md', action: 'recorded', type: 'how-to', layer: 'application', kind: 'authored', repos: ['api'] }],
  }] })
  const text = readFileSync(join(b, 'timeline.json'), 'utf8')
  assert.match(text, /^\{ "version": 1, "commits": \[\n\{"sha":/)
  assert.match(r.out, /^1 commits, 1 changes to notes; timeline\.json written/)
})

test('reads each action: recorded, updated, superseded, moved and deleted, and an explored note by its folder', () => {
  const { b, commit } = brain()
  put(join(b, 'notes/authored/api-retry.md'), note(retry))
  put(join(b, 'notes/authored/api-refund-v1.md'), note({ name: 'api-refund-v1', description: 'Manual refunds', type: 'decision', layer: 'business', repos: '[api]' }))
  put(join(b, 'notes/repos/api/explored/api-invoices.md'), note({ name: 'api-invoices', description: 'Invoices', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  commit('Records three notes')
  put(join(b, 'notes/authored/api-retry.md'), note({ ...retry, description: 'Retries always reuse the key' }))
  put(join(b, 'notes/authored/api-refund-v1.md'), note({ name: 'api-refund-v1', description: 'Manual refunds', type: 'decision', layer: 'business', repos: '[api]', status: 'superseded', supersededBy: 'api-refund-v2' }))
  commit('Updates the retry and supersedes the refund decision')
  rmSync(join(b, 'notes/authored/api-retry.md'))
  put(join(b, 'notes/authored/api-retry-keys.md'), note({ ...retry, name: 'api-retry-keys', description: 'Retries always reuse the key' }))
  commit('Renames the retry note')
  rmSync(join(b, 'notes/authored/api-refund-v1.md'))
  commit('Deletes the refund decision')
  const { json } = timeline(b)
  const actions = json.commits.map((c) => c.changes.map((x) => `${x.action} ${x.note}`).sort())
  assert.deepEqual(actions, [
    ['recorded api-invoices', 'recorded api-refund-v1', 'recorded api-retry'],
    ['superseded api-refund-v1', 'updated api-retry'],
    ['moved api-retry-keys'],
    ['deleted api-refund-v1'],
  ])
  const explored = json.commits[0].changes.find((x) => x.note === 'api-invoices')
  assert.equal(explored.kind, 'explored')
  assert.deepEqual(explored.repos, ['api'])
  const moved = json.commits[2].changes[0]
  assert.equal(moved.from, 'notes/authored/api-retry.md')
  assert.equal(moved.path, 'notes/authored/api-retry-keys.md')
  const deleted = json.commits[3].changes[0]
  assert.equal(deleted.type, 'decision', 'a deletion keeps the type its note last had')
  assert.equal(deleted.layer, 'business')
})

test('leaves out a commit that changes no note, and every card', () => {
  const { b, commit } = brain()
  put(join(b, 'notes/repos/api/REPO.md'), card('api'))
  commit('Registers api')
  put(join(b, 'README.md'), 'Hello\n')
  commit('Adds a readme')
  put(join(b, 'notes/authored/api-retry.md'), note(retry))
  commit('Records the retry key')
  const { json } = timeline(b)
  assert.deepEqual(json.commits.map((c) => c.title), ['Records the retry key'])
})

test('skips the notes-folder migration\'s renames, and reads the legacy notes before it', () => {
  const { b, git, commit } = brain()
  put(join(b, 'repos/api/REPO.md'), card('api'))
  put(join(b, 'repos/api/api-retry.md'), note({ ...retry, repos: undefined }))
  put(join(b, 'repos/api/explored/api-invoices.md'), note({ name: 'api-invoices', description: 'Invoices', type: 'feature', layer: 'business', explored: 'a1b2c3d' }))
  put(join(b, 'shared/invoice-contract.md'), note({ name: 'invoice-contract', description: 'The invoice event', type: 'contract', layer: 'application', repos: '[api, web]' }))
  commit('Records the legacy notes')
  // MIGRATE.md's **Notes folder**: move every card and note into notes/, adding repos to a note from repos/<slug>/.
  mkdirSync(join(b, 'notes/repos/api/explored'), { recursive: true })
  mkdirSync(join(b, 'notes/authored'), { recursive: true })
  git('mv', 'repos/api/REPO.md', 'notes/repos/api/REPO.md')
  git('mv', 'repos/api/explored/api-invoices.md', 'notes/repos/api/explored/api-invoices.md')
  git('mv', 'repos/api/api-retry.md', 'notes/authored/api-retry.md')
  git('mv', 'shared/invoice-contract.md', 'notes/authored/invoice-contract.md')
  put(join(b, 'notes/authored/api-retry.md'), note(retry))
  commit('Moves notes into notes/')
  put(join(b, 'notes/authored/api-retry.md'), note({ ...retry, description: 'Retries always reuse the key' }))
  commit('Updates the retry key')
  const { json } = timeline(b)
  assert.deepEqual(json.commits.map((c) => c.title), ['Records the legacy notes', 'Updates the retry key'])
  const legacy = Object.fromEntries(json.commits[0].changes.map((x) => [x.note, x]))
  assert.deepEqual(legacy['api-retry'].repos, ['api'])
  assert.equal(legacy['api-invoices'].kind, 'explored')
  assert.deepEqual(legacy['invoice-contract'].repos, ['api', 'web'])
  assert.deepEqual(json.commits[1].changes.map((x) => `${x.action} ${x.path}`), ['updated notes/authored/api-retry.md'])
})

test('running it again on the same history leaves the file unchanged', () => {
  const { b, commit } = brain()
  put(join(b, 'notes/authored/api-retry.md'), note(retry))
  commit('Records the retry key')
  const first = timeline(b)
  const again = timeline(b)
  assert.match(again.out, /timeline\.json unchanged/)
  assert.deepEqual(again.json, first.json)
})

test('fails without a BRAIN.md', () => {
  const r = spawnSync(process.execPath, [script, mkdtempSync(join(tmpdir(), 'brain-timeline-'))], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /No BRAIN\.md/)
})
