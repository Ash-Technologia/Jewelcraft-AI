import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, DesignParams } from '../../store/useAppStore'
import { AlertTriangle } from 'lucide-react'
import './ManualControls.css'

interface Props {
    onParamChange: (p: DesignParams, label: string, summary: string) => void
}

const METALS = [
    { id: 'yellow_gold', label: 'Yellow Gold 18k', color: '#FFD700', roughness: 0.15 },
    { id: 'rose_gold', label: 'Rose Gold 18k', color: '#E8A090', roughness: 0.12 },
    { id: 'white_gold', label: 'White Gold 18k', color: '#E8E8F0', roughness: 0.08 },
    { id: 'platinum', label: 'Platinum', color: '#E8E8F0', roughness: 0.06 },
    { id: 'silver', label: 'Sterling Silver', color: '#C0C0C8', roughness: 0.2 },
    { id: 'titanium', label: 'Titanium', color: '#7A7A85', roughness: 0.55 },
]

const STONES = [
    { id: 'diamond', label: 'Diamond', color: '#FFFFFF', transmission: 0.98, ior: 2.417 },
    { id: 'sapphire', label: 'Sapphire', color: '#0F52BA', transmission: 0.72, ior: 1.77 },
    { id: 'ruby', label: 'Ruby', color: '#E0103A', transmission: 0.7, ior: 1.76 },
    { id: 'emerald', label: 'Emerald', color: '#168444', transmission: 0.65, ior: 1.58 },
    { id: 'moissanite', label: 'Moissanite', color: '#F8F8FF', transmission: 0.95, ior: 2.65 },
    { id: 'onyx', label: 'Onyx', color: '#1A1A1A', transmission: 0.0, ior: 1.5 },
]

export default function ManualControls({ onParamChange }: Props) {
    const { currentParams } = useAppStore()
    const p = currentParams
    const [warnings, setWarnings] = useState<string[]>([])

    const type = (p.type || 'ring').toLowerCase()
    const isNecklace = type === 'necklace' || type === 'pendant' || type === 'chain'
    const isEarring = type === 'earring' || type === 'earrings'
    const isBracelet = type === 'bracelet' || type === 'bangle' || type === 'cuff'
    const isCufflinks = type === 'cufflinks'
    const isTieBar = type === 'tiebar' || type === 'tie_bar'
    const isLapelPin = type === 'lapel_pin'
    const isRing = !isNecklace && !isEarring && !isBracelet && !isCufflinks && !isTieBar && !isLapelPin
    const isSignet = isRing && (p.setting.type === 'signet' || p.setting.type === 'flush')

    const update = (delta: Partial<DesignParams>, label: string) => {
        const newP = { ...p, ...delta }
        // Validate
        const w: string[] = []
        if (newP.band.width < 1.0 && isRing) w.push('Band width below 1mm minimum for structural integrity')
        if (newP.prongs.thickness < 0.8 && newP.prongs.count > 0) w.push('Prong thickness below 0.8mm — setting integrity risk')
        setWarnings(w)
        onParamChange(newP, label, label)
    }

    return (
        <div className="mc-root">
            {/* Type Selector */}
            <Section title="Jewelry Type">
                <div className="mc-profile-btns mc-wrap">
                    {['ring', 'necklace', 'earring', 'bracelet', 'cufflinks', 'tiebar', 'lapel_pin'].map(t => (
                        <button key={t} onClick={() => update({ type: t }, `Type: ${t}`)}
                            className={`btn btn-sm mc-option-btn ${type === t ? 'btn-cyan' : 'btn-ghost'}`}>
                            {t.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </Section>
            {/* Warnings */}
            {warnings.map((w, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    className="mc-warning">
                    <AlertTriangle size={13} className="mc-warning-icon" />
                    <span className="mc-warning-text">{w}</span>
                </motion.div>
            ))}

            {/* Metal selector */}
            <Section title="Metal">
                <div className="mc-swatch-grid">
                    {METALS.map(m => (
                        <button key={m.id} onClick={() => update({ metal: { ...p.metal, type: m.id, color: m.color, roughness: m.roughness } }, `Metal: ${m.label}`)}
                            className={`mc-metal-btn${p.metal.type === m.id ? ' active' : ''}`}>
                            {/* background is data-driven per metal — kept as inline style intentionally */}
                            <div className="mc-metal-dot" style={{ '--mc-metal-bg': m.color } as React.CSSProperties} />
                            {m.label}
                        </button>
                    ))}
                </div>
                <RangeSlider label="Finish roughness" min={0.02} max={0.8} step={0.01}
                    value={p.metal.roughness}
                    onChange={v => update({ metal: { ...p.metal, roughness: v } }, 'Metal roughness')} />

                <div className="mc-profile-row">
                    <div className="mc-profile-label">Finish</div>
                    <div className="mc-profile-btns">
                        {['high_polish', 'hammered', 'brushed', 'satin', 'sandblasted', 'matte'].map(f => (
                            <button key={f} onClick={() => update({ metal: { ...p.metal, finish: f } }, `Finish: ${f}`)}
                                className={`btn btn-sm mc-option-btn ${(p.metal.finish || 'high_polish') === f ? 'btn-cyan' : 'btn-ghost'}`}>
                                {f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            {/* Structure - Generalized from "Band" */}
            <Section title={isRing ? "Band" : isNecklace ? "Chain & Bail" : isEarring ? "Setting" : "Structure"}>
                {(isRing || isBracelet) && (
                    <>
                        <RangeSlider label={isRing ? "Width (mm)" : "Thickness (mm)"} min={0.5} max={8} step={0.1}
                            value={p.band.width}
                            onChange={v => update({ band: { ...p.band, width: v } }, `Structure: ${v}mm wide`)} />
                        <RangeSlider label="Depth (mm)" min={0.8} max={4} step={0.1}
                            value={p.band.thickness}
                            onChange={v => update({ band: { ...p.band, thickness: v } }, `Structure depth: ${v}mm`)} />
                    </>
                )}

                {isRing && (
                    <div className="mc-profile-row">
                        <div className="mc-profile-label">Profile</div>
                        <div className="mc-profile-btns">
                            {['round', 'flat', 'knife_edge', 'comfort_fit'].map(pr => (
                                <button key={pr} onClick={() => update({ band: { ...p.band, profile: pr } }, `Band profile: ${pr}`)}
                                    className={`btn btn-sm mc-option-btn-vsmall ${p.band.profile === pr ? 'btn-cyan' : 'btn-ghost'}`}>
                                    {pr.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {isSignet && (
                    <div className="mc-profile-row">
                        <div className="mc-profile-label">Face</div>
                        <div className="mc-profile-btns">
                            {['round', 'oval', 'square', 'cushion'].map(sh => (
                                <button key={sh} onClick={() => update({ signetShape: sh as DesignParams['signetShape'] }, `Signet: ${sh}`)}
                                    className={`btn btn-sm mc-option-btn-vsmall ${p.signetShape === sh ? 'btn-cyan' : 'btn-ghost'}`}>
                                    {sh}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {isNecklace && (
                    <>
                        <div className="mc-profile-row">
                            <div className="mc-profile-label">Bail</div>
                            <div className="mc-profile-btns">
                                {['hidden', 'simple', 'decorative', 'v_bail'].map(bs => (
                                    <button key={bs} onClick={() => update({ bailStyle: bs as DesignParams['bailStyle'] }, `Bail: ${bs}`)}
                                        className={`btn btn-sm mc-option-btn-vsmall ${p.bailStyle === bs ? 'btn-cyan' : 'btn-ghost'}`}>
                                        {bs.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <RangeSlider label="Chain Length (cm)" min={40} max={80} step={2}
                            value={p.chainLength || 45}
                            onChange={v => update({ chainLength: v }, `Chain length: ${v}cm`)} />
                        <div className="mc-profile-row">
                            <div className="mc-profile-label">Style</div>
                            <div className="mc-profile-btns">
                                {['cable', 'box', 'rope', 'snake', 'curb', 'figaro'].map(ct => (
                                    <button key={ct} onClick={() => update({ chainStyle: ct as DesignParams['chainStyle'], chainType: ct }, `Chain: ${ct}`)}
                                        className={`btn btn-sm mc-option-btn ${(p.chainStyle === ct || p.chainType === ct) ? 'btn-cyan' : 'btn-ghost'}`}>
                                        {ct}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {isEarring && (
                    <>
                        <div className="mc-profile-row">
                            <div className="mc-profile-label">Style</div>
                            <div className="mc-profile-btns">
                                {['stud', 'drop', 'hoop'].map(es => (
                                    <button key={es} onClick={() => update({ earringStyle: es as DesignParams['earringStyle'] }, `Earring: ${es}`)}
                                        className={`btn btn-sm mc-option-btn ${p.earringStyle === es ? 'btn-cyan' : 'btn-ghost'}`}>
                                        {es}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <RangeSlider label="Drop Length (mm)" min={5} max={40} step={1}
                            value={p.earringDrop || 15}
                            onChange={v => update({ earringDrop: v }, `Drop length: ${v}mm`)} />
                    </>
                )}

                {isBracelet && (
                    <>
                        <div className="mc-profile-row">
                            <div className="mc-profile-label">Accent</div>
                            <div className="mc-profile-btns">
                                {['none', 'station', 'pave_bar'].map(ba => (
                                    <button key={ba} onClick={() => update({ braceletAccent: ba as DesignParams['braceletAccent'] }, `Accent: ${ba}`)}
                                        className={`btn btn-sm mc-option-btn ${p.braceletAccent === ba ? 'btn-cyan' : 'btn-ghost'}`}>
                                        {ba.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <RangeSlider label="Diameter (mm)" min={50} max={90} step={1}
                            value={p.braceletDiameter || 65}
                            onChange={v => update({ braceletDiameter: v }, `Diameter: ${v}mm`)} />
                    </>
                )}

                {isCufflinks && (
                    <div className="mc-profile-row">
                        <div className="mc-profile-label">Face</div>
                        <div className="mc-profile-btns">
                            {['rectangular', 'round', 'oval'].map(sh => (
                                <button key={sh} onClick={() => update({ cufflinkShape: sh as DesignParams['cufflinkShape'] }, `Cufflinks: ${sh}`)}
                                    className={`btn btn-sm mc-option-btn ${p.cufflinkShape === sh ? 'btn-cyan' : 'btn-ghost'}`}>
                                    {sh}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </Section>

            {/* Stone */}
            <Section title="Center Stone">
                <div className="mc-stone-grid">
                    {STONES.map(s => (
                        <button key={s.id} onClick={() => update({ stones: [{ ...p.stones[0], type: s.id, color: s.color, transmission: s.transmission, ior: s.ior }] }, `Stone: ${s.label}`)}
                            className={`mc-stone-btn${p.stones[0]?.type === s.id ? ' active' : ''}`}>
                            {/* background is data-driven per stone — kept as inline style intentionally */}
                            <div className="mc-stone-dot" style={{ '--mc-stone-bg': s.color || 'white' } as React.CSSProperties} />
                            {s.label}
                        </button>
                    ))}
                </div>
                {p.stones[0] && <RangeSlider label="Size (ct)" min={0.1} max={5} step={0.1}
                    value={p.stones[0].size}
                    onChange={v => update({ stones: [{ ...p.stones[0], size: v }] }, `Stone: ${v}ct`)} />}
            </Section>

            {/* Prongs */}
            {(isRing || isNecklace) && (
                <Section title="Prongs">
                    <div className="mc-prong-row">
                        {[0, 3, 4, 6, 8].map(n => (
                            <button key={n} onClick={() => update({ prongs: { ...p.prongs, count: n } }, `${n || 'No'} prongs`)}
                                className={`btn btn-sm mc-option-btn-wide ${p.prongs.count === n ? 'btn-cyan' : 'btn-ghost'}`}>
                                {n || 'None'}
                            </button>
                        ))}
                    </div>
                    <RangeSlider label="Thickness (mm)" min={0.5} max={2.0} step={0.05}
                        value={p.prongs.thickness}
                        onChange={v => update({ prongs: { ...p.prongs, thickness: v } }, `Prong thickness: ${v}mm`)} />
                </Section>
            )}

            {/* Halo */}
            {!isBracelet && (
                <Section title="Halo">
                    <label className="mc-toggle-label">
                        <div onClick={() => update({ halo: { ...p.halo, enabled: !p.halo?.enabled } }, p.halo?.enabled ? 'Halo removed' : 'Halo added')}
                            className={`mc-toggle-track${p.halo?.enabled ? ' on' : ''}`}>
                            <div className={`mc-toggle-thumb${p.halo?.enabled ? ' on' : ''}`} />
                        </div>
                        <span className={`mc-toggle-text${p.halo?.enabled ? ' on' : ''}`}>
                            {p.halo?.enabled ? 'Halo enabled' : 'No halo'}
                        </span>
                    </label>
                    {p.halo?.enabled && (
                        <RangeSlider label="Stone count" min={8} max={32} step={2}
                            value={p.halo.stoneCount}
                            onChange={v => update({ halo: { ...p.halo, stoneCount: v } }, `Halo: ${v} stones`)} />
                    )}
                </Section>
            )}

            {/* Engraving */}
            <Section title="Engraving">
                <label className="mc-toggle-label">
                    <div onClick={() => update({ engraving: { ...p.engraving, enabled: !p.engraving?.enabled } }, p.engraving?.enabled ? 'Engraving removed' : 'Engraving added')}
                        className={`mc-toggle-track${p.engraving?.enabled ? ' engraving-on' : ''}`}>
                        <div className={`mc-toggle-thumb${p.engraving?.enabled ? ' on' : ''}`} />
                    </div>
                    <span className={`mc-toggle-text${p.engraving?.enabled ? ' engraving-on' : ''}`}>Engraving</span>
                </label>
                {p.engraving?.enabled && (
                    <input value={p.engraving?.text || ''} placeholder="Enter engraving text..."
                        onChange={e => update({ engraving: { ...p.engraving, text: e.target.value } }, `Engraving: "${e.target.value}"`)}
                        className="mc-engraving-input" />
                )}
            </Section>

            {/* Motifs & Carvings */}
            <Section title="Motifs & Carvings">
                <div className="mc-motif-grid">
                    {['none', 'geometric', 'floral', 'dolphin', 'peacock', 'tribal', 'classic_scroll'].map(m => (
                        <button key={m} onClick={() => update({ motif: m === 'none' ? undefined : m }, `Motif: ${m}`)}
                            className={`mc-motif-btn${(p.motif || 'none') === m ? ' active' : ''}`}>
                            <span className="capitalize">{m.replace('_', ' ')}</span>
                        </button>
                    ))}
                </div>
                <div className="text-[10px] text-gray-400 mt-2 px-1">
                    Adds detailed 3D carvings/embossings to the surface.
                </div>
            </Section>

            {/* Advanced - Section Cut */}
            <Section title="Advanced View">
                <div className="mc-profile-row">
                    <div className="mc-profile-label">Section Cut</div>
                    <div className="mc-profile-btns">
                        {['none', 'x', 'y', 'z'].map(ax => (
                            <button key={ax} onClick={() => update({ sectionCutAxis: ax as DesignParams['sectionCutAxis'] }, `Section Cut: ${ax}`)}
                                className={`btn btn-sm mc-option-btn-vsmall ${(p.sectionCutAxis || 'none') === ax ? 'btn-cyan' : 'btn-ghost'}`}>
                                {ax.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                {p.sectionCutAxis && p.sectionCutAxis !== 'none' && (
                    <RangeSlider label="Cut Offset" min={-5} max={5} step={0.1}
                        value={p.sectionCutOffset ?? 0}
                        onChange={v => update({ sectionCutOffset: v }, `Cut offset: ${v}`)} />
                )}
            </Section>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(true)
    return (
        <div className="mc-section">
            <button onClick={() => setOpen(!open)} className={`mc-section-toggle${open ? ' open' : ''}`}>
                <span className="mc-section-title">{title}</span>
                <span className="mc-section-chevron">{open ? '▾' : '▸'}</span>
            </button>
            {open && <div>{children}</div>}
        </div>
    )
}

function RangeSlider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
    const pct = ((value - min) / (max - min)) * 100
    return (
        <div className="mc-slider-root">
            <div className="mc-slider-header">
                <span className="mc-slider-label">{label}</span>
                <span className="mc-slider-value">{value}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                aria-label={label} title={label}
                style={{ '--val': `${pct}%` } as React.CSSProperties}
                onChange={e => onChange(Number(e.target.value))} />
        </div>
    )
}
