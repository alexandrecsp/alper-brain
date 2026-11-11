#!/usr/bin/env node
// Measures where sub-agents spend their context, from Claude Code's transcripts (every `subagents/*.jsonl` with its
// `.meta.json` under the folders given): per agent type, the first turn's context (system prompt, agent definition,
// preloaded skills, brief), the turns, the input re-read across them, and per kind of tool result its size, how much
// of it came before the agent's first edit, and its share of the re-reads (size × the turns it stays in context).
// Run: node scripts/agent-tokens.mjs [folder|trace.jsonl...] [--type <regex>]
//   folder defaults to ~/.claude/projects. For an eval, pass its run's trace.jsonl (the tracePath in --json's
//   output; kept with --keep-temp), whose sub-agent messages carry the id of the Agent call that started them.
//   --type defaults to ^alper-brain:
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const ti = args.indexOf('--type')
const type = new RegExp(ti >= 0 ? args.splice(ti, 2)[1] : '^alper-brain:')
const roots = args.length ? args : [join(homedir(), '.claude', 'projects')]

const parse = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)

// An eval's trace.jsonl streams every agent's messages; a sub-agent's carry the id of the Agent call that started it.
const fromTrace = (path) => {
  const lines = parse(path)
  const types = new Map()
  for (const e of lines) for (const b of e.message?.content ?? []) if (b.type === 'tool_use' && b.name === 'Agent') types.set(b.id, b.input?.subagent_type ?? '?')
  const runs = new Map()
  for (const e of lines) {
    const id = e.parent_tool_use_id
    if (!id || !types.has(id)) continue
    if (!runs.has(id)) runs.set(id, { meta: { agentType: types.get(id) }, lines: [] })
    runs.get(id).lines.push(e)
  }
  return [...runs.values()].filter((r) => type.test(r.meta.agentType))
}

const transcripts = []
const walk = (dir, depth = 0) => {
  if (depth > 8) return
  let names
  try { names = readdirSync(dir) } catch { return }
  for (const n of names) {
    const p = join(dir, n)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walk(p, depth + 1)
    else if (n.endsWith('.meta.json') && dir.endsWith('subagents')) {
      const meta = JSON.parse(readFileSync(p, 'utf8'))
      const jl = p.replace(/\.meta\.json$/, '.jsonl')
      if (type.test(meta.agentType ?? '') && existsSync(jl)) transcripts.push({ meta, lines: parse(jl) })
    } else if (n === 'trace.jsonl') transcripts.push(...fromTrace(p))
  }
}
for (const r of roots) r.endsWith('.jsonl') ? transcripts.push(...fromTrace(r)) : walk(r)
if (!transcripts.length) {
  console.log(`No sub-agent transcripts matching ${type} under ${roots.join(', ')}`)
  process.exit(1)
}

const kind = (name, input) => {
  if (name === 'Read') {
    const p = (input.file_path ?? '').replace(/\\/g, '/')
    if (/\/\.sdd\/specs\/.*\/\d{3}-[^/]+\.md$/.test(p) && !/milestone\.md|review\.md/.test(p)) return 'read:ticket'
    if (/\/\.sdd\//.test(p)) return 'read:spec/milestone/review'
    if (/\/skills\/|\/plugins\//.test(p)) return 'read:skills'
    if (/\/(repos|shared)\/[^/]+/.test(p) && /brain/i.test(p)) return 'read:brain-notes'
    if (/STRUCTURE\.md|GLOSSARY|\/adr\/|CLAUDE\.md|AGENTS\.md|README/i.test(p)) return 'read:repo-docs'
    return 'read:repo-code'
  }
  if (name === 'Bash') {
    const c = input.command ?? ''
    if (/sdd\.mjs/.test(c)) return 'bash:sdd.mjs'
    if (/git\b.*\b(show|diff)\b/.test(c)) return 'bash:git-show/diff'
    if (/git\b.*\blog\b/.test(c)) return 'bash:git-log'
    if (/\b(cat|head|tail|sed -n)\b/.test(c)) return 'bash:cat'
    if (/\b(npm|pnpm|yarn|npx|dotnet|pytest|jest|vitest|go test|mvn|gradle|cargo|tsc|sh [\w./-]*test)/.test(c)) return 'bash:test/build'
    if (/\b(ls|find|tree)\b/.test(c)) return 'bash:ls/find'
    if (/\b(grep|rg)\b/.test(c)) return 'bash:grep'
    return 'bash:other'
  }
  return name === 'Skill' ? `skill:${input.skill ?? '?'}` : name.toLowerCase()
}
const size = (c) => (typeof c === 'string' ? c.length : Array.isArray(c) ? c.reduce((n, b) => n + (b.text?.length ?? (b.content ? size(b.content) : 0)), 0) : 0)
const tok = (chars) => chars / 4

const byType = {}
for (const { meta, lines } of transcripts) {
  const uses = new Map()
  const results = []
  // A message is logged once per content block; its last usage is the whole message's.
  const usage = new Map()
  let turn = 0, firstEdit = null
  for (const e of lines) {
    const m = e.message
    if (!m) continue
    if (e.type === 'assistant') {
      const id = m.id ?? e.uuid
      if (m.usage) {
        if (!usage.has(id)) turn++
        usage.set(id, m.usage)
      }
      for (const b of m.content ?? []) if (b.type === 'tool_use') {
        uses.set(b.id, b)
        if (firstEdit === null && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(b.name)) firstEdit = turn
      }
    }
    if (e.type === 'user' && Array.isArray(m.content)) for (const b of m.content) if (b.type === 'tool_result') {
      const u = uses.get(b.tool_use_id)
      if (u) results.push({ kind: kind(u.name, u.input ?? {}), chars: size(b.content), at: turn })
    }
  }
  const ctxOf = (u) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
  const us = [...usage.values()]
  const firstCtx = us.length ? ctxOf(us[0]) : 0
  const ctxSum = us.reduce((n, u) => n + ctxOf(u), 0)
  const out = us.reduce((n, u) => n + (u.output_tokens ?? 0), 0)
  const t = (byType[meta.agentType] ??= { runs: 0, turns: 0, ctxSum: 0, out: 0, firstCtx: 0, edits: 0, editRuns: 0, kinds: {} })
  t.runs++; t.turns += turn; t.ctxSum += ctxSum; t.out += out; t.firstCtx += firstCtx
  if (firstEdit !== null) { t.edits += firstEdit; t.editRuns++ }
  for (const r of results) {
    const k = (t.kinds[r.kind] ??= { calls: 0, chars: 0, pre: 0, resid: 0 })
    k.calls++; k.chars += r.chars
    k.resid += tok(r.chars) * Math.max(0, turn - r.at)
    if (firstEdit === null || r.at < firstEdit) k.pre += r.chars
  }
}

const k = (n) => `${(n / 1000).toFixed(1)}k`
for (const [name, t] of Object.entries(byType).sort((a, b) => b[1].ctxSum / b[1].runs - a[1].ctxSum / a[1].runs)) {
  const per = (n) => n / t.runs
  console.log(`\n${name}: ${t.runs} runs, ${per(t.turns).toFixed(0)} turns, first turn ${k(per(t.firstCtx))} tok, input ${k(per(t.ctxSum))} tok, output ${k(per(t.out))} tok` +
    (t.editRuns ? `, first edit at turn ${(t.edits / t.editRuns).toFixed(0)}` : ''))
  const resid = Object.values(t.kinds).reduce((n, v) => n + v.resid, 0) || 1
  console.log(`  ${'result kind'.padEnd(26)} ${'calls'.padStart(6)} ${'tok'.padStart(7)} ${'pre-edit'.padStart(9)} ${'re-read'.padStart(8)}   (per run)`)
  for (const [kn, v] of Object.entries(t.kinds).sort((a, b) => b[1].resid - a[1].resid).slice(0, 10))
    console.log(`  ${kn.padEnd(26)} ${per(v.calls).toFixed(1).padStart(6)} ${k(tok(per(v.chars))).padStart(7)} ${k(tok(per(v.pre))).padStart(9)} ${`${((v.resid / resid) * 100).toFixed(0)}%`.padStart(8)}`)
}
