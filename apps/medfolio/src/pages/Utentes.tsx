import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import {
  ApiError,
  createUtente,
  deleteUtente,
  exportUtentes,
  getUtentesMulti,
  updateUtente,
  type Utente,
  type UtenteMulti,
  type UtenteBody,
} from '../lib/api'
import { calculateAge, fromISODate, toISODate } from '../lib/date'
import { useHospitalScope } from '../lib/hospitalScope'
import { scopeParams } from '../lib/hospitalScopeModel'
import { HospitalScopePicker } from '../components/HospitalScopePicker'
import '../styles/crud.scss'

const SEXO_OPTIONS = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Feminino', value: 'feminino' },
  { label: 'Outro', value: 'outro' },
]

const emptyForm: UtenteBody = { nome: '', processo: '', sexo: null, dataNascimento: null }

export function Utentes() {
  const { scope, setScope, hospitals, selectedHospitals, label, loadingHospitals, scopeError, accessVersion, refreshHospitals } = useHospitalScope()
  const scopeKey = scope.kind === 'all' ? 'all' : scope.ids.join(',')
  const navigate = useNavigate()
  const toast = useRef<Toast>(null)
  const requestVersion = useRef(0)
  const exportVersion = useRef(0)
  const [utentes, setUtentes] = useState<UtenteMulti[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Utente | null>(null)
  const [form, setForm] = useState<UtenteBody>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [writeHospitalId, setWriteHospitalId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportCount, setExportCount] = useState<number | null>(null)

  function load() {
    if (loadingHospitals) return
    const version = ++requestVersion.current
    setLoading(true)
    setUtentes([]); setTotal(0)
    getUtentesMulti(scope, pageSize, page * pageSize, filter)
      .then((result) => { if (version === requestVersion.current) { setUtentes(result.rows); setTotal(result.total) } })
      .catch((error) => {
        if (version !== requestVersion.current) return
        if (error instanceof ApiError && error.status === 403) void refreshHospitals()
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os utentes.' })
      })
      .finally(() => { if (version === requestVersion.current) setLoading(false) })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0) }, [scopeKey, filter])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), [scopeKey, filter, page, pageSize, loadingHospitals, accessVersion])
  useEffect(() => { exportVersion.current++; setExportOpen(false); setExportCount(null) }, [scopeKey, filter])

  async function openExport() {
    const version = ++exportVersion.current
    setExportCount(null); setExportOpen(true)
    try { const count = (await getUtentesMulti(scope, 1, 0, filter)).total; if (version === exportVersion.current) setExportCount(count) }
    catch { toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível calcular a exportação.' }) }
  }

  function openCreate() {
    setWriteHospitalId(selectedHospitals.length === 1 ? selectedHospitals[0].id : null)
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: UtenteMulti) {
    setWriteHospitalId(row.hospitalId)
    setEditing(row)
    setForm({ nome: row.nome ?? '', processo: row.processo, sexo: row.sexo, dataNascimento: row.dataNascimento })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!writeHospitalId) { setFormError('Escolha o hospital do utente.'); return }
    setSaving(true)
    try {
      if (editing) {
        await updateUtente(editing.id, form, writeHospitalId)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Utente atualizado.' })
      } else {
        await createUtente(form, writeHospitalId)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Utente criado.' })
      }
      setDialogOpen(false)
      setWriteHospitalId(null)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o utente.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: UtenteMulti) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome ?? row.processo}"?`,
      header: 'Eliminar utente',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteUtente(row.id, row.hospitalId)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Utente eliminado.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar o utente.',
          })
        }
      },
    })
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Utentes</h1>
      <p className="page__subtitle">Os meus utentes nos hospitais selecionados.</p>
      <HospitalScopePicker scope={scope} hospitals={hospitals} label={label} onChange={(next) => { setScope(next); setPage(0) }} />
      {scopeError && <div className="crud-form__error" role="alert">{scopeError}</div>}
      <div role="status">{total.toLocaleString('pt-PT')} utentes · {selectedHospitals.length} hospitais</div>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar utentes..." />
        </span>
        <Button label="Exportar dados" icon="pi pi-file-excel" outlined onClick={openExport} disabled={loading || hospitals.length === 0} />
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} disabled={hospitals.length === 0} />
      </div>

      <Dialog header="Confirmar exportação" visible={exportOpen} onHide={() => setExportOpen(false)} style={{ width: 'min(92vw, 520px)' }}>
        <dl className="export-summary">
          <dt>Tema</dt><dd>Utentes</dd>
          <dt>Hospitais</dt><dd>{label}: {selectedHospitals.map((h) => h.nome).join(', ')}</dd>
          <dt>Pesquisa</dt><dd>{filter || 'Sem pesquisa'}</dd>
          <dt>Utentes previstos</dt><dd>{exportCount === null ? 'A calcular…' : exportCount.toLocaleString('pt-PT')}</dd>
        </dl>
        <div className="crud-form__actions">
          <Button label="Cancelar" text onClick={() => setExportOpen(false)} />
          <Button label={`Exportar ${exportCount?.toLocaleString('pt-PT') ?? '…'} utentes`} disabled={exportCount === null || exportCount === 0} loading={exporting}
            onClick={async () => {
              setExporting(true)
              try { await exportUtentes(scope, filter); setExportOpen(false) }
              catch { toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível exportar.' }) }
              finally { setExporting(false) }
            }} />
        </div>
      </Dialog>

      <div className="crud-table">
        <DataTable
          responsiveLayout="stack"
          breakpoint="767px"
          value={utentes}
          loading={loading}
          emptyMessage="Nenhum utente encontrado."
          lazy
          paginator
          first={page * pageSize}
          totalRecords={total}
          onPage={(e) => { setPage(Math.floor(e.first / e.rows)); setPageSize(e.rows) }}
          rows={pageSize}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="nome" header="Nome" />
          <Column field="hospitalNome" header="Hospital" />
          <Column field="processo" header="Nº Processo" />
          <Column header="Sexo" body={(row: Utente) => SEXO_OPTIONS.find((o) => o.value === row.sexo)?.label ?? '—'} />
          <Column header="Idade" body={(row: Utente) => calculateAge(row.dataNascimento) ?? '—'} />
          <Column
            header=""
            style={{ width: '140px' }}
            body={(row: UtenteMulti) => (
              <div className="crud-actions">
                <Button
                  icon="pi pi-eye"
                  text
                  rounded
                  aria-label="Ver"
                  onClick={() => navigate(`/utentes/${row.id}?hospitalId=${row.hospitalId}&return=${encodeURIComponent(scopeParams(scope).toString())}`)}
                />
                <Button icon="pi pi-pencil" text rounded aria-label="Editar" onClick={() => openEdit(row)} />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  severity="danger"
                  aria-label="Eliminar"
                  onClick={() => confirmDelete(row)}
                />
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog
        header={editing ? 'Editar utente' : 'Criar utente'}
        visible={dialogOpen}
        onHide={() => { setDialogOpen(false); setWriteHospitalId(null) }}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="utente-hospital">Hospital do utente</label>
            <Dropdown inputId="utente-hospital" filter disabled={!!editing} value={writeHospitalId} options={hospitals}
              optionLabel="nome" optionValue="id" placeholder="Escolher hospital" onChange={(e) => setWriteHospitalId(e.value)} />
          </div>
          <fieldset disabled={!writeHospitalId} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="crud-field">
            <label htmlFor="utente-nome">Nome completo</label>
            <InputText
              id="utente-nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="utente-processo">Nº Processo</label>
            <InputText
              id="utente-processo"
              required
              value={form.processo}
              onChange={(e) => setForm((f) => ({ ...f, processo: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="utente-sexo">Sexo</label>
            <Dropdown
              inputId="utente-sexo"
              value={form.sexo}
              options={SEXO_OPTIONS}
              onChange={(e) => setForm((f) => ({ ...f, sexo: e.value }))}
              placeholder="Selecionar"
              showClear
            />
          </div>
          <div className="crud-field">
            <label htmlFor="utente-nascimento">Data de nascimento</label>
            <Calendar
              inputId="utente-nascimento"
              value={fromISODate(form.dataNascimento)}
              onChange={(e) => setForm((f) => ({ ...f, dataNascimento: e.value ? toISODate(e.value as Date) : null }))}
              dateFormat="dd/mm/yy"
              showIcon
              maxDate={new Date()}
            />
          </div>
          </fieldset>
          {formError && <div className="crud-form__error">{formError}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button type="submit" label="Guardar" loading={saving} disabled={!writeHospitalId} />
          </div>
        </form>
      </Dialog>
    </div>
  )
}
