import { useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Checkbox } from 'primereact/checkbox'
import type { HospitalMembership } from '@nexo-centro/schemas'
import type { HospitalScope } from '../lib/hospitalScopeModel'
import '../styles/hospital-scope.scss'

interface Props {
  hospitals: HospitalMembership[]
  scope: HospitalScope
  label: string
  onChange: (scope: HospitalScope) => void
}

export function HospitalScopePicker({ hospitals, scope, label, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<HospitalScope>(scope)
  const filtered = useMemo(() => hospitals.filter((h) => h.nome.toLocaleLowerCase('pt').includes(search.toLocaleLowerCase('pt'))), [hospitals, search])
  const selected = draft.kind === 'all' ? new Set(hospitals.map((h) => h.id)) : new Set(draft.ids)
  function toggle(id: string) {
    const ids = new Set(selected)
    if (ids.has(id)) ids.delete(id); else ids.add(id)
    setDraft({ kind: 'selected', ids: [...ids] })
  }
  return <div className="hospital-scope">
    <span className="hospital-scope__label">Âmbito dos hospitais</span>
    <Button type="button" outlined label={label} icon="pi pi-filter" disabled={hospitals.length === 0} onClick={() => { setDraft(scope); setSearch(''); setOpen(true) }} aria-label={`Alterar âmbito dos hospitais. Atual: ${label}`} />
    {hospitals.length === 0 && <span role="status">Sem hospitais com acesso aprovado.</span>}
    <Dialog header="Âmbito dos hospitais" visible={open} onHide={() => setOpen(false)} style={{ width: 'min(92vw, 440px)' }}>
      <p>Escolha um, vários ou todos os hospitais a que tem acesso.</p>
      <div className="hospital-scope__actions">
        <Button type="button" text label="Todos os hospitais" onClick={() => setDraft({ kind: 'all' })} />
        <Button type="button" text label="Limpar seleção" onClick={() => setDraft({ kind: 'selected', ids: [] })} />
        <Button type="button" text label="Selecionar resultados" onClick={() => setDraft({ kind: 'selected', ids: [...new Set([...(draft.kind === 'all' ? [] : draft.ids), ...filtered.map((h) => h.id)])] })} />
      </div>
      <InputText aria-label="Pesquisar hospitais" placeholder="Pesquisar hospitais" value={search} onChange={(e) => setSearch(e.target.value)} className="hospital-scope__search" />
      <div className="hospital-scope__list">
        {filtered.map((h) => <div key={h.id} className="hospital-scope__item">
          <Checkbox inputId={`scope-${h.id}`} checked={selected.has(h.id)} onChange={() => toggle(h.id)} />
          <label htmlFor={`scope-${h.id}`}>{h.nome}</label>
          <button type="button" className="hospital-scope__only" onClick={() => setDraft({ kind: 'selected', ids: [h.id] })} aria-label={`Selecionar apenas ${h.nome}`}>Só este</button>
        </div>)}
        {!filtered.length && <p>Não foram encontrados hospitais.</p>}
      </div>
      <p role="status">{draft.kind === 'all' ? `Todos os ${hospitals.length} hospitais` : `${draft.ids.length} hospitais selecionados`}</p>
      <div className="hospital-scope__footer">
        <Button type="button" label="Cancelar" text onClick={() => setOpen(false)} />
        <Button type="button" label="Aplicar âmbito" disabled={draft.kind === 'selected' && draft.ids.length === 0} onClick={() => { onChange(draft); setOpen(false) }} />
      </div>
    </Dialog>
  </div>
}
