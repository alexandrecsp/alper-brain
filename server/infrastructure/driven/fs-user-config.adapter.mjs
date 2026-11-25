import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The user's own settings for the server, kept in `<home>/.alper-brain/config.json`, beside the brain list and `server.json`
// and outside every repository, so each user sets their own. `port` is the one setting: the port the server listens on.
export const fsUserConfig = ({ home }) => {
  const file = join(home, '.alper-brain', 'config.json')
  return {
    // The port the file names, or undefined when there is no file or it names none. Throws, naming the file, when the file is
    // not JSON or its port is not a whole number from 1 to 65535.
    port: () => {
      let config
      try {
        config = JSON.parse(readFileSync(file, 'utf8'))
      } catch (e) {
        if (e.code === 'ENOENT') return undefined
        throw new Error(`${file} is not valid JSON: ${e.message}`)
      }
      const port = config?.port
      if (port === undefined) return undefined
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${file}: "port" must be a whole number from 1 to 65535, not ${JSON.stringify(port)}`)
      }
      return port
    },
  }
}
