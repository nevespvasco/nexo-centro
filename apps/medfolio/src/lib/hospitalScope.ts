import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { HospitalMembership } from '@nexo-centro/schemas'
import { getHospitals } from './api'
import { type HospitalScope, scopeParams } from './hospitalScopeModel'

export function useHospitalScope() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hospitals, setHospitals] = useState<HospitalMembership[]>([])
  const [loadingHospitals, setLoadingHospitals] = useState(true)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [accessVersion, setAccessVersion] = useState(0)
  const hospitalsKey = useRef<string | null>(null)
  const scope = useMemo<HospitalScope>(() => {
    const ids = searchParams.getAll('hospitalId')
    return searchParams.get('scope') === 'selected' && ids.length ? { kind: 'selected', ids: [...new Set(ids)] } : { kind: 'all' }
  }, [searchParams])
  useEffect(() => {
    const raw = searchParams.get('scope')
    if ((raw !== null && raw !== 'all' && raw !== 'selected') ||
      ((raw === null || raw === 'all') && searchParams.has('hospitalId')) ||
      (raw === 'selected' && searchParams.getAll('hospitalId').length === 0)) {
      setScopeError('O âmbito do link era inválido. A consulta voltou a todos os hospitais disponíveis.')
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.delete('scope'); next.delete('hospitalId')
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const refreshHospitals = useCallback(async () => {
    try {
      const list = await getHospitals()
      const key = JSON.stringify(list.map((h) => [h.id, h.nome]))
      if (key !== hospitalsKey.current) {
        hospitalsKey.current = key
        setHospitals(list); setAccessVersion((n) => n + 1)
      }
    } catch { setScopeError('Não foi possível verificar o acesso aos hospitais.') }
    finally { setLoadingHospitals(false) }
  }, [])
  useEffect(() => {
    void refreshHospitals()
    const onFocus = () => { void refreshHospitals() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshHospitals])
  useEffect(() => {
    if (loadingHospitals || scope.kind !== 'selected') return
    const allowed = new Set(hospitals.map((h) => h.id))
    if (scope.ids.some((id) => !allowed.has(id))) {
      setScopeError('O acesso a um hospital selecionado mudou. A consulta voltou a todos os hospitais disponíveis.')
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.delete('scope'); next.delete('hospitalId')
        return next
      }, { replace: true })
    }
  }, [scope, hospitals, loadingHospitals, setSearchParams])
  function setScope(nextScope: HospitalScope) {
    setScopeError(null)
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('scope'); next.delete('hospitalId')
      const selection = scopeParams(nextScope)
      selection.forEach((value, key) => next.append(key, value))
      return next
    })
  }
  const selectedHospitals = scope.kind === 'all' ? hospitals : hospitals.filter((h) => scope.ids.includes(h.id))
  const label = scope.kind === 'all' ? `Todos os hospitais (${hospitals.length})`
    : selectedHospitals.length <= 2 ? `${selectedHospitals.map((h) => h.nome).join(' + ')} (${selectedHospitals.length})`
    : `${selectedHospitals.length} hospitais selecionados`
  return { scope, setScope, hospitals, selectedHospitals, label, loadingHospitals, scopeError, accessVersion, refreshHospitals }
}
