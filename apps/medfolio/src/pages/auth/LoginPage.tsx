import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth/AuthContext'
import { defaultRoute } from '../../shell/nav.config'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { login, loginTwoFactor } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? defaultRoute

  const [step, setStep] = useState<'credentials' | '2fa'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.status === '2fa_required') {
        setStep('2fa')
      } else if (!result.user.hasHospitalMembership) {
        navigate('/selecionar-hospital', { replace: true })
      } else if (result.mustSetupTwoFactor) {
        navigate('/configurar-2fa', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar sessão.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTwoFactorSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await loginTwoFactor(code)
      if (result.status === 'ok') {
        navigate(result.user.hasHospitalMembership ? from : '/selecionar-hospital', { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível validar o código.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Link to="/login" className="auth-page__wordmark">
        <i className="pi pi-heart-fill" aria-hidden="true" />
        MedFolio
      </Link>
      {step === 'credentials' ? (
          <>
            <h1 className="auth-card__title">Entrar</h1>
            <p className="auth-card__subtitle">Acede à tua conta MedFolio.</p>
            <form className="auth-form" onSubmit={handleCredentialsSubmit}>
              <div className="auth-field">
                <label htmlFor="email">E-mail</label>
                <InputText
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="password">Palavra-passe</label>
                <Password
                  inputId="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  feedback={false}
                  toggleMask
                />
              </div>
              {error && <div className="auth-form__error">{error}</div>}
              <Button type="submit" label="Entrar" loading={loading} />
              <div className="auth-form__links">
                <Link to="/esqueci-password">Esqueci-me da palavra-passe</Link>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-card__title">Verificação em duas etapas</h1>
            <p className="auth-card__subtitle">
              Introduz o código da tua aplicação de autenticação, ou um código de recuperação.
            </p>
            <form className="auth-form" onSubmit={handleTwoFactorSubmit}>
              <div className="auth-field">
                <label htmlFor="code">Código</label>
                <InputText
                  id="code"
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              {error && <div className="auth-form__error">{error}</div>}
              <Button type="submit" label="Verificar" loading={loading} />
            </form>
          </>
        )}
    </AuthLayout>
  )
}
