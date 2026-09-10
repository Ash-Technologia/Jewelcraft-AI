import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/useAuthStore'
import { Sparkles, PenTool, Package2, LogOut, User, Gem } from 'lucide-react'
import { healthCheck } from '../../api/client'
import './Navbar.css'

const navLinks = [
    { path: '/',         label: 'Overview',      icon: Gem },
    { path: '/generate', label: 'AI 3D Studio',  icon: Sparkles },
    { path: '/designer', label: '3D Atelier',    icon: PenTool },
    { path: '/export',   label: 'Export CAD',    icon: Package2 },
]

type AIStatus = 'gemini' | 'openai' | 'mock' | 'offline'

export default function Navbar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, isLoggedIn, logout } = useAuthStore()
    const [scrolled, setScrolled] = useState(false)
    const [aiStatus, setAiStatus] = useState<AIStatus>('offline')

    // Detect scroll for blur intensification
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Check AI backend status on mount
    useEffect(() => {
        healthCheck().then((h) => {
            if (!h) { setAiStatus('offline'); return }
            const v = h.vision_ai
            if (v === 'gemini') setAiStatus('gemini')
            else if (v === 'openai') setAiStatus('openai')
            else setAiStatus('mock')
        }).catch(() => setAiStatus('offline'))
    }, [])

    const aiLabel: Record<AIStatus, string> = {
        gemini: 'Gemini AI',
        openai: 'OpenAI',
        mock: 'Mock Mode',
        offline: 'Offline',
    }
    const aiDotClass: Record<AIStatus, string> = {
        gemini: 'ai-dot ai-dot-live',
        openai: 'ai-dot ai-dot-live',
        mock: 'ai-dot ai-dot-mock',
        offline: 'ai-dot ai-dot-offline',
    }

    return (
        <div className="navbar-wrapper">
            <motion.nav
                initial={{ y: -64, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}
            >
                <div className="navbar-inner">

                    {/* ── Logo ── */}
                    <button onClick={() => navigate('/')} className="navbar-logo-btn">
                        <div className="navbar-logo-gem">
                            <Gem size={18} className="navbar-gem-icon" />
                        </div>
                        <div className="navbar-logo-text">
                            <div className="navbar-logo-name">JewelCraft</div>
                            <div className="navbar-logo-sub">AI Design Studio</div>
                        </div>
                    </button>

                    {/* ── Nav Links ── */}
                    <nav className="navbar-links" aria-label="Main navigation">
                        {navLinks.map((link) => {
                            const Icon = link.icon
                            const active = location.pathname === link.path
                            return (
                                <button
                                    key={link.path}
                                    onClick={() => navigate(link.path)}
                                    className={`navbar-link-btn${active ? ' active' : ''}`}
                                    aria-current={active ? 'page' : undefined}
                                >
                                    <Icon size={15} className="navbar-link-icon" />
                                    <span className="navbar-link-label">{link.label}</span>
                                    {active && (
                                        <motion.div
                                            layoutId="nav-indicator"
                                            className="navbar-indicator"
                                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                </button>
                            )
                        })}
                    </nav>

                    {/* ── Right Actions ── */}
                    <div className="navbar-actions">
                        {/* Launch Studio Quick CTA */}
                        {location.pathname !== '/generate' && (
                            <button
                                className="navbar-launch-btn"
                                onClick={() => navigate('/generate')}
                            >
                                <Sparkles size={13} />
                                <span>Launch Studio</span>
                            </button>
                        )}

                        {/* AI Status Chip */}
                        <div className="navbar-ai-chip" title={`Vision AI: ${aiLabel[aiStatus]}`}>
                            <span className={aiDotClass[aiStatus]} />
                            <span className="navbar-ai-label">{aiLabel[aiStatus]}</span>
                        </div>

                        {isLoggedIn ? (
                            <div className="navbar-user">
                                <div className="navbar-avatar" title={user?.email}>
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="navbar-username">{user?.name}</span>
                                <button
                                    onClick={() => { logout(); navigate('/') }}
                                    className="navbar-logout-btn"
                                    title="Sign Out"
                                    aria-label="Sign Out"
                                >
                                    <LogOut size={13} />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="navbar-signin-btn"
                                onClick={() => navigate('/auth')}
                                id="navbar-signin"
                            >
                                <User size={13} />
                                <span>Sign In</span>
                            </button>
                        )}
                    </div>

                </div>
            </motion.nav>
        </div>
    )
}
