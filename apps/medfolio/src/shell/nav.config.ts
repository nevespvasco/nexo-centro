/**
 * Navigation model for the medfolio shell.
 * Sections map to collapsible groups; items map to routes.
 * Icons are primeicons glyphs (verified present in primeicons@8).
 */
export interface NavItemDef {
  label: string
  icon: string
  path: string
}

export interface NavSectionDef {
  id: string
  title: string
  items: NavItemDef[]
}

export const navSections: NavSectionDef[] = [
  {
    id: 'plataforma',
    title: 'Plataforma',
    items: [
      { label: 'Painel', icon: 'pi-home', path: '/' },
      { label: 'Registos Cirúrgicos', icon: 'pi-file-edit', path: '/registos-cirurgicos' },
      { label: 'Cirurgias por Área', icon: 'pi-chart-pie', path: '/cirurgias-por-area' },
      { label: 'Atividade Científica', icon: 'pi-book', path: '/atividade-cientifica' },
      { label: 'Formações', icon: 'pi-graduation-cap', path: '/formacoes' },
    ],
  },
  {
    id: 'gestao-dados',
    title: 'Gestão de Dados',
    items: [
      { label: 'Utentes', icon: 'pi-users', path: '/utentes' },
      { label: 'Hospitais de Origem', icon: 'pi-building', path: '/hospitais-origem' },
      { label: 'Especialidades', icon: 'pi-briefcase', path: '/especialidades' },
      { label: 'Zonas Anatómicas', icon: 'pi-sitemap', path: '/zonas-anatomicas' },
      { label: 'Diagnósticos', icon: 'pi-clipboard', path: '/diagnosticos' },
      { label: 'Procedimentos', icon: 'pi-list-check', path: '/procedimentos' },
    ],
  },
]

/** Flat list of every routed destination, in nav order. */
export const navItems: NavItemDef[] = navSections.flatMap((s) => s.items)

/** The landing route — first item in the first section. */
export const defaultRoute = navItems[0].path

export interface HospitalDef {
  id: string
  /** Two-letter tile initials. */
  initials: string
  /** Full name, shown as tooltip. */
  name: string
}

export interface AccountInfo {
  name: string
  email: string
}
