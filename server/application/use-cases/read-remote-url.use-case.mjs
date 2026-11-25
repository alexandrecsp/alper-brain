import { findClone } from '../services/find-clone.service.mjs'

// Reads a linked clone's origin url, or null without one.
export const readRemoteUrl = (ports) => async (id, slug) => (await findClone(ports, id, slug)).remoteUrl()
