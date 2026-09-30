import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { Sidebar } from 'primereact/sidebar'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { InputTextarea } from 'primereact/inputtextarea'
import { Dropdown } from 'primereact/dropdown'
import { MultiSelect } from 'primereact/multiselect'
import { Calendar } from 'primereact/calendar'
import { Checkbox } from 'primereact/checkbox'
import type {
  CatalogosRegisto,
  CreateCirurgia,
  CreateRegisto,
} from '@nexo-centro/schemas'
import {
  ApiError,
  createRegisto,
  deleteRegisto,
  exportRegistos,
  getCatalogosRegisto,
  getDiagnosticos,
  getProcedimentos,
  getRegisto,
  getRegistos,
  getRegistoStatistics,
  getUtenteByProcesso,
  getUtentes,
  listEspecialidades,
  updateRegisto,
  type Diagnostico,
  type EspecialidadeRow,
  type Procedimento,
  type RegistoFiltros,
  type RegistoMultiResumo,
  type RegistoStatistics,
  type Utente,
} from '../lib/api'
import { formatDatePT, fromISODate, toISODate } from '../lib/date'
import { QuickAddDiagnostico, QuickAddProcedimento } from '../components/QuickAddDialogs'
import { HospitalScopePicker } from '../components/HospitalScopePicker'
import { useHospitalScope } from '../lib/hospitalScope'
import '../styles/crud.scss'

const TIPO_LESAO_OPTIONS = [
  { label: 'Benigno', value: 'benigno' },
  { label: 'Maligno', value: 'maligno' },
]
const CLAVIEN_OPTIONS = [
  { label: 'Sem complicações', value: 'sem_complicacoes' },
  { label: 'I', value: 'I' },
  { label: 'II', value: 'II' },
  { label: 'IIIa', value: 'IIIa' },
  { label: 'IIIb', value: 'IIIb' },
  { label: 'IVa', value: 'IVa' },
  { label: 'IVb', value: 'IVb' },
  { label: 'V', value: 'V' },
]

const emptyCirurgia: CreateCirurgia = {
  diagnosticoId: '',
  procedimentoId: '',
  tipo: null,
  funcaoCirurgiaoId: null,
  clavienDindo: null,
  anatomiaPatologica: null,
  observacoes: null,
}

const emptyCatalogos: CatalogosRegisto = { tiposDeCirurgia: [], funcoesCirurgiao: [], tiposDeAbordagem: [] }

function emptyForm(): CreateRegisto {
  return {
    utenteId: '',
    especialidadeId: null,
    dataCirurgia: toISODate(new Date()),
    idadeCirurgia: null,
    tipoDeCirurgiaId: '',
    tipoDeAbordagemId: null,
    ambulatorio: false,
    observacoes: null,
    cirurgias: [{ ...emptyCirurgia }],
  }
}

const emptyFiltros: RegistoFiltros = {}

export function RegistosCirurgicos() {
  const toast = useRef<Toast>(null)
  const { scope, setScope, hospitals, selectedHospitals, label: scopeLabel, loadingHospitals, scopeError, accessVersion, refreshHospitals } = useHospitalScope()
  const scopeKey = scope.kind === 'all' ? 'all' : scope.ids.join(',')
  const [rows, setRows] = useState<RegistoMultiResumo[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<RegistoStatistics | null>(null)
  const [view, setView] = useState<'overview' | 'hospitals' | 'compare' | 'records'>('overview')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const requestVersion = useRef(0)
  const exportVersion = useRef(0)
  const [loading, setLoading] = useState(true)
  const [utentes, setUtentes] = useState<Utente[]>([])
  const [especialidades, setEspecialidades] = useState<EspecialidadeRow[]>([])
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [catalogos, setCatalogos] = useState<CatalogosRegisto>(emptyCatalogos)
  const [filtros, setFiltros] = useState<RegistoFiltros>(emptyFiltros)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateRegisto>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportPreview, setExportPreview] = useState<number | null>(null)
  const [writeHospitalId, setWriteHospitalId] = useState<string | null>(null)
  const [quickAddDiagForIndex, setQuickAddDiagForIndex] = useState<number | null>(null)
  const [quickAddProcForIndex, setQuickAddProcForIndex] = useState<number | null>(null)
  const [processoLookup, setProcessoLookup] = useState('')
  const [processoLoading, setProcessoLoading] = useState(false)
  const [processoMsg, setProcessoMsg] = useState<string | null>(null)

  function load(f?: RegistoFiltros) {
    if (loadingHospitals) return
    const version = ++requestVersion.current
    setLoading(true)
    setRows([]); setTotal(0); setStats(null)
    const requested = f ?? filtros
    const effective = selectedHospitals.length === 1 ? requested : {
      search: requested.search, dataInicio: requested.dataInicio, dataFim: requested.dataFim,
    }
    Promise.all([getRegistos(scope, effective, pageSize, page * pageSize), getRegistoStatistics(scope, effective)])
      .then(([result, statistics]) => {
        if (version !== requestVersion.current) return
        setRows(result.rows); setTotal(result.total); setStats(statistics)
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 403) void refreshHospitals()
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os registos.' })
      })
      .finally(() => { if (version === requestVersion.current) setLoading(false) })
  }

  function applyFiltros(patch: Partial<RegistoFiltros>) {
    const next = { ...filtros, ...patch }
    setFiltros(next)
    setPage(0)
  }

  function clearFiltros() {
    setFiltros(emptyFiltros)
    setPage(0)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0) }, [scopeKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), [scopeKey, filtros, page, pageSize, loadingHospitals, accessVersion])
  useEffect(() => { exportVersion.current++; setExportOpen(false); setExportPreview(null) }, [scopeKey, filtros])
  const referenceHospitalId = writeHospitalId ?? (scope.kind === 'selected' && scope.ids.length === 1 ? scope.ids[0] : hospitals.length === 1 ? hospitals[0].id : null)
  useEffect(() => {
    if (!referenceHospitalId) return
    Promise.all([getUtentes(referenceHospitalId), listEspecialidades(referenceHospitalId), getDiagnosticos(referenceHospitalId), getProcedimentos(referenceHospitalId), getCatalogosRegisto(referenceHospitalId)])
      .then(([u, e, d, p, c]) => {
        setUtentes(u)
        setEspecialidades(e)
        setDiagnosticos(d)
        setProcedimentos(p)
        setCatalogos(c)
      })
      .catch(() =>
        toast.current?.show({
          severity: 'warn',
          summary: 'Aviso',
          detail: 'Não foi possível carregar todos os dados de referência.',
        }),
      )
  }, [referenceHospitalId])

  async function lookupProcesso() {
    if (!processoLookup.trim()) return
    setProcessoLoading(true)
    setProcessoMsg(null)
    try {
      if (!writeHospitalId) return
      const { utente } = await getUtenteByProcesso(processoLookup.trim(), writeHospitalId)
      if (utente) {
        setForm((f) => ({ ...f, utenteId: utente.id }))
        setProcessoMsg(`Utente encontrado: ${utente.nome ?? `Processo ${utente.processo}`}`)
      } else {
        setProcessoMsg('Nenhum utente encontrado com esse processo.')
      }
    } catch {
      setProcessoMsg('Erro ao pesquisar.')
    } finally {
      setProcessoLoading(false)
    }
  }

  function openCreate() {
    setWriteHospitalId(scope.kind === 'selected' && scope.ids.length === 1 ? scope.ids[0] : hospitals.length === 1 ? hospitals[0].id : null)
    setEditingId(null)
    setForm(emptyForm())
    setFormError(null)
    setProcessoLookup('')
    setProcessoMsg(null)
    setDialogOpen(true)
  }

  async function openEdit(row: RegistoMultiResumo) {
    setFormError(null)
    try {
      const r = await getRegisto(row.id, row.hospitalId)
      setWriteHospitalId(row.hospitalId)
      setEditingId(row.id)
      setForm({
        utenteId: r.utenteId,
        especialidadeId: r.especialidadeId,
        dataCirurgia: r.dataCirurgia,
        idadeCirurgia: r.idadeCirurgia,
        tipoDeCirurgiaId: r.tipoDeCirurgiaId,
        tipoDeAbordagemId: r.tipoDeAbordagemId,
        ambulatorio: r.ambulatorio,
        observacoes: r.observacoes,
        cirurgias: r.cirurgias.map((c) => ({
          diagnosticoId: c.diagnosticoId,
          procedimentoId: c.procedimentoId,
          tipo: c.tipo,
          funcaoCirurgiaoId: c.funcaoCirurgiaoId,
          clavienDindo: c.clavienDindo,
          anatomiaPatologica: c.anatomiaPatologica,
          observacoes: c.observacoes,
        })),
      })
      setDialogOpen(true)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível abrir o registo.' })
    }
  }

  function updateCirurgia(index: number, patch: Partial<CreateCirurgia>) {
    setForm((f) => ({
      ...f,
      cirurgias: f.cirurgias.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }))
  }

  function addCirurgia() {
    setForm((f) => ({ ...f, cirurgias: [...f.cirurgias, { ...emptyCirurgia }] }))
  }

  function removeCirurgia(index: number) {
    setForm((f) => ({ ...f, cirurgias: f.cirurgias.filter((_, i) => i !== index) }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!writeHospitalId) { setFormError('Escolha o hospital do registo.'); return }
    if (!form.utenteId || !form.tipoDeCirurgiaId) {
      setFormError('Selecione o utente e o tipo de cirurgia.')
      return
    }
    if (form.cirurgias.some((c) => !c.diagnosticoId || !c.procedimentoId)) {
      setFormError('Cada cirurgia precisa de um diagnóstico e de um procedimento.')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateRegisto(editingId, form, writeHospitalId)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Registo atualizado.' })
      } else {
        await createRegisto(form, writeHospitalId)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Registo criado.' })
      }
      setDialogOpen(false)
      setWriteHospitalId(null)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o registo.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: RegistoMultiResumo) {
    confirmDialog({
      message: `Eliminar o registo de ${row.utenteNome ?? `processo ${row.utenteProcesso}`} de ${formatDatePT(row.dataCirurgia)}?`,
      header: 'Eliminar registo',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteRegisto(row.id, row.hospitalId)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Registo eliminado.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar o registo.',
          })
        }
      },
    })
  }

  const utenteOptions = utentes.map((u) => ({
    label: u.nome ? `${u.nome} (${u.processo})` : `Processo ${u.processo}`,
    value: u.id,
  }))
  const singleHospital = selectedHospitals.length === 1
  const activeClinicalFilterCount = [
    filtros.diagnosticoId,
    filtros.procedimentoId,
    filtros.funcaoCirurgiaoId,
    filtros.tipoDeCirurgiaIds?.length ? filtros.tipoDeCirurgiaIds : undefined,
  ].filter(Boolean).length
  const hasActiveFilters = Object.values(filtros).some((value) => value !== undefined && (Array.isArray(value) ? value.length > 0 : true))
  useEffect(() => {
    if (singleHospital) return
    setFiltros((current) => current.diagnosticoId || current.procedimentoId || current.funcaoCirurgiaoId || current.tipoDeCirurgiaIds?.length
      ? { search: current.search, dataInicio: current.dataInicio, dataFim: current.dataFim } : current)
  }, [singleHospital])
  const maxRegistos = Math.max(1, ...(stats?.perHospital.map((h) => h.registos) ?? []))
  const comparison = stats?.perHospital.filter((h) => compareIds.includes(h.hospitalId)) ?? []

  async function openExport() {
    const version = ++exportVersion.current
    setExportPreview(null)
    setExportOpen(true)
    try { const count = (await getRegistoStatistics(scope, filtros)).totalRegistos; if (version === exportVersion.current) setExportPreview(count) }
    catch { toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível calcular a exportação.' }) }
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Registos Cirúrgicos</h1>
      <p className="page__subtitle">Os meus registos cirúrgicos nos hospitais selecionados.</p>
      <HospitalScopePicker scope={scope} hospitals={hospitals} label={scopeLabel} onChange={(next) => {
        setScope(next)
        setWriteHospitalId(null)
        setFiltros((current) => ({ search: current.search, dataInicio: current.dataInicio, dataFim: current.dataFim }))
        setPage(0)
      }} />
      {scopeError && <div className="crud-form__error" role="alert">{scopeError}</div>}
      <div role="status">{total.toLocaleString('pt-PT')} registos encontrados · {selectedHospitals.length} hospitais · Período: {filtros.dataInicio ?? 'início'} — {filtros.dataFim ?? 'hoje'}</div>

      <div className="crud-toolbar">
        <span />
        <Button
          label="Exportar dados"
          icon="pi pi-file-excel"
          outlined
          loading={exporting}
          disabled={loading || loadingHospitals || hospitals.length === 0}
          onClick={openExport}
        />
        <Button label="Criar registo" icon="pi pi-plus" onClick={openCreate} disabled={hospitals.length === 0} />
      </div>

      <div className="registo-filter-section">
      <div className="registo-filterbar">
        <div className="registo-filterbar__search">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText
            aria-label="Pesquisar utente ou processo"
            placeholder="Pesquisar utente ou processo..."
            value={filtros.search ?? ''}
            onChange={(e) => applyFiltros({ search: e.target.value || undefined })}
          />
        </div>
        <Calendar
          className="registo-filterbar__date"
          aria-label="Data inicial"
          placeholder="Data inicial"
          dateFormat="dd/mm/yy"
          value={filtros.dataInicio ? fromISODate(filtros.dataInicio) : null}
          onChange={(e) => applyFiltros({ dataInicio: e.value ? toISODate(e.value) : undefined })}
          showButtonBar
        />
        <Calendar
          className="registo-filterbar__date"
          aria-label="Data final"
          placeholder="Data final"
          dateFormat="dd/mm/yy"
          value={filtros.dataFim ? fromISODate(filtros.dataFim) : null}
          onChange={(e) => applyFiltros({ dataFim: e.value ? toISODate(e.value) : undefined })}
          showButtonBar
        />
        <Button type="button" className="registo-filterbar__more" label="Mais filtros"
          icon="pi pi-sliders-h" badge={activeClinicalFilterCount ? String(activeClinicalFilterCount) : undefined}
          outlined onClick={() => setFiltersOpen(true)} />
        {hasActiveFilters && (
          <Button type="button" className="registo-filterbar__clear" label="Limpar" text onClick={clearFiltros} />
        )}
      </div>

      {hasActiveFilters && <div className="registo-filter-chips" aria-label="Filtros ativos">
        {filtros.search && <button type="button" className="registo-filter-chip" onClick={() => applyFiltros({ search: undefined })}>
          Pesquisa: {filtros.search}<i className="pi pi-times" aria-hidden="true" />
        </button>}
        {filtros.dataInicio && <button type="button" className="registo-filter-chip" onClick={() => applyFiltros({ dataInicio: undefined })}>
          Desde {formatDatePT(filtros.dataInicio)}<i className="pi pi-times" aria-hidden="true" />
        </button>}
        {filtros.dataFim && <button type="button" className="registo-filter-chip" onClick={() => applyFiltros({ dataFim: undefined })}>
          Até {formatDatePT(filtros.dataFim)}<i className="pi pi-times" aria-hidden="true" />
        </button>}
        {filtros.diagnosticoId && <button type="button" className="registo-filter-chip" onClick={() => applyFiltros({ diagnosticoId: undefined })}>
          Diagnóstico: {diagnosticos.find((item) => item.id === filtros.diagnosticoId)?.nome ?? 'Selecionado'}<i className="pi pi-times" aria-hidden="true" />
        </button>}
        {filtros.procedimentoId && <button type="button" className="registo-filter-chip" onClick={() => applyFiltros({ procedimentoId: undefined })}>
          Procedimento: {procedimentos.find((item) => item.id === filtros.procedimentoId)?.nome ?? 'Selecionado'}<i className="pi pi-times" aria-hidden="true" />
        </button>}
        {filtros.funcaoCirurgiaoId && <button type="button" className="registo-filter-chip" onClick={() => applyFiltros({ funcaoCirurgiaoId: undefined })}>
          Função: {catalogos.funcoesCirurgiao.find((item) => item.id === filtros.funcaoCirurgiaoId)?.nome ?? 'Selecionada'}<i className="pi pi-times" aria-hidden="true" />
        </button>}
        {filtros.tipoDeCirurgiaIds?.map((id) => <button key={id} type="button" className="registo-filter-chip" onClick={() => {
          const ids = filtros.tipoDeCirurgiaIds?.filter((current) => current !== id) ?? []
          applyFiltros({ tipoDeCirurgiaIds: ids.length ? ids : undefined })
        }}>
          Tipo: {catalogos.tiposDeCirurgia.find((item) => item.id === id)?.nome ?? 'Selecionado'}<i className="pi pi-times" aria-hidden="true" />
        </button>)}
      </div>}
      </div>

      <Sidebar visible={filtersOpen} onHide={() => setFiltersOpen(false)} position="right" header="Filtros clínicos"
        className="registo-filter-sidebar" style={{ width: 'min(92vw, 440px)' }}>
        <div className="registo-filter-drawer">
        <p className="registo-filter-drawer__hint">Refine os registos por dados clínicos. As alterações são aplicadas automaticamente.</p>
        {!singleHospital && <div className="registo-filter-drawer__notice">Selecione um único hospital para usar estes filtros clínicos.</div>}
        <div className="registo-filter-drawer__field">
          <label htmlFor="filtro-diagnostico">Diagnóstico</label>
        <Dropdown
          inputId="filtro-diagnostico"
          disabled={!singleHospital}
          showClear
          placeholder="Todos os diagnósticos"
          value={filtros.diagnosticoId ?? null}
          options={diagnosticos}
          optionLabel="nome"
          optionValue="id"
          filter
          onChange={(e) => applyFiltros({ diagnosticoId: e.value ?? undefined })}
        />
        </div>
        <div className="registo-filter-drawer__field">
          <label htmlFor="filtro-procedimento">Procedimento</label>
        <Dropdown
          inputId="filtro-procedimento"
          disabled={!singleHospital}
          showClear
          placeholder="Todos os procedimentos"
          value={filtros.procedimentoId ?? null}
          options={procedimentos}
          optionLabel="nome"
          optionValue="id"
          filter
          onChange={(e) => applyFiltros({ procedimentoId: e.value ?? undefined })}
        />
        </div>
        <div className="registo-filter-drawer__field">
          <label htmlFor="filtro-funcao">Função</label>
        <Dropdown
          inputId="filtro-funcao"
          disabled={!singleHospital}
          showClear
          placeholder="Todas as funções"
          value={filtros.funcaoCirurgiaoId ?? null}
          options={catalogos.funcoesCirurgiao}
          optionLabel="nome"
          optionValue="id"
          onChange={(e) => applyFiltros({ funcaoCirurgiaoId: e.value ?? undefined })}
        />
        </div>
        <div className="registo-filter-drawer__field">
          <label htmlFor="filtro-tipo-cirurgia">Tipo de cirurgia</label>
        <MultiSelect
          inputId="filtro-tipo-cirurgia"
          disabled={!singleHospital}
          placeholder="Todos os tipos"
          value={filtros.tipoDeCirurgiaIds ?? []}
          options={catalogos.tiposDeCirurgia}
          optionLabel="nome"
          optionValue="id"
          filter
          maxSelectedLabels={1}
          selectedItemsLabel="{0} tipos selecionados"
          onChange={(e) => applyFiltros({ tipoDeCirurgiaIds: e.value?.length ? e.value : undefined })}
        />
        </div>
        <div className="registo-filter-drawer__footer">
          <Button type="button" label="Limpar filtros" text onClick={clearFiltros} disabled={!hasActiveFilters} />
          <Button type="button" label="Concluído" onClick={() => setFiltersOpen(false)} />
        </div>
        </div>
      </Sidebar>

      <div className="scope-tabs" role="group" aria-label="Visão dos registos">
        {([['overview', 'Visão geral'], ['hospitals', 'Por hospital'], ['compare', 'Comparar'], ['records', 'Registos']] as const).map(([id, label]) =>
          <Button key={id} type="button" label={label} outlined={view !== id} onClick={() => setView(id)} />)}
      </div>

      {view === 'overview' && stats && <section aria-label="Visão geral" className="scope-panel">
        <div className="dash-grid">
          <div className="dash-card"><div className="dash-card__label">Os meus registos cirúrgicos</div><div className="dash-card__value">{stats.totalRegistos.toLocaleString('pt-PT')}</div></div>
          <div className="dash-card"><div className="dash-card__label">Cirurgias nos registos</div><div className="dash-card__value">{stats.totalCirurgias.toLocaleString('pt-PT')}</div></div>
        </div>
        <h2 className="dash-section__title">Evolução mensal</h2>
        <div className="scope-bars">{stats.evolution.map((m) => <div key={m.month} className="scope-bar-row"><span>{m.month}</span><div style={{ width: `${Math.max(2, 100 * m.registos / Math.max(1, ...stats.evolution.map((x) => x.registos)))}%` }} /><strong>{m.registos}</strong></div>)}</div>
      </section>}

      {view === 'hospitals' && stats && <section aria-label="Registos por hospital" className="scope-panel">
        <h2 className="dash-section__title">Por hospital</h2>
        <div className="crud-table"><DataTable value={stats.perHospital} paginator rows={10} sortField="registos" sortOrder={-1}>
          <Column field="hospitalNome" header="Hospital" sortable />
          <Column field="registos" header="Registos" sortable />
          <Column field="cirurgias" header="Cirurgias" sortable />
          <Column header="Distribuição" body={(h: RegistoStatistics['perHospital'][number]) => `${Math.round(100 * h.registos / Math.max(1, stats.totalRegistos))}%`} />
        </DataTable></div>
      </section>}

      {view === 'compare' && stats && <section aria-label="Comparar hospitais" className="scope-panel">
        <h2 className="dash-section__title">Comparar volumes dos meus registos</h2>
        <p>Escolha até cinco hospitais. Estes volumes não medem desempenho clínico.</p>
        <MultiSelect value={compareIds} options={stats.perHospital.map((h) => ({ label: h.hospitalNome, value: h.hospitalId }))}
          placeholder="Hospitais para comparar" onChange={(e) => setCompareIds((e.value as string[]).slice(0, 5))} maxSelectedLabels={3} />
        <div className="scope-bars">{comparison.map((h) => <div key={h.hospitalId} className="scope-bar-row"><span>{h.hospitalNome}</span><div style={{ width: `${Math.max(2, 100 * h.registos / maxRegistos)}%` }} /><strong>{h.registos}</strong></div>)}</div>
      </section>}

      {view === 'records' && <div className="crud-table">
        <DataTable
          responsiveLayout="stack"
          breakpoint="767px"
          value={rows}
          loading={loading}
          emptyMessage="Nenhum registo encontrado."
          lazy
          paginator
          first={page * pageSize}
          totalRecords={total}
          onPage={(e) => { setPage(Math.floor(e.first / e.rows)); setPageSize(e.rows) }}
          rows={pageSize}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column header="Data" body={(r: RegistoMultiResumo) => formatDatePT(r.dataCirurgia)} />
          <Column field="hospitalNome" header="Hospital" />
          <Column
            header="Utente"
            body={(r: RegistoMultiResumo) => r.utenteNome ?? `Processo ${r.utenteProcesso}`}
          />
          <Column header="Especialidade" body={(r: RegistoMultiResumo) => r.especialidadeNome ?? '—'} />
          <Column header="Tipo" body={(r: RegistoMultiResumo) => r.tipoDeCirurgiaNome ?? '—'} />
          <Column header="Abordagem" body={(r: RegistoMultiResumo) => r.tipoDeAbordagemNome ?? '—'} />
          <Column header="Ambulatório" body={(r: RegistoMultiResumo) => (r.ambulatorio ? 'Sim' : '—')} />
          <Column header="Nº cirurgias" body={(r: RegistoMultiResumo) => r.numeroCirurgias} />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(r: RegistoMultiResumo) => (
              <div className="crud-actions">
                <Button icon="pi pi-pencil" text rounded aria-label={`Editar registo de ${r.hospitalNome}`} onClick={() => openEdit(r)} />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  severity="danger"
                  aria-label="Eliminar"
                  onClick={() => confirmDelete(r)}
                />
              </div>
            )}
          />
        </DataTable>
      </div>}

      <Dialog header="Confirmar exportação" visible={exportOpen} onHide={() => setExportOpen(false)} style={{ width: 'min(92vw, 520px)' }}>
        <dl className="export-summary">
          <dt>Tema</dt><dd>Registos cirúrgicos</dd>
          <dt>Hospitais</dt><dd>{scopeLabel}: {selectedHospitals.map((h) => h.nome).join(', ')}</dd>
          <dt>Período</dt><dd>{filtros.dataInicio ?? 'Sem início definido'} — {filtros.dataFim ?? 'Sem fim definido'}</dd>
          <dt>Pesquisa</dt><dd>{filtros.search ?? 'Sem pesquisa'}</dd>
          <dt>Registos previstos</dt><dd>{exportPreview === null ? 'A calcular…' : exportPreview.toLocaleString('pt-PT')}</dd>
        </dl>
        <div className="crud-form__actions">
          <Button type="button" label="Cancelar" text onClick={() => setExportOpen(false)} />
          <Button type="button" label={`Exportar ${exportPreview?.toLocaleString('pt-PT') ?? '…'} registos`} disabled={exportPreview === null || exportPreview === 0} loading={exporting}
            onClick={async () => {
              setExporting(true)
              try { await exportRegistos(scope, filtros); setExportOpen(false) }
              catch { toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível exportar.' }) }
              finally { setExporting(false) }
            }} />
        </div>
      </Dialog>

      <Dialog
        header={editingId ? 'Editar registo' : 'Criar registo'}
        visible={dialogOpen}
        onHide={() => { setDialogOpen(false); setWriteHospitalId(null) }}
        style={{ width: '760px' }}
        breakpoints={{ '960px': '95vw' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="registo-hospital">Hospital do registo</label>
            <Dropdown inputId="registo-hospital" filter disabled={!!editingId} value={writeHospitalId} options={hospitals}
              optionLabel="nome" optionValue="id" placeholder="Escolher hospital" onChange={(e) => {
                setWriteHospitalId(e.value)
                setForm(emptyForm())
                setUtentes([]); setDiagnosticos([]); setProcedimentos([]); setCatalogos(emptyCatalogos)
              }} />
          </div>
          {!writeHospitalId && <p>Escolha um hospital para preencher o registo.</p>}
          <fieldset disabled={!writeHospitalId} style={{ border: 0, padding: 0, margin: 0 }}>
          {!editingId && (
            <div className="crud-field">
              <label htmlFor="registo-processo">Procurar por nº de processo</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <InputText
                  id="registo-processo"
                  value={processoLookup}
                  placeholder="Nº processo..."
                  style={{ flex: 1 }}
                  onChange={(e) => { setProcessoLookup(e.target.value); setProcessoMsg(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupProcesso() } }}
                />
                <Button
                  type="button"
                  icon="pi pi-search"
                  loading={processoLoading}
                  onClick={lookupProcesso}
                  disabled={!processoLookup.trim()}
                />
              </div>
              {processoMsg && (
                <small style={{ color: form.utenteId ? 'var(--green-600)' : 'var(--orange-600)' }}>
                  {processoMsg}
                </small>
              )}
            </div>
          )}
          <div className="crud-field">
            <label htmlFor="registo-utente">Utente</label>
            <Dropdown
              inputId="registo-utente"
              filter
              value={form.utenteId}
              options={utenteOptions}
              placeholder="Selecionar utente"
              onChange={(e) => setForm((f) => ({ ...f, utenteId: e.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="registo-especialidade">Especialidade (opcional)</label>
            <Dropdown
              inputId="registo-especialidade"
              showClear
              value={form.especialidadeId}
              options={especialidades}
              optionLabel="nome"
              optionValue="id"
              placeholder="Selecionar especialidade"
              onChange={(e) => setForm((f) => ({ ...f, especialidadeId: e.value ?? null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="registo-data">Data da cirurgia</label>
            <Calendar
              inputId="registo-data"
              required
              dateFormat="dd/mm/yy"
              value={fromISODate(form.dataCirurgia)}
              onChange={(e) => setForm((f) => ({ ...f, dataCirurgia: e.value ? toISODate(e.value) : f.dataCirurgia }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="registo-idade">Idade na cirurgia (opcional)</label>
            <InputNumber
              inputId="registo-idade"
              value={form.idadeCirurgia}
              min={0}
              max={150}
              onChange={(e) => setForm((f) => ({ ...f, idadeCirurgia: e.value ?? null }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="registo-tipo">Tipo de cirurgia</label>
            <Dropdown
              inputId="registo-tipo"
              value={form.tipoDeCirurgiaId}
              options={catalogos.tiposDeCirurgia}
              optionLabel="nome"
              optionValue="id"
              placeholder="Selecionar tipo"
              onChange={(e) => setForm((f) => ({ ...f, tipoDeCirurgiaId: e.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="registo-abordagem">Tipo de abordagem (opcional)</label>
            <Dropdown
              inputId="registo-abordagem"
              showClear
              value={form.tipoDeAbordagemId}
              options={catalogos.tiposDeAbordagem}
              optionLabel="nome"
              optionValue="id"
              placeholder="Selecionar abordagem"
              onChange={(e) => setForm((f) => ({ ...f, tipoDeAbordagemId: e.value ?? null }))}
            />
          </div>
          <div className="crud-field crud-field--inline">
            <Checkbox
              inputId="registo-ambulatorio"
              checked={form.ambulatorio ?? false}
              onChange={(e) => setForm((f) => ({ ...f, ambulatorio: e.checked ?? false }))}
            />
            <label htmlFor="registo-ambulatorio">Ambulatório</label>
          </div>
          <div className="crud-field">
            <label htmlFor="registo-obs">Observações</label>
            <InputTextarea
              id="registo-obs"
              rows={2}
              value={form.observacoes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value || null }))}
            />
          </div>

          <div className="dash-section__title">Cirurgias</div>
          {form.cirurgias.map((c, i) => (
            <div key={i} className="registo-cirurgia">
              <div className="registo-cirurgia__head">
                <span>Cirurgia {i + 1}</span>
                {form.cirurgias.length > 1 && (
                  <Button
                    type="button"
                    icon="pi pi-times"
                    text
                    rounded
                    severity="danger"
                    aria-label="Remover cirurgia"
                    onClick={() => removeCirurgia(i)}
                  />
                )}
              </div>
              <div className="crud-field">
                <label>Diagnóstico</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <Dropdown
                    filter
                    value={c.diagnosticoId}
                    options={diagnosticos}
                    optionLabel="nome"
                    optionValue="id"
                    placeholder="Selecionar diagnóstico"
                    style={{ flex: 1 }}
                    onChange={(e) => updateCirurgia(i, { diagnosticoId: e.value })}
                  />
                  <Button
                    type="button"
                    icon="pi pi-plus"
                    text
                    rounded
                    size="small"
                    aria-label="Criar diagnóstico"
                    onClick={() => setQuickAddDiagForIndex(i)}
                  />
                </div>
              </div>
              <div className="crud-field">
                <label>Procedimento</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <Dropdown
                    filter
                    value={c.procedimentoId}
                    options={procedimentos}
                    optionLabel="nome"
                    optionValue="id"
                    placeholder="Selecionar procedimento"
                    style={{ flex: 1 }}
                    onChange={(e) => updateCirurgia(i, { procedimentoId: e.value })}
                  />
                  <Button
                    type="button"
                    icon="pi pi-plus"
                    text
                    rounded
                    size="small"
                    aria-label="Criar procedimento"
                    onClick={() => setQuickAddProcForIndex(i)}
                  />
                </div>
              </div>
              <div className="crud-field">
                <label>Classificação (opcional)</label>
                <Dropdown
                  showClear
                  value={c.tipo}
                  options={TIPO_LESAO_OPTIONS}
                  placeholder="Benigno / Maligno"
                  onChange={(e) => updateCirurgia(i, { tipo: e.value ?? null })}
                />
              </div>
              <div className="crud-field">
                <label>Função do cirurgião (opcional)</label>
                <Dropdown
                  showClear
                  value={c.funcaoCirurgiaoId}
                  options={catalogos.funcoesCirurgiao}
                  optionLabel="nome"
                  optionValue="id"
                  placeholder="Selecionar função"
                  onChange={(e) => updateCirurgia(i, { funcaoCirurgiaoId: e.value ?? null })}
                />
              </div>
              <div className="crud-field">
                <label>Clavien-Dindo (opcional)</label>
                <Dropdown
                  showClear
                  value={c.clavienDindo}
                  options={CLAVIEN_OPTIONS}
                  placeholder="Grau de complicação"
                  onChange={(e) => updateCirurgia(i, { clavienDindo: e.value ?? null })}
                />
              </div>
            </div>
          ))}
          <Button type="button" label="Adicionar cirurgia" icon="pi pi-plus" text onClick={addCirurgia} />
          </fieldset>

          {formError && <div className="crud-form__error">{formError}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={() => { setDialogOpen(false); setWriteHospitalId(null) }} disabled={saving} />
            <Button type="submit" label="Guardar" loading={saving} disabled={!writeHospitalId} />
          </div>
        </form>
      </Dialog>

      <QuickAddDiagnostico
        hospitalId={writeHospitalId ?? ''}
        visible={quickAddDiagForIndex !== null}
        onHide={() => setQuickAddDiagForIndex(null)}
        onCreated={(d) => {
          setDiagnosticos((prev) => [...prev, d])
          if (quickAddDiagForIndex !== null) updateCirurgia(quickAddDiagForIndex, { diagnosticoId: d.id })
          setQuickAddDiagForIndex(null)
        }}
      />

      <QuickAddProcedimento
        hospitalId={writeHospitalId ?? ''}
        visible={quickAddProcForIndex !== null}
        onHide={() => setQuickAddProcForIndex(null)}
        onCreated={(p) => {
          setProcedimentos((prev) => [...prev, p])
          if (quickAddProcForIndex !== null) updateCirurgia(quickAddProcForIndex, { procedimentoId: p.id })
          setQuickAddProcForIndex(null)
        }}
      />
    </div>
  )
}
