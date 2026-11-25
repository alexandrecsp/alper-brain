// The brain list port over another, each brain's path replaced by the folder that holds its `BRAIN.md`, so a brain added before
// its move into `.brain/` is found there once it has moved. A path with no brain stays as listed.
export const resolvingBrainList = ({ brainList, brainFolderOf }) => ({
  all: () => brainList.all().map((brain) => ({ ...brain, path: brainFolderOf(brain.path) ?? brain.path })),
  add: brainList.add,
  remove: brainList.remove,
})
