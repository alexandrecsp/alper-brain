// Run: node --test server/application/use-cases/read-remote-url.use-case.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inMemoryBrainFiles } from '../../infrastructure/driven/in-memory-brain-files.adapter.mjs'
import { inMemoryBrainList } from '../../infrastructure/driven/in-memory-brain-list.adapter.mjs'
import { inMemoryGitClone } from '../../infrastructure/driven/in-memory-git-clone.adapter.mjs'
import { readRemoteUrl } from './read-remote-url.use-case.mjs'

const urlFor = (links) =>
  readRemoteUrl({
    brainList: inMemoryBrainList([{ id: 'b1', name: 'work', path: '/brain' }]),
    brainFiles: inMemoryBrainFiles({ '/brain': { '.local/repos.json': JSON.stringify(links) } }),
    gitClone: inMemoryGitClone({ '/clones/app': { remoteUrl: async () => 'git@h:app.git' } }),
  })('b1', 'app')

test('a link given as a path string finds its clone', async () => {
  assert.equal(await urlFor({ app: '/clones/app' }), 'git@h:app.git')
})

test('a link given as an object with a path finds its clone', async () => {
  assert.equal(await urlFor({ app: { path: '/clones/app' } }), 'git@h:app.git')
})
