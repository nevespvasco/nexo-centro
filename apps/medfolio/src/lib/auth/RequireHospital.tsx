import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireHospital({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()

  if (status === 'loading') return null
  if (status === 'authenticated' && user && !user.hasHospitalMembership) {
    return <Navigate to="/selecionar-hospital" replace />
  }
  return <>{children}</>
}
