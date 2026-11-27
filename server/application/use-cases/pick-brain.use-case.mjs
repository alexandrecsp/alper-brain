import { NotABrainError } from '../../domain/errors/not-a-brain.error.mjs'

export const PICK_TITLE = 'Pick the brain folder, the one holding BRAIN.md or a .brain/ folder'

// Opens the machine's folder dialog and adds the brain in the folder picked, by `add` (the add-brain use case); resolves with its
// entry, or null when the user cancels. A folder holding no brain is refused with `NotABrainError` and left off the list.
export const pickBrain = ({ folderPicker, brainFolderOf, add }) => async () => {
  const path = await folderPicker.pick(PICK_TITLE)
  if (path === null) return null
  if (brainFolderOf(path) === null) throw new NotABrainError(path)
  return add(path)
}
