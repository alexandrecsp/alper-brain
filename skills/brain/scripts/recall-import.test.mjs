// Run: node --test skills/brain/scripts/recall-import.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'recall.mjs')
const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text) }
const note = (fm, body) => `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}\n`

// A clusters brain's `.brain/` folder on `api` and `web`: a retry how-to, an unrelated decision and a contract between them.
const brain = () => {
  const b = join(mkdtempSync(join(tmpdir(), 'brain-recall-import-')), '.brain')
  put(join(b, 'BRAIN.md'), '---\nkind: standalone\n---\n\n# Brain\n')
  for (const slug of ['api', 'web']) put(join(b, `repos/${slug}.md`), `---\nslug: ${slug}\nremote: local only\n---\n\nThe ${slug} repository.\n`)
  put(join(b, '.local/repos.json'), '{}')
  put(join(b, 'notes/repos/api/api-retry-keys.md'), note({ name: 'api-retry-keys', description: 'Billing retries reuse the idempotency key', type: 'how-to', layer: 'application', repos: '[api]' },
    'A retried charge sends the first idempotency key, so the provider never bills twice.'))
  put(join(b, 'notes/repos/api/api-refund-limit.md'), note({ name: 'api-refund-limit', description: 'Refunds above 500 wait for finance', type: 'decision', layer: 'business', repos: '[api]' },
    'Finance approves every large refund.'))
  put(join(b, 'notes/shared/invoice-event-contract.md'), note({ name: 'invoice-event-contract', description: 'The invoice event api emits and web reads', type: 'contract', layer: 'application', repos: '[api, web]' },
    'An unrelated body about schemas.'))
  return b
}

test('importing recall.mjs prints nothing and exits normally', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(script).href)})`], { encoding: 'utf8' })
  assert.deepEqual({ status: r.status, out: r.stdout, err: r.stderr }, { status: 0, out: '', err: '' })
})

test('rank returns the notes a query matches, best first, and the contracts on the repository', async () => {
  const { rank } = await import(pathToFileURL(script).href)
  const r = rank(brain(), { repos: ['api'], queries: ['idempotency key retry'] })
  assert.deepEqual(
    { notes: r.shown.map(({ n }) => n.name), contracts: r.contracts.map((n) => n.name) },
    { notes: ['api-retry-keys'], contracts: ['invoice-event-contract'] },
  )
})
