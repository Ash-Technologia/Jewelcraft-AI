/**
 * Material substitution engine — suggests alternatives to reduce cost or improve properties.
 */

import { DesignParams } from '../store/useAppStore'

export interface Substitution {
    id: string
    category: 'metal' | 'stone' | 'setting'
    fromLabel: string
    toLabel: string
    priceDelta: number         // negative = savings
    qualityNote: string
    params: Partial<DesignParams>
}

export function getSubstitutions(params: DesignParams): Substitution[] {
    const subs: Substitution[] = []

    // Metal substitutions
    if (params.metal.type === 'yellow_gold' || params.metal.type === 'rose_gold') {
        subs.push({
            id: 'metal-platinum',
            category: 'metal',
            fromLabel: params.metal.type.replace('_', ' '),
            toLabel: 'Platinum',
            priceDelta: -8000,
            qualityNote: 'More durable, hypoallergenic. Lower gold content.',
            params: { metal: { ...params.metal, type: 'platinum', color: '#E8E8F0' } },
        })
        subs.push({
            id: 'metal-silver',
            category: 'metal',
            fromLabel: params.metal.type.replace('_', ' '),
            toLabel: 'Sterling Silver',
            priceDelta: -35000,
            qualityNote: 'Significant savings. Requires periodic polishing.',
            params: { metal: { ...params.metal, type: 'silver', color: '#C0C0C0' } },
        })
    }

    // Stone substitutions
    if (params.stones[0]?.type === 'diamond') {
        subs.push({
            id: 'stone-moissanite',
            category: 'stone',
            fromLabel: 'Diamond',
            toLabel: 'Moissanite',
            priceDelta: -120000,
            qualityNote: '97% visually identical. Higher refractive index (2.65 vs 2.42).',
            params: { stones: [{ ...params.stones[0], type: 'moissanite', color: '#F8F8FF', ior: 2.65, transmission: 0.95 }] },
        })
        subs.push({
            id: 'stone-lab-diamond',
            category: 'stone',
            fromLabel: 'Natural Diamond',
            toLabel: 'Lab-Grown Diamond',
            priceDelta: -80000,
            qualityNote: 'Chemically identical. 40-60% less expensive.',
            params: { stones: [{ ...params.stones[0], type: 'diamond' }] },
        })
    }

    if (params.stones[0]?.type === 'ruby') {
        subs.push({
            id: 'stone-garnet',
            category: 'stone',
            fromLabel: 'Ruby',
            toLabel: 'Garnet',
            priceDelta: -60000,
            qualityNote: 'Similar red hue. Less expensive but lower hardness (7 vs 9).',
            params: { stones: [{ ...params.stones[0], type: 'garnet', color: '#A52A2A', ior: 1.75, transmission: 0.5 }] },
        })
    }

    // Setting substitutions
    if (params.setting.type === 'prong' && params.prongs.count >= 6) {
        subs.push({
            id: 'setting-bezel',
            category: 'setting',
            fromLabel: `${params.prongs.count}-prong`,
            toLabel: 'Bezel',
            priceDelta: -3000,
            qualityNote: 'More protective. Slightly lower sparkle visibility.',
            params: { setting: { type: 'bezel' }, prongs: { ...params.prongs, count: 0 } },
        })
    }

    // Filter by budget relevance — prioritize subs that bring price under budget
    return subs.sort((a, b) => a.priceDelta - b.priceDelta)
}

/**
 * Get contextual proactive suggestions for the AI agent based on current design state.
 */
export function getProactiveSuggestions(params: DesignParams): { text: string; action: string }[] {
    const suggestions: { text: string; action: string }[] = []

    // Band width suggestion
    if (params.band.width > 4) {
        suggestions.push({ text: '💍 Wide band — try knife edge for elegance', action: 'make the band thinner with knife edge profile' })
    }

    // No halo suggestion
    if (!params.halo.enabled && params.stones.length > 0) {
        suggestions.push({ text: '✨ Add a diamond halo for extra brilliance', action: 'add a halo' })
    }

    // Halo with many stones
    if (params.halo.enabled && params.halo.stoneCount > 16) {
        suggestions.push({ text: '🎯 Try a minimalist design with fewer halo stones', action: 'make it more minimal' })
    }

    // Metal type variety
    if (params.metal.type === 'yellow_gold') {
        suggestions.push({ text: '🌹 Rose gold is trending in 2026', action: 'switch to rose gold' })
    }

    // Diamond alternative
    if (params.stones[0]?.type === 'diamond') {
        suggestions.push({ text: '💡 Moissanite saves 95% — sparkles more!', action: 'switch to moissanite' })
    }

    // Style DNA based
    if (params.style_dna.modernity < 0.4) {
        suggestions.push({ text: '⚡ Try a modern minimalist look', action: 'make it more modern and minimal' })
    }

    if (params.style_dna.luxury > 0.8 && params.style_dna.complexity < 0.5) {
        suggestions.push({ text: '👑 Add pavé accents for luxurious depth', action: 'add pavé accents to the band' })
    }

    return suggestions.slice(0, 3) // Max 3 suggestions at a time
}
