import { request } from 'node:http'
import { HOST } from '../../server-options.config.mjs'

// One request to the server on `port`, resolving with its status and text, or rejecting with the socket's error. `body` is sent
// as it is; a request that gets no answer within `timeout` ms is destroyed.
export const callServer = (port, { method = 'GET', path, headers = {}, body, timeout }) => new Promise((resolve, reject) => {
  const req = request({ host: HOST, port, method, path, headers, agent: false, timeout }, (res) => {
    let text = ''
    res.on('data', (d) => (text += d))
    res.on('end', () => resolve({ status: res.statusCode, body: text }))
  })
  req.on('timeout', () => req.destroy(new Error('no answer')))
  req.on('error', reject)
  req.end(body)
})
