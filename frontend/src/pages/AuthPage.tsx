import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../store/useAuthStore'
import { Lock, Mail, User as UserIcon } from 'lucide-react'
import './AuthPage.css'

export default function AuthPage() {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    
    const navigate = useNavigate()
    const location = useLocation()
    const { login } = useAuthStore()

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/catalog'

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password || (mode === 'signup' && !name)) {
            toast.error('Please fill in all fields')
            return
        }

        // Mock auth
        const user = {
            id: crypto.randomUUID(),
            name: mode === 'signup' ? name : (email.split('@')[0] || 'User'),
            email
        }

        login(user)
        toast.success(`Welcome to JewelCraft, ${user.name}!`)
        navigate(from, { replace: true })
    }

    return (
        <div className="page auth-page">
            <div className="bg-animated" />
            <div className="bg-noise" />
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass auth-card"
            >
                <div className="auth-header">
                    <div className="auth-header-icon">💎</div>
                    <h1 className="auth-title">
                        {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p className="auth-desc">
                        {mode === 'signin' 
                            ? 'Enter your details to access your design lab' 
                            : 'Join JewelCraft to save and share your designs'}
                    </p>
                </div>

                <div className="tab-bar auth-tabs">
                    <button 
                        className={`tab auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
                        onClick={() => setMode('signin')}
                    >
                        Sign In
                    </button>
                    <button 
                        className={`tab auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
                        onClick={() => setMode('signup')}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {mode === 'signup' && (
                        <div className="auth-input-wrapper">
                            <UserIcon size={18} className="auth-input-icon" />
                            <input 
                                type="text" 
                                placeholder="Full Name" 
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="auth-input"
                            />
                        </div>
                    )}
                    
                    <div className="auth-input-wrapper">
                        <Mail size={18} className="auth-input-icon" />
                        <input 
                            type="email" 
                            placeholder="Email Address" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="auth-input"
                        />
                    </div>

                    <div className="auth-input-wrapper">
                        <Lock size={18} className="auth-input-icon" />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="auth-input"
                        />
                    </div>

                    <button type="submit" className="btn btn-cyan auth-submit-btn">
                        {mode === 'signin' ? 'Sign In to Lab' : 'Create Account'}
                    </button>
                </form>
            </motion.div>
        </div>
    )
}
