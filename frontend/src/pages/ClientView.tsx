import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { MessageSquare, Pin, Send } from 'lucide-react'
import { DEFAULT_PARAMS } from '../store/useAppStore'
import JewelViewer from '../components/viewer/JewelViewer'
import './ClientView.css'

interface Annotation { id: string; x: number; y: number; text: string; timestamp: number }

export default function ClientView() {
    const { shareId } = useParams()
    const navigate = useNavigate()
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [annotateMode, setAnnotateMode] = useState(false)
    const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
    const [commentText, setCommentText] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const viewerRef = useRef<HTMLDivElement>(null)

    const handleViewerClick = (e: React.MouseEvent) => {
        if (!annotateMode) return
        const rect = viewerRef.current!.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        setPendingPin({ x, y })
    }

    const handleAddComment = () => {
        if (!pendingPin || !commentText.trim()) return
        setAnnotations(prev => [...prev, { id: crypto.randomUUID(), ...pendingPin, text: commentText, timestamp: Date.now() }])
        setPendingPin(null)
        setCommentText('')
        toast.success('Annotation added!')
    }

    const handleSubmit = () => {
        if (annotations.length === 0) { toast.error('Add at least one annotation before submitting'); return }
        setSubmitted(true)
        toast.success(`${annotations.length} feedback annotation(s) sent to designer!`)
    }

    return (
        <div className="cv-root">
            {/* Client header */}
            <div className="cv-header">
                <div className="cv-header-logo">
                    <span className="cv-header-gem">💎</span>
                    <div>
                        <div className="cv-header-name">JewelCraft AI</div>
                        <div className="cv-header-sub">Design Review — Share ID: {shareId}</div>
                    </div>
                </div>
                <div className="cv-header-actions">
                    <button className="btn btn-sm btn-ghost cv-back-btn" onClick={() => navigate('/export')}>
                        ✕ Close Preview
                    </button>
                    <button
                        className={`btn btn-sm cv-annotate-btn ${annotateMode ? 'btn-cyan' : 'btn-ghost'}`}
                        onClick={() => setAnnotateMode(!annotateMode)}
                    >
                        <Pin size={13} /> {annotateMode ? 'Exit Annotate' : 'Annotate Design'}
                    </button>
                    <button className="btn btn-cyan btn-sm cv-submit-btn" onClick={handleSubmit} disabled={submitted}>
                        <Send size={13} /> {submitted ? 'Feedback Sent ✓' : `Send Feedback (${annotations.length})`}
                    </button>
                </div>
            </div>

            {/* Main layout */}
            <div className="cv-main">
                {/* 3D Viewer */}
                <div ref={viewerRef} className={`cv-viewer-col${annotateMode ? ' annotate' : ''}`} onClick={handleViewerClick}>
                    <JewelViewer params={DEFAULT_PARAMS} lightPreset="showroom" autoRotate />

                    {/* Annotation pins — left/top are data-driven — now using CSS variables */}
                    {annotations.map(pin => (
                        <motion.div key={pin.id} initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="cv-pin-anchor" style={{ '--pos-x': `${pin.x}%`, '--pos-y': `${pin.y}%` } as React.CSSProperties}>
                            <div className="cv-pin-marker">
                                <span className="cv-pin-exclaim">!</span>
                            </div>
                            <div className="cv-pin-label">{pin.text}</div>
                        </motion.div>
                    ))}

                    {/* Pending pin input — left/top are data-driven — now using CSS variables */}
                    {pendingPin && (
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                            className="cv-pending-pin" style={{ '--pos-x': `${pendingPin.x}%`, '--pos-y': `${pendingPin.y}%` } as React.CSSProperties}>
                            <div className="cv-pending-title">📝 Add Comment</div>
                            <input value={commentText} onChange={e => setCommentText(e.target.value)}
                                placeholder="Describe your feedback..."
                                aria-label="Comment text"
                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                className="cv-pending-input" autoFocus />
                            <div className="cv-pending-actions">
                                <button className="btn btn-cyan btn-sm cv-add-pin-btn" onClick={handleAddComment}>Add Pin</button>
                                <button className="btn btn-ghost btn-sm cv-cancel-pin-btn" onClick={() => setPendingPin(null)}>Cancel</button>
                            </div>
                        </motion.div>
                    )}

                    {/* Annotate mode hint */}
                    {annotateMode && (
                        <div className="cv-annotate-hint">
                            📍 Click anywhere on the ring to add a feedback pin
                        </div>
                    )}
                </div>

                {/* Feedback sidebar */}
                <div className="cv-sidebar">
                    <div className="cv-sidebar-header">
                        <div className="cv-sidebar-title">
                            <MessageSquare size={14} className="cv-sidebar-title-icon" />
                            Feedback ({annotations.length})
                        </div>
                        <div className="text-secondary cv-sidebar-sub">Click 'Annotate Design' to add comments directly on the 3D model</div>
                    </div>
                    <div className="cv-annotations-list">
                        <AnimatePresence>
                            {annotations.length === 0 ? (
                                <div className="cv-empty-annotations">
                                    <Pin size={24} className="cv-empty-pin-icon" />
                                    No annotations yet.<br />Click the ring to add feedback.
                                </div>
                            ) : annotations.map((a, i) => (
                                <motion.div key={a.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                                    className="cv-annotation-item">
                                    <div className="cv-annotation-header">
                                        <span className="cv-annotation-pin-label">📍 Pin {i + 1}</span>
                                        <button onClick={() => setAnnotations(prev => prev.filter(x => x.id !== a.id))}
                                            className="cv-annotation-delete">✕</button>
                                    </div>
                                    <div className="cv-annotation-text">{a.text}</div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    {!submitted && (
                        <div className="cv-submit-footer">
                            <button className="btn btn-cyan cv-submit-full-btn" onClick={handleSubmit}>
                                <Send size={14} /> Send {annotations.length} Feedback{annotations.length !== 1 ? 's' : ''} to Designer
                            </button>
                        </div>
                    )}
                    {submitted && (
                        <div className="cv-submitted">
                            <div className="cv-submitted-check">✓</div>
                            <div className="cv-submitted-title">Feedback Sent!</div>
                            <div className="cv-submitted-sub">The designer has been notified and will review your {annotations.length} comment(s).</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
