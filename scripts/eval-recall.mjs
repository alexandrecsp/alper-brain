#!/usr/bin/env node
// Measures how well the brain skill's recall.mjs finds the notes a query needs, over a set of labelled queries.
// It runs recall.mjs as the skills do, as a separate process, so it measures the output they read, not its internals.
// Run: node scripts/eval-recall.mjs <brain> <queries.json> [--setup <name>]... [--top <n>] [--verbose] [--json <out.json>]
//
// queries.json holds [{ "id", "query", "expect": ["note-name", ...], "kind"?, "phrasings"?: ["...", ...] }].
// Keep it beside the brain it labels (in its .sdd/), never in this repository, since it names the brain's notes.
// Write the phrasings blind: from the query and the repository cards, never from the expected notes.
//
// A query counts a note as found at k when the note is among the first k of recall's `notes:` section, or in its
// `contracts:` section, which recall never ranks out. Each setup reports, averaged over the queries:
// - r@5, r@15, r@all: the share of expected notes found at 5, at 15, and anywhere in the --top listed (15 by default).
// - mrr: 1 / the rank of the first expected note in `notes:`, or 0 when none is listed.
// - read: how many notes recall lists, what it costs the reader. Compare setups at an equal read.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RECALL = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'brain', 'scripts', 'recall.mjs')

// Each setup turns a labelled query into recall.mjs arguments, or into null when the query cannot run under it.
const SETUPS = {
  'one-query': (q) => ['--query', q.query],
  phrasings: (q) => (q.phrasings?.length ? [q.query, ...q.phrasings].flatMap((p) => ['--query', p]) : null),
}

const fail = (message) => {
  console.error(`eval-recall: ${message}`)
  process.exit(2)
}

const argv = process.argv.slice(2)
const opts = { setups: [], top: 15, verbose: false, json: null }
const positional = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--setup') opts.setups.push(argv[++i])
  else if (a === '--top') opts.top = Number(argv[++i])
  else if (a === '--verbose') opts.verbose = true
  else if (a === '--json') opts.json = argv[++i]
  else if (a.startsWith('--')) fail(`unknown option ${a}`)
  else positional.push(a)
}
if (positional.length !== 2) fail('usage: eval-recall.mjs <brain> <queries.json> [--setup <name>]... [--top <n>] [--verbose] [--json <out.json>]')
if (!(opts.top > 0)) fail('--top takes a positive number')
const [brain, queriesPath] = positional.map((p) => resolve(p))
for (const s of opts.setups) if (!SETUPS[s]) fail(`unknown setup ${s}; one of ${Object.keys(SETUPS).join(', ')}`)
const setups = opts.setups.length ? opts.setups : Object.keys(SETUPS)

let queries
try {
  queries = JSON.parse(readFileSync(queriesPath, 'utf8'))
} catch (e) {
  fail(`cannot read ${queriesPath}: ${e.message}`)
}
if (!Array.isArray(queries) || !queries.length) fail(`${queriesPath} holds no queries`)
for (const q of queries) if (!q.id || !q.query || !Array.isArray(q.expect) || !q.expect.length) fail(`query ${JSON.stringify(q).slice(0, 80)} lacks id, query or expect`)

// ---- Running recall and reading its sections

const noteName = (entry) => basename(entry.split(' · ')[0].trim(), '.md')

function recall(args) {
  let out
  try {
    out = execFileSync(process.execPath, [RECALL, brain, '--top', String(opts.top), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    throw new Error(String(e.stderr ?? e.message).trim())
  }
  const sections = { contracts: [], notes: [], fused: false }
  let section = null
  for (const line of out.split('\n')) {
    const head = line.match(/^(contracts|notes)\b/)
    if (head) {
      section = head[1]
      if (section === 'notes') sections.fused = /fused from \d+ queries/.test(line)
    } else if (/^\S/.test(line)) section = null
    else if (section && line.startsWith('  ') && !line.trim().startsWith('…') && line.trim() !== 'none') sections[section].push(noteName(line))
  }
  return sections
}

// ---- Scoring

const results = {}
for (const setup of setups) {
  const rows = []
  let unsupported = null
  for (const q of queries) {
    const args = SETUPS[setup](q)
    if (!args) continue
    const got = recall(args)
    // A recall.mjs from before fusion keeps only the last --query, so it must say it fused them.
    if (args.filter((a) => a === '--query').length > 1 && !got.fused) {
      unsupported = 'it does not fuse several --query'
      break
    }
    const found = (listed) => q.expect.filter((e) => got.contracts.includes(e) || listed.includes(e))
    const first = got.notes.findIndex((n) => q.expect.includes(n))
    rows.push({
      id: q.id, kind: q.kind ?? '',
      r5: found(got.notes.slice(0, 5)).length / q.expect.length,
      r15: found(got.notes.slice(0, 15)).length / q.expect.length,
      rAll: found(got.notes).length / q.expect.length,
      rr: first < 0 ? 0 : 1 / (first + 1),
      read: got.notes.length,
      missed: q.expect.filter((e) => !found(got.notes).includes(e)),
    })
  }
  results[setup] = { unsupported, rows }
}

// ---- Report

const mean = (rows, key) => (rows.length ? rows.reduce((s, r) => s + r[key], 0) / rows.length : 0)
const fmt = (x) => x.toFixed(2)
const kinds = [...new Set(queries.map((q) => q.kind).filter(Boolean))]
const out = [`brain: ${brain.replace(/\\/g, '/')} · ${queries.length} queries · top ${opts.top} · recall ${RECALL.replace(/\\/g, '/')}`, '']
out.push(`${'setup'.padEnd(12)} ${'n'.padStart(3)}  r@5   r@15  r@all mrr   read${kinds.map((k) => `  r@5 ${k}`).join('')}`)
for (const [setup, { unsupported, rows }] of Object.entries(results)) {
  if (unsupported) {
    out.push(`${setup.padEnd(12)} not supported by this recall.mjs: ${unsupported}`)
    continue
  }
  if (!rows.length) {
    out.push(`${setup.padEnd(12)} no query can run under it (needs phrasings)`)
    continue
  }
  const byKind = kinds.map((k) => {
    const of = rows.filter((r) => r.kind === k)
    return `  ${(of.length ? fmt(mean(of, 'r5')) : '–').padStart(4 + k.length)}`
  }).join('')
  out.push(`${setup.padEnd(12)} ${String(rows.length).padStart(3)}  ${fmt(mean(rows, 'r5'))}  ${fmt(mean(rows, 'r15'))}  ${fmt(mean(rows, 'rAll'))}  ${fmt(mean(rows, 'rr'))}  ${mean(rows, 'read').toFixed(1).padStart(4)}${byKind}`)
}
if (opts.verbose) {
  for (const [setup, { unsupported, rows }] of Object.entries(results)) {
    if (unsupported || !rows.length) continue
    out.push('', `${setup}:`)
    for (const r of rows) out.push(`  ${r.id} ${r.kind.padEnd(10)} r@5 ${fmt(r.r5)} r@15 ${fmt(r.r15)} rr ${fmt(r.rr)}${r.missed.length ? ` · missed ${r.missed.join(', ')}` : ''}`)
  }
}
console.log(out.join('\n'))
if (opts.json) writeFileSync(opts.json, `${JSON.stringify({ brain, queries: queriesPath, top: opts.top, date: new Date().toISOString(), results }, null, 2)}\n`)
