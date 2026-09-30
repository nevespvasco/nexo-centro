import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import {
  ApiError,
  createDiagnostico,
  createProcedimento,
  getZonasAnatomicas,
  listEspecialidades,
  type Diagnostico,
  type EspecialidadeRow,
  type Procedimento,
  type ZonaAnatomica,
} from '../lib/api'
import type { TipoLesao } from '@nexo-centro/schemas'

const TIPO_LESAO_OPTIONS: { label: string; value: TipoLesao }[] = [
  { label: 'Benigno', value: 'benigno' },
  { label: 'Maligno', value: 'maligno' },
]

// ── QuickAdd Diagnóstico ──────────────────────────────────────────────────

interface QuickAddDiagnosticoProps {
  visible: boolean
  onHide: () => void
  onCreated: (d: Diagnostico) => void
}

export function QuickAddDiagnostico({ visible, onHide, onCreated }: QuickAddDiagnosticoProps) {
  const toast = useRef<Toast>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoLesao>('benigno')
  const [zonaId, setZonaId] = useState<string>('')
  const [zonas, setZonas] = useState<ZonaAnatomica[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleShow() {
    setNome('')
    setTipo('benigno')
    setZonaId('')
    setError(null)
    getZonasAnatomicas().then(setZonas).catch(() => null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!zonaId) { setError('Selecione uma zona anatómica.'); return }
    setError(null)
    setSaving(true)
    try {
      const d = await createDiagnostico({ nome, tipo, zonaAnatomicaId: zonaId })
      onCreated(d)
      onHide()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o diagnóstico.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Toast ref={toast} />
      <Dialog
        header="Criar diagnóstico"
        visible={visible}
        onHide={onHide}
        onShow={handleShow}
        style={{ width: '420px' }}
      >
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-field">
            <label htmlFor="qa-diag-nome">Nome</label>
            <InputText id="qa-diag-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="crud-field">
            <label htmlFor="qa-diag-zona">Zona anatómica</label>
            <Dropdown
              inputId="qa-diag-zona"
              value={zonaId}
              options={zonas}
              optionLabel="nome"
              optionValue="id"
              filter
              placeholder="Selecionar..."
              onChange={(e) => setZonaId(e.value)}
            />
          </div>
          <div className="crud-field">
            <label htmlFor="qa-diag-tipo">Tipo (opcional)</label>
            <Dropdown
              inputId="qa-diag-tipo"
              value={tipo}
              options={TIPO_LESAO_OPTIONS}
              onChange={(e) => setTipo(e.value)}
            />
          </div>
          {error && <div className="crud-form__error">{error}</div>}
          <div className="crud-form__actions">
            <Button type="button" label="Cancelar" text onClick={onHide} disabled={saving} />
            <Button type="submit" label="Criar" loading={saving} />
          </div>
        </form>
      </Dialog>
    </>
  )
}

// ── QuickAdd Procedimento ─────────────────────────────────────────────────

interface QuickAddProcedimentoProps {
  visible: boolean
  onHide: () => void
  onCreated: (p: Procedimento) => void
}

export function QuickAddProcedimento({ visible, onHide, onCreated }: QuickAddProcedimentoProps) {
  const [nome, setNome] = useState('')
  const [especialidadeId, setEspecialidadeId] = useState<string>('')
  const [especialidades, setEspecialidades] = useState<EspecialidadeRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleShow() {
    setNome('')
    setEspecialidadeId('')
    setError(null)
    listEspecialidades().then(setEspecialidades).catch(() => null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!especialidadeId) { setError('Selecione uma especialidade.'); return }
    setError(null)
    setSaving(true)
    try {
      const p = await createProcedimento({ nome, especialidadeId })
      onCreated(p)
      onHide()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o procedimento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      header="Criar procedimento"
      visible={visible}
      onHide={onHide}
      onShow={handleShow}
      style={{ width: '420px' }}
    >
      <form className="crud-form" onSubmit={handleSubmit}>
        <div className="crud-field">
          <label htmlFor="qa-proc-nome">Nome</label>
          <InputText id="qa-proc-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="crud-field">
          <label htmlFor="qa-proc-esp">Especialidade</label>
          <Dropdown
            inputId="qa-proc-esp"
            value={especialidadeId}
            options={especialidades}
            optionLabel="nome"
            optionValue="id"
            filter
            placeholder="Selecionar..."
            onChange={(e) => setEspecialidadeId(e.value)}
          />
        </div>
        {error && <div className="crud-form__error">{error}</div>}
        <div className="crud-form__actions">
          <Button type="button" label="Cancelar" text onClick={onHide} disabled={saving} />
          <Button type="submit" label="Criar" loading={saving} />
        </div>
      </form>
    </Dialog>
  )
}
