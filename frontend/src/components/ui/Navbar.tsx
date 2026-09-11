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

function BrandLogoIcon() {
    return (
        <div className="navbar-logo-emblem">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="navbar-brand-svg">
                <defs>
                    <linearGradient id="navGold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFF4D0" />
                        <stop offset="35%" stopColor="#E5C175" />
                        <stop offset="75%" stopColor="#B38530" />
                        <stop offset="100%" stopColor="#6C4E14" />
                    </linearGradient>
                    <linearGradient id="navDiamond" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="60%" stopColor="#CBE5F8" />
                        <stop offset="100%" stopColor="#78B9ED" />
                    </linearGradient>
                    <linearGradient id="facetShine" x1="50%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.2" />
                    </linearGradient>
                    <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#D4AF37" floodOpacity="0.4" />
                    </filter>
                </defs>

                {/* Outer Octagonal Gold Shield */}
                <path d="M12 3 L28 3 L37 12 L37 28 L28 37 L12 37 L3 28 L3 12 Z" fill="#100D09" stroke="url(#navGold)" strokeWidth="1.6" />
                <circle cx="20" cy="20" r="14" stroke="url(#navGold)" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.4" />

                {/* Diamond Facets */}
                <g filter="url(#logoGlow)">
                    {/* Crown Top */}
                    <polygon points="14,13 26,13 20,17" fill="url(#facetShine)" />
                    {/* Crown Sides */}
                    <polygon points="9,18 14,13 20,17" fill="url(#navGold)" opacity="0.9" />
                    <polygon points="26,13 31,18 20,17" fill="url(#navGold)" opacity="0.9" />
                    {/* Upper Girdle */}
                    <polygon points="9,18 20,17 14,23" fill="url(#navDiamond)" opacity="0.9" />
                    <polygon points="31,18 20,17 26,23" fill="url(#navDiamond)" opacity="0.9" />
                    <polygon points="20,17 14,23 26,23" fill="#FFFFFF" opacity="0.95" />
                    {/* Pavilion Lower */}
                    <polygon points="9,18 14,23 20,31" fill="url(#navGold)" />
                    <polygon points="31,18 26,23 20,31" fill="url(#navGold)" opacity="0.85" />
                    <polygon points="14,23 26,23 20,31" fill="url(#facetShine)" />
                </g>

                {/* Sparkling Star */}
                <path d="M28 8 L29 11 L32 12 L29 13 L28 16 L27 13 L24 12 L27 11 Z" fill="#FFFBE6" />
                <circle cx="28" cy="12" r="1.2" fill="#FFFFFF" />
            </svg>
        </div>
    )
}

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

                    {/* ── Brand Logo ── */}
                    <button onClick={() => navigate('/')} className="navbar-logo-btn" title="JewelCraft AI — Place Vendôme Autonomous Atelier">
                        <BrandLogoIcon />
                        <div className="navbar-logo-text">
                            <div className="navbar-logo-name">
                                JEWEL<span className="navbar-logo-name-accent">CRAFT</span>
                            </div>
                            <div className="navbar-logo-sub">AUTONOMOUS 3D ATELIER</div>
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
