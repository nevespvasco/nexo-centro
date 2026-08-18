import { useCallback, useState } from 'react'

/**
 * useState mirrored to localStorage. Reads once on init; writes on every set.
 * Falls back to the default when storage is unavailable or holds bad JSON.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // ignore write failures (private mode, quota)
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set] as const
}
