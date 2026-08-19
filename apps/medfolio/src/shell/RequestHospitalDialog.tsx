import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { ApiError, getAvailableHospitals, requestHospitalAccess } from '../lib/api'
import type { AvailableHospital } from '@nexo-centro/schemas'
import '../styles/crud.scss'

interface RequestHospitalDialogProps {
  visible: boolean
  onHide: () => void
  onAdded?: () => void
}

export function RequestHospitalDialog({ visible, onHide, onAdded }: RequestHospitalDialogProps) {
  const toast = useRef<Toast>(null)
  const [hospitals, setHospitals] = useState<AvailableHospital[]>([])
  const [loading, setLoading] = useState(false)
  const [hospitalId, setHospitalId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setHospitalId(null)
    setError(null)
    setLoading(true)
    getAvailableHospitals()
      .then(setHospitals)
      .catch(() => setHospitals([]))
      .finally(() => setLoading(false))
  }, [visible])

  async function handleSubmit() {
    if (!hospitalId) return
    setError(null)
    setSaving(true)
    try {
      await requestHospitalAccess(hospitalId)
      toast.current?.show({
        severity: 'success',
        summary: 'Hospital adicionado',
        detail: 'Já tens acesso a este hospital.',
      })
      onAdded?.()
      onHide()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível adicionar o hospital.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Toast ref={toast} />
      <Dialog header="Adicionar hospital" visible={visible} onHide={onHide} style={{ width: '420px' }}>
        <div className="crud-form">
          <div className="crud-field">
            <label htmlFor="request-hospital">Hospital</label>
            <Dropdown
              inputId="request-hospital"
              value={hospitalId}
              options={hospitals}
              optionLabel="nome"
              optionValue="id"
              filter
              loading={loading}
              placeholder="Selecionar hospital"
              emptyMessage="Sem hospitais disponíveis para adicionar."
              onChange={(e) => setHospitalId(e.value)}
            />
          </div>
          {!loading && hospitals.length === 0 && (
            <div className="crud-form__error">Sem hospitais disponíveis para adicionar.</div>
          )}
          {error && <div className="crud-form__error">{error}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={onHide} disabled={saving} />
            <Button
              type="button"
              label="Adicionar"
              loading={saving}
              disabled={!hospitalId || hospitals.length === 0}
              onClick={handleSubmit}
            />
          </div>
        </div>
      </Dialog>
    </>
  )
}
