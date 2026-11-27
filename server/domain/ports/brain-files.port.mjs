// The brain files port: one brain's files, by the folder `root` that holds them. Paths are relative to `root`, spelled with `/`.
// A driven adapter implements these four calls, by `node:fs` or in memory:
//   all(root)               → { files: { [path]: text }, times: { [path]: ms } }, the files the page reads of a brain:
//                              `.local/specs/**/*.md` (the only files with a time, their last change), `notes/repos/**` and `notes/shared/**`,
//                              `.local/drafts/**`, every `repos/<slug>.md` card and `.local/repos.json`; it reads no research note, no doc
//                              and no file of an old layout
//   read(root, path)        → the file's text, or null when it is missing
//   write(root, path, text) → writes the file's full text and creates the folders it lacks
//   watch(root, onChange)   → calls `onChange(snapshot)` with what `all(root)` returns, after the brain's files may have changed
//                              (a burst of changes makes one call), and returns the function that stops watching
export {}
