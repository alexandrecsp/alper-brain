// The running server's brain list, as the entry asks it. A driven adapter implements this one call, over the server's HTTP API:
//   add({ port, path })   → adds the brain at the absolute `path` to the server on `port` and answers its entry `{ id, name, path, status }`;
//                           a path already listed answers its entry again. It throws `BrainNotAddedError` when the server refuses.
export {}
