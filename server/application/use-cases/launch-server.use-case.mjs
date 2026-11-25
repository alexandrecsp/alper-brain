import { PortHeldError } from '../../domain/errors/port-held.error.mjs'
import { compareVersions } from '../services/compare-versions.service.mjs'

// Leaves one current server running and gives its port. A server of this version or a newer one is reused, an older one is
// stopped first, and another program on the port is refused with `PortHeldError`. Port 0 asks for a free port, which none holds.
// The server `recordedPort` names, on another port, is stopped first, so a changed port leaves no server behind on the old one.
export const launchServer = ({ version, askHealth, stopServer, startServer, recordedPort = () => undefined }) => async ({ port }) => {
  if (port !== 0) {
    const old = recordedPort()
    if (old !== undefined && old !== port && (await askHealth(old)).state === 'alper-brain') await stopServer(old)
    const answer = await askHealth(port)
    if (answer.state === 'other') throw new PortHeldError(port)
    if (answer.state === 'alper-brain') {
      if (compareVersions(answer.version, version) >= 0) return { port }
      await stopServer(port)
    }
  }
  return { port: await startServer({ port }) }
}
