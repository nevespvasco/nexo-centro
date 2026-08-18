interface CollapseToggleProps {
  collapsed: boolean
  onToggle: () => void
}

export function CollapseToggle({ collapsed, onToggle }: CollapseToggleProps) {
  return (
    <button
      type="button"
      className="collapse-toggle"
      onClick={onToggle}
      aria-label={collapsed ? 'Expandir painel de navegação' : 'Recolher painel de navegação'}
      aria-pressed={collapsed}
    >
      <i className={`pi ${collapsed ? 'pi-angle-right' : 'pi-angle-left'}`} aria-hidden="true" />
    </button>
  )
}
