import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import { RekhaProvider, useRekha, can } from './store'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Demo from './pages/Demo'
import Campaigns from './pages/Campaigns'
import CampaignDetail from './pages/CampaignDetail'
import Ledger from './pages/Ledger'
import Metrics from './pages/Metrics'
import About from './pages/About'
import Users from './pages/Users'

function Console() {
  const { role } = useRekha()
  const location = useLocation()
  if (!role) return <Navigate to="/login" replace />

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route index element={<Overview />} />
          <Route path="arena" element={can.attack(role) ? <Demo /> : <Navigate to="/app" replace />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="about" element={<About />} />
          <Route path="users" element={can.admin(role) ? <Users /> : <Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  )
}

function Shell() {
  const { ping, refreshAll, role } = useRekha()
  useEffect(() => { ping() }, [ping])
  useEffect(() => { refreshAll() }, [refreshAll])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={role ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/app/*" element={<Console />} />
      {/* Old URLs */}
      <Route path="/demo" element={<Navigate to="/app/arena" replace />} />
      <Route path="/ledger" element={<Navigate to="/app/ledger" replace />} />
      <Route path="/metrics" element={<Navigate to="/app/metrics" replace />} />
      <Route path="/about" element={<Navigate to="/app/about" replace />} />
      <Route path="/architecture" element={<Navigate to="/app/about?tab=how" replace />} />
      <Route path="/objectives" element={<Navigate to="/app/about?tab=guarantees" replace />} />
      <Route path="/threat-model" element={<Navigate to="/app/about?tab=threats" replace />} />
      <Route path="/roadmap" element={<Navigate to="/app/about?tab=roadmap" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RekhaProvider>
        <Shell />
      </RekhaProvider>
    </MotionConfig>
  )
}
