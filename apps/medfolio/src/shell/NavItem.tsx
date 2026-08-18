import { NavLink } from 'react-router-dom'
import { Tooltip } from 'primereact/tooltip'
import type { NavItemDef } from './nav.config'

interface NavItemProps {
  item: NavItemDef
  /** Collapsed rail mode — show icon only, label via tooltip. */
  collapsed?: boolean
  onNavigate?: () => void
}

export function NavItem({ item, collapsed = false, onNavigate }: NavItemProps) {
  const tooltipId = `nav-${item.path.replace(/\//g, '')}`
  return (
    <>
      {collapsed && <Tooltip target={`.${tooltipId}`} position="right" content={item.label} />}
      <NavLink
        to={item.path}
        onClick={onNavigate}
        className={({ isActive }) =>
          `nav-item ${tooltipId} ${isActive ? 'is-active' : ''}`
        }
        aria-label={item.label}
      >
        <i className={`nav-item__icon pi ${item.icon}`} aria-hidden="true" />
        <span className="nav-item__label">{item.label}</span>
        <i className="nav-item__chevron pi pi-angle-right" aria-hidden="true" />
      </NavLink>
    </>
  )
}
