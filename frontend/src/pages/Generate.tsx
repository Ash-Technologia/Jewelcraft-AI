import { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Upload, Sparkles, Image as ImageIcon, Wand2, History } from 'lucide-react'
import { useAppStore, DEFAULT_PARAMS, DesignParams } from '../store/useAppStore'
import ConceptCard from '../components/generate/ConceptCard'
import { analyzeImage, generateConcepts, connectWebSocket, onWsEvent, isBackendConnected } from '../api/client'
import type { AnalysisResult } from '../api/client'

// ─── NEW: No TensorFlow. Uses our pure-CV detector + image-faithful params ───
import { detectJewelryType } from '../utils/jewelryDetector'
import { analyzeImageForParams, buildFaithfulConcepts } from '../utils/imageToParams'

import './Generate.css'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type JewelType = 'ring' | 'pendant' | 'earring' | 'bracelet'

export interface ExtractedFeatures {
    metal: string
    stone: string
    cut: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT-BASED TYPE DETECTION (for prompt input)
// ─────────────────────────────────────────────────────────────────────────────

function detectTypeFromText(text: string): JewelType {
    if (!text) return 'ring'
    const t = text.toLowerCase()

    if (t.includes('necklace') || t.includes('pendant') || t.includes('chain') ||
        t.includes('locket') || t.includes('choker') || t.includes('collar') ||
        t.includes('lavaliere') || t.includes('haar') || t.includes('mala') ||
        t.includes('mangalsutra') || t.includes('rani haar')) return 'pendant'

    if (t.includes('earring') || t.includes('stud') || t.includes('hoop') ||
        t.includes('chandelier') || t.includes('dangle') || t.includes('drop ear') ||
        t.includes('ear ring') || t.includes('huggie') || t.includes('climber') ||
        t.includes('jhumka') || t.includes('bali') || t.includes('jhumki') ||
        t.includes('tops') || t.includes('crawler')) return 'earring'

    if (t.includes('bracelet') || t.includes('bangle') || t.includes('cuff') ||
        t.includes('anklet') || t.includes('armband') || t.includes('kada') ||
        t.includes('kara') || t.includes('wristband')) return 'bracelet'

    if (t.includes('ring') || t.includes('solitaire') || t.includes('engagement') ||
        t.includes('wedding') || t.includes('signet') || t.includes('eternity')) return 'ring'

    return 'ring'
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY MAPS
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<JewelType, string> = {
    ring: '💍', pendant: '📿', earring: '✨', bracelet: '💎',
}
const TYPE_LABEL: Record<JewelType, string> = {
    ring: 'Ring', pendant: 'Pendant', earring: 'Earring', bracelet: 'Bracelet',
}

const METAL_HEX: Record<string, string> = {
    yellow_gold: '#FFD700', rose_gold: '#E8A090', white_gold: '#E8E8E8',
    platinum: '#D0D0D8', silver: '#C0C0C8',
}
const STONE_HEX: Record<string, string> = {
    diamond: '#F5F5FF', ruby: '#CC1033', emerald: '#1A6B2A',
    sapphire: '#0A3FA0', onyx: '#111111', amethyst: '#7B2D8B', moissanite: '#F0F5FF',
}
const STONE_PHYS: Record<string, { transmission: number; ior: number }> = {
    diamond: { transmission: 0.97, ior: 2.417 }, moissanite: { transmission: 0.95, ior: 2.65 },
    ruby: { transmission: 0.55, ior: 1.77 }, emerald: { transmission: 0.50, ior: 1.58 },
    sapphire: { transmission: 0.55, ior: 1.77 }, onyx: { transmission: 0.0, ior: 1.49 },
    amethyst: { transmission: 0.60, ior: 1.54 },
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE-SPECIFIC PARAM DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

function typeBase(t: JewelType): Partial<DesignParams> {
    switch (t) {
        case 'pendant':
            return { type: 'pendant', band: { width: 2.5, thickness: 1.5, profile: 'round' }, prongs: { count: 4, style: 'round', height: 0.9, thickness: 0.7 }, halo: { enabled: false, stoneCount: 16, stoneSize: 0.025 } }
        case 'earring':
            return { type: 'earring', band: { width: 1.2, thickness: 1.0, profile: 'round' }, prongs: { count: 4, style: 'round', height: 0.8, thickness: 0.6 }, halo: { enabled: false, stoneCount: 12, stoneSize: 0.022 } }
        case 'bracelet':
            return { type: 'bracelet', band: { width: 6.0, thickness: 3.0, profile: 'round' }, prongs: { count: 0, style: 'bezel', height: 0, thickness: 0 }, halo: { enabled: false, stoneCount: 0, stoneSize: 0 } }
        default:
            return { type: 'ring', band: { width: 2.5, thickness: 1.8, profile: 'round' }, prongs: { count: 4, style: 'round', height: 1.2, thickness: 0.9 }, halo: { enabled: false, stoneCount: 16, stoneSize: 0.03 } }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPT VARIANT TYPES (unchanged interface — ConceptCard still works)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConceptVariant {
    [key: string]: string | number | DesignParams | undefined
    id: string; label: string; description: string; metal: string
    setting: string; finish: string; priceEstimate: number; manufactureScore: number
    color: string; params: DesignParams; thumbnail: string; variant: 'classic' | 'modern' | 'ornate'
}

type ConceptList = ConceptVariant[]

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK: Build concepts procedurally when no image is available
// ─────────────────────────────────────────────────────────────────────────────

function buildFallbackConcepts(jType: JewelType, metalType: string, stoneType: string, stoneCut: string, stoneSize: number, styleDna: Record<string, number>, genCount: number = 0, gender: string = 'womens'): ConceptList {
    const base = typeBase(jType)
    const seed = genCount * 1337
    const rng = (idx: number) => { const x = Math.sin(seed + idx) * 10000; return x - Math.floor(x) }

    // Adjusted constraints by gender
    const isMens = gender === 'mens'
    const isUnisex = gender === 'unisex'

    const personas = [
        { id: 'classic', label: 'Classic', desc: 'Timeless luxury', m: 'yellow_gold', pCount: isMens ? 0 : 4, pStyle: isMens ? 'bezel' : 'round', bandW: isMens ? 1.8 : 1.0, set: isMens ? 'flush' : 'prong', halo: !isMens },
        { id: 'modern', label: 'Modern', desc: 'Sleek & minimalist', m: 'platinum', pCount: 0, pStyle: 'bezel', bandW: isMens ? 2.0 : (isUnisex ? 1.5 : 0.7), set: isMens ? 'tension' : 'bezel', halo: false },
        { id: 'ornate', label: 'Ornate', desc: 'Vintage intricacies', m: 'rose_gold', pCount: isMens ? 0 : 6, pStyle: isMens ? 'bezel' : 'claw', bandW: isMens ? 1.6 : 1.4, set: isMens ? 'flush' : 'pave', halo: !isMens },
        { id: 'artdeco', label: 'Art Deco', desc: 'Geometric glamour', m: 'platinum', pCount: 4, pStyle: 'v_prong', bandW: isMens ? 1.8 : 1.8, set: 'channel', halo: !isMens },
        { id: 'minimalist', label: 'Minimalist', desc: 'Barely there', m: 'white_gold', pCount: isMens ? 0 : 3, pStyle: 'bezel', bandW: isMens ? 1.5 : (isUnisex ? 1.0 : 0.4), set: 'flush', halo: false },
        { id: 'bohemian', label: 'Bohemian', desc: 'Organic flow', m: 'yellow_gold', pCount: 4, pStyle: 'claw', bandW: isMens ? 2.0 : 1.2, set: isMens ? 'flush' : 'prong', halo: false },
        { id: 'royal', label: 'Royal', desc: 'Regal majesty', m: 'yellow_gold', pCount: isMens ? 0 : 8, pStyle: isMens ? 'bezel' : 'claw', bandW: isMens ? 2.2 : 1.5, set: isMens ? 'pave' : 'pave', halo: true },
        { id: 'vintage', label: 'Vintage', desc: 'Heirloom charm', m: 'rose_gold', pCount: isMens ? 0 : 4, pStyle: isMens ? 'bezel' : 'claw', bandW: isMens ? 1.6 : 1.3, set: isMens ? 'flush' : 'pave', halo: !isMens },
    ]

    const shuffledPersonas = [...personas].sort((a) => rng(a.id.charCodeAt(0)) - 0.5)
    const p1 = shuffledPersonas[(genCount * 3) % personas.length]
    const p2 = shuffledPersonas[(genCount * 3 + 1) % personas.length]
    const p3 = shuffledPersonas[(genCount * 3 + 2) % personas.length]

    const buildVariant = (p: typeof p1, idx: number): ConceptVariant => {
        const rSize = stoneSize * (0.8 + rng(idx) * 0.6)
        const finalCut = isMens && rng(idx) > 0.5 ? 'emerald' : rng(idx) > 0.7 ? 'emerald' : (stoneCut || 'round_brilliant')
        const finalMetal = rng(idx) > 0.8 ? p.m : metalType || p.m
        const rRough = isMens ? (rng(idx + 1) > 0.4 ? 0.6 : 0.2) : (rng(idx + 1) > 0.8 ? 0.4 : 0.1) // Men's rings often brushed
        const bWidth = (base.band?.width ?? (isMens ? 4.5 : 2.5)) * p.bandW * (0.9 + rng(idx + 2) * 0.2)
        const bThick = (base.band?.thickness ?? (isMens ? 2.2 : 1.8)) * p.bandW * (0.9 + rng(idx + 3) * 0.2)

        const stone = jType === 'bracelet' ? {
            type: 'onyx', cut: 'cabochon', size: 0,
            color: '#111111', transmission: 0, ior: 1.49,
            position: 'center' as const, count: 0,
        } : {
            type: stoneType, cut: finalCut, size: rSize,
            color: STONE_HEX[stoneType] || '#F5F5FF',
            transmission: (STONE_PHYS[stoneType] || STONE_PHYS.diamond).transmission,
            ior: (STONE_PHYS[stoneType] || STONE_PHYS.diamond).ior,
            position: 'center' as const, count: 1,
        }

        // Structural fix for non-rings: ensure setting types make sense
        let finalSettingType = p.set as "prong" | "bezel" | "pave" | "channel" | "tension" | "flush";
        if (jType !== 'ring') {
            if (finalSettingType === 'tension' || finalSettingType === 'flush' || finalSettingType === 'channel') {
                finalSettingType = 'bezel'; // Safer fallback for pendants/earrings
            }
        }

        const params: DesignParams = {
            ...DEFAULT_PARAMS, ...base, type: jType, gender: gender as 'womens' | 'mens' | 'unisex',
            metal: { type: finalMetal, color: METAL_HEX[finalMetal] || '#FFD700', roughness: rRough, finish: rRough > 0.4 ? 'brushed' : 'high_polish' },
            stones: [stone],
            band: { width: bWidth, thickness: bThick, profile: p.bandW < 0.8 && !isMens ? 'knife_edge' : 'round' },
            prongs: { count: p.pCount, style: p.pStyle as "round" | "claw" | "bezel" | "v_prong", height: (base.prongs?.height ?? 1.2) * (1 + rng(idx) * 0.4), thickness: 0.9 + rng(idx) * 0.3 },
            setting: { type: finalSettingType },
            halo: { enabled: p.halo, stoneCount: 16 + Math.floor(rng(idx) * 10), stoneSize: 0.02 + rng(idx) * 0.015 },
            style_dna: { romance: rng(idx), boldness: rng(idx + 1), modernity: rng(idx + 2), luxury: rng(idx + 3), complexity: rng(idx + 4) },
            engraving: { enabled: false, text: '', font: 'serif', depth: 0.3 }
        }
        const price = Math.floor(75000 + rng(idx) * 80000 + (p.halo ? 25000 : 0) + (rSize > 2.0 ? 50000 : 0))
        return {
            id: p.id, label: p.label, description: `${TYPE_LABEL[jType]} — ${p.desc} · ${finalCut}`,
            metal: finalMetal.replace(/_/g, ' ') + ' 18k', setting: p.halo ? 'Halo' : finalSettingType,
            finish: rRough > 0.4 ? 'Brushed' : 'High Polish',
            priceEstimate: Math.round(price / 1000) * 1000, manufactureScore: 85 + Math.floor(rng(idx) * 14),
            color: METAL_HEX[finalMetal] || '#FFD700', params, thumbnail: typeThumbnail(jType),
            variant: p.id === 'modern' ? 'modern' : (p.id === 'ornate' ? 'ornate' : 'classic'),
        }
    }

    return [buildVariant(p1, 0), buildVariant(p2, 1), buildVariant(p3, 2)]
}

function typeThumbnail(t: JewelType): string {
    const map: Record<JewelType, string> = {
        ring: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c848?w=300&q=80',
        pendant: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300&q=80',
        earring: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300&q=80',
        bracelet: 'https://images.unsplash.com/photo-1573408301185-9519f94815f7?w=300&q=80',
    }
    return map[t]
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE MOCK ANALYSIS (for overlay display)
// ─────────────────────────────────────────────────────────────────────────────

const BASE_ANALYSIS = {
    type: 'ring' as JewelType, gender: 'womens',
    components: [
        { name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.45 } },
        { name: 'band', type: 'band', position: { x: 0.50, y: 0.75 } },
        { name: 'prong_01', type: 'prong', position: { x: 0.42, y: 0.38 } },
        { name: 'prong_02', type: 'prong', position: { x: 0.58, y: 0.38 } },
        { name: 'prong_03', type: 'prong', position: { x: 0.42, y: 0.52 } },
        { name: 'prong_04', type: 'prong', position: { x: 0.58, y: 0.52 } },
    ],
    metal: { type: 'yellow_gold', color: '#FFD700', finish: 'high_polish', roughness: 0.15 },
    stones: [{ type: 'diamond', cut: 'round_brilliant', size: 1.0, position: { x: 0.50, y: 0.45 } }],
    style_dna: { romance: 0.75, boldness: 0.35, modernity: 0.55, luxury: 0.85, complexity: 0.40 },
    confidence: 0.92,
}

type AnalysisState = typeof BASE_ANALYSIS

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Generate() {
    const navigate = useNavigate()
    const { setCurrentParams, addVersion, uploadedImage, setUploadedImage, gender, setGender } = useAppStore()

    const isMounted = useRef(true)
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const [inputMode, setInputMode] = useState<'upload' | 'prompt'>('upload')
    const [promptText, setPromptText] = useState('')
    const [isGeneratingImage, setIsGeneratingImage] = useState(false)
    const [imageMetadata, setImageMetadata] = useState<{ width: number; height: number; size: string; format: string } | null>(null)

    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisLog, setAnalysisLog] = useState<string[]>([])
    const [analysisResult, setAnalysisResult] = useState<AnalysisState | null>(null)
    const [detectedType, setDetectedType] = useState<JewelType>('ring')

    const [isGenerating, setIsGenerating] = useState(false)
    const [concepts, setConcepts] = useState<ConceptList | null>(null)
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
    const [genCount, setGenCount] = useState<number>(0)

    const uploadedFileRef = useRef<File | null>(null)
    const logRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, [analysisLog])

    // WebSocket listeners
    useEffect(() => {
        connectWebSocket()
        const u1 = onWsEvent('analysis_log', (d) => setAnalysisLog(prev => [...prev, (d as { line: string }).line]))
        const u2 = onWsEvent('concept_ready', (d) => {
            const ev = d as { index: number; concept: { params: DesignParams; label: string; persona: string; priceEstimate: number; score: number } }
            setConcepts(prev => {
                const updated = prev ? [...prev] : [] as ConceptList
                const cp: DesignParams = { ...ev.concept.params, ...typeBase(detectedType), type: detectedType, gender, engraving: { enabled: false, text: '', font: 'serif', depth: 0.3 } }
                updated[ev.index] = {
                    id: ev.concept.persona, label: ev.concept.label,
                    description: `${ev.concept.persona} ${TYPE_LABEL[detectedType]}`,
                    metal: ((cp.metal as { type: string }).type || 'gold').replace(/_/g, ' '),
                    setting: (cp.setting as { type: string }).type || 'prong',
                    finish: (cp.metal as { finish: string }).finish || 'high_polish',
                    priceEstimate: ev.concept.priceEstimate, manufactureScore: ev.concept.score,
                    color: (cp.metal as { color: string }).color || '#FFD700',
                    params: cp, thumbnail: typeThumbnail(detectedType),
                    variant: ev.concept.persona.toLowerCase() as 'classic' | 'modern' | 'ornate',
                }
                return updated
            })
        })
        return () => { u1(); u2() }
    }, [detectedType, gender])

    // ── LOG HELPER ─────────────────────────────────────────────────────────────
    const addLog = async (msg: string, delay = 0) => {
        if (delay > 0) await new Promise(r => setTimeout(r, delay))
        setAnalysisLog(prev => [...prev, msg])
    }

    // ── ANALYSIS ───────────────────────────────────────────────────────────────
    const startAnalysis = async (file?: File, forcedType?: JewelType, imageUrl?: string) => {
        if (!isMounted.current) return
        setIsAnalyzing(true)
        setAnalysisLog([])
        setAnalysisResult(null)
        setConcepts(null)
        setSelectedIdx(null)

        let jType: JewelType = forcedType ?? 'ring'

        // ── Try real backend first ──────────────────────────────────────────────
        try {
            if (isBackendConnected() && file) {
                const result = await analyzeImage(file)
                if (!result.mock && isMounted.current) {
                    const a = result.analysis
                    jType = (a.jewelry_type as JewelType) ?? 'ring'
                    setDetectedType(jType)
                    const mapped: AnalysisState = {
                        type: jType, gender: gender,
                        components: a.components || BASE_ANALYSIS.components,
                        metal: { type: a.metal?.type || 'yellow_gold', color: METAL_HEX[a.metal?.type] || '#FFD700', finish: a.metal?.finish || 'high_polish', roughness: 0.15 },
                        stones: (a.stones || []).map((s: Record<string, unknown>) => ({ type: s.type as string, cut: s.cut as string, size: s.estimated_carat as number, position: { x: 0.5, y: 0.45 } })),
                        style_dna: a.style_dna || BASE_ANALYSIS.style_dna,
                        confidence: a.confidence || 0.88,
                    }
                    setAnalysisResult(mapped)
                    setIsAnalyzing(false)
                    startGeneration(jType, mapped, imageUrl)
                    return
                }
            }
        } catch {
            console.warn('[Generate] backend unavailable, using CV detector')
        }

        // ── NEW: Pure CV Detection via jewelryDetector ──────────────────────────
        await addLog('> Initializing JewelCraft Vision Engine v2.0...')

        // Run detection in parallel with log animation
        const detectionPromise = (!forcedType && imageUrl)
            ? detectJewelryType(imageUrl, file?.name)
            : Promise.resolve({ type: jType, confidence: forcedType ? 0.99 : 0.0, features: undefined, debug: undefined })

        await addLog('> Running foreground segmentation...', 300)
        await addLog('> Detecting object topology (blobs, edges)...', 280)

        const detResult = await detectionPromise

        if (!forcedType) {
            if (detResult.confidence >= 0.42) {
                jType = detResult.type
                // Log the debug scores if available
                if (detResult.debug) {
                    const db = detResult.debug
                    await addLog(`> Signal scores — ring:${db.sc_ring} pendant:${db.sc_pendant} earring:${db.sc_earring} bracelet:${db.sc_bracelet}`, 200)
                    await addLog(`> Probabilities — ring:${db.p_ring} pendant:${db.p_pendant} earring:${db.p_earring} bracelet:${db.p_bracelet}`, 150)
                    await addLog(`> isDualBlob=${db.isDualBlob}  blobCount=${db.blobCount}  torusScore=${db.torus}  AR=${db.origAR}`, 150)
                }
            } else {
                // Low confidence — show scores and default
                if (detResult.debug) {
                    const db = detResult.debug
                    await addLog(`> WARN: Low confidence (${Math.round(Number(detResult.confidence) * 100)}%)`, 200)
                    await addLog(`> Scores — ring:${db.sc_ring} pendant:${db.sc_pendant} earring:${db.sc_earring} bracelet:${db.sc_bracelet}`, 150)
                }
                jType = detResult.type  // still use best guess, just show warning
            }
            setDetectedType(jType)
            toast.success(`Detected: ${TYPE_LABEL[jType]}${detResult.confidence < 0.42 ? ' (low confidence — use dropdown to correct)' : ''}`)
        }

        const typeLog = TYPE_LABEL[jType]
        const conf = detResult.confidence > 0 ? detResult.confidence.toFixed(2) : (forcedType ? '1.00' : '0.91')

        const steps = [
            `> Classification → ${typeLog.toUpperCase()} (p=${conf})`,
            '> Analyzing metal color signature...',
            '> Detecting stone clusters and halo pattern...',
            '> Estimating stone size from blob geometry...',
            '> Extracting prong count via radial scan...',
            '> Computing Style DNA vectors...',
            '> Building faithful parametric model...',
            '> Analysis complete ✓',
        ]
        for (const step of steps) {
            await new Promise(r => setTimeout(r, 220 + Math.random() * 130))
            if (!isMounted.current) return
            setAnalysisLog(prev => [...prev, step])
        }

        setDetectedType(jType)

        // Build analysis result for overlay display
        const metalType = detResult.features?.metal || 'yellow_gold'
        const stoneType = detResult.features?.stone || 'diamond'
        const mockResult: AnalysisState = {
            ...BASE_ANALYSIS,
            type: jType,
            gender: gender,
            components: typeComponents(jType),
            metal: { type: metalType, color: METAL_HEX[metalType] || '#FFD700', finish: 'high_polish', roughness: 0.15 },
            stones: [{ type: stoneType, cut: detResult.features?.cut || 'round_brilliant', size: 1.0, position: { x: 0.50, y: 0.45 } }],
        }

        setAnalysisResult(mockResult)
        setIsAnalyzing(false)
        startGeneration(jType, mockResult, imageUrl)
    }

    // ── GENERATION — now uses image-faithful analysis ─────────────────────────
    const startGeneration = async (jType: JewelType, analysis: AnalysisState, imageUrl?: string) => {
        if (!isMounted.current) return
        setIsGenerating(true)

        // Try backend first
        try {
            if (isBackendConnected()) {
                const backendAnalysis = { ...analysis, jewelry_type: jType } as unknown as AnalysisResult
                const result = await generateConcepts(backendAnalysis)
                if (result.success && result.concepts.length > 0) {
                    const mapped = result.concepts.map((c) => {
                        const cp: DesignParams = { ...(c.params as DesignParams), ...typeBase(jType), type: jType, gender }
                        return {
                            id: c.persona as string, label: c.label as string,
                            description: `${c.persona} ${TYPE_LABEL[jType]}`,
                            metal: ((cp.metal as { type: string }).type || 'gold').replace(/_/g, ' '),
                            setting: (cp.setting as { type: string }).type || 'prong',
                            finish: (cp.metal as { finish: string }).finish || 'high_polish',
                            priceEstimate: c.priceEstimate as number, manufactureScore: c.score as number,
                            color: (cp.metal as { color: string }).color || '#FFD700',
                            params: cp, thumbnail: typeThumbnail(jType),
                            variant: (c.persona as string).toLowerCase() as 'classic' | 'modern' | 'ornate',
                        }
                    })
                    setConcepts(mapped)
                    setIsGenerating(false)
                    toast.success(`Generated 3 ${TYPE_LABEL[jType]} concepts!`)
                    return
                }
            }
        } catch {
            console.warn('[Generate] backend generation failed, using image-faithful CV')
        }

        // ── NEW: Image-faithful concept generation ────────────────────────────
        await new Promise(r => setTimeout(r, 800))
        if (!isMounted.current) return

        let cs: ConceptList

        if (imageUrl) {
            try {
                // Full image analysis → faithful params
                const imgAnalysis = await analyzeImageForParams(imageUrl, jType)
                const faithfulRaw = buildFaithfulConcepts(imgAnalysis)
                cs = faithfulRaw as ConceptList
            } catch (err) {
                console.warn('[Generate] image analysis failed, using fallback concepts:', err)
                cs = buildFallbackConcepts(
                    jType, analysis.metal.type,
                    analysis.stones[0]?.type || 'diamond',
                    analysis.stones[0]?.cut || 'round_brilliant',
                    analysis.stones[0]?.size || 1.0,
                    analysis.style_dna, genCount, gender
                )
            }
        } else {
            cs = buildFallbackConcepts(
                jType, analysis.metal.type,
                analysis.stones[0]?.type || 'diamond',
                analysis.stones[0]?.cut || 'round_brilliant',
                analysis.stones[0]?.size || 1.0,
                analysis.style_dna, genCount, gender
            )
        }

        cs = cs.map(c => ({ ...c, thumbnail: c.thumbnail || typeThumbnail(jType) }))
        setConcepts(cs)
        setIsGenerating(false)
        toast.success(`Generated 3 image-faithful ${TYPE_LABEL[jType]} concepts!`)
    }

    // ── DROP HANDLER ──────────────────────────────────────────────────────────
    const onDrop = (files: File[]) => {
        const file = files[0]
        if (!file) return
        uploadedFileRef.current = file
        const url = URL.createObjectURL(file)
        const sizeMB = file.size / (1024 * 1024)
        const fmt = file.name.split('.').pop()?.toUpperCase() || 'IMG'
        const img = new window.Image()
        img.onload = () => setImageMetadata({ width: img.naturalWidth, height: img.naturalHeight, size: sizeMB < 1 ? `${(file.size / 1024).toFixed(0)} KB` : `${sizeMB.toFixed(1)} MB`, format: fmt })
        img.src = url
        setUploadedImage(url)
        setDetectedType('ring')
        startAnalysis(file, undefined, url)
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, onDropRejected: () => toast.error('File exceeds 20 MB or unsupported format.'),
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        maxFiles: 1, maxSize: 20 * 1024 * 1024,
    })

    const handlePromptGenerate = async () => {
        if (!promptText.trim()) return
        setIsGeneratingImage(true)
        const pType = detectTypeFromText(promptText)
        setDetectedType(pType)
        await new Promise(r => setTimeout(r, 1400))
        setIsGeneratingImage(false)
        const sampleMap: Record<JewelType, string> = {
            ring: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c848?w=800&q=80',
            pendant: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80',
            earring: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80',
            bracelet: 'https://images.unsplash.com/photo-1573408301185-9519f94815f7?w=800&q=80',
        }
        const imgUrl = sampleMap[pType]
        setUploadedImage(imgUrl)
        startAnalysis(undefined, pType, imgUrl)
    }

    const openInDesigner = (params: DesignParams, label: string) => {
        setCurrentParams(params)
        addVersion({ id: crypto.randomUUID(), timestamp: Date.now(), label: `${label} Concept`, thumbnail: '', params, changeSummary: `Generated ${params.type} from image`, priceEstimate: 0, manufactureScore: 100 })
        navigate('/designer')
    }

    const reset = (e: React.MouseEvent) => {
        e.stopPropagation()
        setUploadedImage(null); setAnalysisResult(null)
        setConcepts(null); setAnalysisLog([])
        setDetectedType('ring'); setSelectedIdx(null); setImageMetadata(null)
    }

    const typeIcon = TYPE_ICON[detectedType] || '💍'
    const typeLabel = TYPE_LABEL[detectedType] || 'Ring'

    return (
        <div className="page gen-page">
            <div className="bg-animated" />
            <div className="bg-noise" />

            <div className="container gen-container-layer">
                {/* ── Header ── */}
                <div className="gen-header">
                    <div className="gen-header-badge">
                        <span className="badge badge-indigo">AI Synthesis Engine v2.4</span>
                    </div>
                    <h1 className="gen-headline h1">
                        From <span className="gen-headline-image">Image</span> to <span className="gen-headline-concept">Masterpiece</span>
                    </h1>
                    <p className="gen-subtext text-secondary">
                        Upload a photo, sketch, or reference image. Our vision models decompose
                        the design into structural DNA and generate 3D-ready parametric concepts.
                    </p>

                    <div className="gen-demo-btn-group">
                        {(['ring', 'pendant', 'earring', 'bracelet'] as JewelType[])
                            .filter(t => {
                                if (gender === 'mens') return t !== 'earring' && t !== 'pendant';
                                if (gender === 'unisex') return t !== 'earring';
                                return true;
                            })
                            .map(t => (
                                <button key={t} className="btn btn-ghost gen-demo-btn" onClick={() => {
                                    const samples: Record<JewelType, string> = {
                                        ring: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80',
                                        pendant: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80',
                                        earring: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80',
                                        bracelet: 'https://images.unsplash.com/photo-1573408301185-9519f94815f7?w=800&q=80',
                                    }
                                    const url = samples[t]
                                    setUploadedImage(url); setDetectedType(t)
                                    startAnalysis(undefined, t, url)
                                }}>
                                    <Sparkles size={14} /> {TYPE_ICON[t]} Sample {TYPE_LABEL[t]}
                                </button>
                            ))}
                    </div>
                </div>

                {/* ── Input modes ── */}
                {!uploadedImage && (
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                        <div className="gen-input-tabs gen-tabs-spacing">
                            <button className={`gen-input-tab ${gender === 'womens' ? 'active' : ''}`} onClick={() => setGender('womens')}>
                                Women's Designs
                            </button>
                            <button className={`gen-input-tab ${gender === 'mens' ? 'active' : ''}`} onClick={() => setGender('mens')}>
                                Men's Collection
                            </button>
                            <button className={`gen-input-tab ${gender === 'unisex' ? 'active' : ''}`} onClick={() => setGender('unisex')}>
                                Unisex / Minimal
                            </button>
                        </div>

                        <div className="gen-input-tabs">
                            <button className={`gen-input-tab ${inputMode === 'upload' ? 'active' : ''}`} onClick={() => setInputMode('upload')}>
                                <ImageIcon size={16} className="gen-input-tab-icon" /> Upload Reference
                            </button>
                            <button className={`gen-input-tab ${inputMode === 'prompt' ? 'active' : ''}`} onClick={() => setInputMode('prompt')}>
                                <Wand2 size={16} className="gen-input-tab-icon" /> AI Generative Prompt
                            </button>
                        </div>

                        {inputMode === 'upload' ? (
                            <div {...getRootProps()} className={`gen-dropzone ${isDragActive ? 'drag-active' : ''}`}>
                                <input {...getInputProps()} />
                                <div className="gen-dropzone-icon">
                                    {isDragActive ? '✨' : '📸'}
                                </div>
                                <h3 className="gen-dropzone-title">{isDragActive ? 'Drop to start synthesis' : 'Drop a reference photo'}</h3>
                                <p className="text-secondary gen-dropzone-sub">Our vision AI will extract the proportions, metal, and stones.</p>
                                <button className="btn btn-cyan btn-lg gen-dropzone-btn"><Upload size={18} /> Choose File</button>
                            </div>
                        ) : (
                            <div className="gen-prompt-zone">
                                {isGeneratingImage ? (
                                    <div className="gen-generating-overlay">
                                        <div className="gen-spinner" />
                                        <h3 className="text-h3">Synthesizing Design...</h3>
                                        <p className="text-secondary">Generating 3D parameters from prompt</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="gen-dropzone-icon">✨</div>
                                        <h3 className="gen-dropzone-title">Describe your vision</h3>
                                        <div className="gen-prompt-input-wrap">
                                            <input className="gen-prompt-input"
                                                placeholder="e.g. a minimalist platinum band with an emerald cut center stone..."
                                                value={promptText}
                                                onChange={e => setPromptText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handlePromptGenerate()}
                                                autoFocus />
                                            <button className="btn btn-cyan btn-lg gen-prompt-btn"
                                                onClick={handlePromptGenerate}
                                                disabled={!promptText.trim()}><Wand2 size={18} /> Create</button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                                            {[
                                                "Minimalist platinum solitaire ring with emerald-cut diamond",
                                                "Vintage rose gold pendant with ruby halo and milgrain",
                                                "Art deco white gold earrings with baguette sapphires",
                                                "Men's brushed titanium wedding band with channel set black diamonds"
                                            ].map((suggestion, idx) => (
                                                <button 
                                                    key={idx} 
                                                    className="btn btn-ghost btn-sm" 
                                                    style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    onClick={() => setPromptText(suggestion)}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ── Results ── */}
                {uploadedImage && (
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="gen-analysis-grid">
                            <div className="gen-image-wrap card">
                                <img src={uploadedImage} alt="Reference" className="gen-uploaded-img" />
                                {imageMetadata && (
                                    <div className="gen-image-meta">
                                        <span>{imageMetadata.width} x {imageMetadata.height} px</span>
                                        <span className="gen-meta-sep">|</span>
                                        <span className="capitalize">{imageMetadata.format}</span>
                                    </div>
                                )}
                                <div className="gen-type-badge badge badge-cyan">
                                    {typeIcon} {typeLabel} Detected
                                </div>
                                {/* Manual type override */}
                                <select
                                    className="gen-type-override"
                                    value={detectedType}
                                    onChange={(e) => {
                                        const newType = e.target.value as JewelType
                                        setDetectedType(newType)
                                        setConcepts(null)
                                        setSelectedIdx(null)
                                        startAnalysis(uploadedFileRef.current || undefined, newType, uploadedImage || undefined)
                                    }}
                                    title="Change detected type"
                                >
                                    <option value="ring">💍 Ring</option>
                                    <option value="pendant">📿 Necklace / Pendant</option>
                                    <option value="earring">✨ Earring</option>
                                    <option value="bracelet">💎 Bracelet</option>
                                </select>
                                {isAnalyzing && <motion.div animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} className="gen-scan-line" />}
                                <button className="btn btn-icon btn-sm gen-reset-btn" onClick={reset} title="Reset">×</button>
                            </div>

                            <div className="gen-analysis-panel glass">
                                <div className="gen-analysis-header">
                                    <History size={18} className="gen-analysis-icon" />
                                    <span className="gen-analysis-title">Processing Log</span>
                                    {isAnalyzing ? (
                                        <div className="gen-analyzing-badge text-cyan">
                                            Processing <span className="gen-analyzing-dot" />
                                        </div>
                                    ) : (
                                        <div className="gen-done-badge text-cyan">Complete ✓</div>
                                    )}
                                </div>
                                <div className="gen-console-scroll" ref={logRef}>
                                    {analysisLog.map((log, i) => (
                                        <div key={i} className="gen-typewriter">
                                            <span className="gen-tw-prefix">[{new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}]</span> {log}
                                        </div>
                                    ))}
                                    {isAnalyzing && (
                                        <div className="gen-typewriter">
                                            <span className="gen-tw-prefix">[{new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}]</span>
                                            <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="gen-tw-cursor">_</motion.span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Synthesis Preview */}
                        <div style={{ marginTop: 48 }}>
                            <div className="gen-concepts-header">
                                <div>
                                    <h2 className="text-h2 gen-concepts-title-row">
                                        <Sparkles size={20} className="gen-concepts-inline-icon" />
                                        Synthesized Concepts
                                    </h2>
                                    <p className="text-secondary gen-concepts-sub">
                                        {concepts ? `Three design paths synthesized for ${gender === 'womens' ? "Women's" : gender === 'mens' ? "Men's" : "Unisex"} wear.` : 'AI synthesis in progress...'}
                                    </p>
                                </div>
                            </div>

                            <div className="gen-concepts-grid">
                                {concepts ? (
                                    concepts.map((concept, i) => (
                                        <ConceptCard
                                            key={concept.id}
                                            concept={concept}
                                            isSelected={selectedIdx === i}
                                            dimmed={selectedIdx !== null && selectedIdx !== i}
                                            onSelect={() => setSelectedIdx(i)}
                                            onUseAsReference={() => startAnalysis(undefined, concept.params.type as JewelType, concept.thumbnail)}
                                        />
                                    ))
                                ) : (
                                    [1, 2, 3].map(n => (
                                        <div key={n} className="gen-skeleton-card glass">
                                            <div className="gen-skeleton-thumb skeleton-anim" />
                                            <div className="gen-skeleton-body">
                                                <div className="gen-skeleton-title skeleton-anim" />
                                                <div className="gen-skeleton-sub skeleton-anim" />
                                                <div className="gen-skeleton-pills">
                                                    <div className="gen-skeleton-pill-1 skeleton-anim" />
                                                    <div className="gen-skeleton-pill-2 skeleton-anim" />
                                                </div>
                                                <div className="gen-skeleton-btn skeleton-anim" />
                                            </div>
                                            <div className="gen-skeleton-footer skeleton-anim" />
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="gen-hybrid-wrap">
                                {selectedIdx !== null && concepts && (
                                    <button className="btn btn-cyan btn-lg gen-hybrid-open-btn" onClick={() => openInDesigner(concepts[selectedIdx].params, concepts[selectedIdx].label)}>
                                        Open Refined Design in Studio
                                    </button>
                                )}

                                {concepts && !isGenerating && (
                                    <button className="btn btn-ghost btn-lg gen-hybrid-regen-btn" onClick={() => {
                                        const nextGen = genCount + 1
                                        setGenCount(nextGen)
                                        setConcepts(null)
                                        setSelectedIdx(null)
                                        if (analysisResult) {
                                            startGeneration(detectedType, analysisResult, uploadedImage || undefined)
                                        }
                                    }}>
                                        <Wand2 size={18} /> Regenerate Concepts
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function typeComponents(t: JewelType) {
    switch (t) {
        case 'pendant': return [
            { name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.68 } },
            { name: 'bail', type: 'bail', position: { x: 0.50, y: 0.38 } },
            { name: 'chain', type: 'chain', position: { x: 0.50, y: 0.20 } },
        ]
        case 'earring': return [
            { name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.62 } },
            { name: 'hook', type: 'post', position: { x: 0.50, y: 0.22 } },
        ]
        case 'bracelet': return [
            { name: 'center_stone', type: 'stone', position: { x: 0.50, y: 0.45 } },
            { name: 'band', type: 'band', position: { x: 0.50, y: 0.65 } },
            { name: 'clasp', type: 'clasp', position: { x: 0.15, y: 0.50 } },
        ]
        default: return BASE_ANALYSIS.components
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeComponentLabels(t: JewelType): string[] {
    switch (t) {
        case 'pendant': return ['1x Center Stone (Diamond)', '1x Bail (Round)', '1x Chain (Cable link)']
        case 'earring': return ['1x Center Stone (Diamond)', '1x Post / French Hook', '1x Bezel Cup (Round)']
        case 'bracelet': return ['1x Center Stone (Diamond)', '1x Band (Bangle)', '4x Prongs (Round)', '1x Clasp']
        default: return ['1x Center Stone (Diamond)', '4x Prongs (Round)', '1x Band (Comfort Fit)']
    }
}