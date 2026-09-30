import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { ApiError } from '../../lib/api'
import { postAdminLogin, postAdminLoginTwoFactor } from '../../lib/adminApi'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = requiresTwoFactor
        ? await postAdminLoginTwoFactor(code)
        : await postAdminLogin(email, password)
      if (result.status === '2fa_required') {
        setRequiresTwoFactor(true)
        setPassword('')
        return
      }
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar sessão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page admin-login">
      <div className="auth-shell admin-login__shell" style={{ justifyContent: 'center' }}>
        <div className="auth-shell__form" style={{ maxWidth: 400, width: '100%' }}>
          <div className="auth-page__wordmark" style={{ marginBottom: '1.5rem' }}>
            <i className="pi pi-shield" aria-hidden="true" />
            MedFolio Admin
          </div>
          <h1 className="auth-card__title">Administração</h1>
          <p className="auth-card__subtitle">Acede à área de administração.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {requiresTwoFactor ? (
              <div className="auth-field">
                <label htmlFor="code">Código de verificação</label>
                <InputText
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            ) : (
              <>
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
              </>
            )}
            {error && <div className="auth-form__error">{error}</div>}
            <Button
              type="submit"
              label={requiresTwoFactor ? 'Verificar' : 'Entrar'}
              loading={loading}
            />
          </form>
        </div>
      </div>
    </div>
  )
}
