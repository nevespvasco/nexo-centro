import type { ReactNode } from 'react'
import heroUrl from '../../assets/auth-hero.jpg'
import './auth.scss'

/**
 * Presentational shell for the auth screens: a white split-screen card floating
 * on a mint canvas — the form panel on the left, a healthcare photo with a
 * glassmorphic caption on the right. Purely visual; `children` render into the
 * left panel (wordmark first, then the page's own title/form).
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-shell__form">{children}</div>
        <aside className="auth-shell__aside" aria-hidden="true">
          <img className="auth-shell__photo" src={heroUrl} alt="" />
          <div className="auth-shell__caption">
            <p className="auth-shell__caption-title">Cuidados de saúde, mais próximos.</p>
            <p className="auth-shell__caption-text">
              Os registos clínicos dos teus utentes, seguros e sempre à mão.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
