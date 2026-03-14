import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Paintbrush, Layers } from 'lucide-react'
import { DesignParams } from '../../store/useAppStore'
import JewelViewer from '../viewer/JewelViewer'
import './ReferencePanel.css'

interface ReferenceConcept {
    id: string
    label: string
    params: DesignParams
    color: string
}

interface Props {
    concept: ReferenceConcept
    onClose: () => void
    onApplyStyle: (params: Partial<DesignParams>) => void
    onBorrowComponent: (component: string, params: Partial<DesignParams>) => void
}

const BORROWABLE_COMPONENTS = [
    { key: 'metal', label: 'Metal & Finish', icon: '🪙', extract: (p: DesignParams) => ({ metal: p.metal }) },
    { key: 'stones', label: 'Stones', icon: '💎', extract: (p: DesignParams) => ({ stones: p.stones }) },
    { key: 'band', label: 'Band Profile', icon: '💍', extract: (p: DesignParams) => ({ band: p.band }) },
    { key: 'setting', label: 'Setting Type', icon: '🔧', extract: (p: DesignParams) => ({ setting: p.setting, prongs: p.prongs }) },
    { key: 'halo', label: 'Halo', icon: '✨', extract: (p: DesignParams) => ({ halo: p.halo }) },
    { key: 'style_dna', label: 'Style DNA', icon: '🧬', extract: (p: DesignParams) => ({ style_dna: p.style_dna }) },
]

export default function ReferencePanel({ concept, onClose, onApplyStyle, onBorrowComponent }: Props) {
    const [hoveredComponent, setHoveredComponent] = useState<string | null>(null)

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="refp-root"
            >
                <div className="refp-header">
                    <div className="refp-header-left">
                        <Layers size={18} className="refp-header-icon" />
                        <div>
                            <div className="refp-title">Use "{concept.label}" as Reference</div>
                            <div className="refp-subtitle">Borrow the entire style or individual components</div>
                        </div>
                    </div>
                    <button className="btn btn-sm btn-ghost refp-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <div className="refp-body">
                    {/* Mini 3D preview */}
                    <div className="refp-preview">
                        <JewelViewer params={concept.params} mini autoRotate />
                    </div>

                    {/* Actions */}
                    <div className="refp-actions">
                        {/* Full style transfer */}
                        <button
                            className="refp-action-btn refp-style-btn"
                            onClick={() => onApplyStyle(concept.params)}
                        >
                            <Paintbrush size={16} />
                            <div>
                                <div className="refp-action-title">Apply Full Style</div>
                                <div className="refp-action-desc">Copy all visual parameters</div>
                            </div>
                        </button>

                        {/* Component borrowing */}
                        <div className="refp-components-label">Or borrow individual components:</div>
                        <div className="refp-components-grid">
                            {BORROWABLE_COMPONENTS.map(comp => (
                                <button
                                    key={comp.key}
                                    className={`refp-comp-btn ${hoveredComponent === comp.key ? 'hovered' : ''}`}
                                    onMouseEnter={() => setHoveredComponent(comp.key)}
                                    onMouseLeave={() => setHoveredComponent(null)}
                                    onClick={() => onBorrowComponent(comp.key, comp.extract(concept.params) as Partial<DesignParams>)}
                                >
                                    <span className="refp-comp-icon">{comp.icon}</span>
                                    <span className="refp-comp-label">{comp.label}</span>
                                    <Copy size={12} className="refp-comp-copy" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
