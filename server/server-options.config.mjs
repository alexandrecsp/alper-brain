// What the entry (`main.mjs`) and the server (`server.mjs`) share: the one host the server listens on, its fixed port, and how
// each reads the options on its command line.
export const HOST = '127.0.0.1'
export const DEFAULT_PORT = 9999

// The value after `--<name>` in `args`, or undefined when the option is not there.
export const argOf = (args, name) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? undefined : args[i + 1]
}
