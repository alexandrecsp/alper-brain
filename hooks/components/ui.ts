import type { EngineInterface } from 'claude-code'

// What the surface draws with, resolved once per render and handed down.
export type Elements = ReturnType<EngineInterface['ui']['resolve']>

export type Draw = {
  ui: Elements
  // Where a surface has Svg: not the terminal, which keeps the text bars.
  Svg: Elements['Svg'] | undefined
  // The pane's clock, in ms.
  at: number
}
