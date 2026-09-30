import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { Tag } from 'primereact/tag'
import { ApiError, type AdminUserRow, getAdminUsers, patchAdminUserActive } from '../../lib/adminApi'

export function AdminUsersPage() {
  const navigate = useNavigate()
  const toast = useRef<Toast>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  function load() {
    setLoading(true)
    getAdminUsers()
      .then(setUsers)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/admin/login', { replace: true })
        } else {
          toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os utilizadores.' })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function toggleActive(user: AdminUserRow) {
    setToggling(user.id)
    try {
      const updated = await patchAdminUserActive(user.id, !user.isActive)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: updated.isActive } : u)))
      toast.current?.show({
        severity: 'success',
        summary: 'Atualizado',
        detail: `Utilizador ${updated.isActive ? 'ativado' : 'desativado'}.`,
      })
    } catch (err) {
      toast.current?.show({
        severity: 'error',
        summary: 'Erro',
        detail: err instanceof ApiError ? err.message : 'Não foi possível atualizar o utilizador.',
      })
    } finally {
      setToggling(null)
    }
  }

  const activeTemplate = (row: AdminUserRow) => (
    <Tag value={row.isActive ? 'Ativo' : 'Inativo'} severity={row.isActive ? 'success' : 'danger'} />
  )

  const actionsTemplate = (row: AdminUserRow) => (
    <div className="admin-table__actions">
      <Button
        icon={row.isActive ? 'pi pi-user-minus' : 'pi pi-user-plus'}
        aria-label={row.isActive ? 'Desativar utilizador' : 'Ativar utilizador'}
        title={row.isActive ? 'Desativar utilizador' : 'Ativar utilizador'}
        className="admin-user-toggle"
        text
        rounded
        size="small"
        loading={toggling === row.id}
        onClick={() => toggleActive(row)}
      />
    </div>
  )

  return (
    <div className="admin-page">
      <Toast ref={toast} />
      <div className="admin-page__heading"><div><span className="admin-page__eyebrow">GESTÃO DE ACESSO</span><h1>Utilizadores</h1><p>Consulta e gere o acesso às contas da plataforma.</p></div></div>
      <DataTable
        className="admin-table"
        value={users}
        loading={loading}
        paginator
        rows={20}
        emptyMessage="Nenhum utilizador encontrado."
        stripedRows
      >
        <Column field="nome" header="Nome" sortable />
        <Column field="email" header="E-mail" sortable />
        <Column header="Estado" body={activeTemplate} />
        <Column field="createdAt" header="Criado em" sortable body={(row: AdminUserRow) => new Date(row.createdAt).toLocaleDateString('pt-PT')} />
        <Column header="Ações" headerStyle={{ textAlign: 'right' }} body={actionsTemplate} />
      </DataTable>
    </div>
  )
}
