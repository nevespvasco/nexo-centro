import type { HospitalDef } from './nav.config'
import { HospitalAvatar } from './HospitalAvatar'

interface MiniRailProps {
  hospitals: HospitalDef[]
  activeHospital: string | null
  onSelectHospital: (id: string) => void
  inert?: boolean
}

export function MiniRail({ hospitals, activeHospital, onSelectHospital, inert }: MiniRailProps) {
  return (
    <div className="minirail" role="tablist" aria-label="Trocar de hospital" inert={inert || undefined}>
      {hospitals.map((hospital) => (
        <HospitalAvatar
          key={hospital.id}
          hospital={hospital}
          active={hospital.id === activeHospital}
          onSelect={onSelectHospital}
        />
      ))}
    </div>
  )
}
