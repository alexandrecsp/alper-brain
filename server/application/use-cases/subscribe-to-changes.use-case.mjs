// Tells `tell` each change to a listed brain's files, as `{ brain, changed, times }`; returns the function that ends it.
export const subscribeToChanges = ({ brainCopies }) => (tell) => brainCopies.subscribe(tell)
