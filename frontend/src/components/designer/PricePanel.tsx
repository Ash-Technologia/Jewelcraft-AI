import { useMemo, useEffect } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts'
import { Activity } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { TREND_DATA, COMPETITOR_DATA, METAL_PRICES, STONE_PRICES, TrendItem, CompetitorItem } from '../../data/marketPricing'
import './PricePanel.css'

function cosineSim(a: Record<string, number>, b: Record<string, number>) {
    const keys = Object.keys(a)
    const dot = keys.reduce((s, k) => s + (a[k] || 0) * (b[k] || 0), 0)
    const magA = Math.sqrt(keys.reduce((s, k) => s + (a[k] || 0) ** 2, 0))
    const magB = Math.sqrt(keys.reduce((s, k) => s + (b[k] || 0) ** 2, 0))
    return magA && magB ? dot / (magA * magB) : 0
}

export default function PricePanel() {
    const { 
        currentParams: p, budget, setBudget, versions, 
        liveMetalPrices, fetchLivePrices, isFetchingPrices,
        useLivePrices, setUseLivePrices 
    } = useAppStore()

    useEffect(() => {
        if (!liveMetalPrices && !isFetchingPrices) {
            fetchLivePrices();
        }
    }, [liveMetalPrices, isFetchingPrices, fetchLivePrices]);

    // Geometric factors
    const type = (p.type || 'ring').toLowerCase()
    const isNecklace = type === 'necklace' || type === 'pendant' || type === 'chain'
    const isEarring = type === 'earring' || type === 'earrings'
    const isBracelet = type === 'bracelet' || type === 'bangle'
    const isRing = !isNecklace && !isEarring && !isBracelet

    // Precise metal weight calculation
    const metalWeight = useMemo(() => {
        const density: Record<string, number> = {
            yellow_gold: 15.5, white_gold: 15.8, rose_gold: 15.4,
            platinum: 21.45, silver: 10.49, titanium: 4.5,
        }
        const d = density[p.metal.type] || 15.5
        
        let volume = 0
        if (isRing) {
            const innerRadius = 8.5
            const outerRadius = innerRadius + p.band.thickness
            volume = Math.PI * (outerRadius ** 2 - innerRadius ** 2) * p.band.width
        } else if (isNecklace) {
            volume = (p.chainLength || 45) * 1.5
        } else if (isBracelet) {
            const r = 32.5
            volume = Math.PI * ((r + 1.5) ** 2 - r ** 2) * (p.band.width || 4)
        }

        // Settings and halo volumes
        const stoneVolume = p.stones.length * 22
        const haloVolume = p.halo.enabled ? p.halo.stoneCount * 7 : 0
        volume += (stoneVolume + haloVolume)

        return (volume / 1000) * d
    }, [p.band.width, p.band.thickness, p.metal.type, p.chainLength, p.stones.length, p.halo.enabled, p.halo.stoneCount, isRing, isNecklace, isBracelet])

    // Precise stone pricing
    const stoneMultiplier = isEarring ? 2 : 1
    const stonePrice = useMemo(() => {
        return p.stones.reduce((sum, s) => {
            const base = STONE_PRICES[s.type] || 0
            const scarcity = s.size > 2 ? 1.6 : s.size > 1 ? 1.25 : 1.0
            return sum + (base * s.size * scarcity)
        }, 0) * stoneMultiplier
    }, [p.stones, stoneMultiplier])

    // Sustainability and ethics score
    const ethicsScore = useMemo(() => {
        let s = 85
        if (p.stones.some(st => st.type === 'moissanite')) s += 10
        if (p.metal.type === 'platinum') s += 5
        if (p.stones.some(st => st.type === 'diamond')) s -= 5
        return Math.min(100, Math.max(0, s))
    }, [p.stones, p.metal.type])

    // Labor and overhead
    const laborBase = isNecklace ? 12000 : isBracelet ? 15000 : 8000
    const complexityMult = 1 + (p.halo.enabled ? 0.35 : 0) + (p.engraving.enabled ? 0.1 : 0) + (p.motif ? 0.25 : 0)
    const chainCost = isNecklace ? (p.chainLength || 45) * 125 : 0
    
    const metalPricePerGram = useMemo(() => {
        if (useLivePrices && liveMetalPrices) {
            if (p.metal.type === 'platinum') return liveMetalPrices.platinum;
            if (p.metal.type === 'silver') return liveMetalPrices.silver;
            return liveMetalPrices.gold;
        }
        return METAL_PRICES[p.metal.type] || 5500;
    }, [useLivePrices, liveMetalPrices, p.metal.type]);

    const totalPrice = Math.round((metalWeight * metalPricePerGram + stonePrice + laborBase * complexityMult + chainCost) * 1.25)
    
    // Budget health
    const overBudget = totalPrice > budget
    const budgetPct = Math.min((totalPrice / budget) * 100, 150)

    // Style analytics
    const trends = useMemo(() => TREND_DATA.map((t: TrendItem) => ({
        ...t, score: Math.round(cosineSim(p.style_dna, t.style_dna) * 100),
    })).sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, 3), [p.style_dna])

    const competitors = useMemo(() => COMPETITOR_DATA.map((c: CompetitorItem) => ({
        ...c, score: Math.round(cosineSim(p.style_dna, c.style_dna) * 100),
    })).filter((c: { score: number }) => c.score >= 65).sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, 2), [p.style_dna])

    const radarData = Object.entries(p.style_dna).map(([key, val]) => ({
        axis: key.charAt(0).toUpperCase() + key.slice(1),
        current: Math.round((val as number) * 100),
        ...(versions.length > 0 ? { previous: Math.round((versions[0].params.style_dna[key as keyof typeof versions[0]['params']['style_dna']] || 0) * 100) } : {}),
    }))

    return (
        <div className="pp-root">
            {/* Price */}
            <div className="pp-price-section">
                <div className="pp-label-row">
                    <span className="pp-label">Estimated Price</span>
                    <div className={`pp-price-toggle ${useLivePrices ? 'active' : ''}`} 
                         onClick={() => setUseLivePrices(!useLivePrices)}
                         title={useLivePrices ? "Switch to Demo Rates" : "Switch to Live Market Rates"}>
                        <Activity size={12} className={useLivePrices ? "text-cyan animate-pulse" : "text-muted"} />
                        <span>{useLivePrices ? 'Live Market' : 'Demo Rate'}</span>
                    </div>
                </div>
                <div className={`text-price pp-price-display`}>₹{totalPrice.toLocaleString('en-IN')}</div>

                {/* Budget bar */}
                <div className="pp-budget-section">
                    <div className="pp-budget-header">
                        <span className="pp-budget-label">Budget: ₹{budget.toLocaleString('en-IN')}</span>
                        <span className={`pp-budget-status${overBudget ? ' over' : ' under'}`}>
                            {overBudget ? `+${((budgetPct - 100)).toFixed(0)}% over` : `${(100 - budgetPct).toFixed(0)}% under`}
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div className={`progress-fill${overBudget ? ' pp-progress-fill-over' : ' pp-progress-fill-under'}`}
                            style={{ '--budget-pct': `${Math.min(budgetPct, 100)}%` } as React.CSSProperties} />
                    </div>
                </div>
                <input type="range" min={20000} max={500000} step={5000} value={budget}
                    aria-label="Budget slider" title="Budget slider"
                    style={{ '--val': `${((budget - 20000) / 480000) * 100}%` } as React.CSSProperties}
                    onChange={e => setBudget(Number(e.target.value))} />
                <div className="pp-budget-minmax">
                    <span>₹20k</span><span>Budget Limit</span><span>₹5L</span>
                </div>
            </div>

            <div className="divider-cyan" />

            {/* Cost breakdown */}
            <div className="pp-breakdown-section">
                <div className="pp-label">Breakdown</div>
                {[
                    { label: 'Metal (' + p.metal.type.replace('_', ' ') + ')', value: metalWeight * metalPricePerGram },
                    { label: 'Stone(s)', value: stonePrice },
                    { label: 'Labor', value: Math.round(laborBase * complexityMult) },
                ].map(item => (
                    <div key={item.label} className="pp-breakdown-row">
                        <span className="text-secondary">{item.label}</span>
                        <span className="pp-breakdown-value">₹{Math.round(item.value).toLocaleString('en-IN')}</span>
                    </div>
                ))}
            </div>

            <div className="divider-cyan" />

            {/* Design DNA Radar */}
            <div className="pp-dna-section">
                <div className="pp-label">Design DNA</div>
                <div className="pp-radar-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="rgba(255,255,255,0.07)" />
                            <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                            <Radar name="Current" dataKey="current" stroke="var(--accent-cyan)" fill="var(--accent-cyan)" fillOpacity={0.25} />
                            {versions.length > 0 && <Radar name="v1" dataKey="previous" stroke="var(--accent-purple)" fill="var(--accent-purple)" fillOpacity={0.15} />}
                            {versions.length > 0 && <Legend wrapperStyle={{ fontSize: 10 }} />}
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="divider-cyan" />

            {/* Material Insights */}
            <div className="pp-breakdown-section">
                <div className="pp-label">Material Insights</div>
                <div className="pp-breakdown-row">
                    <span className="text-secondary">Est. Metal Weight</span>
                    <span className="pp-breakdown-value">{metalWeight.toFixed(2)}g</span>
                </div>
                <div className="pp-breakdown-row">
                    <span className="text-secondary">Purity</span>
                    <span className="pp-breakdown-value">{p.metal.type.includes('gold') ? '18k (750)' : '950 Plat'}</span>
                </div>
                <div className="pp-breakdown-row">
                    <span className="text-secondary">Sustainability Score</span>
                    <span className={`badge ${ethicsScore >= 90 ? 'badge-green' : 'badge-indigo'}`}>{ethicsScore}%</span>
                </div>
            </div>

            <div className="divider-cyan" />

            {/* Trend Match */}
            <div className="pp-trend-section">
                <div className="pp-label">Trend Match 2025/2026</div>
                {trends.map((t: { name: string; description?: string; score: number }) => (
                    <div key={t.name} className="pp-trend-row">
                        <div className="pp-trend-info">
                            <div className="pp-trend-name">{t.name}</div>
                            <div className="pp-trend-desc">{t.description}</div>
                        </div>
                        <div className={`badge ${t.score >= 80 ? 'badge-green' : t.score >= 60 ? 'badge-indigo' : 'badge-gray'} pp-trend-badge`}>{t.score}%</div>
                    </div>
                ))}
            </div>

            {/* Competitor Comparison */}
            {competitors.length > 0 && (
                <div>
                    <div className="pp-label">Style Similar To</div>
                    {competitors.map((c: { name: string; brand?: string; score: number }) => (
                        <div key={c.name} className="pp-competitor-row">
                            <div className="pp-competitor-info">
                                <div className="pp-competitor-name">{c.name}</div>
                                <div className="pp-competitor-brand">{c.brand}</div>
                            </div>
                            <span className="badge badge-indigo pp-competitor-match">{c.score}% match</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
