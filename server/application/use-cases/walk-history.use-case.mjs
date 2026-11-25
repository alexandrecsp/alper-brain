import { findClone } from '../services/find-clone.service.mjs'

// Walks a linked clone's history from `tips`, as `GitRead`'s `walk` does: `{ commits, more }`.
export const walkHistory = (ports) => async (id, slug, tips, options) => (await findClone(ports, id, slug)).walk(tips, options)
