import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { ApiError, getUtente, type Utente } from '../lib/api'
import { calculateAge, formatDatePT } from '../lib/date'
import '../styles/crud.scss'

const SEXO_LABELS: Record<string, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  outro: 'Outro',
}

export function UtenteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [utente, setUtente] = useState<Utente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getUtente(id)
      .then(setUtente)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o utente.'))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="page">
      <Button
        className="crud-detail__back"
        icon="pi pi-arrow-left"
        label="Voltar"
        text
        onClick={() => navigate('/utentes')}
      />
      <h1 className="page__title">Detalhe do utente</h1>
      <p className="page__subtitle">Dados completos do registo, incluindo idade calculada a partir da data de nascimento.</p>

      {loading && <p>A carregar…</p>}
      {error && <Tag severity="danger" value={error} />}

      {utente && (
        <>
          <div className="crud-detail">
            <div className="crud-detail__row">
              <span className="crud-detail__label">Nome completo</span>
              <span className="crud-detail__value">{utente.nome ?? '—'}</span>
            </div>
            <div className="crud-detail__row">
              <span className="crud-detail__label">Nº Processo</span>
              <span className="crud-detail__value">{utente.processo}</span>
            </div>
            <div className="crud-detail__row">
              <span className="crud-detail__label">Sexo</span>
              <span className="crud-detail__value">{utente.sexo ? SEXO_LABELS[utente.sexo] : '—'}</span>
            </div>
            <div className="crud-detail__row">
              <span className="crud-detail__label">Data de nascimento</span>
              <span className="crud-detail__value">{formatDatePT(utente.dataNascimento)}</span>
            </div>
            <div className="crud-detail__row">
              <span className="crud-detail__label">Idade</span>
              <span className="crud-detail__value">{calculateAge(utente.dataNascimento) ?? '—'}</span>
            </div>
            <div className="crud-detail__row">
              <span className="crud-detail__label">Criado em</span>
              <span className="crud-detail__value">{new Date(utente.createdAt).toLocaleString('pt-PT')}</span>
            </div>
            <div className="crud-detail__row">
              <span className="crud-detail__label">Última atualização</span>
              <span className="crud-detail__value">{new Date(utente.updatedAt).toLocaleString('pt-PT')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
