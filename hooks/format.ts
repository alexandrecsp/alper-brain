import type { TurnUsage } from 'claude-code'

import type { Tokens } from '../types'

export const NO_TOKENS: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export const total = (t: Tokens) => t.input + t.output + t.cacheRead + t.cacheWrite

export const usageTotal = (u: TurnUsage) =>
  u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

export const addUsage = (t: Tokens, u: TurnUsage): Tokens => ({
  input: t.input + u.input_tokens,
  output: t.output + u.output_tokens,
  cacheRead: t.cacheRead + u.cache_read_input_tokens,
  cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
})

export const tokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`

export const elapsed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))

  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

// The text on one line, for a Text that cuts it at the edge of its box.
/** A moment in ms as the local time of day, `17:08:42`. */
export const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8)

export const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

export const bar = (share: number, width: number) => {
  const full = Math.round(Math.max(0, Math.min(1, share)) * width)

  return '█'.repeat(full) + '░'.repeat(width - full)
}

// The one argument that says what a tool call is about, for the activity line.
const ARG_KEYS = ['description', 'file_path', 'pattern', 'command', 'url', 'query', 'path', 'skill']

export const describe = (tool: string, args: Record<string, unknown>) => {
  const key = ARG_KEYS.find(k => typeof args[k] === 'string' && args[k] !== '')

  return key === undefined ? tool : `${tool} ${String(args[key])}`
}

/** The arguments of a tool call that name files, joined, for finding .sdd paths. */
export const pathArgs = (args: Record<string, unknown>) =>
  ['file_path', 'path', 'command', 'pattern', 'notebook_path']
    .map(k => args[k])
    .filter((v): v is string => typeof v === 'string')
    .join('\n')
