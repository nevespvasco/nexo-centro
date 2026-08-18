import { useCallback, useEffect } from 'react'
import { usePersistentState } from './usePersistentState'

export type Theme = 'light' | 'dark'

/** App theme (Night Mode) persisted to localStorage and reflected on <html data-theme>. */
export function useTheme() {
  const [theme, setTheme] = usePersistentState<Theme>('medfolio.theme', 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = useCallback(
    () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [setTheme],
  )

  return { theme, toggle }
}
