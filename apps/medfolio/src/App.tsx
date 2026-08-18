import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { defaultRoute, navItems } from './shell/nav.config'
import { RegistosCirurgicos } from './pages/RegistosCirurgicos'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { PerfilPage } from './pages/Perfil'
import { LoginPage } from './pages/auth/LoginPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { TwoFactorSetupPage } from './pages/auth/TwoFactorSetupPage'
import { RequireAuth } from './lib/auth/RequireAuth'
import './App.scss'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-password" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-password" element={<ResetPasswordPage />} />
      <Route
        path="/configurar-2fa"
        element={
          <RequireAuth>
            <TwoFactorSetupPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        {navItems.map((item) =>
          item.path === defaultRoute ? (
            <Route key={item.path} path={item.path} element={<RegistosCirurgicos />} />
          ) : (
            <Route
              key={item.path}
              path={item.path}
              element={<PlaceholderPage title={item.label} />}
            />
          ),
        )}
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Route>
    </Routes>
  )
}

export default App
