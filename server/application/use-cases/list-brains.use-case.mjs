import { brainEntry } from '../services/brain-entry.service.mjs'

// Lists each brain the user added, with its status.
export const listBrains = ({ brainList, brainFolderOf }) => () => brainList.all().map(brainEntry(brainFolderOf))
