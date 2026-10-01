import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import {
  ApiError,
  createDiagnostico,
  deleteDiagnostico,
  getDiagnosticosMulti,
  getZonasAnatomicas,
  updateDiagnostico,
  type DiagnosticoBody,
  type DiagnosticoMulti,
  type ZonaAnatomica,
} from '../lib/api'
import { useHospitalScope } from '../lib/hospitalScope'
import { HospitalScopePicker } from '../components/HospitalScopePicker'
import '../styles/crud.scss'

const TIPO_OPTIONS = [
  { label: 'Benigno', value: 'benigno' },
  { label: 'Maligno', value: 'maligno' },
]

const emptyForm: DiagnosticoBody = { nome: '', zonaAnatomicaId: '', tipo: 'benigno', descricao: '' }

// Diagnósticos NÃO são partilháveis: cada um pertence a um hospital (ou é global).
// Têm o filtro de âmbito, mas sem associação a vários hospitais.
export function Diagnosticos() {
  const { scope, setScope, hospitals, selectedHospitals, label, loadingHospitals, scopeError, accessVersion, refreshHospitals } =
    useHospitalScope()
  const scopeKey = scope.kind === 'all' ? 'all' : scope.ids.join(',')
  const toast = useRef<Toast>(null)
  const requestVersion = useRef(0)
  const [rows, setRows] = useState<DiagnosticoMulti[]>([])
  const [zonas, setZonas] = useState<ZonaAnatomica[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DiagnosticoMulti | null>(null)
  const [form, setForm] = useState<DiagnosticoBody>(emptyForm)
  const [writeHospitalId, setWriteHospitalId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    if (loadingHospitals) return
    const version = ++requestVersion.current
    setLoading(true)
    setRows([])
    getDiagnosticosMulti(scope)
      .then((result) => { if (version === requestVersion.current) setRows(result) })
      .catch((error) => {
        if (version !== requestVersion.current) return
        if (error instanceof ApiError && error.status === 403) void refreshHospitals()
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os diagnósticos.' })
      })
      .finally(() => { if (version === requestVersion.current) setLoading(false) })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(), [scopeKey, loadingHospitals, accessVersion])
  useEffect(() => {
    getZonasAnatomicas({ kind: 'all' }).then(setZonas).catch(() => setZonas([]))
  }, [])

  const editable = (row: DiagnosticoMulti) => row.hospitalId !== null

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setWriteHospitalId(selectedHospitals.length === 1 ? selectedHospitals[0].id : null)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: DiagnosticoMulti) {
    setEditing(row)
    setWriteHospitalId(row.hospitalId)
    setForm({ nome: row.nome, zonaAnatomicaId: row.zonaAnatomicaId ?? '', tipo: row.tipo ?? 'benigno', descricao: row.descricao ?? '' })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!writeHospitalId) { setFormError('Escolha o hospital do diagnóstico.'); return }
    setSaving(true)
    try {
      if (editing) {
        await updateDiagnostico(editing.id, form, writeHospitalId)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Diagnóstico atualizado.' })
      } else {
        await createDiagnostico(form, writeHospitalId)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Diagnóstico criado.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o diagnóstico.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: DiagnosticoMulti) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome}"?`,
      header: 'Eliminar diagnóstico',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteDiagnostico(row.id, row.hospitalId ?? undefined)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Diagnóstico eliminado.' })
          load()
        } catch (err) {
          toast.current?.show({ severity: 'error', summary: 'Erro', detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar o diagnóstico.' })
        }
      },
    })
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Diagnósticos</h1>
      <p className="page__subtitle">Diagnósticos no âmbito selecionado. Cada diagnóstico pertence a um hospital.</p>
      <HospitalScopePicker scope={scope} hospitals={hospitals} label={label} onChange={setScope} />
      {scopeError && <div className="crud-form__error" role="alert">{scopeError}</div>}
      <div role="status">{rows.length.toLocaleString('pt-PT')} diagnósticos · {selectedHospitals.length} hospitais</div>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar diagnósticos..." />
        </span>
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} disabled={hospitals.length === 0} />
      </div>

      <div className="crud-table">
        <DataTable
          responsiveLayout="stack"
          breakpoint="767px"
          value={rows}
          loading={loading}
          globalFilter={filter}
          globalFilterFields={['nome', 'zonaAnatomicaNome', 'descricao']}
          emptyMessage="Nenhum diagnóstico encontrado."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="zonaAnatomicaNome" header="Zona Anatómica" body={(row: DiagnosticoMulti) => row.zonaAnatomicaNome ?? '—'} />
          <Column header="Classificação" body={(row: DiagnosticoMulti) => TIPO_OPTIONS.find((o) => o.value === row.tipo)?.label ?? '—'} />
          <Column
            header="Hospital"
            body={(row: DiagnosticoMulti) => (row.hospitalId ? row.hospitalNome ?? '—' : <Tag value="Global" severity="info" />)}
          />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(row: DiagnosticoMulti) => (
              <div className="crud-actions">
                <Button icon="pi pi-pencil" text rounded aria-label="Editar" disabled={!editable(row)} onClick={() => openEdit(row)} />
                <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Eliminar" disabled={!editable(row)} onClick={() => confirmDelete(row)} />
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog header={editing ? 'Editar diagnóstico' : 'Criar diagnóstico'} visible={dialogOpen} onHide={() => setDialogOpen(false)} style={{ width: '480px' }}>
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="diagnostico-hospital">Hospital</label>
            <Dropdown inputId="diagnostico-hospital" filter disabled={!!editing} value={writeHospitalId} options={hospitals} optionLabel="nome" optionValue="id" placeholder="Escolher hospital" onChange={(e) => setWriteHospitalId(e.value)} />
          </div>
          <fieldset disabled={!writeHospitalId} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="crud-field">
              <label htmlFor="diagnostico-nome">Nome</label>
              <InputText id="diagnostico-nome" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="crud-field">
              <label htmlFor="diagnostico-zona">Zona Anatómica</label>
              <Dropdown inputId="diagnostico-zona" required value={form.zonaAnatomicaId} options={zonas} optionLabel="nome" optionValue="id" filter placeholder="Selecionar zona anatómica" onChange={(e) => setForm((f) => ({ ...f, zonaAnatomicaId: e.value }))} />
            </div>
            <div className="crud-field">
              <label htmlFor="diagnostico-tipo">Classificação</label>
              <Dropdown inputId="diagnostico-tipo" required value={form.tipo} options={TIPO_OPTIONS} onChange={(e) => setForm((f) => ({ ...f, tipo: e.value }))} />
            </div>
            <div className="crud-field">
              <label htmlFor="diagnostico-descricao">Descrição</label>
              <InputText id="diagnostico-descricao" value={form.descricao ?? ''} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value || null }))} />
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
