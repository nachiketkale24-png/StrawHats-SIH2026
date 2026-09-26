// Cache decoded display data in this tab; bounded and explicitly refreshable.
const entries = new Map<string, { value: unknown; expires: number }>()
const pending = new Map<string, Promise<unknown>>()
let generation = 0
export function clearDisplayCache() {
  generation++
  entries.clear()
  pending.clear()
}
export async function cachedDisplay<T>(key: string, signal: AbortSignal, fetchValue: () => Promise<T>, ttl = 5 * 60_000): Promise<T> {
  signal.throwIfAborted()
  const entry = entries.get(key)
  let promise: Promise<T>
  if (entry && entry.expires > Date.now()) {
    entries.delete(key)
    entries.set(key, entry)
    promise = Promise.resolve(entry.value as T)
  } else {
    const existing = pending.get(key)
    if (existing) promise = existing as Promise<T>
    else {
      const startedGeneration = generation
      promise = fetchValue().then(value => {
        if (generation === startedGeneration) {
          entries.set(key, { value, expires: Date.now() + ttl })
          while (entries.size > 24) entries.delete(entries.keys().next().value!)
        }
        return value
      }).finally(() => { if (pending.get(key) === promise) pending.delete(key) })
      pending.set(key, promise)
    }
  }
  // A cancelled view must not cancel a shared request or a prefetch.
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    promise.then(value => { signal.removeEventListener('abort', abort); if (!signal.aborted) resolve(value) },
      error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
