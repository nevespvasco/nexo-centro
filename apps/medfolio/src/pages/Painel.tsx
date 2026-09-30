import { useEffect, useState } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { ProgressSpinner } from 'primereact/progressspinner'
import type { Dashboard, DashboardRegistoRecente } from '@nexo-centro/schemas'
import { ApiError, getDashboard } from '../lib/api'
import { HospitalScopePicker } from '../components/HospitalScopePicker'
import { useHospitalScope } from '../lib/hospitalScope'
import { formatDatePT } from '../lib/date'
import '../styles/crud.scss'

const CLINICAL_CARDS: { key: keyof Dashboard; label: string }[] = [
  { key: 'totalRegistos', label: 'Os meus registos cirúrgicos' },
  { key: 'cirurgiasMes', label: 'Registos este mês' },
  { key: 'totalUtentes', label: 'Utentes operados' },
  { key: 'complicacoes', label: 'Complicações' },
]
const PERSONAL_CARDS: { key: keyof Dashboard; label: string }[] = [
  { key: 'totalAtividades', label: 'Atividades científicas' },
  { key: 'totalFormacoes', label: 'Formações' },
  { key: 'horasFormacao', label: 'Horas de formação' },
  { key: 'creditosFormacao', label: 'Créditos' },
]

export function Painel() {
  const { scope, setScope, hospitals, selectedHospitals, label, loadingHospitals, scopeError, accessVersion, refreshHospitals } = useHospitalScope()
  const scopeKey = scope.kind === 'all' ? 'all' : scope.ids.join(',')
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loadingHospitals) return
    let current = true
    setLoading(true); setError(null); setData(null)
    getDashboard(scope)
      .then((value) => { if (current) setData(value) })
      .catch((error) => { if (current) { if (error instanceof ApiError && error.status === 403) void refreshHospitals(); setError('Não foi possível carregar o painel.') } })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, loadingHospitals, accessVersion])

  return (
    <div className="page">
      <h1 className="page__title">Painel</h1>
      <p className="page__subtitle">Resumo dos meus registos nos hospitais selecionados.</p>
      <HospitalScopePicker scope={scope} hospitals={hospitals} label={label} onChange={setScope} />
      {scopeError && <div className="crud-form__error" role="alert">{scopeError}</div>}
      <div role="status">{selectedHospitals.length} hospitais incluídos{data ? ` · ${data.totalRegistos} registos` : ''}</div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <ProgressSpinner style={{ width: 48, height: 48 }} />
        </div>
      )}
      {error && <div className="crud-form__error">{error}</div>}

      {data && (
        <>
          <div className="dash-grid">
            {CLINICAL_CARDS.map((c) => (
              <div key={c.key} className="dash-card">
                <div className="dash-card__label">{c.label}</div>
                <div className="dash-card__value">{data[c.key] as number}</div>
              </div>
            ))}
          </div>

          <div className="dash-section__title">Atividade pessoal · independente do hospital</div>
          <div className="dash-grid">
            {PERSONAL_CARDS.map((c) => (
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
              <Column field="hospitalNome" header="Hospital" />
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
