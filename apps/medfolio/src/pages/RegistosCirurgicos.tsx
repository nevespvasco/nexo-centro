import { useEffect, useState } from 'react'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { Button } from 'primereact/button'
import { getHealth, type HealthResponse } from '../lib/api'

type ConnectionState =
  | { status: 'loading' }
  | { status: 'connected'; data: HealthResponse }
  | { status: 'error'; message: string }

export function RegistosCirurgicos() {
  const [connection, setConnection] = useState<ConnectionState>({ status: 'loading' })

  const checkHealth = () => {
    setConnection({ status: 'loading' })
    getHealth()
      .then((data) => setConnection({ status: 'connected', data }))
      .catch((err) =>
        setConnection({ status: 'error', message: err instanceof Error ? err.message : String(err) }),
      )
  }

  useEffect(checkHealth, [])

  return (
    <div className="page">
      <h1 className="page__title">Registos Cirúrgicos</h1>
      <p className="page__subtitle">Estado do serviço e ponto de entrada da aplicação.</p>
      <Card title="medfolio-api" className="health-card">
        <div className="health-row">
          <span>Estado da ligação</span>
          {connection.status === 'loading' && <Tag severity="info" value="A verificar…" />}
          {connection.status === 'connected' && (
            <Tag severity="success" value={`ligado — ${connection.data.service}`} icon="pi pi-check" />
          )}
          {connection.status === 'error' && (
            <Tag severity="danger" value={connection.message} icon="pi pi-times" />
          )}
        </div>
        <Button label="Verificar novamente" icon="pi pi-refresh" onClick={checkHealth} outlined />
      </Card>
    </div>
  )
}
