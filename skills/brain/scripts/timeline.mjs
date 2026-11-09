#!/usr/bin/env node
// Writes <brain>/timeline.json, every committed change to the notes in repos/ and shared/, oldest first, by the
// brain's FORMAT.md **Timeline**. It reads git history alone, so the same history always writes the same file,
// and a conflict in it resolves by running this again.
// Run: node timeline.mjs <brain>   (prints how many commits and changes it holds, and whether the file changed)
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const brain = resolve(process.argv[2] ?? '.')
if (!existsSync(join(brain, 'BRAIN.md'))) {
  console.error(`No BRAIN.md in ${brain}: pass the brain's folder.`)
  process.exit(1)
}

const git = (args, input) => {
  const r = spawnSync('git', ['-C', brain, '-c', 'core.quotepath=off', ...args], { input, maxBuffer: 1 << 30 })
  if (r.status !== 0) {
    console.error(r.stderr.toString().trim() || `git ${args[0]} failed`)
    process.exit(1)
  }
  return r.stdout
}

const hasCommits = spawnSync('git', ['-C', brain, 'rev-parse', '--verify', '--quiet', 'HEAD']).status === 0
const RS = '\x1e', US = '\x1f'
const log = hasCommits
  ? git(['log', '--reverse', '--no-merges', '-M', '--name-status', `--format=${RS}%H${US}%aI${US}%an${US}%s`, '--', 'repos', 'shared']).toString('utf8')
  : ''

// A note's file: Markdown under repos/<slug>/ (its explored/ too) or shared/, never a repository's card.
const isNote = (path) => path.endsWith('.md') && !/^repos\/[^/]+\/REPO\.md$/.test(path) && /^(repos\/[^/]+\/|shared\/)/.test(path)

const commits = []
for (const block of log.split(RS).slice(1)) {
  const [head, ...lines] = block.split('\n')
  const [sha, date, author, title] = head.split(US)
  const changes = []
  for (const line of lines) {
    if (!line.trim()) continue
    const [status, a, b] = line.split('\t')
    const letter = status[0]
    const path = letter === 'R' || letter === 'C' ? b : a
    if (!isNote(path) && !(letter === 'R' && isNote(a))) continue
    changes.push({ letter, path, from: letter === 'R' ? a : undefined })
  }
  if (changes.length) commits.push({ sha, date, author, title, changes })
}

// Every note's text at the commit that wrote it, read in one batch.
const wanted = commits.flatMap((c) => c.changes.filter((x) => x.letter !== 'D').map((x) => `${c.sha}:${x.path}`))
const texts = new Map()
if (wanted.length) {
  const out = git(['cat-file', '--batch'], wanted.join('\n') + '\n')
  let at = 0
  for (const key of wanted) {
    const nl = out.indexOf(10, at)
    const header = out.subarray(at, nl).toString('utf8')
    at = nl + 1
    const size = Number(header.split(' ')[2])
    if (header.endsWith(' missing') || Number.isNaN(size)) continue
    texts.set(key, out.subarray(at, at + size).toString('utf8'))
    at += size + 1
  }
}

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text ?? '')
  const fm = {}
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line)
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return fm
}

function meta(path, text) {
  const fm = frontmatter(text)
  const parts = path.split('/')
  const repos = parts[0] === 'repos'
    ? [parts[1]]
    : (fm.repos ?? '').replace(/^\[|\]$/g, '').split(',').map((r) => r.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  return {
    note: parts.at(-1).replace(/\.md$/, ''),
    type: fm.type || 'other',
    kind: fm.explored || parts[2] === 'explored' ? 'explored' : 'authored',
    repos,
    superseded: fm.status === 'superseded',
  }
}

// The last state each path was seen in, so a deletion keeps its note's type and a supersede shows as one.
const last = new Map()
const out = commits.map((c) => {
  const changes = c.changes.map(({ letter, path, from }) => {
    let m, action
    if (letter === 'D') {
      m = last.get(path) ?? meta(path, '')
      last.delete(path)
      action = 'deleted'
    } else {
      m = meta(path, texts.get(`${c.sha}:${path}`))
      const before = last.get(from ?? path)
      if (from) last.delete(from)
      last.set(path, m)
      action = letter === 'R' ? 'moved' : letter === 'M' ? (m.superseded && !before?.superseded ? 'superseded' : 'updated') : 'recorded'
    }
    const change = { note: m.note, path, action, type: m.type, kind: m.kind, repos: m.repos }
    if (from) change.from = from
    return change
  })
  // Seven characters on every clone, whatever its core.abbrev, so every clone writes the same file.
  return { sha: c.sha.slice(0, 7), date: new Date(c.date).toISOString().replace(/\.\d{3}Z$/, 'Z'), author: c.author, title: c.title, changes }
})

// One commit per line, so a teammate's new commits show as new lines in the diff.
const json = `{ "version": 1, "commits": [\n${out.map((c) => JSON.stringify(c)).join(',\n')}\n] }\n`
const file = join(brain, 'timeline.json')
// A checkout with core.autocrlf holds the file with CRLF endings, which is the same file to git.
const changed = !existsSync(file) || readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== json
if (changed) writeFileSync(file, json)
const total = out.reduce((n, c) => n + c.changes.length, 0)
console.log(`${out.length} commits, ${total} changes to notes; timeline.json ${changed ? 'written' : 'unchanged'}`)
