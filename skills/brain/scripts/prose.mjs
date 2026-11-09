#!/usr/bin/env node
// Checks the plain-prose rules a script can decide, by the brain's PROSE.md: sentence length (rule 3), wordy
// phrases (rule 2), semicolons and spaced dashes between clauses (rule 6) and paragraph length (rule 9). It reads
// only the sentences PROSE.md's **Where it applies** names, by the file's shape: a note or draft, a repository
// card, a spec.md, a milestone.md or a ticket. Every other file is skipped.
// Run: node prose.mjs <file|folder>...   (prints one <path>:<line> per finding and exits 1, else prints prose: ok)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const MAX = { proc: 20, desc: 25 }
const MAX_SENTENCES = 6
const WORDY = [
  [/\butili[sz](e|es|ed|ing|ation)\b/i, 'use'],
  [/\bin order to\b/i, 'to'],
  [/\bprior to\b/i, 'before'],
  [/\bsubsequent to\b/i, 'after'],
  [/\bin the event that\b/i, 'if'],
  [/\bapproximately\b/i, 'about'],
  [/\bcommenc(e|es|ed|ing)\b/i, 'start'],
  [/\bfacilitat(e|es|ed|ing)\b/i, 'help'],
  [/\band\/or\b/i, '"or", or name both cases'],
]
const ABBREVIATIONS = new Set(['e.g.', 'i.e.', 'vs.', 'cf.', 'approx.', 'no.', 'fig.'])
const SKIP_DIRS = new Set(['.git', 'node_modules', 'snapshots', '.obsidian'])

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: node prose.mjs <file|folder>...')
  process.exit(2)
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : walk(path)
    return name.endsWith('.md') ? [path] : []
  })
const files = args.flatMap((arg) => {
  if (!existsSync(arg)) {
    console.error(`${arg}: not found`)
    process.exit(2)
  }
  return statSync(arg).isDirectory() ? walk(arg) : [arg]
})

// ---- Blocks: a paragraph or a list item, each line kept with its number. Sentences never cross a block.

const frontmatterEnd = (lines) => {
  if (lines[0]?.trim() !== '---') return 0
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return end < 0 ? 0 : end + 1
}
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/
const LABEL = /^\*\*([^*]+?):?\*\*:?\s*/

// Splits lines [from, to) into blocks, leaving out code fences, tables, headings and HTML comments.
const blocksOf = (lines, from, to) => {
  const blocks = []
  let block = null
  let fence = false
  const close = () => {
    if (block) blocks.push(block)
    block = null
  }
  for (let i = from; i < to; i++) {
    const raw = lines[i]
    const t = raw.trim()
    if (/^(```|~~~)/.test(t)) {
      fence = !fence
      close()
      continue
    }
    if (fence) continue
    if (!t || t.startsWith('|') || t.startsWith('#') || t.startsWith('<!--')) {
      close()
      continue
    }
    if (LIST_ITEM.test(raw)) {
      close()
      block = { list: true, lines: [{ n: i + 1, text: raw.replace(LIST_ITEM, '') }] }
    } else if (LABEL.test(t) || !block) {
      close()
      block = { list: false, lines: [{ n: i + 1, text: t }] }
    } else block.lines.push({ n: i + 1, text: t })
  }
  close()
  return blocks
}
const labelOf = (block) => block.lines[0].text.match(LABEL)?.[1].trim().toLowerCase() ?? null
const sectionsOf = (lines, from) => {
  const out = []
  for (let i = from; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+?)\s*$/)
    if (h) out.push({ name: h[1].toLowerCase(), from: i + 1 })
  }
  out.forEach((s, k) => (s.to = k + 1 < out.length ? out[k + 1].from - 1 : lines.length))
  return out
}

// ---- Shapes: each returns the blocks to check, each with its mode, procedural or descriptive. The section and
// line names below copy PROSE.md's **Where it applies** table: rename one in a template, and rename it here too.

const NOTE_SKIP = /^(related|sources):|^superseded by\b/i
const shapes = {
  note(lines, start) {
    const out = []
    const front = lines.slice(1, start - 1)
    const d = front.findIndex((l) => /^description:/.test(l))
    if (d >= 0) {
      const text = lines[d + 1].replace(/^description:\s*/, '').replace(/^(["'])(.*)\1$/, '$2')
      out.push({ mode: 'desc', list: false, lines: [{ n: d + 2, text }] })
    }
    const howTo = front.some((l) => /^type:\s*how-to\s*$/.test(l))
    for (const b of blocksOf(lines, start, lines.length)) {
      if (NOTE_SKIP.test(b.lines[0].text)) continue
      const label = labelOf(b)
      out.push({ ...b, mode: label === 'how to apply' || (howTo && label !== 'why') ? 'proc' : 'desc' })
    }
    return out
  },
  card: (lines, start) => blocksOf(lines, start, lines.length).map((b) => ({ ...b, mode: 'desc' })),
  spec(lines, start) {
    const prose = new Set(['problem statement', 'solution', 'user stories', 'out of scope', 'further notes'])
    return sectionsOf(lines, start)
      .filter((s) => prose.has(s.name))
      .flatMap((s) => blocksOf(lines, s.from, s.to).map((b) => ({ ...b, mode: 'desc' })))
  },
  milestone(lines, start) {
    const first = sectionsOf(lines, start)[0]
    const header = first ? first.from - 1 : lines.length
    const modes = { delivers: 'desc', 'done when': 'proc' }
    return blocksOf(lines, start, header)
      .filter((b) => modes[labelOf(b)])
      .map((b) => ({ ...b, mode: modes[labelOf(b)] }))
  },
  ticket(lines, start) {
    const modes = { 'what to build': 'desc', 'acceptance criteria': 'proc' }
    return sectionsOf(lines, start)
      .filter((s) => modes[s.name])
      .flatMap((s) =>
        blocksOf(lines, s.from, s.to).map((b) => ({ ...b, mode: modes[s.name], criterion: s.name === 'acceptance criteria' })),
      )
  },
}
const shapeOf = (path, lines, start) => {
  const name = basename(path)
  if (name === 'REPO.md') return 'card'
  if (name === 'spec.md') return 'spec'
  if (name === 'milestone.md') return 'milestone'
  // A ticket opens on its "# Ticket" heading; a heading further down, such as one in a template's code fence, is not one.
  if (/^# Ticket\b/.test(lines.slice(start).find((l) => l.trim()) ?? '')) return 'ticket'
  const front = start ? lines.slice(1, start - 1) : []
  if (front.some((l) => /^name:/.test(l)) && front.some((l) => /^type:/.test(l))) return 'note'
  return null
}

// ---- Words and sentences. A code span, link or URL is one word; a token with no letter or digit is none.

const NBSP = ' '
const tokensOf = (text) =>
  text
    .replace(/`[^`]*`/g, (m) => m.replace(/\s+/g, NBSP))
    .replace(/\[\[[^\]]*\]\]/g, (m) => m.replace(/\s+/g, NBSP))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(LABEL, '')
    .split(/[ \t]+/)
    .filter(Boolean)
const isWord = (t) => /[A-Za-z0-9]/.test(t)
const endsSentence = (t) => {
  const bare = t.replace(/[*_"')\]]+$/, '')
  return /[.!?]$/.test(bare) && !ABBREVIATIONS.has(bare.toLowerCase().replace(/^[*_("']+/, ''))
}
const sentencesOf = (block) => {
  const sentences = []
  let cur = null
  for (const { n, text } of block.lines)
    for (const t of tokensOf(text)) {
      cur ??= { n, tokens: [] }
      cur.tokens.push(t)
      if (endsSentence(t)) {
        sentences.push(cur)
        cur = null
      }
    }
  if (cur) sentences.push(cur)
  return sentences
}
const snippet = (tokens) => {
  const s = tokens.slice(0, 8).join(' ').replaceAll(NBSP, ' ')
  return tokens.length > 8 ? `${s}…` : s
}

// ---- Findings

const findings = []
let checked = 0
for (const path of files) {
  const lines = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n').split('\n')
  const start = frontmatterEnd(lines)
  const shape = shapeOf(path, lines, start)
  if (!shape) continue
  checked++
  const where = (n) => `${path.replaceAll('\\', '/')}:${n}`
  for (const block of shapes[shape](lines, start)) {
    const sentences = sentencesOf(block)
    for (const s of sentences) {
      // A criterion's ", proven at <seam>" ending is the template's, so it counts as no words.
      const tail = block.criterion ? s.tokens.findLastIndex((t, k) => t === 'proven' && /,$/.test(s.tokens[k - 1] ?? '')) : -1
      const words = (tail > 0 ? s.tokens.slice(0, tail) : s.tokens).filter(isWord).length
      if (words > MAX[block.mode])
        findings.push(
          `${where(s.n)}: ${block.mode === 'proc' ? 'procedural' : 'descriptive'} sentence of ${words} words, at most ${MAX[block.mode]}: "${snippet(s.tokens)}"`,
        )
      const joint = s.tokens.find((t) => /;$/.test(t.replace(/[*_]+$/, '')) || /^(—|–|--)$/.test(t))
      if (joint) findings.push(`${where(s.n)}: "${joint}" joins two clauses; end the first with a full stop: "${snippet(s.tokens)}"`)
    }
    if (!block.list && sentences.length > MAX_SENTENCES)
      findings.push(`${where(block.lines[0].n)}: paragraph of ${sentences.length} sentences, at most ${MAX_SENTENCES}`)
    for (const { n, text } of block.lines) {
      const prose = text.replace(/`[^`]*`/g, '')
      for (const [pattern, plain] of WORDY) {
        const m = prose.match(pattern)
        if (m) findings.push(`${where(n)}: "${m[0]}": write ${plain}`)
      }
    }
  }
}

if (!checked) {
  console.log(`prose: no note, card, spec, milestone or ticket in ${args.join(', ')}`)
  process.exit(1)
}
if (findings.length) {
  for (const f of findings) console.log(f)
  console.log(`prose: ${findings.length} finding${findings.length === 1 ? '' : 's'} in ${checked} file${checked === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log(`prose: ok, ${checked} file${checked === 1 ? '' : 's'} checked`)
