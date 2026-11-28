// Run: node --test skills/brain/scripts/page-data.test.mjs
// Runs brain.html's note data (toData, in THE PAGE block) in Node over a small brain's files (page-blocks.support.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toData } from './page-blocks.support.mjs'

// A small brain: an explored note of the api repository and an authored note of two repositories, linking each other, the
// explored one linking a note nobody wrote and itself.
const FILES = new Map([
  ['notes/repos/api/billing.md', '---\ntype: concept\nexplored: abc1234\ndescription: How billing works\n---\nBilling raises an [[invoice]], then waits on [[unwritten]] and on [[billing]].\n'],
  ['notes/shared/invoice.md', '---\ntype: decision\nrepos: [api, web]\ndescription: What an invoice is\n---\nAn invoice is raised by [[billing]].\n'],
])

test("each note of the brain's files carries the notes it links to", () => {
  const { notes } = toData('team', FILES)
  assert.deepEqual(notes.map((n) => [n.id, n.links]), [['billing', ['invoice', 'unwritten']], ['invoice', ['billing']]])
})

test('a link to a note nobody wrote is a ghost', () => {
  const { ghosts } = toData('team', FILES)
  assert.deepEqual(ghosts, ['unwritten'])
})
