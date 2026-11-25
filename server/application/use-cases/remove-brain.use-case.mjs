// Removes a brain from the list; the brain's folder is left as it is.
export const removeBrain = ({ brainList }) => (id) => brainList.remove(id)
