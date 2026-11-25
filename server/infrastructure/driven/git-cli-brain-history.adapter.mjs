import { execFile, spawn } from 'node:child_process'

// What git sees of the environment: none of the variables that would point it at another repository.
const gitEnv = () => {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...env } = process.env
  return env
}

// Runs `git -C <root> <args>`; resolves with its output, or null when it exits non-zero.
const git = (root, args) => new Promise((resolve) => {
  execFile('git', ['-C', root, '-c', 'core.quotepath=off', ...args], { encoding: 'utf8', windowsHide: true, env: gitEnv(), maxBuffer: 1 << 30 }, (error, stdout) => resolve(error ? null : stdout))
})

const RS = '\x1e'
const US = '\x1f'
const STATUS = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', T: 'modified' }

// The brain history port by the `git` command. `--relative` and the `./` before each path read paths from the brain's folder, so a
// brain inside a host repository gives the same paths as a brain of its own.
export const gitCliBrainHistory = () => ({
  async log(root) {
    const out = await git(root, ['log', '--relative', '--reverse', '--no-merges', '-M', '--name-status', `--format=${RS}%H${US}%aI${US}%an${US}%s`, '--', 'notes'])
    if (out === null) return []
    return out.split(RS).slice(1).map((block) => {
      const [head, ...lines] = block.split('\n')
      const [sha, date, author, title] = head.split(US)
      const changes = lines.filter((line) => line.trim()).map((line) => {
        const [letter, a, b] = line.split('\t')
        const renamed = letter[0] === 'R'
        return { status: STATUS[letter[0]] ?? 'added', path: renamed ? b : a, ...(renamed ? { from: a } : {}) }
      })
      return { sha, date, author, title, changes }
    })
  },
  textsAt(root, wanted) {
    return new Promise((resolve) => {
      const texts = new Map()
      if (wanted.length === 0) return resolve(texts)
      const child = spawn('git', ['-C', root, 'cat-file', '--batch'], { windowsHide: true, env: gitEnv(), stdio: ['pipe', 'pipe', 'ignore'] })
      const chunks = []
      child.stdout.on('data', (d) => chunks.push(d))
      child.on('error', () => resolve(texts))
      child.on('close', () => {
        const out = Buffer.concat(chunks)
        let at = 0
        for (const { sha, path } of wanted) {
          const end = out.indexOf(0x0a, at)
          if (end < 0) break
          const header = out.toString('utf8', at, end)
          at = end + 1
          const size = Number(header.split(' ')[2])
          if (header.endsWith(' missing') || Number.isNaN(size)) continue
          texts.set(`${sha}:${path}`, out.toString('utf8', at, at + size))
          at += size + 1
        }
        resolve(texts)
      })
      child.stdin.on('error', () => {})
      child.stdin.end(wanted.map(({ sha, path }) => `${sha}:./${path}`).join('\n') + '\n')
    })
  },
})
