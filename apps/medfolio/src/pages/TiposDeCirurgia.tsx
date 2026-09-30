import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Tag } from 'primereact/tag'
import {
  ApiError,
  createTipoDeCirurgia,
  deleteTipoDeCirurgia,
  listTiposDeCirurgia,
  updateTipoDeCirurgia,
  type CatalogoItem,
  type CatalogoItemBody,
} from '../lib/api'
import '../styles/crud.scss'

const emptyForm: CatalogoItemBody = { nome: '', descricao: null }

export function TiposDeCirurgia() {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<CatalogoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogoItem | null>(null)
  const [form, setForm] = useState<CatalogoItemBody>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listTiposDeCirurgia()
      .then(setRows)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os tipos de cirurgia.' }),
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

  function openEdit(row: CatalogoItem) {
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
        await updateTipoDeCirurgia(editing.id, form)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Tipo de cirurgia atualizado.' })
      } else {
        await createTipoDeCirurgia(form)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Tipo de cirurgia criado.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o tipo de cirurgia.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: CatalogoItem) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome}"?`,
      header: 'Eliminar tipo de cirurgia',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteTipoDeCirurgia(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Tipo de cirurgia eliminado.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar o tipo de cirurgia.',
          })
        }
      },
    })
  }

  const isOwned = (row: CatalogoItem) => row.hospitalId !== null

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Tipos de Cirurgia</h1>
      <p className="page__subtitle">Gere os tipos de cirurgia disponíveis no hospital ativo.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar tipos de cirurgia..." />
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
          emptyMessage="Nenhum tipo de cirurgia encontrado."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="descricao" header="Descrição" body={(row: CatalogoItem) => row.descricao ?? '—'} />
          <Column
            header=""
            body={(row: CatalogoItem) =>
              !isOwned(row) ? <Tag value="Global" severity="info" /> : null
            }
            style={{ width: '80px' }}
          />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(row: CatalogoItem) => (
              <div className="crud-actions">
                <Button
                  icon="pi pi-pencil"
                  text
                  rounded
                  aria-label="Editar"
                  disabled={!isOwned(row)}
                  onClick={() => openEdit(row)}
                />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  severity="danger"
                  aria-label="Eliminar"
                  disabled={!isOwned(row)}
                  onClick={() => confirmDelete(row)}
                />
              </div>
            )}
          />
        </DataTable>
      </div>

      <Dialog
        header={editing ? 'Editar tipo de cirurgia' : 'Criar tipo de cirurgia'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="tipo-cirurgia-nome">Nome</label>
            <InputText
              id="tipo-cirurgia-nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="tipo-cirurgia-descricao">Descrição</label>
            <InputText
              id="tipo-cirurgia-descricao"
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
