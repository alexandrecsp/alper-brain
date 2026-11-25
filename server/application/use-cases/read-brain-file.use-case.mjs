import { findBrain } from '../services/find-brain.service.mjs'
import { insideBrain } from '../services/inside-brain.service.mjs'

// Reads one file of a listed brain: its text, or null when it is missing.
export const readBrainFile = ({ brainList, brainFiles }) => (id, path) => {
  const { path: root } = findBrain(brainList, id)
  insideBrain(root, path)
  return brainFiles.read(root, path)
}
