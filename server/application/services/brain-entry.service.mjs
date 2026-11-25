// A listed brain as the API shows it: its status is `missing` when neither its folder nor its `.brain/` holds a `BRAIN.md`.
export const brainEntry = (brainFolderOf) => (brain) => ({ ...brain, status: brainFolderOf(brain.path) ? 'ok' : 'missing' })
