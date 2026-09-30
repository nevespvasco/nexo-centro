import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
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
  RegistoResumo,
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
  getUtenteByProcesso,
  getUtentes,
  listEspecialidades,
  updateRegisto,
  type Diagnostico,
  type EspecialidadeRow,
  type Procedimento,
  type RegistoFiltros,
  type Utente,
} from '../lib/api'
import { formatDatePT, fromISODate, toISODate } from '../lib/date'
import { QuickAddDiagnostico, QuickAddProcedimento } from '../components/QuickAddDialogs'
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
  const [rows, setRows] = useState<RegistoResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [utentes, setUtentes] = useState<Utente[]>([])
  const [especialidades, setEspecialidades] = useState<EspecialidadeRow[]>([])
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [catalogos, setCatalogos] = useState<CatalogosRegisto>(emptyCatalogos)
  const [filtros, setFiltros] = useState<RegistoFiltros>(emptyFiltros)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateRegisto>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [quickAddDiagForIndex, setQuickAddDiagForIndex] = useState<number | null>(null)
  const [quickAddProcForIndex, setQuickAddProcForIndex] = useState<number | null>(null)
  const [processoLookup, setProcessoLookup] = useState('')
  const [processoLoading, setProcessoLoading] = useState(false)
  const [processoMsg, setProcessoMsg] = useState<string | null>(null)

  function load(f?: RegistoFiltros) {
    setLoading(true)
    getRegistos(f ?? filtros)
      .then(setRows)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os registos.' }),
      )
      .finally(() => setLoading(false))
  }

  function applyFiltros(patch: Partial<RegistoFiltros>) {
    const next = { ...filtros, ...patch }
    setFiltros(next)
    load(next)
  }

  function clearFiltros() {
    setFiltros(emptyFiltros)
    load(emptyFiltros)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), [])
  useEffect(() => {
    Promise.all([getUtentes(), listEspecialidades(), getDiagnosticos(), getProcedimentos(), getCatalogosRegisto()])
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
  }, [])

  async function lookupProcesso() {
    if (!processoLookup.trim()) return
    setProcessoLoading(true)
    setProcessoMsg(null)
    try {
      const { utente } = await getUtenteByProcesso(processoLookup.trim())
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
    setEditingId(null)
    setForm(emptyForm())
    setFormError(null)
    setProcessoLookup('')
    setProcessoMsg(null)
    setDialogOpen(true)
  }

  async function openEdit(id: string) {
    setFormError(null)
    try {
      const r = await getRegisto(id)
      setEditingId(id)
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
        await updateRegisto(editingId, form)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Registo atualizado.' })
      } else {
        await createRegisto(form)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Registo criado.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o registo.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: RegistoResumo) {
    confirmDialog({
      message: `Eliminar o registo de ${row.utenteNome ?? `processo ${row.utenteProcesso}`} de ${formatDatePT(row.dataCirurgia)}?`,
      header: 'Eliminar registo',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteRegisto(row.id)
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

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Registos Cirúrgicos</h1>
      <p className="page__subtitle">Registo de atos cirúrgicos e das intervenções realizadas.</p>

      <div className="crud-toolbar">
        <span />
        <Button
          label="Exportar"
          icon="pi pi-file-excel"
          outlined
          loading={exporting}
          onClick={async () => {
            setExporting(true)
            try { await exportRegistos(filtros) }
            catch { toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível exportar.' }) }
            finally { setExporting(false) }
          }}
        />
        <Button label="Criar registo" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <div className="crud-filters">
        <InputText
          placeholder="Pesquisar utente..."
          value={filtros.search ?? ''}
          onChange={(e) => applyFiltros({ search: e.target.value || undefined })}
          style={{ flex: '1 1 180px' }}
        />
        <Calendar
          placeholder="Data início"
          dateFormat="dd/mm/yy"
          value={filtros.dataInicio ? fromISODate(filtros.dataInicio) : null}
          onChange={(e) => applyFiltros({ dataInicio: e.value ? toISODate(e.value) : undefined })}
          showButtonBar
          style={{ flex: '1 1 140px' }}
        />
        <Calendar
          placeholder="Data fim"
          dateFormat="dd/mm/yy"
          value={filtros.dataFim ? fromISODate(filtros.dataFim) : null}
          onChange={(e) => applyFiltros({ dataFim: e.value ? toISODate(e.value) : undefined })}
          showButtonBar
          style={{ flex: '1 1 140px' }}
        />
        <Dropdown
          showClear
          placeholder="Diagnóstico"
          value={filtros.diagnosticoId ?? null}
          options={diagnosticos}
          optionLabel="nome"
          optionValue="id"
          filter
          onChange={(e) => applyFiltros({ diagnosticoId: e.value ?? undefined })}
          style={{ flex: '1 1 160px' }}
        />
        <Dropdown
          showClear
          placeholder="Procedimento"
          value={filtros.procedimentoId ?? null}
          options={procedimentos}
          optionLabel="nome"
          optionValue="id"
          filter
          onChange={(e) => applyFiltros({ procedimentoId: e.value ?? undefined })}
          style={{ flex: '1 1 160px' }}
        />
        <Dropdown
          showClear
          placeholder="Função"
          value={filtros.funcaoCirurgiaoId ?? null}
          options={catalogos.funcoesCirurgiao}
          optionLabel="nome"
          optionValue="id"
          onChange={(e) => applyFiltros({ funcaoCirurgiaoId: e.value ?? undefined })}
          style={{ flex: '1 1 140px' }}
        />
        <MultiSelect
          placeholder="Tipo de cirurgia"
          value={filtros.tipoDeCirurgiaIds ?? []}
          options={catalogos.tiposDeCirurgia}
          optionLabel="nome"
          optionValue="id"
          onChange={(e) => applyFiltros({ tipoDeCirurgiaIds: e.value?.length ? e.value : undefined })}
          style={{ flex: '1 1 160px' }}
        />
        {Object.values(filtros).some((v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)) && (
          <Button icon="pi pi-filter-slash" text rounded severity="secondary" aria-label="Limpar filtros" onClick={clearFiltros} />
        )}
      </div>

      <div className="crud-table">
        <DataTable
          responsiveLayout="stack"
          breakpoint="767px"
          value={rows}
          loading={loading}
          emptyMessage="Nenhum registo encontrado."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column header="Data" body={(r: RegistoResumo) => formatDatePT(r.dataCirurgia)} sortable sortField="dataCirurgia" />
          <Column
            header="Utente"
            body={(r: RegistoResumo) => r.utenteNome ?? `Processo ${r.utenteProcesso}`}
          />
          <Column header="Especialidade" body={(r: RegistoResumo) => r.especialidadeNome ?? '—'} />
          <Column header="Tipo" body={(r: RegistoResumo) => r.tipoDeCirurgiaNome ?? '—'} />
          <Column header="Abordagem" body={(r: RegistoResumo) => r.tipoDeAbordagemNome ?? '—'} />
          <Column header="Ambulatório" body={(r: RegistoResumo) => (r.ambulatorio ? 'Sim' : '—')} />
          <Column header="Nº cirurgias" body={(r: RegistoResumo) => r.numeroCirurgias} />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(r: RegistoResumo) => (
              <div className="crud-actions">
                <Button icon="pi pi-pencil" text rounded aria-label="Editar" onClick={() => openEdit(r.id)} />
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
      </div>

      <Dialog
        header={editingId ? 'Editar registo' : 'Criar registo'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '760px' }}
        breakpoints={{ '960px': '95vw' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
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

          {formError && <div className="crud-form__error">{formError}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button type="submit" label="Guardar" loading={saving} />
          </div>
        </form>
      </Dialog>

      <QuickAddDiagnostico
        visible={quickAddDiagForIndex !== null}
        onHide={() => setQuickAddDiagForIndex(null)}
        onCreated={(d) => {
          setDiagnosticos((prev) => [...prev, d])
          if (quickAddDiagForIndex !== null) updateCirurgia(quickAddDiagForIndex, { diagnosticoId: d.id })
          setQuickAddDiagForIndex(null)
        }}
      />

      <QuickAddProcedimento
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
