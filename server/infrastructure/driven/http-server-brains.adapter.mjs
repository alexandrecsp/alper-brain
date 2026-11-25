import { BrainNotAddedError } from '../../domain/errors/brain-not-added.error.mjs'
import { callServer } from './local-server-call.support.mjs'

const TIMEOUT_MS = 5000

// `POST /api/brains` on the server `record` names, with the token `server.json` holds, which only the user who started it can read.
export const httpServerBrains = ({ record }) => ({
  add: async ({ port, path }) => {
    const written = record.read()
    if (written?.port !== port) throw new BrainNotAddedError(path, 'server.json does not name the server answering')
    const headers = { 'content-type': 'application/json', 'x-brain-token': written.token }
    const { status, body } = await callServer(port, { method: 'POST', path: '/api/brains', headers, body: JSON.stringify({ path }), timeout: TIMEOUT_MS })
      .catch((e) => { throw new BrainNotAddedError(path, e.message) })
    if (status !== 200) throw new BrainNotAddedError(path, `it answered ${status}`)
    return JSON.parse(body)
  },
})
