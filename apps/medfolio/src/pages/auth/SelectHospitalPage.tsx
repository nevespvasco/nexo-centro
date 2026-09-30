import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import type { AvailableHospital } from '@nexo-centro/schemas'
import { ApiError, getAvailableHospitals, requestHospitalAccess } from '../../lib/api'
import { useAuth } from '../../lib/auth/AuthContext'
import { defaultRoute } from '../../shell/nav.config'
import { AuthLayout } from './AuthLayout'

export function SelectHospitalPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [hospitals, setHospitals] = useState<AvailableHospital[]>([])
  const [loading, setLoading] = useState(true)
  const [hospitalId, setHospitalId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    getAvailableHospitals()
      .then(setHospitals)
      .catch(() => setHospitals([]))
      .finally(() => setLoading(false))
  }, [])

  // Only redirect away for a membership the user already had when this page
  // was first reached — deliberately not reactive to `user`, so the request
  // this page itself triggers doesn't race the post-submit navigate() below
  // (react-router's <Navigate> re-renders via effect and can otherwise win
  // the race, sending the user to defaultRoute before it can route through
  // /configurar-2fa first).
  useEffect(() => {
    if (user?.hasHospitalMembership) {
      navigate(defaultRoute, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit() {
    if (!hospitalId) return
    setError(null)
    setSaving(true)
    try {
      await requestHospitalAccess(hospitalId)
      setRequested(true)
      setHospitals((current) => current.filter((hospital) => hospital.id !== hospitalId))
      setHospitalId(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    setSaving(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthLayout>
      <span className="auth-page__wordmark">
        <i className="pi pi-heart-fill" aria-hidden="true" />
        MedFolio
      </span>
      <h1 className="auth-card__title">Seleciona o teu hospital</h1>
        <p className="auth-card__subtitle">
          Escolhe o teu hospital de origem para entrares na aplicação. Podes adicionar outros
          hospitais mais tarde.
        </p>
        <div className="auth-form">
          <div className="auth-field">
            <label htmlFor="select-hospital">Hospital</label>
            <Dropdown
              inputId="select-hospital"
              value={hospitalId}
              options={hospitals}
              optionLabel="nome"
              optionValue="id"
              filter
              filterBy="nome"
              loading={loading}
              placeholder="Pesquisar hospital"
              emptyMessage="Sem hospitais disponíveis."
              onChange={(e) => setHospitalId(e.value)}
            />
          </div>
          {error && <div className="auth-form__error">{error}</div>}
          {requested && (
            <div className="auth-form__success">
              Pedido enviado. Poderás entrar depois de um responsável do hospital o aprovar.
            </div>
          )}
          <Button
            type="button"
            label="Continuar"
            loading={saving}
            disabled={!hospitalId || saving}
            onClick={handleSubmit}
          />
          <Button
            type="button"
            label="Terminar sessão"
            text
            disabled={saving}
            onClick={handleLogout}
          />
        </div>
    </AuthLayout>
  )
}
