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
  getUtentes,
  updateUtente,
  type Utente,
  type UtenteBody,
} from '../lib/api'
import { calculateAge, fromISODate, toISODate } from '../lib/date'
import '../styles/crud.scss'

const SEXO_OPTIONS = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Feminino', value: 'feminino' },
  { label: 'Outro', value: 'outro' },
]

const emptyForm: UtenteBody = { nome: '', processo: '', sexo: null, dataNascimento: null }

export function Utentes() {
  const navigate = useNavigate()
  const toast = useRef<Toast>(null)
  const [utentes, setUtentes] = useState<Utente[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Utente | null>(null)
  const [form, setForm] = useState<UtenteBody>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    getUtentes()
      .then(setUtentes)
      .catch(() =>
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os utentes.' }),
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

  function openEdit(row: Utente) {
    setEditing(row)
    setForm({ nome: row.nome ?? '', processo: row.processo, sexo: row.sexo, dataNascimento: row.dataNascimento })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateUtente(editing.id, form)
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Utente atualizado.' })
      } else {
        await createUtente(form)
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Utente criado.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o utente.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(row: Utente) {
    confirmDialog({
      message: `Tens a certeza que queres eliminar "${row.nome ?? row.processo}"?`,
      header: 'Eliminar utente',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteUtente(row.id)
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
      <p className="page__subtitle">Gere os utentes registados no hospital ativo.</p>

      <div className="crud-toolbar">
        <span className="crud-toolbar__filter">
          <InputText value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar utentes..." />
        </span>
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <div className="crud-table">
        <DataTable
          value={utentes}
          loading={loading}
          globalFilter={filter}
          globalFilterFields={['nome', 'processo']}
          emptyMessage="Nenhum utente encontrado."
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
        >
          <Column field="nome" header="Nome" sortable />
          <Column field="processo" header="Nº Processo" sortable />
          <Column header="Sexo" body={(row: Utente) => SEXO_OPTIONS.find((o) => o.value === row.sexo)?.label ?? '—'} />
          <Column header="Idade" body={(row: Utente) => calculateAge(row.dataNascimento) ?? '—'} />
          <Column
            header=""
            style={{ width: '140px' }}
            body={(row: Utente) => (
              <div className="crud-actions">
                <Button
                  icon="pi pi-eye"
                  text
                  rounded
                  aria-label="Ver"
                  onClick={() => navigate(`/utentes/${row.id}`)}
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
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
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
