import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DesignParams } from '../../store/useAppStore'
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Lightbulb } from 'lucide-react'
import './ManufactureScore.css'

interface Props {
    score: number
    params: DesignParams
}

export default function ManufactureScore({ score, params }: Props) {
    const [isExpanded, setIsExpanded] = useState(false)
    const circumference = 2 * Math.PI * 40
    const offset = circumference - (score / 100) * circumference
    const color = score >= 90 ? 'var(--accent-green)' : score >= 70 ? 'var(--accent-indigo)' : 'var(--accent-rose)'

    const issues: string[] = []
    if (params.band.width < 1.0) issues.push('Thin band (< 1mm)')
    if (params.band.thickness < 1.0) issues.push('Thin wall (< 1mm)')
    if (params.prongs.count > 0 && params.prongs.thickness < 0.8) issues.push('Fragile prongs (< 0.8mm)')

    // Improvement tips
    const tips: string[] = []
    if (score < 90) {
        if (params.band.width < 1.8) tips.push('Increase band width to 1.8mm+')
        if (params.band.thickness < 1.5) tips.push('Increase band thickness to 1.5mm+')
        if (params.prongs.count > 0 && params.prongs.thickness < 0.9) tips.push('Strengthen prongs to 0.9mm+')
        if (params.setting.type === 'tension') tips.push('Consider a bezel setting for higher security')
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mfg-root ${isExpanded ? 'expanded' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="mfg-main-row">
                {/* Score dial */}
                <div className="mfg-dial">
                    <svg width="54" height="54" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
                        <motion.circle
                            cx="50" cy="50" r="40" fill="none"
                            stroke={color} strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: offset }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                        />
                    </svg>
                    <div className="mfg-score-overlay">
                        <span className="mfg-score-num" style={{ color }}>{score}</span>
                    </div>
                </div>

                <div className="mfg-info">
                    <div className="mfg-label">Ready for production?</div>
                    <div className="mfg-status" style={{ color }}>
                        {score >= 90 ? 'High' : score >= 70 ? 'Good' : 'Medium'} Precision
                    </div>
                </div>

                <div className="mfg-toggle">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mfg-details"
                    >
                        <div className="mfg-divider" />
                        
                        {issues.length > 0 && (
                            <div className="mfg-section">
                                <div className="mfg-section-title">Critical Feedback</div>
                                {issues.map((issue, i) => (
                                    <div key={i} className="mfg-detail-row error">
                                        <AlertTriangle size={12} />
                                        <span>{issue}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mfg-section">
                            <div className="mfg-section-title">How to reach 90%+</div>
                            {tips.length > 0 ? (
                                tips.map((tip, i) => (
                                    <div key={i} className="mfg-detail-row tip">
                                        <Lightbulb size={12} />
                                        <span>{tip}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="mfg-detail-row success">
                                    <CheckCircle2 size={12} />
                                    <span>Your design is production-ready!</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
