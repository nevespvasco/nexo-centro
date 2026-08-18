import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Footer } from './Footer'
import { MiniRail } from './MiniRail'
import { NavPanel } from './NavPanel'
import type { HospitalDef } from './nav.config'
import { usePersistentState } from './usePersistentState'
import { useTheme } from './useTheme'
import { getHospitals } from '../lib/api'
import './shell.scss'

export function AppShell() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [userCollapsed, setUserCollapsed] = usePersistentState('medfolio.nav.collapsed', false)
  const [activeHospital, setActiveHospital] = usePersistentState<string | null>(
    'medfolio.hospital',
    null,
  )
  const [hospitals, setHospitals] = useState<HospitalDef[]>([])
  const [isTablet, setIsTablet] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Load the hospitals this user has approved access to (drives the switcher).
  useEffect(() => {
    getHospitals()
      .then((list) => setHospitals(list.map((h) => ({ id: h.id, initials: h.initials, name: h.nome }))))
      .catch(() => setHospitals([]))
  }, [])

  // Reconcile the persisted active hospital against the loaded list: covers
  // legacy localStorage ids (the old hardcoded "mh"/"ds"), a deleted/inaccessible
  // id, and first load (activeHospital starts null).
  useEffect(() => {
    if (hospitals.length === 0) return
    if (activeHospital && hospitals.some((h) => h.id === activeHospital)) return
    setActiveHospital(hospitals[0]?.id ?? null)
  }, [hospitals, activeHospital, setActiveHospital])

  // Auto-collapse the nav panel to an icon rail at tablet widths.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1199px) and (min-width: 768px)')
    const update = () => setIsTablet(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Track mobile breakpoint so the off-canvas drawer content can be made inert while closed.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const collapsed = isTablet || userCollapsed
  const toggleCollapsed = useCallback(
    () => setUserCollapsed((prev) => !prev),
    [setUserCollapsed],
  )
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [drawerOpen])

  // Close the drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, closeDrawer])

  return (
    <div className={`shell ${drawerOpen ? 'is-drawer-open' : ''}`}>
      <TopBar
        theme={theme}
        drawerOpen={drawerOpen}
        onToggleTheme={toggleTheme}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
      />
      <div className="body">
        <MiniRail
          hospitals={hospitals}
          activeHospital={activeHospital}
          onSelectHospital={setActiveHospital}
          inert={isMobile && !drawerOpen}
        />
        <NavPanel
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onNavigate={closeDrawer}
          inert={isMobile && !drawerOpen}
          {...(isMobile && { hospitals, activeHospital, onSelectHospital: setActiveHospital })}
        />
        <main className="content">
          <Outlet />
        </main>
        <div className="scrim" onClick={closeDrawer} aria-hidden="true" />
      </div>
      <Footer />
    </div>
  )
}
