import type { ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { defaultRoute, navItems } from './shell/nav.config'
import { RegistosCirurgicos } from './pages/RegistosCirurgicos'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { PerfilPage } from './pages/Perfil'
import { Utentes } from './pages/Utentes'
import { UtenteDetalhe } from './pages/UtenteDetalhe'
import { Especialidades } from './pages/Especialidades'
import { ZonasAnatomicas } from './pages/ZonasAnatomicas'
import { Diagnosticos } from './pages/Diagnosticos'
import { Procedimentos } from './pages/Procedimentos'
import { LoginPage } from './pages/auth/LoginPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { TwoFactorSetupPage } from './pages/auth/TwoFactorSetupPage'
import { SelectHospitalPage } from './pages/auth/SelectHospitalPage'
import { RequireAuth } from './lib/auth/RequireAuth'
import { RequireHospital } from './lib/auth/RequireHospital'
import './App.scss'

const CRUD_PAGES: Record<string, ComponentType> = {
  '/utentes': Utentes,
  '/especialidades': Especialidades,
  '/zonas-anatomicas': ZonasAnatomicas,
  '/diagnosticos': Diagnosticos,
  '/procedimentos': Procedimentos,
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-password" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-password" element={<ResetPasswordPage />} />
      <Route
        path="/selecionar-hospital"
        element={
          <RequireAuth>
            <SelectHospitalPage />
          </RequireAuth>
        }
      />
      <Route
        path="/configurar-2fa"
        element={
          <RequireAuth>
            <RequireHospital>
              <TwoFactorSetupPage />
            </RequireHospital>
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <RequireHospital>
              <AppShell />
            </RequireHospital>
          </RequireAuth>
        }
      >
        {navItems.map((item) => {
          if (item.path === defaultRoute) {
            return <Route key={item.path} path={item.path} element={<RegistosCirurgicos />} />
          }
          const CrudPage = CRUD_PAGES[item.path]
          return (
            <Route
              key={item.path}
              path={item.path}
              element={CrudPage ? <CrudPage /> : <PlaceholderPage title={item.label} />}
            />
          )
        })}
        <Route path="/utentes/:id" element={<UtenteDetalhe />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Route>
    </Routes>
  )
}

export default App
