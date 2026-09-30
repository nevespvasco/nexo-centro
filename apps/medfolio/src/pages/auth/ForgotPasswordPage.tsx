import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { postForgotPassword } from '../../lib/api'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await postForgotPassword(email)
      setSent(true)
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
      <h1 className="auth-card__title">Esqueci-me da palavra-passe</h1>
        <p className="auth-card__subtitle">
          Indica o teu e-mail e enviamos-te um link para definires uma nova palavra-passe.
        </p>
        {sent ? (
          <p className="auth-form__hint">
            Se existir uma conta com esse e-mail, vais receber um link de recuperação em breve.
          </p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
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
            <Button type="submit" label="Enviar link" loading={loading} />
            <div className="auth-form__links">
              <Link to="/login">Voltar a entrar</Link>
            </div>
          </form>
        )}
    </AuthLayout>
  )
}
