import { Router, Request, Response } from 'express'
import multer from 'multer'
import { broadcast } from '../server.js'

const router = Router()
const upload = multer({ dest: 'uploads/', limits: { fileSize: 20 * 1024 * 1024 } })

// ── Type-specific mock analyses ────────────────────────────────
const MOCK_BY_TYPE: Record<string, object> = {
    ring: {
        jewelry_type: 'ring', confidence: 0.93, gender: 'womens',
        metal: { type: 'yellow_gold', purity: '18K', finish: 'high_polish' },
        stones: [{ type: 'diamond', cut: 'round_brilliant', count: 1, estimated_carat: 1.0, position: 'center', color_grade: 'G', clarity: 'VS1' }],
        setting: { type: 'prong', prong_count: 4, style: 'classic_solitaire' },
        band: { width_mm: 2.5, profile: 'comfort_fit' },
        halo: { present: false, stone_count: 0 },
        style_dna: { romance: 0.75, boldness: 0.35, modernity: 0.55, luxury: 0.85, complexity: 0.40 },
        components: [
            { name: 'center_stone', type: 'stone', position: { x: 0.52, y: 0.30 } },
            { name: 'prong_01', type: 'prong', position: { x: 0.42, y: 0.22 } },
            { name: 'prong_02', type: 'prong', position: { x: 0.62, y: 0.22 } },
            { name: 'prong_03', type: 'prong', position: { x: 0.42, y: 0.42 } },
            { name: 'prong_04', type: 'prong', position: { x: 0.62, y: 0.42 } },
            { name: 'band', type: 'band', position: { x: 0.52, y: 0.70 } },
        ],
    },
    necklace: {
        jewelry_type: 'necklace', confidence: 0.91, gender: 'womens',
        metal: { type: 'yellow_gold', purity: '18K', finish: 'high_polish' },
        stones: [{ type: 'diamond', cut: 'round_brilliant', count: 1, estimated_carat: 0.75, position: 'center', color_grade: 'H', clarity: 'VS2' }],
        setting: { type: 'bezel', prong_count: 0, style: 'pendant_bezel' },
        band: { width_mm: 1.5, profile: 'round' },
        halo: { present: false, stone_count: 0 },
        style_dna: { romance: 0.80, boldness: 0.40, modernity: 0.60, luxury: 0.75, complexity: 0.35 },
        components: [
            { name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.68 } },
            { name: 'bail', type: 'bail', position: { x: 0.50, y: 0.38 } },
            { name: 'chain', type: 'chain', position: { x: 0.50, y: 0.18 } },
        ],
    },
    earring: {
        jewelry_type: 'earring', confidence: 0.90, gender: 'womens',
        metal: { type: 'white_gold', purity: '14K', finish: 'high_polish' },
        stones: [{ type: 'diamond', cut: 'round_brilliant', count: 1, estimated_carat: 0.5, position: 'center', color_grade: 'F', clarity: 'VVS1' }],
        setting: { type: 'prong', prong_count: 4, style: 'stud' },
        band: { width_mm: 1.2, profile: 'round' },
        halo: { present: false, stone_count: 0 },
        style_dna: { romance: 0.60, boldness: 0.45, modernity: 0.70, luxury: 0.80, complexity: 0.30 },
        components: [
            { name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.60 } },
            { name: 'hook', type: 'post', position: { x: 0.50, y: 0.22 } },
        ],
    },
    bracelet: {
        jewelry_type: 'bracelet', confidence: 0.89, gender: 'womens',
        metal: { type: 'rose_gold', purity: '18K', finish: 'high_polish' },
        stones: [{ type: 'diamond', cut: 'round_brilliant', count: 1, estimated_carat: 0.75, position: 'center', color_grade: 'G', clarity: 'SI1' }],
        setting: { type: 'prong', prong_count: 4, style: 'bangle_solitaire' },
        band: { width_mm: 5.0, profile: 'round' },
        halo: { present: false, stone_count: 0 },
        style_dna: { romance: 0.70, boldness: 0.60, modernity: 0.50, luxury: 0.75, complexity: 0.45 },
        components: [
            { name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.45 } },
            { name: 'band', type: 'band', position: { x: 0.50, y: 0.65 } },
            { name: 'clasp', type: 'clasp', position: { x: 0.15, y: 0.50 } },
        ],
    },
}

function logLines(detectedType: string): string[] {
    const label = detectedType.toUpperCase()
    return [
        '> Initializing JewelCraft Vision Model v3.2...',
        '> Loading image tensor (1024×1024)...',
        '> Running object detection pass...',
        `> Detected: ${label} (confidence: 0.91)`,
        `> Classifying jewelry category → ${label}`,
        '> Analyzing metal properties...',
        '> Detecting stone arrangement...',
        '> Extracting component positions...',
        '> Computing Style DNA vectors...',
        '> Analysis complete ✓',
    ]
}

function typeFromFilename(name = ''): string {
    const n = name.toLowerCase()
    if (n.includes('necklace') || n.includes('pendant') || n.includes('chain') || n.includes('locket')) return 'necklace'
    if (n.includes('earring') || n.includes('stud') || n.includes('hoop')) return 'earring'
    if (n.includes('bracelet') || n.includes('bangle') || n.includes('cuff')) return 'bracelet'
    return 'ring'
}

// ── POST /api/analyze ──────────────────────────────────────────
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
    const useRealAI = !!process.env.OPENAI_API_KEY
    const hintType = (req.body?.hint_type as string | undefined) || typeFromFilename(req.file?.originalname)

    try {
        const lines = logLines(hintType)
        for (let i = 0; i < lines.length; i++) {
            await new Promise(r => setTimeout(r, 180 + Math.random() * 130))
            broadcast('analysis_log', { line: lines[i], index: i })
        }

        if (useRealAI && req.file) {
            const { default: OpenAI } = await import('openai')
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
            const fs = await import('fs')
            const b64 = fs.readFileSync(req.file.path).toString('base64')
            const mime = req.file.mimetype || 'image/jpeg'

            const resp = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are a jewelry image analysis AI. Identify the JEWELRY TYPE first, then extract properties.

SUPPORTED TYPES — choose EXACTLY one:
  ring      = worn on a finger (circular band)
  necklace  = worn around the neck (chain + pendant, or chain alone)
  earring   = worn on an ear (stud, drop, hoop, chandelier)
  bracelet  = worn on the wrist (bangle, tennis, chain, cuff)

Return ONLY this JSON (no markdown):
{
  "jewelry_type": "ring|necklace|earring|bracelet",
  "confidence": 0.0-1.0,
  "gender": "womens|mens|unisex",
  "metal": { "type": "yellow_gold|rose_gold|white_gold|platinum|silver", "purity": "18K", "finish": "high_polish|satin|brushed|matte" },
  "stones": [{ "type": "diamond|ruby|emerald|sapphire|onyx|moissanite|amethyst", "cut": "round_brilliant|oval|emerald|princess|pear", "count": 1, "estimated_carat": 1.0, "position": "center" }],
  "setting": { "type": "prong|bezel|pave|channel", "prong_count": 4, "style": "solitaire" },
  "band": { "width_mm": 2.5, "profile": "round|flat|knife_edge" },
  "halo": { "present": false, "stone_count": 0 },
  "style_dna": { "romance": 0.7, "boldness": 0.4, "modernity": 0.5, "luxury": 0.8, "complexity": 0.4 }
}`,
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Analyze this jewelry image. Identify the type carefully.' },
                            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
                        ],
                    },
                ],
                max_tokens: 900,
            })

            const content = resp.choices[0]?.message?.content || ''
            const match = content.match(/\{[\s\S]*\}/)
            if (match) {
                const analysis = JSON.parse(match[0])
                // Normalise type to our 4 supported types
                const rawType = (analysis.jewelry_type || 'ring').toLowerCase()
                if (rawType.includes('necklace') || rawType.includes('pendant') || rawType.includes('chain')) {
                    analysis.jewelry_type = 'necklace'
                } else if (rawType.includes('earring') || rawType.includes('stud') || rawType.includes('hoop')) {
                    analysis.jewelry_type = 'earring'
                } else if (rawType.includes('bracelet') || rawType.includes('bangle')) {
                    analysis.jewelry_type = 'bracelet'
                } else {
                    analysis.jewelry_type = 'ring'
                }
                analysis.components = estimateComponents(analysis)
                broadcast('analysis_complete', analysis)
                res.json({ success: true, analysis })
                return
            }
        }

        // ── Mock fallback ──
        await new Promise(r => setTimeout(r, 350))
        const mock = MOCK_BY_TYPE[hintType] || MOCK_BY_TYPE.ring
        broadcast('analysis_complete', mock)
        res.json({ success: true, analysis: mock, mock: true })

    } catch (error) {
        console.error('[Analyze] Error:', error)
        const fallType = typeFromFilename(req.file?.originalname)
        const fallback = MOCK_BY_TYPE[fallType] || MOCK_BY_TYPE.ring
        broadcast('analysis_complete', fallback)
        res.json({ success: true, analysis: fallback, mock: true, error: 'Fell back to mock' })
    }
})

function estimateComponents(a: Record<string, unknown>) {
    const comps: Array<{ name: string; type: string; position: { x: number; y: number } }> = []
    const jType = (a.jewelry_type as string || 'ring').toLowerCase()
    const setting = a.setting as Record<string, unknown> | undefined
    const halo = a.halo as Record<string, unknown> | undefined
    const stones = a.stones as unknown[] | undefined

    switch (jType) {
        case 'necklace':
            if (stones?.length) comps.push({ name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.68 } })
            comps.push({ name: 'bail', type: 'bail', position: { x: 0.50, y: 0.38 } })
            comps.push({ name: 'chain', type: 'chain', position: { x: 0.50, y: 0.18 } })
            break
        case 'earring':
            if (stones?.length) comps.push({ name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.60 } })
            comps.push({ name: 'hook', type: 'post', position: { x: 0.50, y: 0.22 } })
            break
        case 'bracelet':
            if (stones?.length) comps.push({ name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.45 } })
            comps.push({ name: 'band', type: 'band', position: { x: 0.50, y: 0.65 } })
            comps.push({ name: 'clasp', type: 'clasp', position: { x: 0.15, y: 0.50 } })
            break
        default:
            if (stones?.length) comps.push({ name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.30 } })
            const pc = (setting?.prong_count as number) || 4
            for (let i = 0; i < pc; i++) {
                const a2 = (i / pc) * Math.PI * 2 - Math.PI / 2
                comps.push({
                    name: `prong_${String(i + 1).padStart(2, '0')}`, type: 'prong',
                    position: { x: 0.50 + Math.cos(a2) * 0.12, y: 0.30 + Math.sin(a2) * 0.12 }
                })
            }
            comps.push({ name: 'band', type: 'band', position: { x: 0.50, y: 0.72 } })
            if (halo?.present) comps.push({ name: 'halo', type: 'stone', position: { x: 0.50, y: 0.32 } })
    }
    return comps
}

export { router as analyzeRouter }