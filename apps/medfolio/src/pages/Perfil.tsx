import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Dropdown } from 'primereact/dropdown'
import {
  ApiError,
  changePassword,
  deleteAccount,
  getEspecialidades,
  getTwoFactorSetup,
  postTwoFactorConfirm,
  postTwoFactorDisable,
  updateProfile,
  type Especialidade,
  type TwoFactorSetupResponse,
} from '../lib/api'
import { useAuth } from '../lib/auth/AuthContext'
import './Perfil.scss'

function secretFrom(otpauthUrl: string): string {
  try {
    return new URL(otpauthUrl).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

export function PerfilPage() {
  const { user, refresh, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="page">
      <h1 className="page__title">Perfil</h1>
      <p className="page__subtitle">Gere os dados da tua conta, a palavra-passe e a segurança.</p>

      <div className="profile-sections">
        <ProfileSection
          nome={user?.nome ?? null}
          email={user?.email ?? ''}
          especialidadeId={user?.especialidadeId ?? null}
          onSaved={refresh}
          onAccountDeleted={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
        />
        <PasswordSection />
        <TwoFactorSection
          enabled={Boolean(user?.twoFactorConfirmedAt)}
          onChanged={refresh}
        />
      </div>
    </div>
  )
}

function ProfileSection({
  nome,
  email,
  especialidadeId,
  onSaved,
  onAccountDeleted,
}: {
  nome: string | null
  email: string
  especialidadeId: string | null
  onSaved: () => Promise<void>
  onAccountDeleted: () => Promise<void>
}) {
  const [nomeValue, setNomeValue] = useState(nome ?? '')
  const [emailValue, setEmailValue] = useState(email)
  const [especialidadeValue, setEspecialidadeValue] = useState<string | null>(especialidadeId)
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getEspecialidades()
      .then(setEspecialidades)
      .catch(() => setEspecialidades([]))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      await updateProfile({
        nome: nomeValue.trim() || null,
        email: emailValue,
        especialidadeId: especialidadeValue,
      })
      await onSaved()
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível guardar as alterações.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteAccount()
      await onAccountDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="profile-card">
      <h2 className="profile-card__title">Perfil</h2>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-field">
          <label htmlFor="nome">Nome</label>
          <InputText id="nome" value={nomeValue} onChange={(e) => setNomeValue(e.target.value)} />
        </div>
        <div className="profile-field">
          <label htmlFor="email">E-mail</label>
          <InputText
            id="email"
            type="email"
            required
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
          />
        </div>
        <div className="profile-field">
          <label htmlFor="especialidade">Especialidade</label>
          <Dropdown
            inputId="especialidade"
            value={especialidadeValue}
            onChange={(e) => setEspecialidadeValue(e.value)}
            options={especialidades}
            optionLabel="nome"
            optionValue="id"
            placeholder="Selecionar especialidade"
            showClear
          />
        </div>
        {error && <div className="profile-form__error">{error}</div>}
        {success && <div className="profile-form__success">Alterações guardadas.</div>}
        <Button type="submit" label="Guardar alterações" loading={loading} />
      </form>

      <div className="profile-danger-zone">
        <div>
          <h3>Eliminar conta</h3>
          <p>Esta ação é irreversível. Todos os teus dados de acesso serão eliminados.</p>
        </div>
        {confirmingDelete ? (
          <div className="profile-danger-zone__confirm">
            <span>Tens a certeza?</span>
            <Button
              label="Sim, eliminar"
              severity="danger"
              loading={deleting}
              onClick={handleDelete}
            />
            <Button label="Cancelar" text onClick={() => setConfirmingDelete(false)} disabled={deleting} />
          </div>
        ) : (
          <Button label="Eliminar conta" severity="danger" outlined onClick={() => setConfirmingDelete(true)} />
        )}
      </div>
    </section>
  )
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (newPassword !== confirmPassword) {
      setError('As palavras-passe não coincidem.')
      return
    }
    setLoading(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar a palavra-passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="profile-card">
      <h2 className="profile-card__title">Palavra-passe</h2>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-field">
          <label htmlFor="current-password">Palavra-passe atual</label>
          <Password
            inputId="current-password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            feedback={false}
            toggleMask
          />
        </div>
        <div className="profile-field">
          <label htmlFor="new-password">Nova palavra-passe</label>
          <Password
            inputId="new-password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            toggleMask
          />
        </div>
        <div className="profile-field">
          <label htmlFor="confirm-password">Confirmar nova palavra-passe</label>
          <Password
            inputId="confirm-password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            feedback={false}
            toggleMask
          />
        </div>
        {error && <div className="profile-form__error">{error}</div>}
        {success && <div className="profile-form__success">Palavra-passe alterada.</div>}
        <Button type="submit" label="Alterar palavra-passe" loading={loading} />
      </form>
    </section>
  )
}

function TwoFactorSection({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<'idle' | 'setup' | 'disable'>('idle')
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startSetup() {
    setMode('setup')
    setError(null)
    setSetup(null)
    setRecoveryCodes(null)
    try {
      setSetup(await getTwoFactorSetup())
    } catch {
      setError('Não foi possível iniciar a configuração de 2FA.')
    }
  }

  function startDisable() {
    setMode('disable')
    setError(null)
    setCode('')
  }

  function cancel() {
    setMode('idle')
    setError(null)
    setCode('')
    setSetup(null)
    setRecoveryCodes(null)
  }

  async function handleConfirmSetup(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await postTwoFactorConfirm(code)
      setRecoveryCodes(result.recoveryCodes)
      await onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o código.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await postTwoFactorDisable(code)
      await onChanged()
      setMode('idle')
      setCode('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível desativar a 2FA.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="profile-card">
      <h2 className="profile-card__title">Verificação em duas etapas</h2>

      {mode === 'idle' && (
        <>
          <p className="profile-card__status">
            Estado atual: <strong>{enabled ? 'Ativa' : 'Inativa'}</strong>
          </p>
          {enabled ? (
            <Button label="Desativar" severity="danger" outlined onClick={startDisable} />
          ) : (
            <Button label="Configurar" onClick={startSetup} />
          )}
        </>
      )}

      {mode === 'setup' && !recoveryCodes && (
        <>
          {setup && (
            <>
              <div className="twofactor-qr">
                <img src={setup.qrDataUrl} alt="Código QR para configurar 2FA" />
              </div>
              <span className="twofactor-secret">{secretFrom(setup.otpauthUrl)}</span>
            </>
          )}
          <form className="profile-form" onSubmit={handleConfirmSetup}>
            <div className="profile-field">
              <label htmlFor="setup-code">Código da app de autenticação</label>
              <InputText
                id="setup-code"
                autoFocus
                required
                disabled={!setup}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && <div className="profile-form__error">{error}</div>}
            <div className="profile-form__actions">
              <Button type="submit" label="Confirmar" loading={loading} disabled={!setup} />
              <Button type="button" label="Cancelar" text onClick={cancel} disabled={loading} />
            </div>
          </form>
        </>
      )}

      {mode === 'setup' && recoveryCodes && (
        <>
          <p className="profile-card__status">
            Guarda os teus códigos de recuperação. Cada código só pode ser usado uma vez.
          </p>
          <div className="recovery-codes">
            {recoveryCodes.map((rc) => (
              <span key={rc} className="recovery-codes__code">
                {rc}
              </span>
            ))}
          </div>
          <Button label="Concluir" onClick={cancel} />
        </>
      )}

      {mode === 'disable' && (
        <form className="profile-form" onSubmit={handleDisable}>
          <div className="profile-field">
            <label htmlFor="disable-code">Código da app de autenticação ou de recuperação</label>
            <InputText
              id="disable-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <div className="profile-form__error">{error}</div>}
          <div className="profile-form__actions">
            <Button type="submit" label="Desativar" severity="danger" loading={loading} />
            <Button type="button" label="Cancelar" text onClick={cancel} disabled={loading} />
          </div>
        </form>
      )}
    </section>
  )
}
