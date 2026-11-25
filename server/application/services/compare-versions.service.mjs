// Orders two dotted versions by their numbers: negative when `a` is older than `b`, zero when equal, positive when newer.
export const compareVersions = (a, b) => {
  const [x, y] = [a, b].map((v) => String(v).split('.').map((n) => parseInt(n, 10) || 0))
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
