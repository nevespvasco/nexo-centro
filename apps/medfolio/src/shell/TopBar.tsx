import { Link } from 'react-router-dom'
import { defaultRoute } from './nav.config'
import type { Theme } from './useTheme'

interface TopBarProps {
  theme: Theme
  drawerOpen: boolean
  onToggleTheme: () => void
  onToggleDrawer: () => void
  onRequestAccess: () => void
}

export function TopBar({ theme, drawerOpen, onToggleTheme, onToggleDrawer, onRequestAccess }: TopBarProps) {
  return (
    <header className="topbar">
      <Link to={defaultRoute} className="topbar__wordmark">
        <i className="pi pi-heart-fill" aria-hidden="true" />
        MedFolio
      </Link>
      <div className="topbar__actions">
        <button type="button" className="iconbtn" aria-label="Pedir acesso a hospital" title="Pedir acesso a hospital" onClick={onRequestAccess}>
          <i className="pi pi-plus-circle" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label={theme === 'dark' ? 'Modo claro' : 'Modo noturno'}
          onClick={onToggleTheme}
        >
          <i className={`pi ${theme === 'dark' ? 'pi-sun' : 'pi-moon'}`} aria-hidden="true" />
        </button>
        <button type="button" className="iconbtn topbar__help-btn" aria-label="Ajuda">
          <i className="pi pi-question-circle" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="iconbtn topbar__menu-btn"
          aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={drawerOpen}
          aria-controls="navpanel"
          onClick={onToggleDrawer}
        >
          <i className={`pi ${drawerOpen ? 'pi-times' : 'pi-bars'}`} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
