import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import {
  ApiError,
  getAdminHospitals,
  patchAdminHospital,
  postAdminHospital,
  type AdminHospitalRow,
} from '../../lib/adminApi'
import '../../styles/crud.scss'

export function AdminHospitalsPage() {
  const navigate = useNavigate()
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<AdminHospitalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminHospitalRow | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    getAdminHospitals()
      .then(setRows)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/admin/login', { replace: true })
        } else if (err instanceof ApiError && err.status === 403) {
          toast.current?.show({ severity: 'warn', summary: 'Sem permissão', detail: 'Sem permissão para gerir hospitais.' })
        } else {
          toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os hospitais.' })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setEditing(null)
    setNome('')
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: AdminHospitalRow) {
    setEditing(row)
    setNome(row.nome)
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      if (editing) {
        await patchAdminHospital(editing.id, { nome })
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Hospital atualizado.' })
      } else {
        await postAdminHospital({ nome })
        toast.current?.show({ severity: 'success', summary: 'Criado', detail: 'Hospital criado.' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível guardar o hospital.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page">
      <Toast ref={toast} />
      <div className="admin-page__heading">
        <div>
          <span className="admin-page__eyebrow">GESTÃO DE DADOS</span>
          <h1>Hospitais</h1>
          <p>Cria e edita os hospitais disponíveis na plataforma.</p>
        </div>
        <Button label="Criar" icon="pi pi-plus" onClick={openCreate} />
      </div>
      <DataTable
        className="admin-table"
        value={rows}
        loading={loading}
        paginator
        rows={20}
        emptyMessage="Nenhum hospital encontrado."
        stripedRows
      >
        <Column field="nome" header="Nome" sortable />
        <Column
          field="createdAt"
          header="Criado em"
          sortable
          body={(row: AdminHospitalRow) => new Date(row.createdAt).toLocaleDateString('pt-PT')}
        />
        <Column
          header="Ações"
          headerStyle={{ textAlign: 'right' }}
          body={(row: AdminHospitalRow) => (
            <div className="admin-table__actions">
              <Button icon="pi pi-pencil" text rounded size="small" aria-label="Editar" title="Editar" onClick={() => openEdit(row)} />
            </div>
          )}
        />
      </DataTable>

      <Dialog
        header={editing ? 'Editar hospital' : 'Criar hospital'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="hospital-nome">Nome</label>
            <InputText
              id="hospital-nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
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
