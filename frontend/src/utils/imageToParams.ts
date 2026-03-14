/**
 * imageToParams.ts — Image-Faithful Jewelry Parameter Extractor
 * ─────────────────────────────────────────────────────────────────────────────
 * Analyzes an uploaded jewelry image and extracts REAL structural parameters:
 *   - Stone count, size, arrangement pattern
 *   - Metal color + finish
 *   - Band width / thickness
 *   - Setting style (prong, bezel, pave, etc.)
 *   - Halo presence
 *   - Complexity / ornamentation level
 *   - 3 variants: close to original, slightly evolved, maximally evolved
 *
 * These params feed directly into JewelMesh so the 3D model looks like
 * the uploaded photo rather than generic placeholder geometry.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { DesignParams } from '../store/useAppStore'
import type { JewelType } from './jewelryDetector'

// ─── RE-EXPORTS of the things Generate.tsx imports from this module ────────
export type { JewelType }
export { detectJewelryType } from './jewelryDetector'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ImageAnalysis {
    jewelType: JewelType
    metal: {
        type: string
        color: string
        roughness: number
        finish: 'high_polish' | 'brushed' | 'hammered' | 'satin'
    }
    primaryStone: {
        type: string
        cut: string
        estimatedSizeMM: number  // real-world estimate in mm
        color: string
        transmission: number
        ior: number
        count: number
    }
    accentStones: {
        type: string
        cut: string
        count: number
        arrangement: 'halo' | 'pave' | 'channel' | 'none'
    }
    setting: 'prong' | 'bezel' | 'pave' | 'channel' | 'tension' | 'flush'
    prongCount: number
    hasHalo: boolean
    bandWidth: number      // relative 0-1
    bandThickness: number  // relative 0-1
    complexity: number     // 0-1
    ornamentation: number  // 0-1 (filigree, milgrain, etc.)
    stonePattern: 'solitaire' | 'trio' | 'cluster' | 'eternity' | 'side_stones'
    confidence: number
}

// ─────────────────────────────────────────────────────────────────────────────
// METAL DB
// ─────────────────────────────────────────────────────────────────────────────

const METAL_COLORS: Record<string, { hex: string; roughness: number; finish: 'high_polish' | 'brushed' | 'hammered' | 'satin' }> = {
    yellow_gold: { hex: '#FFD700', roughness: 0.08, finish: 'high_polish' },
    rose_gold: { hex: '#E8956A', roughness: 0.10, finish: 'high_polish' },
    white_gold: { hex: '#E8E8E8', roughness: 0.10, finish: 'high_polish' },
    platinum: { hex: '#D0D0D8', roughness: 0.06, finish: 'high_polish' },
    silver: { hex: '#C0C0C8', roughness: 0.12, finish: 'high_polish' },
    oxidized: { hex: '#4A4A50', roughness: 0.45, finish: 'brushed' },
}

const STONE_PHYS: Record<string, { transmission: number; ior: number; color: string }> = {
    diamond: { transmission: 0.97, ior: 2.417, color: '#F5F5FF' },
    ruby: { transmission: 0.55, ior: 1.77, color: '#CC1033' },
    emerald: { transmission: 0.50, ior: 1.58, color: '#1A6B2A' },
    sapphire: { transmission: 0.55, ior: 1.77, color: '#0A3FA0' },
    onyx: { transmission: 0.00, ior: 1.49, color: '#111111' },
    amethyst: { transmission: 0.60, ior: 1.54, color: '#7B2D8B' },
    moissanite: { transmission: 0.95, ior: 2.65, color: '#F0F5FF' },
    black_diamond: { transmission: 0.00, ior: 2.42, color: '#151515' },
    pearl: { transmission: 0.00, ior: 1.53, color: '#FAF0E6' },
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_SIZE = 256

async function loadForAnalysis(url: string): Promise<{
    data: Uint8ClampedArray
    origW: number; origH: number
}> {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('Failed to load'))
        img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = ANALYSIS_SIZE; canvas.height = ANALYSIS_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE)
    return {
        data: ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE).data,
        origW: img.naturalWidth, origH: img.naturalHeight,
    }
}

function buildAnalysisMask(data: Uint8ClampedArray, S: number): Uint8Array {
    const mask = new Uint8Array(S * S)
    // Sample background from 5px border
    let bgR = 0, bgG = 0, bgB = 0, bgN = 0
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (x < 5 || x >= S - 5 || y < 5 || y >= S - 5) {
            const i = (y * S + x) * 4
            bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2]; bgN++
        }
    }
    bgR /= bgN; bgG /= bgN; bgB /= bgN
    const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB
    const isLight = bgLuma > 150

    for (let i = 0; i < S * S; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
        const luma = 0.299 * r + 0.587 * g + 0.114 * b
        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB)
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b)
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0
        const lumaDiff = isLight ? (bgLuma - luma) : (luma - bgLuma)
        mask[i] = (diff > 28 || sat > 0.22 || lumaDiff > 32) ? 1 : 0
    }
    return mask
}

// ─────────────────────────────────────────────────────────────────────────────
// STONE CLUSTER DETECTOR
// Finds how many distinct bright/colorful blobs exist = stone count
// ─────────────────────────────────────────────────────────────────────────────

interface StoneBlob {
    cx: number; cy: number; r: number; hue: number; sat: number; size: number
}

function detectStoneClusters(data: Uint8ClampedArray, S: number): StoneBlob[] {
    // Build a "stone likelihood" map: high sat + bright OR very dark (gems)
    const stoneMap = new Float32Array(S * S)
    for (let i = 0; i < S * S; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0
        // Stones: either high saturation (colored gems) or very bright (diamond/white) or very dark (onyx)
        if (sat > 0.30 || luma > 220 || luma < 30) {
            stoneMap[i] = sat * 0.5 + (luma > 200 ? 0.5 : 0) + (luma < 30 ? 0.3 : 0)
        }
    }

    // Simple local maxima detection (non-max suppression)
    const blobs: StoneBlob[] = []
    const used = new Uint8Array(S * S)
    const RADIUS = 8

    for (let y = RADIUS; y < S - RADIUS; y++) {
        for (let x = RADIUS; x < S - RADIUS; x++) {
            const idx = y * S + x
            if (stoneMap[idx] < 0.25 || used[idx]) continue

            // Check if local max in RADIUS neighborhood
            let isMax = true
            for (let dy = -RADIUS; dy <= RADIUS && isMax; dy++) {
                for (let dx = -RADIUS; dx <= RADIUS && isMax; dx++) {
                    const ni = (y + dy) * S + (x + dx)
                    if (stoneMap[ni] > stoneMap[idx]) isMax = false
                }
            }
            if (!isMax) continue

            // Mark region as used
            let regionSize = 0, rS = 0, gS = 0, bS = 0, maxS = 0
            for (let dy = -RADIUS; dy <= RADIUS; dy++) {
                for (let dx = -RADIUS; dx <= RADIUS; dx++) {
                    if (dx * dx + dy * dy <= RADIUS * RADIUS) {
                        const ni = (y + dy) * S + (x + dx)
                        if (ni >= 0 && ni < S * S) {
                            used[ni] = 1; regionSize++
                            rS += data[ni * 4]; gS += data[ni * 4 + 1]; bS += data[ni * 4 + 2]
                            maxS += Math.max(data[ni * 4], data[ni * 4 + 1], data[ni * 4 + 2])
                        }
                    }
                }
            }

            const rA = rS / regionSize, gA = gS / regionSize, bA = bS / regionSize
            const maxCA = maxS / regionSize
            const minCA = Math.min(rA, gA, bA)
            const sat = (maxCA > 0 ? (maxCA - minCA) / maxCA : 0)

            // Hue
            let hue = 0
            if (rA >= gA && rA >= bA) hue = 0    // red
            else if (gA >= rA && gA >= bA) hue = 120  // green
            else hue = 240  // blue

            blobs.push({ cx: x / S, cy: y / S, r: RADIUS / S, hue, sat, size: regionSize })
        }
    }

    return blobs.sort((a, b) => b.size - a.size)
}

// ─────────────────────────────────────────────────────────────────────────────
// METAL COLOR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function detectMetal(data: Uint8ClampedArray, mask: Uint8Array, S: number): string {
    // Focus on high-brightness metallic pixels (reflective areas)
    let rS = 0, gS = 0, bS = 0, n = 0
    let warmPixels = 0, coolPixels = 0, rosePixels = 0

    for (let i = 0; i < S * S; i++) {
        if (!mask[i]) continue
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
        const luma = 0.299 * r + 0.587 * g + 0.114 * b
        // Only look at mid-bright areas (not pure white highlights, not pure black)
        if (luma < 80 || luma > 240) continue
        rS += r; gS += g; bS += b; n++
        if (r > g + 25 && g > b + 20) warmPixels++         // warm = yellow gold
        if (r > g + 15 && g > b + 10 && r - g < 30) rosePixels++ // rose gold
        if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18) coolPixels++ // cool = platinum/white
    }

    if (n === 0) return 'yellow_gold'
    const rA = rS / n, gA = gS / n, bA = bS / n
    const warmFrac = warmPixels / n, roseFrac = rosePixels / n, coolFrac = coolPixels / n

    if (warmFrac > 0.25 && warmFrac > coolFrac) return 'yellow_gold'
    if (roseFrac > 0.20 && rA > gA + 10 && rA - gA < 45) return 'rose_gold'
    if (coolFrac > 0.30 || (rA > 150 && gA > 150 && bA > 148)) {
        return rA < 140 ? 'silver' : 'platinum'
    }
    if (rA > 170 && gA > 130 && bA < 100) return 'yellow_gold'
    return 'white_gold'
}

// ─────────────────────────────────────────────────────────────────────────────
// STONE TYPE DETECTION from dominant color
// ─────────────────────────────────────────────────────────────────────────────

function detectStoneType(blobs: StoneBlob[]): { type: string; cut: string } {
    if (blobs.length === 0) return { type: 'diamond', cut: 'round_brilliant' }

    const main = blobs[0]
    const { hue, sat } = main

    if (sat < 0.15) return { type: 'diamond', cut: 'round_brilliant' }
    if (hue >= 90 && hue <= 150 && sat > 0.25) return { type: 'emerald', cut: 'pear' }
    if (hue >= 330 || hue <= 30 && sat > 0.30) return { type: 'ruby', cut: 'oval' }
    if (hue >= 200 && hue <= 280 && sat > 0.25) return { type: 'sapphire', cut: 'round_brilliant' }
    if (hue >= 270 && hue <= 320 && sat > 0.25) return { type: 'amethyst', cut: 'oval' }

    return { type: 'diamond', cut: 'round_brilliant' }
}

// ─────────────────────────────────────────────────────────────────────────────
// BAND WIDTH + ORNAMENTATION ESTIMATOR
// ─────────────────────────────────────────────────────────────────────────────

function estimateBandWidth(mask: Uint8Array, S: number, jewelType: JewelType): number {
    if (jewelType === 'earring' || jewelType === 'pendant') return 0.5

    // For rings and bracelets: measure the "tube thickness" of the band
    // by finding the narrowest part of the torus
    let totalMaskW = 0, count = 0
    for (let y = 0; y < S; y++) {
        let lineW = 0
        for (let x = 0; x < S; x++) {
            if (mask[y * S + x]) lineW++
        }
        if (lineW > 0 && lineW < S * 0.8) { totalMaskW += lineW; count++ }
    }
    const avgW = count > 0 ? totalMaskW / count / S : 0.3
    // Normalize: thin band ≈ 0.2, thick band ≈ 0.9
    return Math.min(0.95, Math.max(0.15, avgW * 2.5))
}

function estimateOrnamentation(stoneBlobCount: number, mask: Uint8Array, S: number): number {
    const fillRatio = Array.from(mask).filter(v => v).length / (S * S)
    // More stone blobs + higher fill = more ornate
    const stoneScore = Math.min(1, stoneBlobCount / 8)
    const fillScore = Math.min(1, fillRatio * 2)
    return (stoneScore + fillScore) / 2
}

// ─────────────────────────────────────────────────────────────────────────────
// HALO DETECTOR
// Checks if there are small stones arranged in a circle around a center stone
// ─────────────────────────────────────────────────────────────────────────────

function detectHalo(blobs: StoneBlob[]): boolean {
    if (blobs.length < 6) return false
    const center = blobs[0]
    // Check if remaining blobs form a rough circle around center
    let circleCount = 0
    for (let i = 1; i < Math.min(blobs.length, 20); i++) {
        const b = blobs[i]
        const dx = b.cx - center.cx, dy = b.cy - center.cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        // Halo stones are roughly equidistant from center in a ring pattern
        if (dist > 0.05 && dist < 0.25 && b.size < center.size * 0.4) circleCount++
    }
    return circleCount >= 5
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTING DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

function detectSetting(
    blobs: StoneBlob[],
    prongCount: number,
    ornamentation: number
): 'prong' | 'bezel' | 'pave' | 'channel' | 'tension' | 'flush' {
    if (blobs.length > 10) return 'pave'
    if (prongCount === 0) return 'bezel'
    if (ornamentation > 0.6 && blobs.length > 5) return 'pave'
    if (blobs.length > 4 && blobs.length <= 10) return 'channel'
    return 'prong'
}

// ─────────────────────────────────────────────────────────────────────────────
// STONE ARRANGEMENT PATTERN
// ─────────────────────────────────────────────────────────────────────────────

function detectPattern(
    blobs: StoneBlob[],
    hasHalo: boolean
): 'solitaire' | 'trio' | 'cluster' | 'eternity' | 'side_stones' {
    const n = blobs.length
    if (n <= 1) return 'solitaire'
    if (n === 3) return 'trio'
    if (hasHalo) return 'cluster'
    if (n > 8) return 'eternity'
    return 'side_stones'
}

// ─────────────────────────────────────────────────────────────────────────────
// PRONG COUNT ESTIMATOR
// Detects small bright/dark dots around center stone = prongs
// ─────────────────────────────────────────────────────────────────────────────

function estimateProngCount(data: Uint8ClampedArray, centerBlob: StoneBlob | undefined, S: number): number {
    if (!centerBlob) return 4

    const cx = centerBlob.cx * S, cy = centerBlob.cy * S
    const r = centerBlob.r * S * 1.5  // search radius around center stone

    // Count small bright dots in the search ring
    let dotCount = 0
    const stepAngle = Math.PI / 8
    for (let a = 0; a < Math.PI * 2; a += stepAngle) {
        const px = Math.round(cx + Math.cos(a) * r)
        const py = Math.round(cy + Math.sin(a) * r)
        if (px < 0 || px >= S || py < 0 || py >= S) continue
        const idx = py * S + px
        const luma = 0.299 * data[idx * 4] + 0.587 * data[idx * 4 + 1] + 0.114 * data[idx * 4 + 2]
        // Metal prong = brighter than surrounding
        if (luma > 160) dotCount++
    }

    // Round to common prong counts
    if (dotCount <= 3) return 3
    if (dotCount <= 5) return 4
    if (dotCount <= 7) return 6
    return 8
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ANALYSIS FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeImageForParams(
    imageUrl: string,
    jewelType: JewelType
): Promise<ImageAnalysis> {
    const { data } = await loadForAnalysis(imageUrl)
    const S = ANALYSIS_SIZE
    const mask = buildAnalysisMask(data, S)

    const stoneBlobs = detectStoneClusters(data, S)
    const metalType = detectMetal(data, mask, S)
    const { type: stoneType, cut: stoneCut } = detectStoneType(stoneBlobs)
    const hasHalo = detectHalo(stoneBlobs)
    const bandWidth = estimateBandWidth(mask, S, jewelType)
    const ornamentation = estimateOrnamentation(stoneBlobs.length, mask, S)
    const prongCount = estimateProngCount(data, stoneBlobs[0], S)
    const setting = detectSetting(stoneBlobs, prongCount, ornamentation)
    const pattern = detectPattern(stoneBlobs, hasHalo)

    // Estimate stone size from blob size relative to image
    const mainBlobR = stoneBlobs[0]?.r ?? 0.08
    const imageSizeMM = jewelType === 'ring' ? 20 : jewelType === 'earring' ? 25 : jewelType === 'bracelet' ? 60 : 30
    const estimatedSizeMM = Math.max(0.3, Math.min(5.0, mainBlobR * imageSizeMM * 2))

    const metalCfg = METAL_COLORS[metalType] ?? METAL_COLORS.yellow_gold
    const stoneCfg = STONE_PHYS[stoneType] ?? STONE_PHYS.diamond

    return {
        jewelType,
        metal: {
            type: metalType,
            color: metalCfg.hex,
            roughness: metalCfg.roughness,
            finish: metalCfg.finish,
        },
        primaryStone: {
            type: stoneType,
            cut: stoneCut,
            estimatedSizeMM,
            color: stoneCfg.color,
            transmission: stoneCfg.transmission,
            ior: stoneCfg.ior,
            count: stoneBlobs.filter(b => b.size > (stoneBlobs[0]?.size ?? 1) * 0.5).length || 1,
        },
        accentStones: {
            type: 'diamond',
            cut: 'round_brilliant',
            count: hasHalo ? Math.min(24, stoneBlobs.length) : Math.max(0, stoneBlobs.length - 1),
            arrangement: hasHalo ? 'halo' : (stoneBlobs.length > 4 ? 'pave' : 'none'),
        },
        setting,
        prongCount,
        hasHalo,
        bandWidth,
        bandThickness: bandWidth * 0.7,
        complexity: ornamentation,
        ornamentation,
        stonePattern: pattern,
        confidence: Math.min(0.95, 0.5 + stoneBlobs.length * 0.05 + (hasHalo ? 0.1 : 0)),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERT ImageAnalysis → 3 DesignParams variants
//
// Variant 0 = FAITHFUL   (matches image as closely as possible)
// Variant 1 = EVOLVED    (same DNA, slightly more refined)
// Variant 2 = TRANSFORMED (maximally different while staying true to stone/metal)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BAND: Record<JewelType, { width: number; thickness: number }> = {
    ring: { width: 2.5, thickness: 1.8 },
    earring: { width: 1.2, thickness: 1.0 },
    pendant: { width: 1.5, thickness: 1.2 },
    bracelet: { width: 5.0, thickness: 2.8 },
}

export function analysisToParams(
    analysis: ImageAnalysis,
    variantIdx: 0 | 1 | 2
): DesignParams {
    const { jewelType: t, metal, primaryStone: ps, accentStones: as_, setting, prongCount, hasHalo, bandWidth, bandThickness, complexity } = analysis

    const defaults = DEFAULT_BAND[t]

    // Scale band dimensions by detected width
    const scaledBandW = defaults.width * (0.5 + bandWidth * 1.0)
    const scaledBandT = defaults.thickness * (0.5 + bandThickness * 1.0)

    // Stone size → 3D units
    const stoneSize = Math.max(0.3, Math.min(3.5, ps.estimatedSizeMM * 0.28))

    const base: DesignParams = {
        type: t,
        metal: {
            type: metal.type,
            color: metal.color,
            roughness: metal.roughness,
            finish: metal.finish,
        },
        stones: [{
            type: ps.type,
            cut: ps.cut,
            size: stoneSize,
            color: ps.color,
            transmission: ps.transmission,
            ior: ps.ior,
            position: 'center' as const,
            count: ps.count,
        }],
        band: { width: scaledBandW, thickness: scaledBandT, profile: 'round' as const },
        prongs: {
            count: prongCount,
            style: 'round' as const,
            height: 1.0 + complexity * 0.4,
            thickness: 0.7 + complexity * 0.2,
        },
        setting: { type: setting },
        halo: {
            enabled: hasHalo,
            stoneCount: hasHalo ? Math.max(12, as_.count) : 16,
            stoneSize: hasHalo ? stoneSize * 0.22 : 0.025,
        },
        style_dna: {
            romance: 0.5 + complexity * 0.4,
            boldness: 0.3 + bandWidth * 0.5,
            modernity: 1 - complexity * 0.7,
            luxury: 0.6 + complexity * 0.3,
            complexity,
        },
        engraving: { enabled: false, text: '', font: 'serif', depth: 0.3 },
    }

    if (variantIdx === 0) {
        // FAITHFUL — exactly what was detected
        return base
    }

    if (variantIdx === 1) {
        // EVOLVED — same stone/metal, slightly more refined/modern
        return {
            ...base,
            metal: { ...base.metal, roughness: Math.min(0.35, metal.roughness + 0.12), finish: complexity > 0.5 ? 'brushed' : 'satin' },
            prongs: { ...base.prongs, count: prongCount === 4 ? 6 : prongCount, style: 'claw' as const },
            halo: { enabled: !hasHalo && complexity > 0.4, stoneCount: 18, stoneSize: stoneSize * 0.20 },
            band: { ...base.band, width: scaledBandW * 0.85, profile: 'knife_edge' as const },
            style_dna: { ...base.style_dna, modernity: 0.75, complexity: Math.min(1, complexity + 0.2) },
        }
    }

    // TRANSFORMED — maximally different aesthetic, same materials
    const altMetals: Record<string, string> = {
        yellow_gold: 'platinum', rose_gold: 'white_gold', platinum: 'rose_gold',
        white_gold: 'yellow_gold', silver: 'rose_gold',
    }
    const altMetal = altMetals[metal.type] ?? 'platinum'
    const altMetalCfg = METAL_COLORS[altMetal]

    return {
        ...base,
        metal: { type: altMetal, color: altMetalCfg.hex, roughness: altMetalCfg.roughness, finish: 'high_polish' },
        prongs: { count: 0, style: 'bezel' as const, height: 0.5, thickness: 0.5 },
        setting: { type: 'tension' as const },
        halo: { enabled: false, stoneCount: 0, stoneSize: 0 },
        band: { width: scaledBandW * 1.3, thickness: scaledBandT * 0.6, profile: 'flat' as const },
        style_dna: { romance: 0.2, boldness: 0.9, modernity: 0.95, luxury: 0.7, complexity: 0.2 },
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPT LABEL GENERATOR (for UI cards)
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<JewelType, string> = {
    ring: 'Ring', pendant: 'Pendant', earring: 'Earring', bracelet: 'Bracelet',
}

export function buildFaithfulConcepts(
    analysis: ImageAnalysis
): Array<{
    id: string
    label: string
    description: string
    metal: string
    setting: string
    finish: string
    priceEstimate: number
    manufactureScore: number
    color: string
    params: DesignParams
    thumbnail: string
    variant: 'classic' | 'modern' | 'ornate'
}> {
    const typeLabel = TYPE_LABEL[analysis.jewelType]
    const variantNames = ['Faithful', 'Evolved', 'Transformed'] as const
    const variantDescs = [
        `True to the original — ${analysis.primaryStone.type} · ${analysis.metal.type.replace(/_/g, ' ')}`,
        `Refined silhouette — same DNA, elevated finish`,
        `Bold reimagination — contrasting metal, minimal form`,
    ]
    const variantKeys = ['classic', 'modern', 'ornate'] as const

    return [0, 1, 2].map((vi) => {
        const params = analysisToParams(analysis, vi as 0 | 1 | 2)
        const metalLabel = params.metal.type.replace(/_/g, ' ') + ' 18k'
        const settingLabel = params.setting?.type ?? 'prong'
        const finishLabel = params.metal.finish?.replace(/_/g, ' ') ?? 'high polish'
        const priceBase = 45000 + analysis.complexity * 80000 + (analysis.hasHalo ? 25000 : 0)
        const priceVariation = vi === 0 ? 1.0 : vi === 1 ? 1.15 : 0.85
        const price = Math.round((priceBase * priceVariation) / 1000) * 1000

        return {
            id: variantKeys[vi],
            label: `${variantNames[vi]} ${typeLabel}`,
            description: variantDescs[vi],
            metal: metalLabel,
            setting: settingLabel,
            finish: finishLabel,
            priceEstimate: price,
            manufactureScore: 88 + vi * 4,
            color: params.metal.color ?? '#FFD700',
            params,
            thumbnail: '',
            variant: variantKeys[vi],
        }
    })
}
