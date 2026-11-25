// Reads a listed brain's files and the times of its specs' files, from the copy held in memory.
export const readBrainFiles = ({ brainCopies }) => (id) => brainCopies.of(id)
