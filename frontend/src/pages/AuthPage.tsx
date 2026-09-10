import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../store/useAuthStore'
import { Lock, Mail, User as UserIcon, Eye, EyeOff, Gem, Sparkles } from 'lucide-react'
import './AuthPage.css'

const SHOWCASE_ITEMS = [
    { label: 'AI Vision Analysis', desc: 'Upload any jewelry photo for instant AI analysis' },
    { label: 'Parametric 3D Design', desc: 'Customize every detail in real-time 3D' },
    { label: 'Luxury Catalog', desc: 'Browse 100+ curated fine jewelry pieces' },
    { label: 'Export to CAD', desc: 'Download production-ready GLB & STL files' },
]

export default function AuthPage() {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showcaseIdx, setShowcaseIdx] = useState(0)

    const navigate = useNavigate()
    const location = useLocation()
    const { login } = useAuthStore()

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/catalog'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password || (mode === 'signup' && !name)) {
            toast.error('Please fill in all fields')
            return
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }

        setIsLoading(true)
        // Simulated auth delay (replace with real auth in production)
        await new Promise(r => setTimeout(r, 800))

        const user = {
            id: crypto.randomUUID(),
            name: mode === 'signup' ? name : (email.split('@')[0] || 'Designer'),
            email,
        }

        login(user)
        toast.success(`Welcome to JewelCraft, ${user.name}! ✨`, { duration: 3000 })
        setIsLoading(false)
        navigate(from, { replace: true })
    }

    return (
        <div className="auth-page">
            <div className="bg-animated" />
            <div className="bg-noise" />

            <div className="auth-layout">

                {/* ── Left Panel — Feature Showcase ── */}
                <motion.div
                    className="auth-showcase"
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                    {/* Logo */}
                    <div className="auth-showcase-logo">
                        <div className="auth-gem-orb">
                            <Gem size={32} />
                        </div>
                        <div>
                            <div className="auth-brand-name">JewelCraft AI</div>
                            <div className="auth-brand-tagline">Luxury Design Studio</div>
                        </div>
                    </div>

                    {/* Animated feature cards */}
                    <div className="auth-features">
                        {SHOWCASE_ITEMS.map((item, i) => (
                            <motion.div
                                key={i}
                                className={`auth-feature-card${showcaseIdx === i ? ' active' : ''}`}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08, duration: 0.5 }}
                                onClick={() => setShowcaseIdx(i)}
                            >
                                <div className="auth-feature-dot">
                                    <Sparkles size={12} />
                                </div>
                                <div>
                                    <div className="auth-feature-label">{item.label}</div>
                                    <div className="auth-feature-desc">{item.desc}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Decorative ring ornament */}
                    <div className="auth-ornament">
                        <div className="auth-ornament-ring auth-ornament-ring--1" />
                        <div className="auth-ornament-ring auth-ornament-ring--2" />
                        <div className="auth-ornament-ring auth-ornament-ring--3" />
                        <div className="auth-ornament-gem">💎</div>
                    </div>

                    <p className="auth-showcase-footer">
                        Production-grade jewelry AI — powered by Gemini Vision
                    </p>
                </motion.div>

                {/* ── Right Panel — Auth Form ── */}
                <motion.div
                    className="auth-form-panel"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                >
                    <div className="auth-card">

                        {/* Header */}
                        <div className="auth-header">
                            <h1 className="auth-title">
                                {mode === 'signin' ? 'Welcome back' : 'Join JewelCraft'}
                            </h1>
                            <p className="auth-subtitle">
                                {mode === 'signin'
                                    ? 'Sign in to access your design lab'
                                    : 'Create your account to save and share designs'}
                            </p>
                        </div>

                        {/* Mode Tabs */}
                        <div className="auth-tabs">
                            <button
                                className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
                                onClick={() => setMode('signin')}
                                type="button"
                                id="auth-signin-tab"
                            >
                                Sign In
                            </button>
                            <button
                                className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
                                onClick={() => setMode('signup')}
                                type="button"
                                id="auth-signup-tab"
                            >
                                Sign Up
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">

                            <AnimatePresence mode="wait">
                                {mode === 'signup' && (
                                    <motion.div
                                        key="name-field"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="auth-field-wrapper"
                                    >
                                        <div className="auth-field">
                                            <UserIcon size={16} className="auth-field-icon" />
                                            <input
                                                type="text"
                                                placeholder="Full Name"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                className="auth-input"
                                                id="auth-name"
                                                autoComplete="name"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="auth-field">
                                <Mail size={16} className="auth-field-icon" />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="auth-input"
                                    id="auth-email"
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div className="auth-field">
                                <Lock size={16} className="auth-field-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="auth-input"
                                    id="auth-password"
                                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                                    required
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowPassword(p => !p)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>

                            <button
                                type="submit"
                                className={`auth-submit-btn${isLoading ? ' loading' : ''}`}
                                id="auth-submit"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="auth-spinner" />
                                ) : (
                                    <>
                                        <Gem size={15} />
                                        {mode === 'signin' ? 'Enter Design Lab' : 'Create Account'}
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="auth-footer-note">
                            {mode === 'signin' ? (
                                <>Don't have an account?{' '}
                                    <button className="auth-switch-link" onClick={() => setMode('signup')}>
                                        Sign up free
                                    </button>
                                </>
                            ) : (
                                <>Already have an account?{' '}
                                    <button className="auth-switch-link" onClick={() => setMode('signin')}>
                                        Sign in
                                    </button>
                                </>
                            )}
                        </p>
                    </div>
                </motion.div>

            </div>
        </div>
    )
}
