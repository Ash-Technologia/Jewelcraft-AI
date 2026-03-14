import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sliders } from 'lucide-react'
import { DesignParams } from '../../store/useAppStore'
import './HybridSlider.css'

export interface HybridConcept {
    label: string
    priceEstimate: number
    params: DesignParams
    [key: string]: unknown
}

interface Props {
    concepts: HybridConcept[]
    onSelect: (params: DesignParams) => void
}

function blendParams(a: DesignParams, b: DesignParams, ratio: number): DesignParams {
    const blend = (va: number, vb: number) => va * (1 - ratio) + vb * ratio
    return {
        ...a,
        metal: ratio < 0.5 ? a.metal : b.metal,
        band: {
            ...a.band,
            width: blend(a.band.width, b.band.width),
            thickness: blend(a.band.thickness, b.band.thickness),
        },
        stones: a.stones,
        halo: { ...a.halo, enabled: ratio > 0.5 ? b.halo.enabled : a.halo.enabled, stoneCount: Math.round(blend(a.halo.stoneCount, b.halo.stoneCount)) },
        prongs: { ...a.prongs, count: ratio > 0.5 ? b.prongs.count : a.prongs.count, height: blend(a.prongs.height, b.prongs.height) },
        engraving: a.engraving,
        style_dna: {
            romance: blend(a.style_dna.romance, b.style_dna.romance),
            boldness: blend(a.style_dna.boldness, b.style_dna.boldness),
            modernity: blend(a.style_dna.modernity, b.style_dna.modernity),
            luxury: blend(a.style_dna.luxury, b.style_dna.luxury),
            complexity: blend(a.style_dna.complexity, b.style_dna.complexity),
        },
        setting: ratio > 0.5 ? b.setting : a.setting,
    }
}

export default function HybridSlider({ concepts, onSelect }: Props) {
    const [ratio, setRatio] = useState(0.5)
    const [conceptA, setConceptA] = useState(0)
    const [conceptB, setConceptB] = useState(2)

    const hybrid = blendParams(concepts[conceptA]?.params, concepts[conceptB]?.params, ratio)

    return (
        <div className="card glass-gold hs-root">
            <div className="hs-header">
                <Sliders size={18} className="hs-header-icon" />
                <div>
                    <div className="hs-title">Hybrid Generator</div>
                    <div className="text-secondary hs-subtitle">Blend two concepts at any ratio to create a unique 4th design</div>
                </div>
            </div>

            <div className="hs-grid">
                {/* Concept A selector */}
                <div>
                    <div className="hs-selector-label">Concept A</div>
                    <div className="hs-btn-row">
                        {concepts.map((c, i) => (
                            <button key={i} onClick={() => setConceptA(i)}
                                className={`btn btn-sm hs-concept-btn-a${conceptA === i ? ' active' : ''}`}
                            >{c.label}</button>
                        ))}
                    </div>
                </div>

                {/* Blend ratio */}
                <div className="hs-blend-center">
                    <div className="hs-blend-pct">{Math.round(ratio * 100)}%</div>
                    <div className="hs-blend-label">Blend towards B</div>
                    <input
                        aria-label="Blend ratio" title="Blend ratio"
                        type="range" min="0" max="100" value={Math.round(ratio * 100)}
                        onChange={e => setRatio(Number(e.target.value) / 100)}
                        className="hs-blend-range"
                        style={{ '--val': `${ratio * 100}%` } as React.CSSProperties}
                    />
                    <div className="hs-blend-minmax">
                        <span>A</span><span>Hybrid</span><span>B</span>
                    </div>
                </div>

                {/* Concept B selector */}
                <div className="hs-selector-b">
                    <div className="hs-selector-label">Concept B</div>
                    <div className="hs-btn-row-b">
                        {concepts.map((c, i) => (
                            <button key={i} onClick={() => setConceptB(i)}
                                className={`btn btn-sm hs-concept-btn-b${conceptB === i ? ' active' : ''}`}
                            >{c.label}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hybrid Preview */}
            <div className="hs-preview">
                <div className="hs-preview-header">
                    <div>
                        <span className="badge badge-purple hs-preview-label">Hybrid Design</span>
                        <span className="text-secondary hs-preview-desc">
                            {concepts[conceptA]?.label} + {concepts[conceptB]?.label} at {Math.round(ratio * 100)}%
                        </span>
                    </div>
                    <div className="hs-preview-right">
                        <span className="text-price hs-preview-price">
                            ₹{Math.round((concepts[conceptA]?.priceEstimate || 0) * (1 - ratio) + (concepts[conceptB]?.priceEstimate || 0) * ratio).toLocaleString('en-IN')}
                        </span>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="btn btn-gold"
                            onClick={() => onSelect(hybrid)}
                        >Open Hybrid →</motion.button>
                    </div>
                </div>
                <div className="hs-dna-row">
                    {Object.entries(hybrid.style_dna).map(([key, val]) => (
                        <div key={key} className="hs-dna-col">
                            <div className="hs-dna-key">{key}</div>
                            <div className="hs-dna-track">
                                <div className="hs-dna-fill" style={{ width: `${(val as number) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
