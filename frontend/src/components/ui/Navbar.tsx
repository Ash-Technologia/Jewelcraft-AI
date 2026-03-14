import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/useAuthStore'
import { User, LogOut } from 'lucide-react'
import './Navbar.css'

const navLinks = [
    { path: '/generate', label: 'Generate', icon: '✨' },
    { path: '/designer', label: 'Designer', icon: '🎨' },
    { path: '/catalog', label: 'Catalog', icon: '🛍️' },
    { path: '/export',   label: 'Export', icon: '📦' },
]



export default function Navbar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, isLoggedIn, logout } = useAuthStore()

    return (
        <div className="navbar-wrapper">
            <motion.nav
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="navbar"
            >
                <div className="navbar-inner">
                    {/* Logo */}
                    <button onClick={() => navigate('/')} className="navbar-logo-btn">
                        <span className="navbar-logo-icon">💎</span>
                        <div className="navbar-logo-text">
                            <div className="navbar-logo-name">JewelCraft AI</div>
                            <div className="navbar-logo-sub">Design Studio</div>
                        </div>
                    </button>

                    {/* Nav links */}
                    <div className="navbar-links">
                        {navLinks.map((link) => {
                            const active = location.pathname === link.path || (link.path === '/generate' && location.pathname === '/')
                            return (
                                <button
                                    key={link.path}
                                    onClick={() => navigate(link.path)}
                                    className={`btn btn-sm navbar-link-btn${active ? ' active' : ''}`}
                                >
                                    <span>{link.icon}</span>
                                    {link.label}
                                    {active && (
                                        <motion.div
                                            layoutId="nav-indicator"
                                            className="navbar-indicator"
                                        />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Auth Status / Profile */}
                    <div className="navbar-actions">
                        {isLoggedIn ? (
                            <div className="navbar-user-profile">
                                <div className="navbar-user-avatar">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="navbar-user-name">{user?.name}</span>
                                <button onClick={() => { logout(); navigate('/') }} className="navbar-logout-btn" title="Sign Out">
                                    <LogOut size={14} />
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-sm btn-cyan navbar-signin-btn" onClick={() => navigate('/auth')}>
                                <User size={14} style={{ marginRight: '6px' }} /> Sign In
                            </button>
                        )}
                    </div>

                </div>
            </motion.nav>
        </div>
    )
}
