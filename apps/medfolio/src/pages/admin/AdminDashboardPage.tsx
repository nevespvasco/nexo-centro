import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from 'primereact/card'
import { ApiError, type AdminDashboard, getAdminDashboard } from '../../lib/adminApi'

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminDashboard()
      .then(setMetrics)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/admin/login', { replace: true })
        } else {
          setError('Não foi possível carregar as métricas.')
        }
      })
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <div className="admin-page admin-dashboard">
      <div className="admin-page__heading">
        <div><span className="admin-page__eyebrow">VISÃO GERAL</span><h1>Painel de Administração</h1><p>Acompanha a atividade da plataforma.</p></div>
      </div>

      {loading && <p>A carregar...</p>}
      {error && <p style={{ color: 'var(--red-500)' }}>{error}</p>}

      {metrics && (
        <div className="admin-metrics">
          <Card title="Total de Utilizadores">
            <p className="admin-metric__value">{metrics.totalUsers}</p>
          </Card>
          <Card title="Utilizadores Ativos">
            <p className="admin-metric__value">{metrics.activeUsers}</p>
          </Card>
          <Card title="Registos Cirúrgicos">
            <p className="admin-metric__value">{metrics.totalRegistosCirurgicos}</p>
          </Card>
        </div>
      )}
    </div>
  )
}
