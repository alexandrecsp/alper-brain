// The brain list port: the brains the user added, each `{ id, name, path }` with an absolute path.
// A driven adapter implements these three calls, by the file that keeps the list or in memory:
//   all()          → the brains, in the order they were added
//   add(brain)     → adds a brain
//   remove(id)     → removes the brain of that id, and does nothing when none has it
export {}
