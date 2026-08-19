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
  createProcedimento,
  deleteProcedimento,
  getProcedimentos,
  listEspecialidades,
  updateProcedimento,
  type EspecialidadeRow,
  type Procedimento,
  type ProcedimentoBody,
} from '../lib/api'
import '../styles/crud.scss'

const emptyForm: ProcedimentoBody = { especialidadeId: '', nome: '' }

export function Procedimentos() {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<Procedimento[]>([])
  const [especialidades, setEspecialidades] = useState<EspecialidadeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Procedimento | null>(null)
  const [form, setForm] = useState<ProcedimentoBody>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    getProcedimentos()
      .then(setRows)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os procedimentos.' }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useEffect(() => {
    listEspecialidades()
      .then(setEspecialidades)
      .catch(() => setEspecialidades([]))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: Procedimento) {
    setEditing(row)
    setForm({ especialidadeId: row.especialidadeId ?? '', nome: row.nome })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateProcedimento(editing.id, form)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Procedimento atualizado.' })
      } else {
        await createProcedimento(form)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Procedimento criado.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o procedimento.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: Procedimento) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome}"?`,
      header: 'Eliminar procedimento',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteProcedimento(row.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Procedimento eliminado.' })
          load()
        } catch (err) {
          toast.current?.show({
            severity: 'error',
            summary: 'Erro',
            detail: err instanceof ApiError ? err.message : 'Não foi possível eliminar o procedimento.',
          })
        }
      },
    })
  }

  return (
    <div className="page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <h1 className="page__title">Procedimentos</h1>
      <p className="page__subtitle">Gere os procedimentos disponíveis no hospital ativo.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar procedimentos..." />
        </span>
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <div className="crud-table">
        <DataTable
          value={rows}
          loading={loading}
          globalFilter={filter}
          globalFilterFields={['nome', 'especialidadeNome']}
          emptyMessage="Nenhum procedimento encontrado."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="especialidadeNome" header="Especialidade" body={(row: Procedimento) => row.especialidadeNome ?? '—'} sortable />
          <Column field="nome" header="Nome" sortable />
          <Column
            header=""
            style={{ width: '100px' }}
            body={(row: Procedimento) => (
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
        header={editing ? 'Editar procedimento' : 'Criar procedimento'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="procedimento-especialidade">Especialidade</label>
            <Dropdown
              inputId="procedimento-especialidade"
              required
              value={form.especialidadeId}
              options={especialidades}
              optionLabel="nome"
              optionValue="id"
              placeholder="Selecionar especialidade"
              onChange={(e) => setForm((f) => ({ ...f, especialidadeId: e.value }))}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="procedimento-nome">Nome do procedimento</label>
            <InputText
              id="procedimento-nome"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
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
