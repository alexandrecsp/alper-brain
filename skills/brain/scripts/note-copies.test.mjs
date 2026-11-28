// Run: node --test skills/brain/scripts/note-copies.test.mjs
// The page's copy of notes.mjs's layer and relations, since brain.html cannot import it, checked against notes.mjs over the same notes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { noteOf } from './notes.mjs'
import { toData } from './page-blocks.support.mjs'

const RELATIONS = '\n## Relations\n\n- is paid by [[customer]]\n- raises [[invoice]]\n'
const FILES = new Map([
  ['notes/repos/api/billing.md', '---\ntype: feature\ndescription: Billing\n---\nBilling.\n'],
  ['notes/repos/api/stored-feature.md', '---\ntype: feature\nlayer: application\ndescription: Stored on a feature\n---\nFeature.\n'],
  ['notes/domain/order.md', `---\ntype: term\ndescription: An order\nrepos: [api]\n---\nAn order.\n\n## Pairings\n\n- api: \`Order\`, exact\n${RELATIONS}`],
  ['notes/repos/api/orders-api.md', '---\ntype: contract\ndescription: Orders API\nrepos: [api, web]\n---\nA contract.\n'],
  ['notes/repos/api/retries.md', '---\ntype: concept\ndescription: Retries\n---\nA concept.\n'],
  ['notes/repos/api/queue.md', '---\ntype: concept\nexplored: abc1234\ndescription: The queue\n---\nExplored.\n'],
  ['notes/shared/why-events.md', `---\ntype: decision\nlayer: business\ndescription: Why events\nrepos: [api, web]\n---\nA decision.\n${RELATIONS}`],
  ['notes/shared/deploy.md', '---\ntype: how-to\ndescription: Deploy\nrepos: [api, web]\n---\nA how-to with no layer line.\n'],
])

const parsed = () => [...FILES].map(([path, text]) => noteOf(path, text))
const paged = () => new Map(toData('team', FILES).notes.map((n) => [n.id, n]))

test("the page's note data gives each note the layer the note parser works out", () => {
  const page = paged()
  assert.deepEqual(parsed().map((n) => [n.name, page.get(n.name).layer]), parsed().map((n) => [n.name, n.layer]))
})

test("the page's note data gives each note the relations the note parser reads", () => {
  const page = paged()
  assert.deepEqual(parsed().map((n) => [n.name, page.get(n.name).relations]), parsed().map((n) => [n.name, n.relations]))
})
