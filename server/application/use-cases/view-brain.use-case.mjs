import { resolve } from 'node:path'

// Leaves one current server running and gives the URL that opens the page: with a brain, that brain is added to the server's list
// first, and the URL opens it.
export const viewBrain = ({ launch, serverBrains, host }) => async ({ port, brain }) => {
  const { port: served } = await launch({ port })
  const root = `http://${host}:${served}/`
  if (brain === undefined) return root
  const { id } = await serverBrains.add({ port: served, path: resolve(brain) })
  return `${root}#/b/${id}`
}
