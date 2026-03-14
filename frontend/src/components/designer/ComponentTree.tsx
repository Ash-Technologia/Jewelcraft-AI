/**
 * ComponentTree.tsx — shows the right component tree for each jewelry type
 */
import { useState } from 'react'
import { ChevronRight, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { DesignParams } from '../../store/useAppStore'

interface Props {
    params: DesignParams
    onToggleComponent?: (key: string, visible: boolean) => void
}

type TreeNode = {
    key: string; label: string; icon: string
    subs: { k: string; v: string }[]
    warning?: string
}

function buildTree(p: DesignParams): TreeNode[] {
    const t = (p.type ?? 'ring').toLowerCase()
    const metal = (p.metal?.type ?? 'yellow_gold').replace(/_/g, ' ')
    const stone = p.stones?.[0]?.type ?? 'diamond'
    const cut = p.stones?.[0]?.cut ?? 'round_brilliant'
    const size = p.stones?.[0]?.size ?? 1.0
    const bw = p.band?.width ?? 2.5
    const bp = p.band?.profile ?? 'round'
    const pc = p.prongs?.count ?? 4
    const pt = p.prongs?.thickness ?? 0.9
    const ph = p.prongs?.height ?? 1.2
    const thin = pt < 0.8 && pc > 0

    if (t === 'necklace' || t === 'pendant' || t === 'chain') {
        return [
            {
                key: 'chain', label: 'Chain', icon: '📿',
                subs: [{ k: 'Width', v: `${bw.toFixed(1)}mm` }, { k: 'Style', v: 'cable link' }, { k: 'Metal', v: metal }]
            },
            {
                key: 'bail', label: 'Bail', icon: '🔗',
                subs: [{ k: 'Type', v: 'round loop' }, { k: 'Metal', v: metal }]
            },
            {
                key: 'stone', label: 'Pendant Stone', icon: '💎',
                subs: [{ k: 'Type', v: stone }, { k: 'Cut', v: cut }, { k: 'Size', v: `${size}ct` }]
            },
            {
                key: 'setting', label: 'Setting', icon: '🔧',
                subs: [{ k: 'Style', v: p.setting?.type ?? 'bezel' }]
            },
        ]
    }

    if (t === 'earring' || t === 'earrings') {
        return [
            {
                key: 'hook', label: 'Ear Wire / Hook', icon: '🪝',
                subs: [{ k: 'Style', v: 'french wire' }, { k: 'Metal', v: metal }]
            },
            {
                key: 'cup', label: 'Setting Cup', icon: '⭕',
                subs: [{ k: 'Type', v: p.setting?.type ?? 'prong' }, { k: 'Metal', v: metal }]
            },
            {
                key: 'stone', label: 'Center Stone', icon: '💎',
                subs: [{ k: 'Type', v: stone }, { k: 'Cut', v: cut }, { k: 'Size', v: `${size}ct` }]
            },
            ...(pc > 0 ? [{
                key: 'prongs', label: `Prongs (${pc})`, icon: '▲',
                warning: thin ? 'Thin prongs (< 0.8mm)' : undefined,
                subs: [{ k: 'Count', v: `${pc}` }, { k: 'Height', v: `${ph.toFixed(1)}mm` }]
            }] : []),
            ...(p.halo?.enabled ? [{
                key: 'halo', label: 'Halo', icon: '✨',
                subs: [{ k: 'Stones', v: `${p.halo.stoneCount}` }]
            }] : []),
        ]
    }

    if (t === 'bracelet' || t === 'bangle') {
        return [
            {
                key: 'band', label: 'Bangle Band', icon: '⭕',
                subs: [{ k: 'Width', v: `${bw.toFixed(1)}mm` }, { k: 'Profile', v: bp }, { k: 'Metal', v: metal }]
            },
            ...(p.stones?.[0] ? [{
                key: 'stone', label: 'Stone Setting', icon: '💎',
                subs: [{ k: 'Stone', v: stone }, { k: 'Size', v: `${size}ct` }, { k: 'Setting', v: p.setting?.type ?? 'prong' }]
            }] : []),
            ...(p.halo?.enabled ? [{
                key: 'pave', label: 'Pavé Accent', icon: '✨',
                subs: [{ k: 'Stones', v: `${p.halo.stoneCount}` }]
            }] : []),
            {
                key: 'clasp', label: 'Clasp', icon: '🔒',
                subs: [{ k: 'Type', v: 'box clasp' }]
            },
        ]
    }

    // ring
    return [
        {
            key: 'band', label: 'Band', icon: '⭕',
            subs: [{ k: 'Width', v: `${bw.toFixed(1)}mm wide` }, { k: 'Profile', v: bp }, { k: 'Metal', v: metal }]
        },
        {
            key: 'stone', label: 'Center Stone', icon: '💎',
            subs: [{ k: 'Type', v: stone }, { k: 'Cut', v: cut }, { k: 'Size', v: `${size}ct` }]
        },
        ...(pc > 0 ? [{
            key: 'prongs', label: `Prongs (${pc})`, icon: '▲',
            warning: thin ? 'Thin prongs (< 0.8mm)' : undefined,
            subs: [{ k: 'Count', v: `${pc}` }, { k: 'Height', v: `${ph.toFixed(1)}mm` }, { k: 'Thickness', v: `${pt.toFixed(1)}mm` }]
        }] : []),
        ...(p.halo?.enabled ? [{
            key: 'halo', label: 'Halo', icon: '✨',
            subs: [{ k: 'Stones', v: `${p.halo?.stoneCount ?? 0}` }, { k: 'Size', v: `${((p.halo?.stoneSize ?? 0.025) * 1000).toFixed(0)}µm` }]
        }] : []),
        ...(p.engraving?.enabled ? [{
            key: 'engraving', label: 'Engraving', icon: 'A',
            subs: [{ k: 'Text', v: p.engraving?.text ?? '—' }]
        }] : []),
        {
            key: 'setting', label: 'Setting', icon: '🔧',
            subs: [{ k: 'Style', v: p.setting?.type ?? 'prong' }]
        },
    ]
}

const TYPE_META: Record<string, { label: string; icon: string }> = {
    ring: { label: 'Ring', icon: '💍' },
    necklace: { label: 'Necklace', icon: '📿' }, pendant: { label: 'Necklace', icon: '📿' }, chain: { label: 'Necklace', icon: '📿' },
    earring: { label: 'Earring', icon: '✨' }, earrings: { label: 'Earring', icon: '✨' },
    bracelet: { label: 'Bracelet', icon: '📿' }, bangle: { label: 'Bracelet', icon: '📿' },
}

function Node({ n, hidden, onToggle }: { n: TreeNode; hidden: boolean; onToggle: () => void }) {
    const [open, setOpen] = useState(true)
    return (
        <div style={{ marginBottom: 2 }}>
            <div onClick={() => setOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
            }}>
                <span style={{ color: '#666', width: 14, display: 'flex', alignItems: 'center' }}>
                    {n.subs.length ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
                </span>
                <span style={{ fontSize: 13 }}>{n.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: hidden ? '#555' : '#E8E8E8', textDecoration: hidden ? 'line-through' : 'none' }}>
                    {n.label}
                </span>
                {n.warning && <span title={n.warning} style={{ fontSize: 11, color: '#FF9040' }}>⚠</span>}
                <span onClick={e => { e.stopPropagation(); onToggle() }} style={{ color: '#555', cursor: 'pointer' }}>
                    {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </span>
            </div>
            {open && n.subs.length > 0 && (
                <div style={{ paddingLeft: 28 }}>
                    {n.subs.map(s => (
                        <div key={s.k} style={{ display: 'flex', gap: 6, padding: '1px 0', fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
                            <span style={{ color: '#444', fontSize: 10 }}>→</span>
                            <span style={{ flex: 1 }}>{s.k}</span>
                            <span style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>{s.v}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function ComponentTree({ params, onToggleComponent }: Props) {
    const [hidden, setHidden] = useState<Set<string>>(new Set())
    const tree = buildTree(params)
    const jType = (params.type ?? 'ring').toLowerCase()
    const meta = TYPE_META[jType] ?? { label: 'Ring', icon: '💍' }

    const toggle = (key: string) => {
        setHidden(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key); else next.add(key)
            onToggleComponent?.(key, !next.has(key))
            return next
        })
    }

    return (
        <div style={{ padding: '12px 8px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)', marginBottom: 10, textTransform: 'uppercase', padding: '0 8px' }}>
                Component Tree
            </div>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', marginBottom: 16,
                borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-cyan)' }}>{meta.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Model</div>
                </div>
            </div>
            {tree.map(n => (
                <Node key={n.key} n={n} hidden={hidden.has(n.key)} onToggle={() => toggle(n.key)} />
            ))}
        </div>
    )
}