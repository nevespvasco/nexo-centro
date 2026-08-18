import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from 'primereact/menu'
import type { MenuItem } from 'primereact/menuitem'
import type { AccountInfo } from './nav.config'

interface AccountCardProps {
  account: AccountInfo
  onLogout: () => void
}

/** First letter of the first two words of the name, e.g. "John Smith" -> "JS". */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

export function AccountCard({ account, onLogout }: AccountCardProps) {
  const menuRef = useRef<Menu>(null)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const items: MenuItem[] = [
    { label: 'Perfil', icon: 'pi pi-user', command: () => navigate('/perfil') },
    { separator: true },
    { label: 'Terminar sessão', icon: 'pi pi-sign-out', command: onLogout },
  ]

  return (
    <>
      <button
        type="button"
        className="account-card"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => menuRef.current?.toggle(e)}
        aria-label={account.name}
      >
        <span className="account-card__avatar" aria-hidden="true">
          {initialsOf(account.name)}
        </span>
        <div className="account-card__text">
          <div className="account-card__name">{account.name}</div>
          <div className="account-card__email">{account.email}</div>
        </div>
        <i
          className={`account-card__chevron pi ${open ? 'pi-chevron-up' : 'pi-chevron-down'}`}
          aria-hidden="true"
        />
      </button>
      <Menu
        model={items}
        popup
        ref={menuRef}
        onShow={() => setOpen(true)}
        onHide={() => setOpen(false)}
      />
    </>
  )
}
