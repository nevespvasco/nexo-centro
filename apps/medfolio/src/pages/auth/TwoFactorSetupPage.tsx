import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import {
  ApiError,
  getTwoFactorSetup,
  postTwoFactorConfirm,
  postTwoFactorSkip,
  type TwoFactorSetupResponse,
} from '../../lib/api'
import { defaultRoute } from '../../shell/nav.config'
import './auth.scss'

function secretFrom(otpauthUrl: string): string {
  try {
    return new URL(otpauthUrl).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

export function TwoFactorSetupPage() {
  const navigate = useNavigate()
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  useEffect(() => {
    getTwoFactorSetup().then(setSetup).catch(() => setError('Não foi possível iniciar a configuração de 2FA.'))
  }, [])

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await postTwoFactorConfirm(code)
      setRecoveryCodes(result.recoveryCodes)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o código.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    setLoading(true)
    try {
      await postTwoFactorSkip()
      navigate(defaultRoute, { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Link to={defaultRoute} className="auth-page__wordmark">
        <i className="pi pi-heart-fill" aria-hidden="true" />
        MedFolio
      </Link>
      <div className="auth-card">
        {recoveryCodes ? (
          <>
            <h1 className="auth-card__title">Guarda os teus códigos de recuperação</h1>
            <p className="auth-card__subtitle">
              Usa um destes códigos para entrar se perderes o acesso à app de autenticação. Cada
              código só pode ser usado uma vez.
            </p>
            <div className="recovery-codes">
              {recoveryCodes.map((rc) => (
                <span key={rc} className="recovery-codes__code">
                  {rc}
                </span>
              ))}
            </div>
            <Button label="Continuar" onClick={() => navigate(defaultRoute, { replace: true })} />
          </>
        ) : (
          <>
            <h1 className="auth-card__title">Configurar verificação em duas etapas</h1>
            <p className="auth-card__subtitle">
              Torna a tua conta mais segura com um código adicional a cada início de sessão. Podes
              saltar este passo e configurar mais tarde.
            </p>
            {setup && (
              <>
                <div className="twofactor-qr">
                  <img src={setup.qrDataUrl} alt="Código QR para configurar 2FA" />
                </div>
                <span className="twofactor-secret">{secretFrom(setup.otpauthUrl)}</span>
              </>
            )}
            <form className="auth-form" onSubmit={handleConfirm}>
              <div className="auth-field">
                <label htmlFor="code">Código da app de autenticação</label>
                <InputText
                  id="code"
                  autoFocus
                  required
                  disabled={!setup}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              {error && <div className="auth-form__error">{error}</div>}
              <Button type="submit" label="Confirmar" loading={loading} disabled={!setup} />
              <Button
                type="button"
                label="Saltar por agora"
                text
                onClick={handleSkip}
                disabled={loading}
              />
            </form>
          </>
        )}
      </div>
    </div>
  )
}
