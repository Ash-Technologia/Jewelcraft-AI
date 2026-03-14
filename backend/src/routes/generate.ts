import { Router, Request, Response } from 'express'
import { broadcast } from '../server.js'
import { calculatePrice } from '../services/pricing.js'

const router = Router()

// ── Type-specific structural defaults ─────────────────────────
const TYPE_STRUCTURE: Record<string, {
    band: { width: number; thickness: number; profile: string }
    prongs: { count: number; style: string; height: number }
    chain?: { links: number; style: string }
}> = {
    ring: { band: { width: 2.5, thickness: 1.6, profile: 'comfort_fit' }, prongs: { count: 4, style: 'round', height: 1.2 } },
    necklace: { band: { width: 1.5, thickness: 1.2, profile: 'round' }, prongs: { count: 4, style: 'round', height: 0.9 }, chain: { links: 18, style: 'cable' } },
    pendant: { band: { width: 1.2, thickness: 1.0, profile: 'round' }, prongs: { count: 4, style: 'round', height: 0.9 } },
    earring: { band: { width: 1.2, thickness: 1.0, profile: 'round' }, prongs: { count: 4, style: 'round', height: 0.8 } },
    earrings: { band: { width: 1.2, thickness: 1.0, profile: 'round' }, prongs: { count: 4, style: 'round', height: 0.8 } },
    bracelet: { band: { width: 4.5, thickness: 2.5, profile: 'round' }, prongs: { count: 4, style: 'round', height: 1.0 } },
    bangle: { band: { width: 5.0, thickness: 3.0, profile: 'round' }, prongs: { count: 4, style: 'round', height: 1.0 } },
    cufflink: { band: { width: 2.0, thickness: 1.5, profile: 'flat' }, prongs: { count: 0, style: 'bezel', height: 0.0 } },
    cufflinks: { band: { width: 2.0, thickness: 1.5, profile: 'flat' }, prongs: { count: 0, style: 'bezel', height: 0.0 } },
}

// ── Persona overlays — merged ON TOP of type structure ─────────
const PERSONA_OVERLAYS: Record<string, Record<string, unknown>> = {
    classic: {
        metal: { finish: 'high_polish' },
        style_dna: { romance: 0.8, boldness: 0.3, modernity: 0.4, luxury: 0.8, complexity: 0.3 },
    },
    modern: {
        prongs: { count: 0, style: 'bezel' },
        metal: { finish: 'satin' },
        style_dna: { romance: 0.3, boldness: 0.6, modernity: 0.95, luxury: 0.7, complexity: 0.2 },
        setting: { type: 'bezel' },
    },
    ornate: {
        metal: { finish: 'high_polish' },
        halo: { enabled: true, stoneCount: 24, stoneSize: 0.02 },
        style_dna: { romance: 0.95, boldness: 0.7, modernity: 0.2, luxury: 0.95, complexity: 0.9 },
    },
}

// Persona-specific band width multipliers (applied on top of type defaults)
const PERSONA_BAND_SCALE: Record<string, number> = {
    classic: 1.0,
    modern: 0.75,
    ornate: 1.45,
}

interface GenerateRequest {
    analysis: Record<string, unknown>
    personas?: string[]
}

// POST /api/generate
router.post('/', async (req: Request, res: Response) => {
    const { analysis, personas = ['classic', 'modern', 'ornate'] } = req.body as GenerateRequest

    try {
        const concepts = []
        const jewelType = ((analysis.jewelry_type as string) || 'ring').toLowerCase()

        for (let i = 0; i < personas.length; i++) {
            const persona = personas[i]
            const overlay = PERSONA_OVERLAYS[persona] || PERSONA_OVERLAYS.classic

            await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))

            const params = buildConceptParams(analysis, overlay, persona, jewelType)
            const price = calculatePrice(params)

            const concept = {
                id: `concept-${persona}-${Date.now()}`,
                persona,
                label: persona.charAt(0).toUpperCase() + persona.slice(1),
                params,
                priceEstimate: price,
                score: 80 + Math.floor(Math.random() * 18),
                thumbnail: null,
            }

            concepts.push(concept)
            broadcast('concept_ready', { index: i, concept })
        }

        res.json({ success: true, concepts })
    } catch (error) {
        console.error('[Generate] Error:', error)
        res.status(500).json({ success: false, error: 'Generation failed' })
    }
})

function buildConceptParams(
    analysis: Record<string, unknown>,
    overlay: Record<string, unknown>,
    persona: string,
    jewelType: string
) {
    const metal = (analysis.metal as Record<string, unknown>) || {}
    const stones = (analysis.stones as Array<Record<string, unknown>>) || []
    const styleDna = (analysis.style_dna as Record<string, number>) || {}
    const setting = (analysis.setting as Record<string, unknown>) || {}

    const overlayProng = (overlay.prongs as Record<string, unknown>) || {}
    const overlayMetal = (overlay.metal as Record<string, unknown>) || {}
    const overlayHalo = (overlay.halo as Record<string, unknown>) || {}
    const overlayDna = (overlay.style_dna as Record<string, number>) || {}
    const overlaySetting = (overlay.setting as Record<string, unknown>) || {}

    const metalColorMap: Record<string, string> = {
        yellow_gold: '#FFD700', rose_gold: '#E8A090', white_gold: '#E8E8E8',
        platinum: '#D0D0D0', silver: '#C0C0C0', tungsten: '#4A4A4A', titanium: '#8A8A8A',
    }
    const stoneColorMap: Record<string, string> = {
        diamond: '#FFFFFF', ruby: '#E0115F', emerald: '#046307',
        sapphire: '#0F52BA', onyx: '#0A0A0A', moissanite: '#F0F0F0', amethyst: '#9B59B6',
    }

    const metalType = (metal.type as string) || 'yellow_gold'
    const stoneType = (stones[0]?.type as string) || 'diamond'

    // Choose metal type per persona
    const personaMetalType = persona === 'modern' ? 'platinum'
        : persona === 'ornate' ? 'rose_gold'
            : metalType

    const personaMetalColor = metalColorMap[personaMetalType] || '#FFD700'

    // Get type-specific structure
    const typeStruct = TYPE_STRUCTURE[jewelType] || TYPE_STRUCTURE.ring
    const bandScale = PERSONA_BAND_SCALE[persona] || 1.0

    // Persona prong override
    const personaProngCount = persona === 'modern' ? 0
        : persona === 'ornate' ? 6
            : (overlayProng.count as number) ?? typeStruct.prongs.count

    return {
        // ← CRITICAL: always set the jewelry type from detected analysis
        type: jewelType,

        metal: {
            type: personaMetalType,
            color: personaMetalColor,
            roughness: persona === 'modern' ? 0.35 : persona === 'ornate' ? 0.12 : 0.15,
            finish: (overlayMetal.finish as string) || (metal.finish as string) || 'high_polish',
        },

        // Band dimensions scaled by persona, based on type defaults
        band: {
            width: typeStruct.band.width * bandScale,
            thickness: typeStruct.band.thickness * (bandScale * 0.85 + 0.15),
            profile: persona === 'modern' ? 'knife_edge' : persona === 'ornate' ? 'round' : typeStruct.band.profile,
        },

        stones: [{
            type: stoneType,
            cut: (stones[0]?.cut as string) || 'round_brilliant',
            size: (stones[0]?.estimated_carat as number) || 1.0,
            color: stoneColorMap[stoneType] || '#FFFFFF',
            transmission: stoneType === 'onyx' ? 0 : stoneType === 'diamond' ? 0.98 : 0.75,
            ior: stoneType === 'diamond' ? 2.417 : stoneType === 'moissanite' ? 2.65 : 1.77,
            position: 'center',
            count: 1,
        }],

        halo: {
            enabled: (overlayHalo.enabled as boolean) || false,
            stoneCount: (overlayHalo.stoneCount as number) || 16,
            stoneSize: (overlayHalo.stoneSize as number) || 0.025,
        },

        prongs: {
            count: personaProngCount,
            style: persona === 'modern' ? 'bezel' : persona === 'ornate' ? 'claw' : (overlayProng.style as string) || typeStruct.prongs.style,
            height: typeStruct.prongs.height,
            thickness: 0.9,
        },

        setting: {
            type: (overlaySetting.type as string) || (persona === 'modern' ? 'bezel' : (setting.type as string) || 'prong'),
        },

        engraving: { enabled: false, text: '', font: 'serif', depth: 0.3 },

        style_dna: {
            romance: overlayDna.romance ?? styleDna.romance ?? 0.6,
            boldness: overlayDna.boldness ?? styleDna.boldness ?? 0.4,
            modernity: overlayDna.modernity ?? styleDna.modernity ?? 0.5,
            luxury: overlayDna.luxury ?? styleDna.luxury ?? 0.7,
            complexity: overlayDna.complexity ?? styleDna.complexity ?? 0.4,
        },
    }
}

export { router as generateRouter }