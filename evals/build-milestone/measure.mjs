#!/usr/bin/env node
// Prints compare.sh's comparison: per run, then averaged per variant, its cost, time and tokens (the orchestrator's
// and its sub-agents'), how many builders it started and continued, and what it built: tickets done, the milestone
// squashed, the suite on the spec branch, test-plan rows per ticket, scripts holding the missing-file message, and
// the review's findings, those about duplication apart.
//   node measure.mjs <compare-output-folder>     its <variant>-<n>/ run folders, each with trace.jsonl and ws/
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) { console.error('usage: node measure.mjs <compare-output-folder>'); process.exit(1) }
const ms = 'ws/.brain/specs/001-greeting/milestones/demo/001-greeting'
const tickets = ['002-greet-by-name', '003-shout', '004-missing-greeting']
const sh = (cmd, cwd) => spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf8' })
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

const measure = (run) => {
  const r = { run }
  // The trace: stream-json, one message per line; a sub-agent's messages carry the id of the call that started it.
  const lines = read(join(dir, run, 'trace.jsonl')).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const types = new Map()
  let builders = 0, continued = 0
  for (const e of lines) for (const b of e.message?.content ?? []) if (b.type === 'tool_use') {
    if (b.name === 'Agent') { types.set(b.id, (b.input?.subagent_type ?? '?').replace(/^alper-brain:/, '')); if (/builder$/.test(b.input?.subagent_type ?? '')) builders++ }
    if (b.name === 'SendMessage') { types.set(b.id, 'continued'); continued++ }
  }
  // Input per agent from its messages (a message is logged once per block: count it once). Output is left to
  // modelUsage, since a streamed message's usage is taken before its output ends.
  const usage = new Map()
  for (const e of lines) if (e.type === 'assistant' && e.message?.usage) usage.set(e.message.id ?? e.uuid, { who: e.parent_tool_use_id ? types.get(e.parent_tool_use_id) ?? 'sub-agent' : 'orchestrator', u: e.message.usage })
  r.tok = {}
  for (const { who, u } of usage.values()) {
    const t = (r.tok[who] ??= { input: 0, seconds: 0, tools: 0, runs: 0 })
    t.input += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
  }
  // Each sub-agent's run (a continued builder's too) ends in a task_notification with its time and tool calls.
  for (const e of lines) if (e.type === 'system' && e.subtype === 'task_notification' && types.has(e.tool_use_id) && e.usage) {
    const t = (r.tok[types.get(e.tool_use_id)] ??= { input: 0, seconds: 0, tools: 0, runs: 0 })
    t.seconds += (e.usage.duration_ms ?? 0) / 1000; t.tools += e.usage.tool_uses ?? 0; t.runs++
  }
  // `claude -p` ends a result per turn, a background agent's report starting the next: cost and model usage are
  // cumulative, so the last result holds them; turns add up.
  const results = lines.filter((e) => e.type === 'result')
  const last = results.at(-1) ?? {}
  const wall = Number(read(join(dir, run, 'wall-seconds')).trim()) || results.reduce((n, e) => n + (e.duration_ms ?? 0), 0) / 1000
  r.models = Object.fromEntries(Object.entries(last.modelUsage ?? {}).map(([m, u]) => [m.replace(/^claude-/, ''), { cost: u.costUSD, output: u.outputTokens }]))
  Object.assign(r, { cost: last.total_cost_usd, minutes: wall / 60, turns: results.reduce((n, e) => n + (e.num_turns ?? 0), 0), error: !results.length || results.some((e) => e.is_error), builders, continued })

  // What it built.
  const files = tickets.map((t) => read(join(dir, run, ms, `${t}.md`)))
  r.done = files.filter((f) => /\*\*Status:\*\* done[\s\S]*\*\*Commit:\*\* `?[0-9a-f]{7,40}/.test(f)).length
  r.planRows = files.map((f) => (f.split(/\|---\|---\|---\|---\|\r?\n/)[1] ?? '').split('\n').filter((l) => /^\|.*[A-Za-z]/.test(l)).length)
  r.squashed = /\*\*Squash:\*\* `?[0-9a-f]{7,40}/.test(read(join(dir, run, ms, 'milestone.md')))
  const repo = join(dir, run, 'ws/clones/demo')
  const branch = 'sdd/001-greeting/spec'
  const tree = mkdtempSync(join(tmpdir(), 'bm-'))
  if (sh(`git -C "${repo}" archive ${r.squashed ? branch : 'HEAD'} | tar -x -C "${tree}"`).status === 0) {
    const suite = sh('sh test.sh 2>&1', tree)
    r.suite = suite.status === 0 && !suite.stdout.split('\n').some((l) => l.trim() && l.trim() !== 'ok') ? 'pass' : 'fail'
    r.msgCopies = sh(`grep -l "greeting.txt missing" *.sh | grep -v '^test.sh$' | wc -l`, tree).stdout.trim()
    r.shoutReads = /greeting\.txt/.test(read(join(tree, 'shout.sh')))
  }
  const review = read(join(dir, run, ms, 'review.md'))
  r.findings = review.split('\n').filter((l) => /^- \*\*(ST|SP|CO)\d+\*\*/.test(l))
  return r
}

const runs = readdirSync(dir).filter((d) => /^[a-z0-9_]+-\d+$/.test(d) && existsSync(join(dir, d, 'trace.jsonl'))).sort()
if (!runs.length) { console.error(`No <variant>-<n> run folders with a trace.jsonl in ${dir}`); process.exit(1) }
const all = runs.map(measure)
const k = (n) => (n == null || Number.isNaN(n) ? '-' : `${(n / 1000).toFixed(0)}k`)
const sum = (t, f) => Object.values(t).reduce((n, v) => n + v[f], 0)

console.log('Per run')
for (const r of all) {
  console.log(`\n${r.run}: $${r.cost?.toFixed(2) ?? '-'}, ${r.minutes?.toFixed(0) ?? '-'} min, ${r.turns ?? '-'} turns${r.error ? ', ENDED IN ERROR' : ''}; ` +
    `builders ${r.builders}, continued ${r.continued}`)
  console.log(`  by model: ${Object.entries(r.models).map(([m, u]) => `${m} $${u.cost?.toFixed(2)}, output ${k(u.output)}`).join('; ')}`)
  for (const [who, t] of Object.entries(r.tok).sort((a, b) => b[1].input - a[1].input))
    console.log(`  ${who.padEnd(14)} input ${k(t.input).padStart(6)}` + (t.runs ? `  ${t.runs} run(s), ${(t.seconds / 60).toFixed(1)} min, ${t.tools} tool calls` : ''))
  console.log(`  tickets done ${r.done}/3, squashed ${r.squashed}, suite ${r.suite ?? '-'}, test-plan rows ${r.planRows.join('/')}, ` +
    `scripts with the missing-file message ${r.msgCopies ?? '-'}, shout.sh reads greeting.txt ${r.shoutReads ?? '-'}`)
  console.log(`  review: ${r.findings.length} findings, ${r.findings.filter((f) => /duplicat|second copy|copy of|repeat/i.test(f)).length} about duplication`)
  for (const f of r.findings) console.log(`    ${f.slice(0, 150)}`)
}

console.log('\nPer variant (mean)')
const by = Object.groupBy(all, (r) => r.run.replace(/-\d+$/, ''))
const mean = (rs, f) => rs.reduce((n, r) => n + (f(r) ?? 0), 0) / rs.length
console.log(`${'variant'.padEnd(10)} ${'runs'.padStart(4)} ${'cost'.padStart(7)} ${'min'.padStart(5)} ${'input'.padStart(7)} ${'builder in'.padStart(10)} ${'bld min'.padStart(7)} ${'done'.padStart(5)} ${'pass'.padStart(5)} ${'findings'.padStart(8)}`)
for (const [v, rs] of Object.entries(by)) {
  const builder = (r, f) => (r.tok.builder?.[f] ?? 0) + (r.tok.continued?.[f] ?? 0)
  console.log(`${v.padEnd(10)} ${String(rs.length).padStart(4)} ${('$' + mean(rs, (r) => r.cost).toFixed(2)).padStart(7)} ${mean(rs, (r) => r.minutes).toFixed(0).padStart(5)} ` +
    `${k(mean(rs, (r) => sum(r.tok, 'input'))).padStart(7)} ${k(mean(rs, (r) => builder(r, 'input'))).padStart(10)} ${(mean(rs, (r) => builder(r, 'seconds')) / 60).toFixed(1).padStart(7)} ${mean(rs, (r) => r.done).toFixed(1).padStart(5)} ` +
    `${rs.filter((r) => r.suite === 'pass').length}/${rs.length}`.padStart(5) + ` ${mean(rs, (r) => r.findings.length).toFixed(1).padStart(8)}`)
}
console.log('\nOne run\'s cost moves by up to ~40% on an unchanged case: compare means over several runs, never one run.')
