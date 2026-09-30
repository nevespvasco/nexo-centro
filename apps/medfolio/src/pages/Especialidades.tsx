import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import {
  ApiError,
  createEspecialidade,
  deleteEspecialidade,
  listEspecialidades,
  updateEspecialidade,
  type EspecialidadeBody,
  type EspecialidadeRow,
} from '../lib/api'
import '../styles/crud.scss'

const emptyForm: EspecialidadeBody = { nome: '', descricao: null }

export function Especialidades() {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<EspecialidadeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EspecialidadeRow | null>(null)
  const [form, setForm] = useState<EspecialidadeBody>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listEspecialidades()
      .then(setRows)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as especialidades.' }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: EspecialidadeRow) {
    setEditing(row)
    setForm({ nome: row.nome, descricao: row.descricao })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateEspecialidade(editing.id, form)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Especialidade atualizada.' })
      } else {
        await createEspecialidade(form)
        toast.current?.show({ severity: 'success', summary: 'Criada', detail: 'Especialidade criada.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar a especialidade.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: EspecialidadeRow) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome}"?`,
      header: 'Eliminar especialidade',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteEspecialidade(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminada', detail: 'Especialidade eliminada.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar a especialidade.',
          })
        }
      },
    })
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Especialidades</h1>
      <p className="page__subtitle">Gere as especialidades disponíveis no hospital ativo.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar especialidades..." />
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
          globalFilterFields={['nome', 'descricao']}
          emptyMessage="Nenhuma especialidade encontrada."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="descricao" header="Descrição" body={(row: EspecialidadeRow) => row.descricao ?? '—'} />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(row: EspecialidadeRow) => (
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
        header={editing ? 'Editar especialidade' : 'Criar especialidade'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="especialidade-nome">Nome</label>
            <InputText
              id="especialidade-nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="especialidade-descricao">Descrição</label>
            <InputText
              id="especialidade-descricao"
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
