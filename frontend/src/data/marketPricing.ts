/**
 * marketPricing.ts — Live & Benchmark Precious Metal and Gemstone Market Data
 */

export const METAL_PRICES: Record<string, number> = {
    yellow_gold: 5800,
    white_gold: 6100,
    rose_gold: 5900,
    platinum: 3400,
    silver: 85,
}

export const STONE_PRICES: Record<string, number> = {
    diamond: 75000,
    sapphire: 32000,
    emerald: 42000,
    ruby: 48000,
    moissanite: 9500,
    lab_grown: 22000,
}

export interface TrendItem {
    name: string
    growth: string
    description?: string
    style_dna: Record<string, number>
}

export const TREND_DATA: TrendItem[] = [
    { name: 'Art Deco Revival', growth: '+34%', description: 'Geometric symmetry & milgrain accents', style_dna: { romance: 0.7, boldness: 0.8, modernity: 0.6, luxury: 0.9, complexity: 0.75 } },
    { name: 'Organic Minimalist', growth: '+28%', description: 'Clean ergonomic curvature & bezel mounts', style_dna: { romance: 0.5, boldness: 0.3, modernity: 0.9, luxury: 0.7, complexity: 0.25 } },
    { name: 'Vintage Solitaire', growth: '+19%', description: 'Heritage 4-claw solitaire shank', style_dna: { romance: 0.85, boldness: 0.4, modernity: 0.45, luxury: 0.95, complexity: 0.35 } },
]

export interface CompetitorItem {
    name: string
    brand?: string
    price: number
    style_dna: Record<string, number>
}

export const COMPETITOR_DATA: CompetitorItem[] = [
    { name: '1895 Solitaire', brand: 'Cartier', price: 145000, style_dna: { romance: 0.85, boldness: 0.35, modernity: 0.5, luxury: 0.95, complexity: 0.3 } },
    { name: 'The Setting', brand: 'Tiffany & Co.', price: 138000, style_dna: { romance: 0.8, boldness: 0.3, modernity: 0.6, luxury: 0.9, complexity: 0.25 } },
    { name: 'Vintage Alhambra', brand: 'Van Cleef & Arpels', price: 162000, style_dna: { romance: 0.9, boldness: 0.6, modernity: 0.4, luxury: 0.98, complexity: 0.7 } },
]
