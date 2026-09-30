import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import {
  ApiError,
  type AdminRequest,
  getAdminRequests,
  postAdminRequestAction,
} from '../../lib/adminApi'

export function AdminRequestsPage() {
  const navigate = useNavigate()
  const toast = useRef<Toast>(null)
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  function load() {
    setLoading(true)
    getAdminRequests()
      .then(setRequests)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/admin/login', { replace: true })
        } else {
          toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os pedidos.' })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleAction(requestId: string, action: 'approve' | 'reject') {
    setProcessing(requestId)
    try {
      await postAdminRequestAction(requestId, action)
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
      toast.current?.show({
        severity: 'success',
        summary: action === 'approve' ? 'Aprovado' : 'Rejeitado',
        detail: `Pedido ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso.`,
      })
    } catch (err) {
      toast.current?.show({
        severity: 'error',
        summary: 'Erro',
        detail: err instanceof ApiError ? err.message : 'Não foi possível processar o pedido.',
      })
    } finally {
      setProcessing(null)
    }
  }

  const actionsTemplate = (row: AdminRequest) => (
    <div className="admin-table__actions">
      <Button
        label="Aprovar"
        severity="success"
        size="small"
        loading={processing === row.id}
        onClick={() => handleAction(row.id, 'approve')}
      />
      <Button
        label="Rejeitar"
        severity="danger"
        size="small"
        outlined
        loading={processing === row.id}
        onClick={() => handleAction(row.id, 'reject')}
      />
    </div>
  )

  return (
    <div className="admin-page">
      <Toast ref={toast} />
      <div className="admin-page__heading"><div><span className="admin-page__eyebrow">GESTÃO DE ACESSO</span><h1>Pedidos de Acesso</h1><p>Revê e responde aos pedidos pendentes de acesso hospitalar.</p></div></div>
      <DataTable
        className="admin-table"
        value={requests}
        loading={loading}
        paginator
        rows={20}
        emptyMessage="Nenhum pedido pendente."
        stripedRows
      >
        <Column field="userNome" header="Nome" sortable />
        <Column field="userEmail" header="E-mail" sortable />
        <Column field="hospitalNome" header="Hospital" sortable />
        <Column
          field="requestedAt"
          header="Pedido em"
          sortable
          body={(row: AdminRequest) => new Date(row.requestedAt).toLocaleDateString('pt-PT')}
        />
        <Column header="Ações" headerStyle={{ textAlign: 'right' }} body={actionsTemplate} />
      </DataTable>
    </div>
  )
}
