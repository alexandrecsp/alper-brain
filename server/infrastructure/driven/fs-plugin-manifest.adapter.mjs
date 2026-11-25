import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The plugin's version, read from `.claude-plugin/plugin.json` at the plugin's root, three folders above this adapter.
const manifest = join(dirname(fileURLToPath(import.meta.url)), '../../../.claude-plugin/plugin.json')
export const pluginVersion = () => JSON.parse(readFileSync(manifest, 'utf8')).version
