import { findClone } from '../services/find-clone.service.mjs'

// The commit that two commits of a linked clone share as their best common ancestor, or null when they share no history.
export const findMergeBase = (ports) => async (id, slug, a, b) => (await findClone(ports, id, slug)).mergeBase(a, b)
