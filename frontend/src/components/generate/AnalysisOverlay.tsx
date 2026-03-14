import { motion } from 'framer-motion'
import './AnalysisOverlay.css'

interface Component {
    name: string; type: string; position: { x: number; y: number }
}

interface Props {
    analysis: {
        components: Component[]
        confidence: number
        metal?: Record<string, unknown>
        stones?: Record<string, unknown>[]
    }
}

const typeColors: Record<string, string> = {
    stone: 'rgba(79,142,247,0.9)',
    band: 'rgba(61,214,140,0.8)',
    prong: 'rgba(201,168,76,0.9)',
    setting: 'rgba(124,92,191,0.9)',
    halo: 'rgba(232,112,112,0.9)',
}

const typeIcons: Record<string, string> = {
    stone: '💎', band: '⬤', prong: '▲', setting: '◆', halo: '○',
}

export default function AnalysisOverlay({ analysis }: Props) {
    return (
        <div className="ao-root">
            {/* Confidence badge */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="ao-confidence"
            >
                AI Confidence: {(analysis.confidence * 100).toFixed(0)}%
            </motion.div>

            {/* Component annotations */}
            {analysis.components.map((comp, i) => (
                <motion.div
                    key={comp.name}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 300 }}
                    className="ao-annotation"
                    style={{
                        '--pos-x': `${comp.position.x * 100}%`,
                        '--pos-y': `${comp.position.y * 100}%`,
                        '--comp-color': typeColors[comp.type] || 'white',
                        '--comp-border': `${typeColors[comp.type] || 'white'}50`
                    } as React.CSSProperties}
                >
                    <div className="ao-dot" />
                    <div className="ao-label">
                        {typeIcons[comp.type]} {comp.name.replace('_', ' ')}
                    </div>
                    {/* Tooltip on hover */}
                    <div className="ao-tooltip">
                        <div className="ao-tooltip-title">{comp.name.replace(/_/g, ' ')}</div>
                        <div className="ao-tooltip-row">Type: <span>{comp.type}</span></div>
                        <div className="ao-tooltip-row">Position: <span>({(comp.position.x * 100).toFixed(0)}%, {(comp.position.y * 100).toFixed(0)}%)</span></div>
                    </div>
                </motion.div>
            ))}

            {/* Bounding border */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="ao-bound"
            />
        </div>
    )
}
