import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import HeroPage from './pages/HeroPage'
import LoginPage from './pages/LoginPage'
import NgoDashboardPage from './pages/NgoDashboardPage'
import NgoUploadPage from './pages/NgoUploadPage'
import VolunteerDashboardPage from './pages/VolunteerDashboardPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/ngo" element={<NgoUploadPage />} />
      <Route path="/ngo/results" element={<NgoDashboardPage />} />
      <Route path="/volunteer" element={<VolunteerDashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
