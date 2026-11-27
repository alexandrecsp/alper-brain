// Run: node --test server/domain-route.test.mjs
// A brain's domain map, read over the server process driven over HTTP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { call, start, tokenOf } from './server-process.support.mjs'

const CUSTOMER = `---
name: customer
description: A Customer is a person or company that buys from us
type: term
layer: business
repos: [billing-api, web-app]
aliases:
  - cliente
  - buyer
avoid: [client]
---

A person or company that buys from us.

## Pairings
- billing-api: \`Customer\`, narrower. Only who has paid at least once. Avoid: \`buyer\`.
- web-app · checkout: \`User\`, broader. Anyone signed up.

## Relations
- places [[order]]
- is a [[party]]
`

const ORDER = '---\nname: order\ndescription: An Order\ntype: term\nlayer: business\nrepos: [billing-api]\n---\n\nWhat a Customer buys.\n\n## Pairings\n- billing-api: `Order`, same.\n'

// A brain folder holding `files` (path in the brain to text), listed by a fresh server; `write` adds a file to it afterwards.
const brainWith = async (files) => {
  const path = join(mkdtempSync(join(tmpdir(), 'alper-brain-')), 'work')
  const write = (name, text) => {
    mkdirSync(dirname(join(path, '.brain', name)), { recursive: true })
    writeFileSync(join(path, '.brain', name), text)
  }
  for (const [name, text] of Object.entries({ 'BRAIN.md': '# Brain\n', ...files })) write(name, text)
  const { port } = await start()
  const { id } = JSON.parse((await call(port, { method: 'POST', path: '/api/brains', headers: { 'x-brain-token': await tokenOf(port) }, body: { path } })).body)
  return { port, id, write }
}

const domainOf = async (port, id) => {
  const res = await call(port, { path: `/api/brains/${id}/domain` })
  return { status: res.status, ...JSON.parse(res.body) }
}

test('domain route answers each term in the pinned shape', async () => {
  const { port, id } = await brainWith({ 'notes/domain/customer.md': CUSTOMER })
  assert.deepEqual(await domainOf(port, id), {
    status: 200,
    terms: [
      {
        name: 'customer',
        description: 'A Customer is a person or company that buys from us',
        repos: ['billing-api', 'web-app'],
        aliases: ['cliente', 'buyer'],
        avoid: ['client'],
        pairings: [
          { repo: 'billing-api', word: 'Customer', degree: 'narrower', nuance: 'Only who has paid at least once', avoid: ['buyer'] },
          { repo: 'web-app', context: 'checkout', word: 'User', degree: 'broader', nuance: 'Anyone signed up', avoid: [] },
        ],
        relations: [{ verb: 'places', target: 'order' }, { verb: 'is a', target: 'party' }],
        decisions: [],
      },
    ],
  })
})

test('a decision linking a term is listed on that term', async () => {
  const { port, id } = await brainWith({
    'notes/domain/customer.md': CUSTOMER,
    'notes/domain/order.md': ORDER,
    'notes/repos/billing-api/billing-api-retry-idempotency.md': '---\ntype: decision\nlayer: business\nrepos: [billing-api]\n---\n\nA retried charge never bills a [[customer]] twice.\n',
  })
  const { terms } = await domainOf(port, id)
  assert.deepEqual(terms.map((t) => [t.name, t.decisions]), [['customer', ['billing-api-retry-idempotency']], ['order', []]])
})

test('domain route answers 404 for an unknown brain', async () => {
  const { port } = await brainWith({})
  assert.equal((await call(port, { path: '/api/brains/nope/domain' })).status, 404)
})

test('a term written after the server starts shows in the next answer', async () => {
  const { port, id, write } = await brainWith({})
  const before = (await domainOf(port, id)).terms.map((t) => t.name)
  write('notes/domain/order.md', ORDER)
  const after = (await domainOf(port, id)).terms.map((t) => t.name)
  assert.deepEqual({ before, after }, { before: [], after: ['order'] })
})
