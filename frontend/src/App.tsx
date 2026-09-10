import { Routes, Route, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import Navbar from './components/ui/Navbar'
import ParticleBackground from './components/ui/ParticleBackground'
import LandingPage from './pages/LandingPage'
import Generate from './pages/Generate'
import Designer from './pages/Designer'
import Export from './pages/Export'
import ClientView from './pages/ClientView'

import AuthPage from './pages/AuthPage'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -16 },
}
const pageTransition: Transition = { duration: 0.35, ease: 'easeInOut' }

function App() {
  const location = useLocation()
  const isClientView = location.pathname.startsWith('/view/')
  useKeyboardShortcuts()

  return (
    <div className="app-root">
      <div className="bg-animated" />
      <div className="bg-noise" />
      <ParticleBackground />

      {!isClientView && <Navbar />}

      <AnimatePresence mode="popLayout">
        <motion.div
          key={location.pathname}
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
        >
          <Routes location={location}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/designer" element={<Designer />} />
            <Route path="/export" element={<Export />} />

            <Route path="/view/:shareId" element={<ClientView />} />
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default App
