import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAppStore, Version } from '../../store/useAppStore'
import { Clock, PlusCircle } from 'lucide-react'
import './VersionFilmstrip.css'

export default function VersionFilmstrip() {
    const { versions, addVersion, setCurrentParams, currentParams, isSandboxMode } = useAppStore()
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    const handleRestore = (v: Version) => {
        setCurrentParams(v.params)
    }

    const generateThumbnailGradient = (v: Version) => {
        const p = v.params
        const metalColor = p.metal.color || '#FFD700'
        const stoneColor = p.stones[0]?.color || '#FFFFFF'
        return `radial-gradient(circle at 50% 45%, ${stoneColor}60 20%, ${metalColor}80 60%, transparent 80%)`
    }

    return (
        <div className="vf-root">
            <div className="vf-header">
                <Clock size={14} className="vf-header-icon" />
                <span className="vf-header-title">Version History</span>
                <span className={`badge badge-gray vf-count-badge`}>{versions.length} versions</span>
                {isSandboxMode && <span className={`badge vf-frozen-badge`}>🧪 Frozen</span>}
                {!isSandboxMode && versions.length === 0 && (
                    <button
                        className="btn btn-ghost btn-sm vf-snapshot-btn"
                        onClick={() => addVersion({ id: crypto.randomUUID(), timestamp: Date.now(), label: 'Initial Design', thumbnail: '', params: currentParams, changeSummary: 'Starting point', priceEstimate: 95000, manufactureScore: 88 })}>
                        <PlusCircle size={11} /> Save Snapshot
                    </button>
                )}
            </div>

            {versions.length === 0 ? (
                <div className="vf-empty">Accept changes to see version history here</div>
            ) : (
                <div className="filmstrip">
                    {versions.map((v, i) => {
                        const isActive = i === versions.length - 1
                        return (
                            <motion.div
                                key={v.id}
                                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                transition={{ duration: 0.3, type: 'spring' }}
                                className={`filmstrip-card ${isActive ? 'active' : ''}`}
                                onClick={() => handleRestore(v)}
                                onMouseEnter={() => setHoveredId(v.id)}
                                onMouseLeave={() => setHoveredId(null)}
                            >
                                <div className="vf-thumb" style={{ '--thumb-bg': generateThumbnailGradient(v) } as React.CSSProperties}>
                                    <div className="vf-dot" />
                                    <div className="vf-version-num">v{i + 1}</div>
                                </div>
                                <div className="vf-card-label">
                                    {v.label || 'Version ' + (i + 1)}
                                </div>
                                {/* Hover tooltip */}
                                {hoveredId === v.id && (
                                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`tooltip vf-tooltip`}>
                                        <div className="vf-tooltip-title">{v.label}</div>
                                        <div className="vf-tooltip-summary">{v.changeSummary}</div>
                                        <div className="vf-tooltip-meta">
                                            <span className="vf-tooltip-price">₹{(v.priceEstimate / 1000).toFixed(0)}k</span>
                                            <span className="vf-tooltip-score">{v.manufactureScore}/100</span>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
