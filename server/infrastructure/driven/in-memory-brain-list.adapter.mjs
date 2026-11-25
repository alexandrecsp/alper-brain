// The brain list held in memory, for the use-case tests.
export const inMemoryBrainList = (brains = []) => {
  let list = [...brains]
  return {
    all: () => [...list],
    add: (brain) => { list = [...list, brain] },
    remove: (id) => { list = list.filter((b) => b.id !== id) },
  }
}
