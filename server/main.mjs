// The entry, run as `node main.mjs [--port <n>] [--home <dir>] [--idle <ms>] [--plugin-version <v>] [--watch poll] [--brain <path>]`. The port
// is `--port`, else the `port` of the user's `~/.alper-brain/config.json`, else 9999. It leaves one
// current server running, detached from this process, adds the brain at `--brain` to its list, and prints the URL that opens the
// page, at that brain when given. It exits with code 0 once a server answers, and with code 1,
// saying why, when none can.
import { homedir } from 'node:os'
import { launchServer } from './application/use-cases/launch-server.use-case.mjs'
import { viewBrain } from './application/use-cases/view-brain.use-case.mjs'
import { detachedServerStarter } from './infrastructure/driven/detached-server-starter.adapter.mjs'
import { pluginVersion } from './infrastructure/driven/fs-plugin-manifest.adapter.mjs'
import { httpServerBrains } from './infrastructure/driven/http-server-brains.adapter.mjs'
import { fsServerRecord } from './infrastructure/driven/fs-server-record.adapter.mjs'
import { fsUserConfig } from './infrastructure/driven/fs-user-config.adapter.mjs'
import { httpServerProbe } from './infrastructure/driven/http-server-probe.adapter.mjs'
import { DEFAULT_PORT, HOST, argOf } from './server-options.config.mjs'

const option = (name) => argOf(process.argv.slice(2), name)

// The options the server takes as they are. The port is the entry's own: the starter gives it to the server it starts.
const serverArgs = ['home', 'idle', 'plugin-version', 'watch'].flatMap((name) => (option(name) === undefined ? [] : [`--${name}`, option(name)]))

const home = option('home') ?? homedir()
const record = fsServerRecord({ home })
const probe = httpServerProbe({ record })
const launch = launchServer({
  version: option('plugin-version') ?? pluginVersion(),
  askHealth: probe.askHealth,
  stopServer: probe.stopServer,
  startServer: detachedServerStarter({ record, args: serverArgs }),
  recordedPort: () => record.read()?.port,
})
const view = viewBrain({ launch, serverBrains: httpServerBrains({ record }), host: HOST })
try {
  const port = option('port') === undefined ? (fsUserConfig({ home }).port() ?? DEFAULT_PORT) : Number(option('port'))
  console.log(await view({ port, brain: option('brain') }))
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
}
