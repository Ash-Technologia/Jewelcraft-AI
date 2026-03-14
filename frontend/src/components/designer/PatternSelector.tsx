import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Palette } from 'lucide-react'
import { JEWELRY_PATTERNS, searchPatterns, type JewelryPattern } from '../../data/patterns'
import './PatternSelector.css'

interface Props {
    selectedPatternId: string | null
    onSelect: (pattern: JewelryPattern | null) => void
    jewelryType?: string
}

export default function PatternSelector({ selectedPatternId, onSelect, jewelryType = 'ring' }: Props) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const filteredPatterns = searchQuery
        ? searchPatterns(searchQuery)
        : JEWELRY_PATTERNS.filter(p =>
            p.compatibleTypes.includes(jewelryType as JewelryPattern['compatibleTypes'][0])
        )

    const selectedPattern = JEWELRY_PATTERNS.find(p => p.id === selectedPatternId)

    return (
        <div className="psel-root">
            <button className="psel-trigger" onClick={() => setIsOpen(!isOpen)}>
                <Palette size={14} />
                <span>{selectedPattern ? selectedPattern.name : 'Surface Pattern'}</span>
                {selectedPattern && (
                    <span className="badge badge-gold psel-badge">Active</span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="psel-dropdown"
                    >
                        <div className="psel-search-row">
                            <Search size={14} className="psel-search-icon" />
                            <input
                                className="psel-search-input"
                                placeholder="Search patterns..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* None option */}
                        <div
                            className={`psel-item ${!selectedPatternId ? 'active' : ''}`}
                            onClick={() => { onSelect(null); setIsOpen(false) }}
                        >
                            <div className="psel-item-thumb psel-none-thumb">⊘</div>
                            <div className="psel-item-info">
                                <div className="psel-item-name">No Pattern</div>
                                <div className="psel-item-desc">Plain metal surface</div>
                            </div>
                        </div>

                        {/* Pattern grid */}
                        <div className="psel-grid">
                            {filteredPatterns.map(p => (
                                <div
                                    key={p.id}
                                    className={`psel-item ${selectedPatternId === p.id ? 'active' : ''}`}
                                    onClick={() => { onSelect(p); setIsOpen(false) }}
                                >
                                    <img src={p.thumbnailUrl} alt={p.name} className="psel-item-thumb" />
                                    <div className="psel-item-info">
                                        <div className="psel-item-name">{p.name}</div>
                                        <div className="psel-item-desc">{p.description}</div>
                                        <div className="psel-item-tags">
                                            {p.tags.slice(0, 3).map(t => (
                                                <span key={t} className="psel-tag">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
