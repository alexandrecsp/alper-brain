import { findClone } from '../services/find-clone.service.mjs'

// Reads a linked clone's HEAD and branches, with the `sig` that changes when any of them moves.
export const readRefs = (ports) => async (id, slug) => (await findClone(ports, id, slug)).refs()
