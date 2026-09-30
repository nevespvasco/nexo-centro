import { useEffect, useState } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { ProgressSpinner } from 'primereact/progressspinner'
import type { Dashboard, DashboardRegistoRecente } from '@nexo-centro/schemas'
import { getDashboard } from '../lib/api'
import { formatDatePT } from '../lib/date'
import '../styles/crud.scss'

const CARDS: { key: keyof Dashboard; label: string }[] = [
  { key: 'totalRegistos', label: 'Registos cirúrgicos' },
  { key: 'cirurgiasMes', label: 'Registos este mês' },
  { key: 'totalUtentes', label: 'Utentes operados' },
  { key: 'complicacoes', label: 'Complicações' },
  { key: 'totalAtividades', label: 'Atividades científicas' },
  { key: 'totalFormacoes', label: 'Formações' },
  { key: 'horasFormacao', label: 'Horas de formação' },
  { key: 'creditosFormacao', label: 'Créditos' },
]

export function Painel() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError('Não foi possível carregar o painel.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <h1 className="page__title">Painel</h1>
      <p className="page__subtitle">Resumo da sua atividade no hospital ativo.</p>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <ProgressSpinner style={{ width: 48, height: 48 }} />
        </div>
      )}
      {error && <div className="crud-form__error">{error}</div>}

      {data && (
        <>
          <div className="dash-grid">
            {CARDS.map((c) => (
              <div key={c.key} className="dash-card">
                <div className="dash-card__label">{c.label}</div>
                <div className="dash-card__value">{data[c.key] as number}</div>
              </div>
            ))}
          </div>

          <div className="dash-section__title">Registos recentes</div>
          <div className="crud-table">
            <DataTable
              value={data.registosRecentes}
              responsiveLayout="stack"
              breakpoint="767px"
              emptyMessage="Ainda não há registos."
            >
              <Column
                header="Data"
                body={(r: DashboardRegistoRecente) => formatDatePT(r.dataCirurgia)}
              />
              <Column
                header="Utente"
                body={(r: DashboardRegistoRecente) => r.utenteNome ?? `Processo ${r.utenteProcesso}`}
              />
              <Column header="Tipo de cirurgia" body={(r: DashboardRegistoRecente) => r.tipoDeCirurgiaNome ?? '—'} />
              <Column header="Nº cirurgias" body={(r: DashboardRegistoRecente) => r.numeroCirurgias} />
            </DataTable>
          </div>
        </>
      )}
    </div>
  )
}
