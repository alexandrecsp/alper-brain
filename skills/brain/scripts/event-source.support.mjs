// Test support: the browser's EventSource over fetch's streaming body, as much of it as the page's server source uses: a url,
// `addEventListener(name, listener)` and `close()`. Node has no EventSource without a flag.
export class EventSource {
  #stop = new AbortController()
  #listeners = new Map()

  constructor(url) {
    this.#read(url)
  }

  addEventListener(name, listener) {
    this.#listeners.set(name, [...(this.#listeners.get(name) ?? []), listener])
  }

  close() {
    this.#stop.abort()
  }

  async #read(url) {
    try {
      const res = await fetch(url, { signal: this.#stop.signal })
      const decoder = new TextDecoder()
      let buffer = ''
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true })
        for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
          const frame = buffer.slice(0, end).split('\n')
          buffer = buffer.slice(end + 2)
          const name = frame.find((l) => l.startsWith('event: '))?.slice(7)
          const data = frame.find((l) => l.startsWith('data: '))?.slice(6)
          if (name && data !== undefined) for (const listener of this.#listeners.get(name) ?? []) listener({ data })
        }
      }
    } catch { /* closed */ }
  }
}
