import { historyOf } from '../services/brain-history.service.mjs'
import { findBrain } from '../services/find-brain.service.mjs'

// Reads the history of a listed brain's notes, in the timeline's JSON shape.
export const readBrainHistory = ({ brainList, brainHistory: history }) => async (id) => {
  const { path: root } = findBrain(brainList, id)
  return historyOf(history, root)
}
