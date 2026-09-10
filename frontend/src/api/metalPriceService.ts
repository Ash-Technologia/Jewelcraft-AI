/**
 * Metal Price Service
 *
 * Instead of calling GoldAPI directly from the browser (CORS blocked without a key),
 * we call our FastAPI backend's /api/metal-prices endpoint, which:
 *   1. Proxies the GoldAPI call server-side (no CORS issues)
 *   2. Caches the result for 1 hour to avoid hammering the free-tier rate limit
 *   3. Falls back to hardcoded realistic prices if the API is unavailable
 *
 * The backend reads GOLDAPI_KEY from its .env file.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export interface LivePrices {
    gold: number           // per gram, INR
    platinum: number       // per gram, INR
    silver: number         // per gram, INR
    timestamp: number
    source: 'live' | 'cached' | 'fallback'
}

// Realistic INR fallback prices (updated Sep 2026 approximate)
const FALLBACK_PRICES: LivePrices = {
    gold: 6800,       // ₹6,800/g (≈ 18k gold ₹5,100/g)
    platinum: 3200,   // ₹3,200/g
    silver: 90,       // ₹90/g
    timestamp: Date.now(),
    source: 'fallback',
}

// In-memory cache so we don't call the backend on every render
let cachedPrices: LivePrices | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 10 * 60 * 1000  // 10 min client-side cache

export const fetchMetalPrices = async (): Promise<LivePrices> => {
    // Return client-side cache if fresh
    if (cachedPrices && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
        return cachedPrices
    }

    try {
        const resp = await fetch(`${API_BASE}/metal-prices`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

        const data = await resp.json()

        const prices: LivePrices = {
            gold: data.gold_per_gram ?? FALLBACK_PRICES.gold,
            platinum: data.platinum_per_gram ?? FALLBACK_PRICES.platinum,
            silver: data.silver_per_gram ?? FALLBACK_PRICES.silver,
            timestamp: data.timestamp ?? Date.now(),
            source: data.source ?? 'live',
        }

        cachedPrices = prices
        cacheTimestamp = Date.now()
        return prices
    } catch (err) {
        console.warn('[MetalPrices] Backend unavailable, using fallback prices:', err)
        return { ...FALLBACK_PRICES, timestamp: Date.now() }
    }
}

/** Compute estimated price (INR) for a ring/jewelry piece */
export function estimatePrice(params: {
    metal: { type: string }
    stones: Array<{ type: string; size: number }>
    halo: { enabled: boolean; stoneCount: number }
    prongs: { count: number }
    band: { width: number }
}, prices: LivePrices = FALLBACK_PRICES): number {
    const metalWeight = params.band.width * 3.2  // grams (rough estimate)
    const metalCost = (() => {
        switch (params.metal.type) {
            case 'platinum': return metalWeight * prices.platinum
            case 'white_gold':
            case 'yellow_gold':
            case 'rose_gold': return metalWeight * prices.gold * 0.75  // 18k = 75% gold
            case 'silver': return metalWeight * prices.silver
            default: return metalWeight * prices.gold * 0.75
        }
    })()

    const stoneCost = params.stones.reduce((sum, s) => {
        const carat = s.size
        const pricePerCarat = (() => {
            switch (s.type) {
                case 'diamond': return 150000   // ₹1.5L/ct
                case 'ruby': return 80000
                case 'sapphire': return 60000
                case 'emerald': return 70000
                case 'moissanite': return 8000
                default: return 20000
            }
        })()
        return sum + carat * pricePerCarat
    }, 0)

    const haloAddition = params.halo.enabled ? params.halo.stoneCount * 3000 : 0
    const laborCost = 12000 + params.prongs.count * 800

    return Math.round(metalCost + stoneCost + haloAddition + laborCost)
}
