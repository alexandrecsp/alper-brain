import { findClone } from '../services/find-clone.service.mjs'

// Reads one commit of a linked clone, or null when it is missing.
export const readCommit = (ports) => async (id, slug, sha) => (await findClone(ports, id, slug)).commit(sha)
