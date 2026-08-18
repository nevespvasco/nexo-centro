import { Tooltip } from 'primereact/tooltip'
import type { HospitalDef } from './nav.config'

interface HospitalAvatarProps {
  hospital: HospitalDef
  active: boolean
  onSelect: (id: string) => void
}

export function HospitalAvatar({ hospital, active, onSelect }: HospitalAvatarProps) {
  const cls = `hospital-avatar-${hospital.id}`
  return (
    <>
      <Tooltip target={`.${cls}`} position="right" content={hospital.name} />
      <button
        type="button"
        className={`hospital-avatar ${cls} ${active ? 'is-active' : ''}`}
        aria-label={hospital.name}
        aria-current={active ? 'true' : undefined}
        onClick={() => onSelect(hospital.id)}
      >
        {hospital.initials}
      </button>
    </>
  )
}
