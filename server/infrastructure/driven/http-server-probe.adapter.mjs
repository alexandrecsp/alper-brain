import { PortHeldError } from '../../domain/errors/port-held.error.mjs'
import { callServer } from './local-server-call.support.mjs'

const TIMEOUT_MS = 2000
const STOP_TIMEOUT_MS = 5000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const call = (port, options) => callServer(port, { ...options, timeout: TIMEOUT_MS })

// Asks what holds `port`: `free` when nothing listens, `alper-brain` with its version when a server of this plugin answers
// `/health`, and `other` for any other program.
const askHealth = async (port) => {
  try {
    const { status, body } = await call(port, { path: '/health' })
    const health = status === 200 ? JSON.parse(body) : null
    return health?.name === 'alper-brain' && typeof health.version === 'string' ? { state: 'alper-brain', version: health.version } : { state: 'other' }
  } catch (e) {
    return e.code === 'ECONNREFUSED' ? { state: 'free' } : { state: 'other' }
  }
}

// Stops the running server on `port` by its `POST /shutdown`, with the token `server.json` holds, and resolves once the port is free.
export const httpServerProbe = ({ record }) => ({
  askHealth,
  stopServer: async (port) => {
    const written = record.read()
    if (written?.port !== port) throw new PortHeldError(port, 'the older server left no token in server.json')
    const { status } = await call(port, { method: 'POST', path: '/shutdown', headers: { 'x-brain-token': written.token } }).catch(() => ({ status: 0 }))
    if (status !== 204) throw new PortHeldError(port, `the older server refused to stop (${status})`)
    const end = Date.now() + STOP_TIMEOUT_MS
    while (Date.now() < end) {
      if ((await askHealth(port)).state === 'free') return
      await sleep(50)
    }
    throw new PortHeldError(port, 'the older server did not stop in time')
  },
})
