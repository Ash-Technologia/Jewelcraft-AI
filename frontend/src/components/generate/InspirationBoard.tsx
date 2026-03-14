import { motion, AnimatePresence } from 'framer-motion'
import { Pin, Trash2, Wand2 } from 'lucide-react'
import { DesignParams } from '../../store/useAppStore'
import './InspirationBoard.css'

export interface PinnedItem {
    id: string
    componentKey: string
    label: string
    icon: string
    sourceLabel: string
    params: Partial<DesignParams>
}

interface Props {
    pins: PinnedItem[]
    onRemovePin: (id: string) => void
    onGenerateFromPins: () => void
}

export default function InspirationBoard({ pins, onRemovePin, onGenerateFromPins }: Props) {
    if (pins.length === 0) return null

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="ib-root"
        >
            <div className="ib-header">
                <div className="ib-header-left">
                    <Pin size={16} className="ib-header-icon" />
                    <div className="ib-title">Inspiration Board</div>
                    <span className="badge badge-gold ib-count">{pins.length} pins</span>
                </div>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="btn btn-gold btn-sm"
                    onClick={onGenerateFromPins}
                    disabled={pins.length < 2}
                >
                    <Wand2 size={14} /> Generate from Pins
                </motion.button>
            </div>

            <div className="ib-pins">
                <AnimatePresence>
                    {pins.map(pin => (
                        <motion.div
                            key={pin.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="ib-pin"
                        >
                            <span className="ib-pin-icon">{pin.icon}</span>
                            <div className="ib-pin-info">
                                <div className="ib-pin-label">{pin.label}</div>
                                <div className="ib-pin-source">from {pin.sourceLabel}</div>
                            </div>
                            <button
                                className="ib-pin-remove"
                                onClick={() => onRemovePin(pin.id)}
                            >
                                <Trash2 size={12} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}
