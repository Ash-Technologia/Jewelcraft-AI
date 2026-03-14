import { Router, Request, Response } from 'express'

const router = Router()

// ── TYPES ──────────────────────────────────────────────────────
interface Stone {
  type: string
  cut: string
  size: number
  color: string
  transmission: number
  ior: number
  position?: 'center' | 'side' | string
  count?: number
}

interface DesignParams {
  type?: string
  metal: { type: string; color: string; roughness: number; finish: string }
  band: { width: number; thickness: number; profile: string }
  stones: Stone[]
  halo: { enabled: boolean; stoneCount: number; stoneSize: number }
  prongs: { count: number; style: string; height: number; thickness: number }
  setting: { type: string }
  style_dna: { romance: number; boldness: number; modernity: number; luxury: number; complexity: number }
  engraving?: { text: string; font: string; depth: number }
}

interface HistoryItem { role: 'user' | 'assistant'; text: string }

interface AgentRequest {
  message: string
  currentParams: DesignParams
  sessionHistory?: HistoryItem[]
  previousParams?: DesignParams
}

interface AgentResponse {
  success: boolean
  message: string
  params: DesignParams
  changes: Record<string, { from: unknown; to: unknown }>
  summary: string
  priceChange: number
  manufactureWarnings?: string[]
  proactiveSuggestion?: string
  error?: string
}

// ── SAFE DEFAULTS ──────────────────────────────────────────────
const DEFAULT_PARAMS: DesignParams = {
  type: 'ring',
  metal: { type: 'yellow_gold', color: '#FFD700', roughness: 0.15, finish: 'high_polish' },
  band: { width: 2.5, thickness: 1.6, profile: 'comfort_fit' },
  stones: [{ type: 'diamond', cut: 'round_brilliant', size: 1.0, color: '#F8F8FF', transmission: 0.98, ior: 2.417, position: 'center', count: 1 }],
  halo: { enabled: false, stoneCount: 0, stoneSize: 0.025 },
  prongs: { count: 4, style: 'round', height: 1.2, thickness: 0.9 },
  setting: { type: 'prong' },
  style_dna: { romance: 0.5, boldness: 0.5, modernity: 0.5, luxury: 0.5, complexity: 0.5 },
}

// ── Type-specific band defaults ────────────────────────────────
const TYPE_BAND_DEFAULTS: Record<string, DesignParams['band']> = {
  ring: { width: 2.5, thickness: 1.6, profile: 'comfort_fit' },
  necklace: { width: 1.5, thickness: 1.2, profile: 'round' },
  pendant: { width: 1.2, thickness: 1.0, profile: 'round' },
  earring: { width: 1.2, thickness: 1.0, profile: 'round' },
  earrings: { width: 1.2, thickness: 1.0, profile: 'round' },
  bracelet: { width: 4.5, thickness: 2.5, profile: 'round' },
  bangle: { width: 5.0, thickness: 3.0, profile: 'round' },
  cufflink: { width: 2.0, thickness: 1.5, profile: 'flat' },
  cufflinks: { width: 2.0, thickness: 1.5, profile: 'flat' },
}

function sanitizeParams(raw: Partial<DesignParams> | undefined): DesignParams {
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PARAMS))
  const jewelType = (raw.type || DEFAULT_PARAMS.type || 'ring').toLowerCase()
  const typeBand = TYPE_BAND_DEFAULTS[jewelType] || DEFAULT_PARAMS.band
  return {
    type: raw.type ?? DEFAULT_PARAMS.type,
    metal: { ...DEFAULT_PARAMS.metal, ...(raw.metal ?? {}) },
    band: { ...typeBand, ...(raw.band ?? {}) },
    stones: raw.stones?.length ? raw.stones : DEFAULT_PARAMS.stones,
    halo: { ...DEFAULT_PARAMS.halo, ...(raw.halo ?? {}) },
    prongs: { ...DEFAULT_PARAMS.prongs, ...(raw.prongs ?? {}) },
    setting: { ...DEFAULT_PARAMS.setting, ...(raw.setting ?? {}) },
    style_dna: { ...DEFAULT_PARAMS.style_dna, ...(raw.style_dna ?? {}) },
    engraving: raw.engraving ?? undefined,
  }
}

// ── SYSTEM PROMPT ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are JewelCraft AI, an expert jewelry design assistant embedded in a 3D design tool.

You receive the current design parameters (JSON) and a user instruction. 
You MUST return ONLY valid JSON — no markdown, no explanation outside the JSON.

Return this exact shape:
{
  "message": "Conversational explanation of what changed and why (2-3 sentences)",
  "changes": { "band.width": { "from": 2.5, "to": 1.2 }, "metal.type": { "from": "yellow_gold", "to": "rose_gold" } },
  "params": { /* complete updated DesignParams object — every field must be present */ },
  "summary": "Short 2-5 word version label e.g. 'Rose gold + thin band'",
  "priceChange": -3200,
  "manufactureWarnings": [],
  "proactiveSuggestion": "Optional: a follow-up idea the user might like"
}

JEWELRY TYPES (set the "type" field):
  ring, necklace, pendant, earring, bracelet, bangle, cufflink

TYPE-SPECIFIC BAND DEFAULTS:
  ring:      width=2.5, thickness=1.6, profile=comfort_fit
  necklace:  width=1.5, thickness=1.2, profile=round (chain width)
  pendant:   width=1.2, thickness=1.0, profile=round
  earring:   width=1.2, thickness=1.0, profile=round
  bracelet:  width=4.5, thickness=2.5, profile=round
  bangle:    width=5.0, thickness=3.0, profile=round
  cufflink:  width=2.0, thickness=1.5, profile=flat

METAL COLORS:
  yellow_gold: #FFD700, roughness 0.15
  rose_gold:   #E8A090, roughness 0.12
  white_gold:  #E8E8E8, roughness 0.12
  platinum:    #D0D0D8, roughness 0.08
  silver:      #C0C0C8, roughness 0.20

STONE PROPERTIES:
  diamond:    color #F8F8FF, transmission 0.98, ior 2.417
  sapphire:   color #0F52BA, transmission 0.72, ior 1.77
  ruby:       color #E0115F, transmission 0.70, ior 1.76
  emerald:    color #046307, transmission 0.65, ior 1.58
  moissanite: color #F0F8FF, transmission 0.95, ior 2.65
  onyx:       color #1A1A1A, transmission 0.05, ior 1.66
  amethyst:   color #9B59B6, transmission 0.75, ior 1.54

PRICE REFERENCES (INR):
  Band width change: ±₹2,000 per 0.5mm
  Platinum vs gold: +₹12,000
  Diamond 2ct: ₹1,20,000 base
  Adding halo (16 stones): +₹18,000

MANUFACTURE WARNINGS:
  - band.width < 1.0: "Band below 1mm minimum — structural risk"
  - prongs.thickness < 0.8: "Prongs too thin — stone may dislodge"
  - halo.stoneSize < 0.015: "Halo stones too small for casting"

RELATIVE INSTRUCTIONS:
  "go halfway back": interpolate 50% between current and previous
  "a bit more": increase last change by 30%
  "undo that": restore previous params

STYLE PRESETS:
  minimalist:    band.width=1.0, profile=knife_edge, setting=bezel, halo=off, prongs=0, finish=brushed, dna.modernity=0.9
  art_deco:      band.width=3.2, profile=flat, finish=high_polish, dna.boldness=0.85
  victorian:     band.width=3.5, halo=on (24 stones), finish=antique, dna.romance=0.95
  scandinavian:  band.width=1.4, profile=flat, finish=brushed_matte, prongs.count=4

Always return the full params object with the correct "type" field preserved. Never omit fields.`

// ── PRICE DELTA CALCULATOR ─────────────────────────────────────
function calcPriceDelta(prev: DesignParams, next: DesignParams): number {
  let delta = 0
  const bw = (next.band.width - prev.band.width)
  delta += bw * 4000

  const metalPremium: Record<string, number> = {
    platinum: 12000, white_gold: 1500, yellow_gold: 0, rose_gold: 0, silver: -8000,
  }
  delta += (metalPremium[next.metal.type] ?? 0) - (metalPremium[prev.metal.type] ?? 0)

  const stonePremium: Record<string, number> = {
    diamond: 120000, ruby: 72000, emerald: 48000,
    sapphire: 56000, moissanite: 6000, amethyst: 8000, onyx: 2000,
  }
  delta += (stonePremium[next.stones[0]?.type ?? 'diamond'] ?? 0)
    - (stonePremium[prev.stones[0]?.type ?? 'diamond'] ?? 0)

  if (prev.halo.enabled !== next.halo.enabled) {
    delta += next.halo.enabled ? 18000 : -18000
  }

  // Type change pricing
  const typePremium: Record<string, number> = {
    ring: 0, earring: -5000, earrings: -5000,
    pendant: 5000, necklace: 25000, bracelet: 35000, bangle: 30000, cufflink: 15000,
  }
  if (prev.type !== next.type) {
    delta += (typePremium[next.type ?? 'ring'] ?? 0) - (typePremium[prev.type ?? 'ring'] ?? 0)
  }

  return Math.round(delta)
}

// ── MANUFACTURE WARNINGS ───────────────────────────────────────
function getWarnings(p: DesignParams): string[] {
  const w: string[] = []
  if (p.band.width < 1.0)
    w.push('Band below 1mm minimum structural thickness')
  if (p.prongs.thickness < 0.8 && p.prongs.count > 0)
    w.push('Prongs too thin — stone security risk')
  if (p.halo.enabled && p.halo.stoneSize < 0.015)
    w.push('Halo stones may be too small for casting')
  return w
}

// ── DEEP MERGE PARAMS ──────────────────────────────────────────
function deepMerge(base: DesignParams, patch: Partial<DesignParams>): DesignParams {
  const result = JSON.parse(JSON.stringify(base)) as DesignParams
  if (patch.type) result.type = patch.type
  if (patch.metal) Object.assign(result.metal, patch.metal)
  if (patch.band) Object.assign(result.band, patch.band)
  if (patch.stones) result.stones = patch.stones
  if (patch.halo) Object.assign(result.halo, patch.halo)
  if (patch.prongs) Object.assign(result.prongs, patch.prongs)
  if (patch.setting) Object.assign(result.setting, patch.setting)
  if (patch.style_dna) Object.assign(result.style_dna, patch.style_dna)
  if (patch.engraving) result.engraving = { ...result.engraving, ...patch.engraving } as DesignParams['engraving']
  return sanitizeParams(result)
}

// ── BUILD DIFF ─────────────────────────────────────────────────
function buildDiff(
  prev: DesignParams,
  next: DesignParams
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  const flat = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj)) {
      const val = obj[k]
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(out, flat(val as Record<string, unknown>, prefix ? `${prefix}.${k}` : k))
      } else {
        out[prefix ? `${prefix}.${k}` : k] = val
      }
    }
    return out
  }
  const fp = flat(prev as unknown as Record<string, unknown>)
  const fn = flat(next as unknown as Record<string, unknown>)
  for (const k of Object.keys(fn)) {
    if (JSON.stringify(fp[k]) !== JSON.stringify(fn[k])) {
      diff[k] = { from: fp[k], to: fn[k] }
    }
  }
  return diff
}

// ── KEYWORD RULES ──────────────────────────────────────────────
interface KwRule {
  keywords: string[]
  patch: Partial<DesignParams>
  message: string
  summary: string
  proactiveSuggestion?: string
}

const KW_RULES: KwRule[] = [
  // ── Jewelry type changes ──
  {
    keywords: ['necklace', 'chain necklace'],
    patch: { type: 'necklace', band: { width: 1.5, thickness: 1.2, profile: 'round' } },
    message: "Changed to a necklace design — I've adjusted the proportions for a chain-and-pendant structure. The band parameters now represent chain width.",
    summary: 'Changed to necklace',
    proactiveSuggestion: 'Want to try a pendant drop or add a halo to the centre stone?',
  },
  {
    keywords: ['pendant', 'drop pendant', 'locket'],
    patch: { type: 'pendant', band: { width: 1.2, thickness: 1.0, profile: 'round' } },
    message: "Switched to a pendant design — featuring a bail and drop frame. Perfect for showcasing a statement stone.",
    summary: 'Changed to pendant',
  },
  {
    keywords: ['earring', 'earrings', 'stud earring', 'drop earring', 'ear'],
    patch: { type: 'earring', band: { width: 1.2, thickness: 1.0, profile: 'round' }, prongs: { count: 4, style: 'round', height: 0.8, thickness: 0.6 } },
    message: "Switched to earring design — the model now shows a post/hook with your chosen stone. Complexity dial controls stud vs drop style.",
    summary: 'Changed to earring',
    proactiveSuggestion: 'Try increasing complexity for a chandelier drop earring look.',
  },
  {
    keywords: ['bracelet', 'tennis bracelet', 'bangle'],
    patch: { type: 'bracelet', band: { width: 4.5, thickness: 2.5, profile: 'round' } },
    message: "Converted to a bracelet — wider band radius, bangle-style geometry. The stone is set on the top of the bangle.",
    summary: 'Changed to bracelet',
    proactiveSuggestion: 'Add a halo to make the centre stone pop against the wide band.',
  },
  {
    keywords: ['cufflink', 'cufflinks'],
    patch: { type: 'cufflink', band: { width: 2.0, thickness: 1.5, profile: 'flat' }, setting: { type: 'bezel' }, prongs: { count: 0, style: 'bezel', height: 0, thickness: 0 } },
    message: "Changed to cufflink design — circular bezel face with T-bar toggle back. Classic suiting accessory.",
    summary: 'Changed to cufflink',
  },
  {
    keywords: ['ring', 'back to ring', 'make it a ring'],
    patch: { type: 'ring', band: { width: 2.5, thickness: 1.6, profile: 'comfort_fit' } },
    message: "Switched back to a ring design with standard proportions.",
    summary: 'Changed to ring',
  },

  // ── Band changes ──
  {
    keywords: ['thinner', 'thin', 'narrow', 'slim', 'delicate'],
    patch: { band: { width: 1.5, thickness: 1.2, profile: 'knife_edge' } },
    message: "I've slimmed the band to 1.5mm with a knife-edge profile — elegant and modern. Less metal also reduces weight for everyday comfort.",
    summary: 'Thinner band',
    proactiveSuggestion: 'Loving the thin look? Try a bezel setting — it completes the minimalist aesthetic perfectly.',
  },
  {
    keywords: ['wider', 'thick', 'wide', 'bold', 'chunky', 'statement'],
    patch: { band: { width: 4.0, thickness: 2.0, profile: 'flat' } },
    message: "Widened to 4mm flat band — bold and statement-making. This style is trending in 2025 as part of the sculptural jewelry movement.",
    summary: 'Statement band',
  },

  // ── Metal changes ──
  {
    keywords: ['rose gold', 'pink gold', 'romantic'],
    patch: { metal: { type: 'rose_gold', color: '#E8A090', roughness: 0.12, finish: 'high_polish' } },
    message: "Switched to rose gold — the warm blush tone adds a romantic, contemporary feel. Flattering against most skin tones.",
    summary: 'Rose gold',
    proactiveSuggestion: 'Rose gold pairs beautifully with morganite or pink sapphire. Want to try that?',
  },
  {
    keywords: ['white gold'],
    patch: { metal: { type: 'white_gold', color: '#E8E8E8', roughness: 0.12, finish: 'high_polish' } },
    message: "Changed to white gold — sleek and modern, pairs beautifully with diamonds and coloured gems alike.",
    summary: 'White gold',
  },
  {
    keywords: ['yellow gold'],
    patch: { metal: { type: 'yellow_gold', color: '#FFD700', roughness: 0.15, finish: 'high_polish' } },
    message: "Back to classic yellow gold — warm, traditional, and timeless.",
    summary: 'Yellow gold',
  },
  {
    keywords: ['platinum'],
    patch: { metal: { type: 'platinum', color: '#D0D0D8', roughness: 0.08, finish: 'high_polish' } },
    message: "Upgraded to platinum — the most prestigious metal. Naturally white, hypoallergenic, and extremely durable.",
    summary: 'Platinum',
  },
  {
    keywords: ['silver'],
    patch: { metal: { type: 'silver', color: '#C0C0C8', roughness: 0.20, finish: 'high_polish' } },
    message: "Switched to sterling silver — budget-friendly and beautiful.",
    summary: 'Silver',
  },

  // ── Stone changes ──
  {
    keywords: ['sapphire', 'blue stone'],
    patch: { stones: [{ type: 'sapphire', cut: 'oval', size: 1.0, color: '#0F52BA', transmission: 0.72, ior: 1.77, position: 'center', count: 1 }] },
    message: "Changed to sapphire — a stunning deep blue. Hardness 9/10, incredibly durable. ~₹60,000 savings vs diamond.",
    summary: 'Sapphire',
    proactiveSuggestion: 'Sapphire + rose gold is a trending 2025 combination. Want to try it?',
  },
  {
    keywords: ['ruby', 'red stone'],
    patch: { stones: [{ type: 'ruby', cut: 'round_brilliant', size: 1.0, color: '#E0115F', transmission: 0.70, ior: 1.76, position: 'center', count: 1 }] },
    message: "Switched to ruby — the king of gems. Deep pigeon-blood red, symbolic of passion and courage.",
    summary: 'Ruby',
  },
  {
    keywords: ['emerald', 'green stone'],
    patch: { stones: [{ type: 'emerald', cut: 'emerald', size: 1.0, color: '#046307', transmission: 0.65, ior: 1.58, position: 'center', count: 1 }] },
    message: "Changed to emerald — rich verdant green, Cleopatra's favourite. Classic with yellow gold.",
    summary: 'Emerald',
  },
  {
    keywords: ['moissanite', 'budget', 'affordable'],
    patch: { stones: [{ type: 'moissanite', cut: 'round_brilliant', size: 1.0, color: '#F0F8FF', transmission: 0.95, ior: 2.65, position: 'center', count: 1 }] },
    message: "Smart budget choice! Moissanite saves ~95% vs diamond with 97% visual similarity.",
    summary: 'Moissanite',
  },
  {
    keywords: ['onyx', 'black stone', 'dark stone'],
    patch: { stones: [{ type: 'onyx', cut: 'cabochon', size: 1.0, color: '#1A1A1A', transmission: 0.05, ior: 1.66, position: 'center', count: 1 }] },
    message: "Switched to onyx — bold, striking. A cabochon cut showcases the deep black surface beautifully.",
    summary: 'Black onyx',
  },
  {
    keywords: ['amethyst', 'purple stone'],
    patch: { stones: [{ type: 'amethyst', cut: 'oval', size: 1.0, color: '#9B59B6', transmission: 0.75, ior: 1.54, position: 'center', count: 1 }] },
    message: "Switched to amethyst — rich purple hue, wonderfully affordable yet striking.",
    summary: 'Amethyst',
  },

  // ── Setting changes ──
  {
    keywords: ['halo', 'add halo'],
    patch: { halo: { enabled: true, stoneCount: 20, stoneSize: 0.025 } },
    message: "Added a diamond halo of 20 micro-pavé stones — makes the centre stone appear ~30% larger.",
    summary: 'Added halo',
  },
  {
    keywords: ['remove halo', 'no halo', 'without halo'],
    patch: { halo: { enabled: false, stoneCount: 0, stoneSize: 0 } },
    message: "Removed the halo — the centre stone now stands alone in elegant simplicity.",
    summary: 'No halo',
  },
  {
    keywords: ['bezel', 'bezel setting'],
    patch: { setting: { type: 'bezel' }, prongs: { count: 0, style: 'bezel', height: 0, thickness: 0 } },
    message: "Changed to a bezel setting — the metal wraps fully around the stone. Maximum protection and ultra-modern look.",
    summary: 'Bezel setting',
  },

  // ── Style presets ──
  {
    keywords: ['minimal', 'minimalist', 'simple', 'clean'],
    patch: {
      band: { width: 1.0, thickness: 1.1, profile: 'knife_edge' },
      setting: { type: 'bezel' },
      halo: { enabled: false, stoneCount: 0, stoneSize: 0 },
      prongs: { count: 0, style: 'bezel', height: 0.6, thickness: 0.6 },
      metal: { type: 'platinum', color: '#D0D0D8', roughness: 0.35, finish: 'brushed' },
      style_dna: { romance: 0.2, boldness: 0.15, modernity: 0.95, luxury: 0.7, complexity: 0.08 },
    },
    message: "Applied Minimalist preset — knife-edge band, bezel setting, brushed platinum. Aligns with 2026 Sculptural Minimalism trend.",
    summary: 'Minimalist style',
  },
  {
    keywords: ['art deco', 'deco', 'geometric', '1920'],
    patch: {
      band: { width: 3.2, thickness: 2.0, profile: 'flat' },
      metal: { type: 'yellow_gold', color: '#FFD700', roughness: 0.10, finish: 'high_polish' },
      style_dna: { romance: 0.45, boldness: 0.85, modernity: 0.65, luxury: 0.8, complexity: 0.78 },
    },
    message: "Applied Art Deco style — geometric flat band at 3.2mm, high polish yellow gold. Evokes the glamour of 1920s Paris.",
    summary: 'Art Deco style',
  },
  {
    keywords: ['victorian', 'vintage', 'antique', 'ornate'],
    patch: {
      band: { width: 3.5, thickness: 2.2, profile: 'round' },
      halo: { enabled: true, stoneCount: 24, stoneSize: 0.02 },
      metal: { type: 'yellow_gold', color: '#FFD700', roughness: 0.25, finish: 'antique' },
      style_dna: { romance: 0.95, boldness: 0.6, modernity: 0.1, luxury: 0.85, complexity: 0.92 },
    },
    message: "Applied Victorian style — wide band, 24-stone halo, antique gold finish. Maximum romance and ornate detailing.",
    summary: 'Victorian style',
  },
  {
    keywords: ['matte', 'brushed', 'satin'],
    patch: { metal: { finish: 'brushed', roughness: 0.38 } } as Partial<DesignParams>,
    message: "Applied a brushed/satin finish — understated sophistication.",
    summary: 'Brushed finish',
  },
  {
    keywords: ['polish', 'shiny', 'mirror', 'high polish'],
    patch: { metal: { finish: 'high_polish', roughness: 0.08 } } as Partial<DesignParams>,
    message: "Applied mirror-high polish — maximum brilliance.",
    summary: 'High polish',
  },
]

// ── INTENT PARSER ──────────────────────────────────────────────
function parseKeywords(
  message: string,
  current: DesignParams,
  previous?: DesignParams
): Partial<AgentResponse> | null {
  const lower = message.toLowerCase().trim()

  if ((lower.includes('undo') || lower.includes('go back') || lower.includes('revert')) && previous) {
    const safe = sanitizeParams(previous)
    return {
      message: "Restored your previous design. All parameters reverted.",
      params: safe,
      changes: buildDiff(current, safe),
      summary: 'Reverted',
      priceChange: calcPriceDelta(current, safe),
      manufactureWarnings: getWarnings(safe),
    }
  }

  if ((lower.includes('halfway') || lower.includes('half way')) && previous) {
    const blended = JSON.parse(JSON.stringify(current)) as DesignParams
    blended.band.width = (current.band.width + previous.band.width) / 2
    const safe = sanitizeParams(blended)
    return {
      message: "Gone halfway between your current and previous design.",
      params: safe,
      changes: buildDiff(current, safe),
      summary: 'Halfway blend',
      priceChange: calcPriceDelta(current, safe),
      manufactureWarnings: getWarnings(safe),
    }
  }

  const rule = KW_RULES.find(r => r.keywords.some(k => lower.includes(k)))
  if (!rule) return null

  // When changing jewelry type, adopt type-appropriate band if not explicitly patching band
  let patch = { ...rule.patch }
  if (patch.type && !patch.band) {
    const typeBand = TYPE_BAND_DEFAULTS[patch.type]
    if (typeBand) patch = { ...patch, band: typeBand }
  }

  const newParams = deepMerge(current, patch)
  return {
    message: rule.message,
    params: newParams,
    changes: buildDiff(current, newParams),
    summary: rule.summary,
    priceChange: calcPriceDelta(current, newParams),
    manufactureWarnings: getWarnings(newParams),
    proactiveSuggestion: rule.proactiveSuggestion,
  }
}

// ── HEALTH ENDPOINT ────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode: process.env.OPENAI_API_KEY ? 'gpt-4o' : 'keyword-fallback',
    timestamp: new Date().toISOString(),
  })
})

// ── VALIDATE ENDPOINT ──────────────────────────────────────────
router.get('/validate', (req: Request, res: Response) => {
  try {
    const params = req.query.params
      ? sanitizeParams(JSON.parse(req.query.params as string) as Partial<DesignParams>)
      : null
    if (!params) { res.status(400).json({ error: 'params required' }); return }
    res.json({ warnings: getWarnings(params), score: 100 - getWarnings(params).length * 15 })
  } catch {
    res.status(400).json({ error: 'Invalid params JSON' })
  }
})

// ── MAIN AGENT ROUTE ───────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const { message, currentParams: rawCurrent, sessionHistory = [], previousParams: rawPrevious } =
    req.body as AgentRequest

  if (!message?.trim()) {
    res.status(400).json({ success: false, error: 'Message required' })
    return
  }
  if (!rawCurrent) {
    res.status(400).json({ success: false, error: 'currentParams required' })
    return
  }

  const currentParams = sanitizeParams(rawCurrent)
  const previousParams = rawPrevious ? sanitizeParams(rawPrevious) : undefined

  try {
    // ── GPT-4o PATH ──
    if (process.env.OPENAI_API_KEY) {
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `CURRENT PARAMS:\n${JSON.stringify(currentParams, null, 2)}\n\n` +
            (previousParams ? `PREVIOUS PARAMS:\n${JSON.stringify(previousParams, null, 2)}\n\n` : '') +
            `USER SAYS: "${message}"`,
        },
      ]

      for (const h of sessionHistory.slice(-8)) {
        msgs.push({ role: h.role, content: h.text })
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: msgs,
        max_tokens: 1800,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(raw)
      const finalParams = deepMerge(currentParams, parsed.params ?? {})
      const finalChanges = parsed.changes ?? buildDiff(currentParams, finalParams)

      const response: AgentResponse = {
        success: true,
        message: parsed.message ?? 'Changes applied.',
        params: finalParams,
        changes: finalChanges,
        summary: parsed.summary ?? 'Updated design',
        priceChange: parsed.priceChange ?? calcPriceDelta(currentParams, finalParams),
        manufactureWarnings: parsed.manufactureWarnings ?? getWarnings(finalParams),
        proactiveSuggestion: parsed.proactiveSuggestion,
      }
      res.json(response)
      return
    }

    // ── KEYWORD FALLBACK PATH ──
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400))

    const kwResult = parseKeywords(message, currentParams, previousParams)
    if (kwResult) {
      res.json({ success: true, ...kwResult })
      return
    }

    res.json({
      success: true,
      message: `I understand you want to "${message.trim()}". Try: "change to necklace", "make it a bracelet", "switch to earrings", "rose gold", "sapphire", "add halo", or "make it minimalist".`,
      params: currentParams,
      changes: {},
      summary: '',
      priceChange: 0,
      manufactureWarnings: getWarnings(currentParams),
      proactiveSuggestion: 'Need inspiration? Try "change to necklace with sapphire" or "make it art deco".',
    } satisfies AgentResponse)

  } catch (error) {
    console.error('[AgentRoute] Error:', error)
    res.status(500).json({
      success: false,
      error: 'Agent processing failed',
      message: String(error),
    })
  }
})

export { router as agentRouter }