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
  createZonaAnatomica,
  deleteZonaAnatomica,
  getZonasAnatomicas,
  reorderZonasAnatomicas,
  updateZonaAnatomica,
  type ZonaAnatomica,
  type ZonaAnatomicaBody,
} from '../lib/api'
import '../styles/crud.scss'

const emptyForm: ZonaAnatomicaBody = { nome: '', descricao: null }

export function ZonasAnatomicas() {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<ZonaAnatomica[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ZonaAnatomica | null>(null)
  const [form, setForm] = useState<ZonaAnatomicaBody>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [orderDirty, setOrderDirty] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  function load() {
    setLoading(true)
    getZonasAnatomicas()
      .then((r) => {
        setRows(r)
        setOrderDirty(false)
      })
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as zonas anatómicas.' }),
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

  function openEdit(row: ZonaAnatomica) {
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
        await updateZonaAnatomica(editing.id, form)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Zona anatómica atualizada.' })
      } else {
        await createZonaAnatomica(form)
        toast.current?.show({ severity: 'success', summary: 'Criada', detail: 'Zona anatómica criada.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar a zona anatómica.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: ZonaAnatomica) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome}"?`,
      header: 'Eliminar zona anatómica',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteZonaAnatomica(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminada', detail: 'Zona anatómica eliminada.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar a zona anatómica.',
          })
        }
      },
    })
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next)
    setOrderDirty(true)
  }

  async function saveOrder() {
    setSavingOrder(true)
    try {
      const ownedWithOrder = rows
        .map((r, i) => ({ id: r.id, ordem: i, isOwned: r.hospitalId !== null }))
        .filter((r) => r.isOwned)
        .map(({ id, ordem }) => ({ id, ordem }))
      await reorderZonasAnatomicas(ownedWithOrder)
      setOrderDirty(false)
      toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Ordem guardada.' })
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível guardar a ordem.' })
    } finally {
      setSavingOrder(false)
    }
  }

  const isOwned = (row: ZonaAnatomica) => row.hospitalId !== null

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Zonas Anatómicas</h1>
      <p className="page__subtitle">Gere as zonas anatómicas disponíveis no hospital ativo.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar zonas..." />
        </span>
        {orderDirty && (
          <Button label="Guardar ordem" icon="pi pi-sort" outlined loading={savingOrder} onClick={saveOrder} />
        )}
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
          emptyMessage="Nenhuma zona anatómica encontrada."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column
            header=""
            style={{ width: '60px' }}
            body={(_row: ZonaAnatomica, opts) => {
              const i = opts.rowIndex
              if (!isOwned(_row)) return null
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <Button
                    icon="pi pi-angle-up"
                    text
                    rounded
                    size="small"
                    aria-label="Mover para cima"
                    disabled={i === 0}
                    onClick={() => moveRow(i, -1)}
                  />
                  <Button
                    icon="pi pi-angle-down"
                    text
                    rounded
                    size="small"
                    aria-label="Mover para baixo"
                    disabled={i === rows.length - 1}
                    onClick={() => moveRow(i, 1)}
                  />
                </div>
              )
            }}
          />
          <Column field="nome" header="Nome" sortable />
          <Column field="descricao" header="Descrição" body={(row: ZonaAnatomica) => row.descricao ?? '—'} />
          <Column
            header=""
            body={(row: ZonaAnatomica) =>
              !isOwned(row) ? <Tag value="Global" severity="info" /> : null
            }
            style={{ width: '80px' }}
          />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(row: ZonaAnatomica) => (
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
        header={editing ? 'Editar zona anatómica' : 'Criar zona anatómica'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="zona-nome">Nome</label>
            <InputText
              id="zona-nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="zona-descricao">Descrição</label>
            <InputText
              id="zona-descricao"
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
