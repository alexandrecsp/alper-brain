import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The running server's `{ pid, port, version, token }`, kept in `<home>/.alper-brain/server.json`. The token lets a newer entry
// stop this server, so only its owner may read the file.
export const fsServerRecord = ({ home }) => {
  const dir = join(home, '.alper-brain')
  const file = join(dir, 'server.json')
  return {
    read: () => {
      try {
        return JSON.parse(readFileSync(file, 'utf8'))
      } catch (e) {
        if (e.code === 'ENOENT' || e instanceof SyntaxError) return null
        throw e
      }
    },
    write: (record) => {
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 })
    },
  }
}
