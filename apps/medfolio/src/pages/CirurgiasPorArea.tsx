import { useEffect, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Toast } from 'primereact/toast'
import type { CirurgiasPorArea, CirurgiasPorAreaTipo } from '@nexo-centro/schemas'
import { ApiError, exportCirurgiasPorArea, getCirurgiasPorArea } from '../lib/api'
import { useHospitalScope } from '../lib/hospitalScope'
import { HospitalScopePicker } from '../components/HospitalScopePicker'
import '../styles/crud.scss'

type Report = CirurgiasPorArea & { hospitalId: string; hospitalNome: string }
const TIPO_LABEL: Record<string, string> = { benigno: 'Benigno', maligno: 'Maligno' }
const grupoLabel = (g: CirurgiasPorAreaTipo) => (g.tipo ? TIPO_LABEL[g.tipo] : 'Sem classificação')

export function CirurgiasPorArea() {
  const toast = useRef<Toast>(null)
  const { scope, setScope, hospitals, selectedHospitals, label, loadingHospitals, scopeError, accessVersion, refreshHospitals } = useHospitalScope()
  const scopeKey = scope.kind === 'all' ? 'all' : scope.ids.join(',')
  const [data, setData] = useState<{ total: number; reports: Report[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (loadingHospitals) return
    let current = true
    setLoading(true); setError(null); setData(null); setExportOpen(false)
    getCirurgiasPorArea(scope)
      .then((value) => { if (current) setData(value) })
      .catch((error) => { if (current) { if (error instanceof ApiError && error.status === 403) void refreshHospitals(); setError('Não foi possível carregar o relatório.') } })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, loadingHospitals, accessVersion])

  return <div className="page">
    <Toast ref={toast} />
    <h1 className="page__title">Cirurgias por Área</h1>
    <p className="page__subtitle">Distribuição das minhas intervenções por zona anatómica e classificação.</p>
    <HospitalScopePicker scope={scope} hospitals={hospitals} label={label} onChange={setScope} />
    {scopeError && <div className="crud-form__error" role="alert">{scopeError}</div>}
    <div role="status">{selectedHospitals.length} hospitais incluídos{data ? ` · ${data.total} intervenções` : ''}</div>
    {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><ProgressSpinner style={{ width: 48, height: 48 }} /></div>}
    {error && <div className="crud-form__error">{error}</div>}
    {data && <>
      <div className="report-toolbar"><span className="report-total">Total de intervenções: {data.total}</span>
        <Button label="Exportar dados" icon="pi pi-file-excel" outlined onClick={() => setExportOpen(true)} disabled={data.total === 0} /></div>
      {data.total === 0 && <p className="page__subtitle">Ainda não há intervenções registadas.</p>}
      {data.reports.map((report) => <details key={report.hospitalId} className="scope-panel" open={selectedHospitals.length === 1}>
        <summary className="dash-section__title">{report.hospitalNome} · {report.total} intervenções</summary>
        {report.zonas.map((zona) => <div key={zona.zonaAnatomicaId ?? zona.zonaAnatomicaNome} className="report-zona">
          <div className="report-zona__head"><span className="report-zona__name">{zona.zonaAnatomicaNome}</span><span className="report-zona__count">{zona.total} intervenções</span></div>
          {zona.grupos.map((grupo) => <div key={grupoLabel(grupo)}>
            <div className="report-grupo__head">{grupoLabel(grupo)} · {grupo.total}</div>
            <table className="report-table"><thead><tr><th>Diagnóstico</th><th>Procedimento</th><th>Total</th></tr></thead>
              <tbody>{grupo.linhas.map((linha) => <tr key={`${linha.diagnosticoNome} ${linha.procedimentoNome}`}><td>{linha.diagnosticoNome}</td><td>{linha.procedimentoNome}</td><td>{linha.total}</td></tr>)}</tbody></table>
          </div>)}
        </div>)}
      </details>)}
    </>}
    <Dialog header="Confirmar exportação" visible={exportOpen} onHide={() => setExportOpen(false)} style={{ width: 'min(92vw, 520px)' }}>
      <dl className="export-summary">
        <dt>Tema</dt><dd>Cirurgias por Área</dd>
        <dt>Hospitais</dt><dd>{label}: {selectedHospitals.map((h) => h.nome).join(', ')}</dd>
        <dt>Intervenções</dt><dd>{data?.total.toLocaleString('pt-PT') ?? '—'}</dd>
      </dl>
      <div className="crud-form__actions">
        <Button label="Cancelar" text onClick={() => setExportOpen(false)} />
        <Button label={`Exportar ${data?.total.toLocaleString('pt-PT') ?? '…'} cirurgias`} loading={exporting} onClick={async () => {
          setExporting(true)
          try { await exportCirurgiasPorArea(scope); setExportOpen(false) }
          catch { toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível exportar.' }) }
          finally { setExporting(false) }
        }} />
      </div>
    </Dialog>
  </div>
}
