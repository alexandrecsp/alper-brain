import { findBrain } from '../services/find-brain.service.mjs'
import { insideBrain } from '../services/inside-brain.service.mjs'

// Writes one file of a listed brain with its full text, creating the folders it lacks.
export const writeBrainFile = ({ brainList, brainFiles }) => (id, path, text) => {
  const { path: root } = findBrain(brainList, id)
  insideBrain(root, path)
  brainFiles.write(root, path, text)
}
