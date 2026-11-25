// Run: node --test server/infrastructure/driven/fs-user-config.adapter.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fsUserConfig } from './fs-user-config.adapter.mjs'

const homeWith = (text) => {
  const home = mkdtempSync(join(tmpdir(), 'alper-home-'))
  if (text !== undefined) {
    mkdirSync(join(home, '.alper-brain'))
    writeFileSync(join(home, '.alper-brain', 'config.json'), text)
  }
  return home
}

test('the port the config names comes back', () => {
  assert.equal(fsUserConfig({ home: homeWith('{ "port": 51000 }') }).port(), 51000)
})

test('no config file, or a config with no port, gives no port', () => {
  assert.equal(fsUserConfig({ home: homeWith() }).port(), undefined)
  assert.equal(fsUserConfig({ home: homeWith('{}') }).port(), undefined)
})

test('a port that is not a whole number from 1 to 65535 is refused, naming the file', () => {
  for (const bad of ['"51000"', '0', '70000', '1.5']) {
    assert.throws(() => fsUserConfig({ home: homeWith(`{ "port": ${bad} }`) }).port(), /config\.json: "port" must be a whole number/)
  }
})

test('a config that is not JSON is refused, naming the file', () => {
  assert.throws(() => fsUserConfig({ home: homeWith('{ port: 1 ') }).port(), /config\.json is not valid JSON/)
})
