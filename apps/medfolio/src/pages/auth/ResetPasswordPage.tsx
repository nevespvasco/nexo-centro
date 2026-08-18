import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Password } from 'primereact/password'
import { ApiError, postResetPassword } from '../../lib/api'
import './auth.scss'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.')
      return
    }
    setLoading(true)
    try {
      await postResetPassword(token, password)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível redefinir a palavra-passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Link to="/login" className="auth-page__wordmark">
        <i className="pi pi-heart-fill" aria-hidden="true" />
        MedFolio
      </Link>
      <div className="auth-card">
        <h1 className="auth-card__title">Redefinir palavra-passe</h1>
        <p className="auth-card__subtitle">Define uma nova palavra-passe para a tua conta.</p>
        {!token ? (
          <p className="auth-form__hint">Link inválido. Pede um novo em "Esqueci-me da palavra-passe".</p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="password">Nova palavra-passe</label>
              <Password
                inputId="password"
                autoComplete="new-password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                toggleMask
              />
            </div>
            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirmar palavra-passe</label>
              <Password
                inputId="confirmPassword"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                feedback={false}
                toggleMask
              />
            </div>
            {error && <div className="auth-form__error">{error}</div>}
            <Button type="submit" label="Redefinir palavra-passe" loading={loading} />
          </form>
        )}
      </div>
    </div>
  )
}
