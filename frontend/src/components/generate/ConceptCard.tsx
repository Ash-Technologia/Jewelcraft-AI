import { motion } from 'framer-motion'
import { Star, Zap } from 'lucide-react'
import JewelViewer from '../viewer/JewelViewer'
import { DesignParams } from '../../store/useAppStore'
import './ConceptCard.css'

interface Props {
    concept: {
        id: string; label: string; description: string;
        metal: string; setting: string; finish: string;
        priceEstimate: number; manufactureScore: number;
        color: string; params: DesignParams; thumbnail: string;
        variant?: 'classic' | 'modern' | 'ornate';
    }
    isSelected: boolean
    dimmed?: boolean
    onSelect: () => void
    onUseAsReference?: () => void
}

export default function ConceptCard({ concept, isSelected, dimmed, onSelect, onUseAsReference }: Props) {

    const personaColors: Record<string, string> = {
        Classic: 'var(--accent-cyan)', Modern: 'var(--accent-indigo)', Ornate: 'var(--accent-silver)',
    }
    const accentColor = personaColors[concept.label] || 'var(--accent-cyan)'

    const scoreColor = concept.manufactureScore >= 90 ? 'var(--accent-cyan)'
        : concept.manufactureScore >= 70 ? 'var(--accent-indigo)' : 'var(--accent-rose)'

    return (
        <motion.div
            whileHover={{ y: -8, boxShadow: `0 24px 80px rgba(0,0,0,0.6)` }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={onSelect}
            className={`cc-root glass ${isSelected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`}
            style={{
                '--accent': accentColor,
                '--score': scoreColor,
                '--swatch': concept.color,
                background: isSelected ? 'rgba(0, 242, 255, 0.05)' : undefined,
                border: isSelected ? '1px solid var(--accent-cyan)' : undefined
            } as React.CSSProperties}
        >
            {/* 3D Viewer */}
            <div className="cc-preview">
                <JewelViewer params={concept.params} mini autoRotate variant={concept.variant} />

                {/* Persona badge */}
                <div className="cc-persona-pos">
                    <span className="badge cc-persona-badge">
                        {concept.label === 'Classic' ? '👑' : concept.label === 'Modern' ? '⚡' : '✨'} {concept.label}
                    </span>
                </div>

                {/* Score badge */}
                <div className="cc-score-pos">
                    <span className="badge cc-score-badge">
                        ✓ {concept.manufactureScore}/100
                    </span>
                </div>



                {/* Selected glow ring */}
                {isSelected && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="cc-selected-ring"
                    />
                )}
            </div>

            {/* Content */}
            <div className="cc-content">
                <div className="cc-header-row">
                    <div>
                        <div className="cc-title">{concept.label} Concept</div>
                        <div className="text-secondary cc-desc">{concept.description}</div>
                    </div>
                    {isSelected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="cc-star">
                            <Star size={18} fill="currentColor" />
                        </motion.div>
                    )}
                </div>

                {/* Tags */}
                <div className="cc-tags">
                    <span className="pill pill-metal">{concept.metal}</span>
                    <span className="pill pill-stone">{concept.setting}</span>
                    <span className="pill pill-style">{concept.finish}</span>
                </div>

                {/* Price */}
                <div className="cc-price-row">
                    <div>
                        <div className="cc-price-label">Est. Price</div>
                        <div className="text-price">₹{concept.priceEstimate.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="cc-mfg-right">
                        <div className="cc-mfg-label">Mfg Score</div>
                        <div className="cc-mfg-value">{concept.manufactureScore}<span className="cc-mfg-denom">/100</span></div>
                    </div>
                </div>

                {/* Metal color swatch */}
                <div className="cc-swatch-row">
                    <div className="cc-swatch-dot" />
                    <span className="cc-swatch-label">{concept.metal}</span>
                </div>
            </div>

            {/* Action footer */}
            <div className={`cc-footer ${isSelected ? 'selected' : ''}`}>
                <span className="cc-footer-status">
                    {isSelected ? '✓ Selected' : 'Click to select'}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {!isSelected && onUseAsReference && (
                        <button
                            className="cc-ref-btn"
                            onClick={(e) => { e.stopPropagation(); onUseAsReference?.(); }}
                        >📌 Reference</button>
                    )}
                    <div className="btn btn-ghost btn-sm cc-footer-preview">
                        <Zap size={11} /> Preview
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
