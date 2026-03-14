import { motion } from 'framer-motion'
import './RadarChart.css'

interface Props {
    data: Record<string, number>
    size?: number
    color?: string
    overlayData?: Record<string, number>
    overlayColor?: string
    label?: string
}

const AXIS_LABELS: Record<string, string> = {
    romance: '❤️ Romance',
    boldness: '⚡ Boldness',
    modernity: '🔮 Modernity',
    luxury: '💎 Luxury',
    complexity: '🌀 Complexity',
}

export default function RadarChart({ data, size = 200, color = 'var(--accent-cyan)', overlayData, overlayColor = '#A855F7', label }: Props) {
    const keys = Object.keys(data)
    const n = keys.length
    const cx = size / 2
    const cy = size / 2
    const r = size * 0.38

    const angleStep = (2 * Math.PI) / n
    const startAngle = -Math.PI / 2 // Start from top

    const getPoint = (index: number, value: number) => {
        const angle = startAngle + index * angleStep
        return {
            x: cx + Math.cos(angle) * r * value,
            y: cy + Math.sin(angle) * r * value,
        }
    }

    const getPolygon = (values: Record<string, number>) => {
        return keys.map((key, i) => {
            const p = getPoint(i, values[key] || 0)
            return `${p.x},${p.y}`
        }).join(' ')
    }

    // Grid rings
    const gridRings = [0.25, 0.5, 0.75, 1.0]

    return (
        <div className="radar-root">
            {label && <div className="radar-label">{label}</div>}
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Grid rings */}
                {gridRings.map(ringVal => (
                    <polygon
                        key={ringVal}
                        points={keys.map((_, i) => {
                            const p = getPoint(i, ringVal)
                            return `${p.x},${p.y}`
                        }).join(' ')}
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={1}
                    />
                ))}

                {/* Axis lines */}
                {keys.map((_, i) => {
                    const p = getPoint(i, 1)
                    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                })}

                {/* Overlay polygon (comparison) */}
                {overlayData && (
                    <motion.polygon
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        points={getPolygon(overlayData)}
                        fill={`${overlayColor}22`}
                        stroke={overlayColor}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                    />
                )}

                {/* Main polygon */}
                <motion.polygon
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    points={getPolygon(data)}
                    fill={`${color}33`}
                    stroke={color}
                    strokeWidth={2}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                />

                {/* Dots on vertices */}
                {keys.map((key, i) => {
                    const p = getPoint(i, data[key] || 0)
                    return (
                        <circle key={key} cx={p.x} cy={p.y} r={4} fill={color} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
                    )
                })}

                {/* Labels */}
                {keys.map((key, i) => {
                    const p = getPoint(i, 1.22)
                    return (
                        <text
                            key={key}
                            x={p.x} y={p.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--text-secondary)"
                            fontSize={10}
                        >
                            {AXIS_LABELS[key] || key}
                        </text>
                    )
                })}
            </svg>

            {/* Legend values */}
            <div className="radar-values">
                {keys.map(key => (
                    <div key={key} className="radar-val-row">
                        <span className="radar-val-key">{key}</span>
                        <span className="radar-val-num">{Math.round((data[key] || 0) * 100)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
