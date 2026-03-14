import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, MessageSquare, Bell, Copy, Eye, X, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import './SharePanel.css'

interface Annotation {
    id: string
    x: number
    y: number
    text: string
    author: string
    timestamp: number
}

interface Props {
    designName: string
    onClose: () => void
}

export default function SharePanel({ designName, onClose }: Props) {
    const [shareUrl] = useState(`https://jewelcraft.ai/share/${crypto.randomUUID().slice(0, 8)}`)
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [newComment, setNewComment] = useState('')
    const [showAnnotations, setShowAnnotations] = useState(true)
    const [clientEmail, setClientEmail] = useState('')
    const [notifications, setNotifications] = useState<{ id: string; text: string; time: number }[]>(() => [
        { id: '1', text: 'Design shared with client', time: Date.now() },
    ])
    const annotateRef = useRef<HTMLDivElement>(null)

    const copyLink = () => {
        navigator.clipboard.writeText(shareUrl)
        toast.success('Share link copied!')
    }

    const addAnnotation = (e: React.MouseEvent) => {
        if (!annotateRef.current || !showAnnotations) return
        const rect = annotateRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        const text = prompt('Add annotation:')
        if (text) {
            setAnnotations(prev => [...prev, {
                id: crypto.randomUUID(), x, y, text, author: 'You', timestamp: Date.now(),
            }])
            setNotifications(prev => [{ id: crypto.randomUUID(), text: `Annotation added: "${text}"`, time: Date.now() }, ...prev])
        }
    }

    const sendToClient = () => {
        if (!clientEmail.trim()) return
        toast.success(`Design sent to ${clientEmail}!`)
        setNotifications(prev => [{ id: crypto.randomUUID(), text: `Sent to ${clientEmail}`, time: Date.now() }, ...prev])
        setClientEmail('')
    }

    const addComment = () => {
        if (!newComment.trim()) return
        setNotifications(prev => [{ id: crypto.randomUUID(), text: `Comment: "${newComment}"`, time: Date.now() }, ...prev])
        setNewComment('')
        toast.success('Comment added')
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="share-root">
            <div className="share-header">
                <div className="share-header-left">
                    <Link2 size={18} className="share-header-icon" />
                    <div>
                        <div className="share-title">Share "{designName}"</div>
                        <div className="share-subtitle">Collaborate with clients and team</div>
                    </div>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={onClose} title="Close"><X size={16} /></button>
            </div>

            <div className="share-body">
                {/* Share Link */}
                <div className="share-section">
                    <div className="share-section-label">Share Link</div>
                    <div className="share-url-row">
                        <input className="share-url-input" value={shareUrl} readOnly title="Share URL" placeholder="Share link" />
                        <button className="btn btn-sm btn-gold" onClick={copyLink}><Copy size={12} /> Copy</button>
                    </div>
                </div>

                {/* Send to Client */}
                <div className="share-section">
                    <div className="share-section-label">Send to Client</div>
                    <div className="share-email-row">
                        <input className="share-email-input" placeholder="client@email.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
                        <button className="btn btn-sm btn-gold" onClick={sendToClient}><Send size={12} /> Send</button>
                    </div>
                </div>

                {/* Annotations */}
                <div className="share-section">
                    <div className="share-section-header">
                        <div className="share-section-label"><MessageSquare size={14} /> Annotations</div>
                        <button className={`btn btn-sm btn-ghost ${showAnnotations ? 'btn-gold' : ''}`} onClick={() => setShowAnnotations(!showAnnotations)}>
                            <Eye size={12} /> {showAnnotations ? 'On' : 'Off'}
                        </button>
                    </div>
                    <div ref={annotateRef} className="share-annotate-area" onClick={addAnnotation}>
                        <div className="share-annotate-hint">Click to add annotation pin</div>
                        <AnimatePresence>
                            {annotations.map(a => (
                                <motion.div
                                    key={a.id}
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="share-pin"
                                    style={{ left: `${a.x}%`, top: `${a.y}%` }}
                                    title={`${a.author}: ${a.text}`}
                                >
                                    📌
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    {annotations.length > 0 && (
                        <div className="share-annotation-list">
                            {annotations.map(a => (
                                <div key={a.id} className="share-annotation-item">
                                    <span className="share-ann-author">{a.author}</span>
                                    <span className="share-ann-text">{a.text}</span>
                                    <button title="Remove annotation" aria-label="Remove annotation" className="share-ann-remove" onClick={() => setAnnotations(prev => prev.filter(x => x.id !== a.id))}>×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Comments */}
                <div className="share-section">
                    <div className="share-section-label"><MessageSquare size={14} /> Comments</div>
                    <div className="share-comment-row">
                        <input className="share-comment-input" placeholder="Add a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} />
                        <button className="btn btn-sm btn-gold" onClick={addComment}><Send size={12} /></button>
                    </div>
                </div>

                {/* Notifications */}
                <div className="share-section">
                    <div className="share-section-label"><Bell size={14} /> Activity ({notifications.length})</div>
                    <div className="share-notif-list">
                        {notifications.slice(0, 5).map(n => (
                            <div key={n.id} className="share-notif-item">
                                <span className="share-notif-text">{n.text}</span>
                                <span className="share-notif-time">{new Date(n.time).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
