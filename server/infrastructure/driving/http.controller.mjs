import { timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { InvalidBrainPathError } from '../../domain/errors/invalid-brain-path.error.mjs'
import { NoFolderPickerError } from '../../domain/errors/no-folder-picker.error.mjs'
import { NotABrainError } from '../../domain/errors/not-a-brain.error.mjs'
import { NotACloneError } from '../../domain/errors/not-a-clone.error.mjs'
import { PathOutsideBrainError } from '../../domain/errors/path-outside-brain.error.mjs'
import { UnknownBrainError } from '../../domain/errors/unknown-brain.error.mjs'
import { UnlinkedRepoError } from '../../domain/errors/unlinked-repo.error.mjs'
import { HOST } from '../../server-options.config.mjs'

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

// Reads a request's body as text.
const readText = (req) => new Promise((resolve) => {
  let text = ''
  req.setEncoding('utf8')
  req.on('data', (d) => (text += d))
  req.on('end', () => resolve(text))
})

// Reads a request's body as JSON; an unparsable body is read as `{}`, which the use case refuses.
const readJson = async (req) => {
  try {
    return JSON.parse(await readText(req)) ?? {}
  } catch {
    return {}
  }
}

// `GET /api/events`: an SSE stream of the brains' `change` events, until the page closes it.
const events = (req, res, changes) => {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
  res.write(': connected\n\n')
  const unsubscribe = changes((change) => res.write(`event: change\ndata: ${JSON.stringify(change)}\n\n`))
  res.on('close', unsubscribe)
}

// Answers an unknown brain with `404` and a path outside its folder with `400`.
const brainFileErrors = async (res, answer) => {
  try {
    await answer()
  } catch (e) {
    if (e instanceof UnknownBrainError) return json(res, 404, { error: e.message })
    if (e instanceof PathOutsideBrainError) return json(res, 400, { error: e.message })
    throw e
  }
}

// Answers a repository whose brain is unknown or whose slug is unlinked with `404`, and a linked folder that is no clone with `422`.
const repoErrors = async (res, answer) => {
  try {
    await answer()
  } catch (e) {
    if (e instanceof UnknownBrainError || e instanceof UnlinkedRepoError) return json(res, 404, { error: e.message })
    if (e instanceof NotACloneError) return json(res, 422, { error: e.message })
    throw e
  }
}

// `GET /api/brains/:id/repos/:slug/<read>`: one git read of the linked clone.
const repoRead = (res, repos, id, slug, read, search) =>
  repoErrors(res, async () => {
    if (read === 'refs') return json(res, 200, await repos.refs(id, slug))
    if (read === 'remote-url') return json(res, 200, { url: await repos.remoteUrl(id, slug) })
    // `merge-base?a=&b=` answers `{ sha }` of the commits' best common ancestor, `{ sha: null }` when they share none.
    if (read === 'merge-base') return json(res, 200, { sha: await repos.mergeBase(id, slug, search.get('a'), search.get('b')) })
    const commit = await repos.commit(id, slug, search.get('sha'))
    if (commit === null) return json(res, 404, { error: 'not found' })
    json(res, 200, commit)
  })

// `POST /api/brains/:id/repos/:slug/walk`: `{ tips, max?, since?, keep? }` answers `{ commits, more }`. A body of another shape is a bad request.
const repoWalk = async (req, res, repos, id, slug) => {
  const { tips, max, since, keep } = await readJson(req)
  const shas = (list) => Array.isArray(list) && list.every((sha) => typeof sha === 'string')
  const number = (n) => n === undefined || (typeof n === 'number' && Number.isFinite(n))
  if (!shas(tips) || !number(max) || !number(since) || !(keep === undefined || keep === null || shas(keep))) return json(res, 400, { error: 'bad walk request' })
  return repoErrors(res, async () => json(res, 200, await repos.walk(id, slug, tips, { max, since, keep })))
}

// `GET /api/brains/:id/files`: every file of the brain with the specs' times.
const brainFiles = (res, files, id) => brainFileErrors(res, () => json(res, 200, files.all(id)))

// `GET /api/brains/:id/history`: every committed change to the brain's notes, in the timeline's JSON shape.
const brainHistory = (res, history, id) => brainFileErrors(res, async () => json(res, 200, await history(id)))

// `GET` or `PUT /api/brains/:id/file?path=`: one file's text, or writes it. A missing path is outside the brain.
const brainFile = (req, res, files, id, path) =>
  brainFileErrors(res, async () => {
    if (path === undefined) throw new PathOutsideBrainError(path)
    if (req.method === 'PUT') {
      files.write(id, path, await readText(req))
      res.writeHead(204)
      return res.end()
    }
    const text = files.read(id, path)
    if (text === null) return json(res, 404, { error: 'not found' })
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(text)
  })

// Only the loopback names of this very port may reach the server, against DNS rebinding.
const hostAllowed = (req) =>
  [`${HOST}:${req.socket.localPort}`, `localhost:${req.socket.localPort}`].includes(req.headers.host)

// A write (POST, PUT or DELETE) must carry this start's token, which only a page read from `/` holds.
const writeAllowed = (req, token) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return true
  const sent = Buffer.from(String(req.headers['x-brain-token'] ?? ''))
  const own = Buffer.from(token)
  return sent.length === own.length && timingSafeEqual(sent, own)
}

// `POST /api/brains`: a path that is not absolute is a bad request.
const addBrain = async (req, res, brains) => {
  const { path } = await readJson(req)
  try {
    json(res, 200, brains.add(path))
  } catch (e) {
    if (!(e instanceof InvalidBrainPathError)) throw e
    json(res, 400, { error: e.message })
  }
}

// `POST /api/brains/pick`: opens the machine's folder dialog and adds the brain picked, answering its entry, or null on a cancel.
// A folder holding no brain is `422`; a machine with no dialog is `501`, which sends the page back to a typed path.
const pickBrain = async (res, brains) => {
  try {
    json(res, 200, await brains.pick())
  } catch (e) {
    if (e instanceof NotABrainError) return json(res, 422, { error: e.message, path: e.path })
    if (e instanceof NoFolderPickerError) return json(res, 501, { error: e.message })
    throw e
  }
}

// The HTTP adapter: turns a request into a use-case call. It sends no CORS header, so no other origin can read `/`.
export const httpController = ({ health, page, brains, files, history, repos, changes, shutdown, token }) =>
  createServer((req, res) => {
    if (!hostAllowed(req)) return json(res, 403, { error: 'forbidden host' })
    if (!writeAllowed(req, token)) return json(res, 403, { error: 'forbidden write' })
    const { pathname } = new URL(req.url, 'http://localhost')
    if (req.method === 'GET' && pathname === '/health') return json(res, 200, health())
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(page())
    }
    if (req.method === 'GET' && pathname === '/api/events') return events(req, res, changes)
    if (req.method === 'POST' && pathname === '/shutdown') {
      res.writeHead(204)
      return res.end(shutdown)
    }
    if (req.method === 'GET' && pathname === '/api/brains') return json(res, 200, brains.list())
    if (req.method === 'POST' && pathname === '/api/brains') return addBrain(req, res, brains)
    if (req.method === 'POST' && pathname === '/api/brains/pick') return pickBrain(res, brains)
    const brainPath = pathname.match(/^\/api\/brains\/([^/]+)$/)
    if (req.method === 'DELETE' && brainPath) {
      brains.remove(decodeURIComponent(brainPath[1]))
      res.writeHead(204)
      return res.end()
    }
    const filesRoute = pathname.match(/^\/api\/brains\/([^/]+)\/files$/)
    if (req.method === 'GET' && filesRoute) return brainFiles(res, files, decodeURIComponent(filesRoute[1]))
    const historyRoute = pathname.match(/^\/api\/brains\/([^/]+)\/history$/)
    if (req.method === 'GET' && historyRoute) return brainHistory(res, history, decodeURIComponent(historyRoute[1]))
    const fileRoute = pathname.match(/^\/api\/brains\/([^/]+)\/file$/)
    if (fileRoute && ['GET', 'PUT'].includes(req.method)) {
      const path = new URL(req.url, 'http://localhost').searchParams.get('path') ?? undefined
      return brainFile(req, res, files, decodeURIComponent(fileRoute[1]), path)
    }
    const repoRoute = pathname.match(/^\/api\/brains\/([^/]+)\/repos\/([^/]+)\/(refs|commit|remote-url|merge-base)$/)
    if (req.method === 'GET' && repoRoute) {
      const [, id, slug, read] = repoRoute
      return repoRead(res, repos, decodeURIComponent(id), decodeURIComponent(slug), read, new URL(req.url, 'http://localhost').searchParams)
    }
    const walkRoute = pathname.match(/^\/api\/brains\/([^/]+)\/repos\/([^/]+)\/walk$/)
    if (req.method === 'POST' && walkRoute) return repoWalk(req, res, repos, decodeURIComponent(walkRoute[1]), decodeURIComponent(walkRoute[2]))
    json(res, 404, { error: 'not found' })
  })
