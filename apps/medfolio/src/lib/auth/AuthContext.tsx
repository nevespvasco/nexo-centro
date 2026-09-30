import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  type AuthUser,
  type LoginResponse,
  getMe,
  postLogin,
  postLoginTwoFactor,
  postLogout,
} from '../api'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<LoginResponse>
  loginTwoFactor: (code: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  refresh: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const refresh = useCallback(async () => {
    try {
      const me = await getMe()
      setUser(me)
      setStatus('authenticated')
      return me
    } catch {
      setUser(null)
      setStatus('unauthenticated')
      return null
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await postLogin(email, password)
    if (result.status === 'ok') {
      setUser(result.user)
      setStatus('authenticated')
    }
    return result
  }, [])

  const loginTwoFactor = useCallback(async (code: string) => {
    const result = await postLoginTwoFactor(code)
    if (result.status === 'ok') {
      setUser(result.user)
      setStatus('authenticated')
    }
    return result
  }, [])

  const logout = useCallback(async () => {
    try {
      await postLogout()
    } catch {
      // A password alterada ou a conta eliminada já pode ter revogado a sessão.
    }
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo(
    () => ({ user, status, login, loginTwoFactor, logout, refresh }),
    [user, status, login, loginTwoFactor, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
