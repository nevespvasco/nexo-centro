import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { navSections } from './nav.config'
import { AccountCard } from './AccountCard'
import { NavSection } from './NavSection'
import { CollapseToggle } from './CollapseToggle'
import { usePersistentState } from './usePersistentState'
import { useAuth } from '../lib/auth/AuthContext'

interface NavPanelProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  onNavigate?: () => void
  inert?: boolean
}

const defaultExpanded = Object.fromEntries(navSections.map((s) => [s.id, true]))

export function NavPanel({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  inert,
}: NavPanelProps) {
  const [expanded, setExpanded] = usePersistentState<Record<string, boolean>>(
    'medfolio.nav.expanded',
    defaultExpanded,
  )
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const toggleSection = useCallback(
    (id: string) => setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) })),
    [setExpanded],
  )

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  return (
    <nav
      id="navpanel"
      className={`navpanel ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Navegação principal"
      inert={inert || undefined}
    >
      <AccountCard
        account={{ name: user?.nome ?? '', email: user?.email ?? '' }}
        onLogout={handleLogout}
      />
      {navSections.map((section) => (
        <NavSection
          key={section.id}
          section={section}
          expanded={expanded[section.id] ?? true}
          onToggle={toggleSection}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
      <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} />
    </nav>
  )
}
