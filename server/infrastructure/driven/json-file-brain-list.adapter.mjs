import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The brain list kept in `<home>/.alper-brain/brains.json`, read on each call so no copy goes stale.
export const jsonFileBrainList = ({ home }) => {
  const file = join(home, '.alper-brain', 'brains.json')
  const all = () => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      if (e.code === 'ENOENT') return []
      throw e
    }
  }
  const save = (brains) => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(brains, null, 2) + '\n')
  }
  return {
    all,
    add: (brain) => save([...all(), brain]),
    remove: (id) => save(all().filter((b) => b.id !== id)),
  }
}
