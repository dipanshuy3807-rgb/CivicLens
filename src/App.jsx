import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { getAuthUser } from './api'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NgoDashboardPage from './pages/NgoDashboardPage'
import NgoUploadPage from './pages/NgoUploadPage'
import VolunteerDashboardPage from './pages/VolunteerDashboardPage'
import VolunteerOnboardingPage from './pages/VolunteerOnboardingPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/ngo"
        element={(
          <RequireAuth role="ngo">
            <NgoUploadPage />
          </RequireAuth>
        )}
      />
      <Route
        path="/ngo/results"
        element={(
          <RequireAuth role="ngo">
            <NgoDashboardPage />
          </RequireAuth>
        )}
      />
      <Route
        path="/volunteer"
        element={(
          <RequireAuth role="volunteer">
            <VolunteerDashboardPage />
          </RequireAuth>
        )}
      />
      <Route
        path="/volunteer/onboarding"
        element={(
          <RequireAuth role="volunteer">
            <VolunteerOnboardingPage />
          </RequireAuth>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RequireAuth({ children, role }) {
  const user = getAuthUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'ngo' ? '/ngo' : '/volunteer'} replace />
  }

  return children
}

export default App
