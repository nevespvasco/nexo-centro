import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { postAdminLogout } from '../lib/adminApi'
import './admin-shell.scss'

const adminLinks = [
  { label: 'Painel', path: '/admin', icon: 'pi-home', end: true },
  { label: 'Utilizadores', path: '/admin/users', icon: 'pi-users', end: false },
  { label: 'Pedidos Pendentes', path: '/admin/requests', icon: 'pi-bell', end: false },
  { label: 'Hospitais', path: '/admin/hospitals', icon: 'pi-building', end: false },
]

export function AdminShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => setDrawerOpen(false), [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen])

  const logout = useCallback(async () => {
    await postAdminLogout().catch(() => null)
    navigate('/admin/login', { replace: true })
  }, [navigate])

  return (
    <div className={`admin-shell ${drawerOpen ? 'is-drawer-open' : ''}`}>
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-menu-button"
          aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={drawerOpen}
          aria-controls="admin-sidebar"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <i className={`pi ${drawerOpen ? 'pi-times' : 'pi-bars'}`} aria-hidden="true" />
        </button>
        <NavLink to="/admin" className="admin-brand" aria-label="MedFolio Administração">
          <span className="admin-brand__mark"><i className="pi pi-shield" aria-hidden="true" /></span>
          <span><strong>MedFolio</strong><small>Administração</small></span>
        </NavLink>
        <span className="admin-topbar__context">Área de gestão</span>
      </header>

      <div className="admin-body">
        <aside
          id="admin-sidebar"
          className={`admin-sidebar ${collapsed ? 'is-collapsed' : ''}`}
          aria-label="Administração"
          inert={isMobile && !drawerOpen ? true : undefined}
        >
          <div className="admin-sidebar__heading">
            <span className="admin-sidebar__eyebrow">WORKSPACE</span>
            {!isMobile && (
              <button
                type="button"
                className="admin-sidebar__collapse"
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                onClick={() => setCollapsed((value) => !value)}
              >
                <i className={`pi ${collapsed ? 'pi-angle-right' : 'pi-angle-left'}`} aria-hidden="true" />
              </button>
            )}
          </div>
          <nav className="admin-nav" aria-label="Navegação de administração">
            {adminLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) => `admin-nav__link ${isActive ? 'is-active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <i className={`pi ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
                {item.path === '/admin/requests' && <i className="pi pi-angle-right admin-nav__chevron" aria-hidden="true" />}
              </NavLink>
            ))}
          </nav>
          <div className="admin-sidebar__footer">
            <div className="admin-sidebar__identity" aria-hidden="true"><i className="pi pi-user" /></div>
            <div className="admin-sidebar__user"><strong>Administrador</strong><span>Conta de gestão</span></div>
            <button type="button" className="admin-logout" onClick={logout} aria-label="Terminar sessão" title="Terminar sessão">
              <i className="pi pi-sign-out" aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </aside>
        <main className="admin-content"><Outlet /></main>
        <button className="admin-scrim" type="button" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)} />
      </div>
    </div>
  )
}
