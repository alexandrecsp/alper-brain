import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// `brain.html`, read on each call so an updated page shows with no restart.
const page = join(dirname(fileURLToPath(import.meta.url)), '../../../skills/brain/brain.html')
export const readPage = () => readFileSync(page, 'utf8')
