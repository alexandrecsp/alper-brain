import { UnknownBrainError } from '../../domain/errors/unknown-brain.error.mjs'

// The listed brain of that id.
export const findBrain = (brainList, id) => {
  const brain = brainList.all().find((b) => b.id === id)
  if (!brain) throw new UnknownBrainError(id)
  return brain
}
