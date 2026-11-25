import { pathsOf, relativeTo } from '../../../skills/brain/scripts/layout.mjs'
import { UnlinkedRepoError } from '../../domain/errors/unlinked-repo.error.mjs'
import { findBrain } from './find-brain.service.mjs'

// The repo object of the clone that the brain `id` links for `slug` in its `repos/repos.json`, where a slug maps to the clone's path
// or to `{ path }`. Throws `UnknownBrainError`, `UnlinkedRepoError`, or `NotACloneError` when the folder is no clone.
export const findClone = ({ brainList, brainFiles, gitClone }, id, slug) => {
  const { path: root } = findBrain(brainList, id)
  let links = {}
  try {
    links = JSON.parse(brainFiles.read(root, relativeTo(root, pathsOf(root).reposJson)) ?? '{}') ?? {}
  } catch { /* an unreadable links file links nothing */ }
  const link = Object.hasOwn(links, slug) ? links[slug] : undefined
  const path = typeof link === 'string' ? link : link?.path
  if (typeof path !== 'string' || path === '') throw new UnlinkedRepoError(slug)
  return gitClone.open(path)
}
