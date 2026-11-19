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

// The one argument that says what a tool call is about, for the activity line.
const ARG_KEYS = ['description', 'file_path', 'pattern', 'command', 'url', 'query', 'path', 'skill']

export const describe = (tool: string, args: Record<string, unknown>) => {
  const key = ARG_KEYS.find(k => typeof args[k] === 'string' && args[k] !== '')

  return key === undefined ? tool : `${tool} ${String(args[key])}`
}

/** The arguments of a tool call that name files, joined, for finding .brain paths. */
export const pathArgs = (args: Record<string, unknown>) =>
  ['file_path', 'path', 'command', 'pattern', 'notebook_path']
    .map(k => args[k])
    .filter((v): v is string => typeof v === 'string')
    .join('\n')
