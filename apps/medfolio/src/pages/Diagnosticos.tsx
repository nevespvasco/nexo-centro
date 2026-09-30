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
import {
  ApiError,
  createDiagnostico,
  deleteDiagnostico,
  getDiagnosticos,
  getZonasAnatomicas,
  updateDiagnostico,
  type Diagnostico,
  type DiagnosticoBody,
  type ZonaAnatomica,
} from '../lib/api'
import '../styles/crud.scss'

const TIPO_OPTIONS = [
  { label: 'Benigno', value: 'benigno' },
  { label: 'Maligno', value: 'maligno' },
]

const emptyForm: DiagnosticoBody = { nome: '', zonaAnatomicaId: '', tipo: 'benigno', descricao: '' }

export function Diagnosticos() {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<Diagnostico[]>([])
  const [zonas, setZonas] = useState<ZonaAnatomica[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Diagnostico | null>(null)
  const [form, setForm] = useState<DiagnosticoBody>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    getDiagnosticos()
      .then(setRows)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os diagnósticos.' }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useEffect(() => {
    getZonasAnatomicas()
      .then(setZonas)
      .catch(() => setZonas([]))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: Diagnostico) {
    setEditing(row)
    setForm({
      nome: row.nome,
      zonaAnatomicaId: row.zonaAnatomicaId ?? '',
      tipo: row.tipo ?? 'benigno',
      descricao: row.descricao ?? '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateDiagnostico(editing.id, form)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Diagnóstico atualizado.' })
      } else {
        await createDiagnostico(form)
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

  function confirmDelete(row: Diagnostico) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome}"?`,
      header: 'Eliminar diagnóstico',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteDiagnostico(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Diagnóstico eliminado.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar o diagnóstico.',
          })
        }
      },
    })
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Diagnósticos</h1>
      <p className="page__subtitle">Gere os diagnósticos disponíveis no hospital ativo.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar diagnósticos..." />
        </span>
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} />
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
          <Column field="zonaAnatomicaNome" header="Zona Anatómica" body={(row: Diagnostico) => row.zonaAnatomicaNome ?? '—'} />
          <Column
            header="Classificação"
            body={(row: Diagnostico) => TIPO_OPTIONS.find((o) => o.value === row.tipo)?.label ?? '—'}
          />
          <Column field="descricao" header="Descrição" body={(row: Diagnostico) => row.descricao ?? '—'} />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(row: Diagnostico) => (
              <div className="crud-actions">
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
        header={editing ? 'Editar diagnóstico' : 'Criar diagnóstico'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="diagnostico-nome">Nome</label>
            <InputText
              id="diagnostico-nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="diagnostico-zona">Zona Anatómica</label>
            <Dropdown
              inputId="diagnostico-zona"
              required
              value={form.zonaAnatomicaId}
              options={zonas}
              optionLabel="nome"
              optionValue="id"
              placeholder="Selecionar zona anatómica"
              onChange={(e) => setForm((f) => ({ ...f, zonaAnatomicaId: e.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="diagnostico-tipo">Classificação</label>
            <Dropdown
              inputId="diagnostico-tipo"
              required
              value={form.tipo}
              options={TIPO_OPTIONS}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="diagnostico-descricao">Descrição</label>
            <InputText
              id="diagnostico-descricao"
              value={form.descricao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value || null }))}
            />
          </div>
          {formError && <div className="crud-form__error">{formError}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button type="submit" label="Guardar" loading={saving} />
          </div>
        </form>
      </Dialog>
    </div>
  )
}
