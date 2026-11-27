// The server process's composition root, started by the entry (`main.mjs`) as
// `node server.mjs [--port <n>] [--home <dir>] [--idle <ms>] [--plugin-version <v>] [--watch poll]`. It wires the adapters into the
// use cases, listens on 127.0.0.1 and writes `server.json` once it is ready. `--idle <ms>` makes it exit when idle; without it, it stays up. `--home <dir>` stands for the user's home folder, where
// the brain list and `server.json` live in `.alper-brain/`. `--watch poll` turns recursive watching off, so each brain is reread
// on a timer.
import { randomBytes, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { nameOf } from '../skills/brain/scripts/layout.mjs'
import { brainCopies as heldBrainCopies } from './application/services/brain-copies.service.mjs'
import { addBrain } from './application/use-cases/add-brain.use-case.mjs'
import { findMergeBase } from './application/use-cases/find-merge-base.use-case.mjs'
import { listBrains } from './application/use-cases/list-brains.use-case.mjs'
import { pickBrain } from './application/use-cases/pick-brain.use-case.mjs'
import { readBrainFile } from './application/use-cases/read-brain-file.use-case.mjs'
import { readBrainFiles } from './application/use-cases/read-brain-files.use-case.mjs'
import { readBrainHistory } from './application/use-cases/read-brain-history.use-case.mjs'
import { readCommit } from './application/use-cases/read-commit.use-case.mjs'
import { readRefs } from './application/use-cases/read-refs.use-case.mjs'
import { readRemoteUrl } from './application/use-cases/read-remote-url.use-case.mjs'
import { removeBrain } from './application/use-cases/remove-brain.use-case.mjs'
import { reportHealth } from './application/use-cases/report-health.use-case.mjs'
import { servePage } from './application/use-cases/serve-page.use-case.mjs'
import { subscribeToChanges } from './application/use-cases/subscribe-to-changes.use-case.mjs'
import { walkHistory } from './application/use-cases/walk-history.use-case.mjs'
import { writeBrainFile } from './application/use-cases/write-brain-file.use-case.mjs'
import { brainFolderOf } from './infrastructure/driven/fs-brain-file.adapter.mjs'
import { fsBrainFiles } from './infrastructure/driven/fs-brain-files.adapter.mjs'
import { readPage } from './infrastructure/driven/fs-page.adapter.mjs'
import { pluginVersion } from './infrastructure/driven/fs-plugin-manifest.adapter.mjs'
import { fsServerRecord } from './infrastructure/driven/fs-server-record.adapter.mjs'
import { gitCliBrainHistory } from './infrastructure/driven/git-cli-brain-history.adapter.mjs'
import { gitCliClone } from './infrastructure/driven/git-cli-clone.adapter.mjs'
import { nativeFolderPicker } from './infrastructure/driven/native-folder-picker.adapter.mjs'
import { jsonFileBrainList } from './infrastructure/driven/json-file-brain-list.adapter.mjs'
import { resolvingBrainList } from './infrastructure/driven/resolving-brain-list.adapter.mjs'
import { httpController } from './infrastructure/driving/http.controller.mjs'
import { DEFAULT_PORT, HOST, argOf } from './server-options.config.mjs'

const option = (name) => argOf(process.argv, name)

const home = option('home') ?? homedir()
const version = option('plugin-version') ?? pluginVersion()
const brainList = resolvingBrainList({ brainList: jsonFileBrainList({ home }), brainFolderOf })
const brainFiles = fsBrainFiles({ recursiveWatch: option('watch') !== 'poll' })
const brainCopies = heldBrainCopies({ brainList, brainFiles })
const serverRecord = fsServerRecord({ home })
const token = randomBytes(24).toString('hex')

// Stays up until it is stopped. With `--idle <ms>`, it exits once that long passes with no request and no open SSE connection,
// each request starting the time over.
const idleMs = option('idle') === undefined ? undefined : Number(option('idle'))
let idle
let openStreams = 0
const stayAlive = () => {
  clearTimeout(idle)
  if (openStreams === 0 && idleMs !== undefined) idle = setTimeout(() => process.exit(0), idleMs)
}

// A change to the brain list changes which brains are watched.
const watching = (change) => (...args) => {
  const result = change(...args)
  brainCopies.sync()
  return result
}

const add = addBrain({ brainList, brainFolderOf, nameOf, newId: randomUUID })
const pick = pickBrain({ folderPicker: nativeFolderPicker(), brainFolderOf, add })
const gitPorts = { brainList, brainFiles, gitClone: gitCliClone() }
const subscribe = subscribeToChanges({ brainCopies })
const server = httpController({
  health: reportHealth({ version, pid: process.pid }),
  page: servePage({ readPage, token }),
  brains: {
    list: listBrains({ brainList, brainFolderOf }),
    add: watching(add),
    pick: async () => {
      const entry = await pick()
      brainCopies.sync()
      return entry
    },
    remove: watching(removeBrain({ brainList })),
  },
  files: { all: readBrainFiles({ brainCopies }), read: readBrainFile({ brainList, brainFiles }), write: writeBrainFile({ brainList, brainFiles }) },
  history: readBrainHistory({ brainList, brainHistory: gitCliBrainHistory() }),
  repos: { refs: readRefs(gitPorts), commit: readCommit(gitPorts), remoteUrl: readRemoteUrl(gitPorts), walk: walkHistory(gitPorts), mergeBase: findMergeBase(gitPorts) },
  changes: (tell) => {
    openStreams++
    clearTimeout(idle)
    const unsubscribe = subscribe(tell)
    return () => {
      unsubscribe()
      openStreams--
      stayAlive()
    }
  },
  shutdown: () => process.exit(0),
  token,
})
server.on('request', stayAlive)
stayAlive()
server.listen(Number(option('port') ?? DEFAULT_PORT), HOST, () => {
  brainCopies.sync()
  serverRecord.write({ pid: process.pid, port: server.address().port, version, token })
})
