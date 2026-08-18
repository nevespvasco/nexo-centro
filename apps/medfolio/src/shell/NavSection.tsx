import { useCallback } from 'react'
import type { NavSectionDef } from './nav.config'
import { NavItem } from './NavItem'

interface NavSectionProps {
  section: NavSectionDef
  expanded: boolean
  onToggle: (id: string) => void
  collapsed?: boolean
  onNavigate?: () => void
}

export function NavSection({
  section,
  expanded,
  onToggle,
  collapsed = false,
  onNavigate,
}: NavSectionProps) {
  const handleToggle = useCallback(() => onToggle(section.id), [onToggle, section.id])
  const listId = `nav-section-${section.id}`

  return (
    <div className="nav-section">
      <button
        type="button"
        className="nav-section__header"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={listId}
      >
        <span className="nav-section__title">{section.title}</span>
        <i
          className={`nav-section__chevron pi ${expanded ? 'pi-chevron-up' : 'pi-chevron-down'}`}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="nav-section__list" id={listId} role="list">
          {section.items.length === 0 ? (
            <span className="nav-section__empty">Sem itens</span>
          ) : (
            section.items.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
