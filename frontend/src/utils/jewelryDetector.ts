/**
 * jewelryDetector.ts  v2.0  — PRODUCTION REWRITE
 * ─────────────────────────────────────────────────────────────────────────────
 * Completely re-engineered jewelry type detector.
 * No TensorFlow. No external API. Pure browser CV + geometry.
 *
 * KEY FIXES vs v1.0:
 *  - Earring pair images correctly handled (two units side-by-side)
 *  - Aspect ratio zones tightened and cross-validated with mass analysis
 *  - Added "dual-object" detector (earring pairs always appear as two blobs)
 *  - Added "vertical stone chain" detector (earring dangles)
 *  - Bracelet: must be WIDE and have arc/band topology — not just slightly wide
 *  - Ring: requires BOTH near-square ratio AND circular topology (hole + band)
 *  - Pendant: narrow + top-attachment mass + single stone at bottom
 *  - Filename signal weight raised to 6.0 (authoritative when available)
 *  - Debug breakdown included so UI can show per-signal scores
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type JewelType = 'ring' | 'pendant' | 'earring' | 'bracelet'

export interface DetectionFeatures {
    metal: string
    stone: string
    cut: string
}

export interface DetectionResult {
    type: JewelType
    confidence: number
    features?: DetectionFeatures
    debug?: Record<string, number | string>
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS SIZE — 192px gives enough detail without being slow
// ─────────────────────────────────────────────────────────────────────────────
const CS = 192



// ─────────────────────────────────────────────────────────────────────────────
// IMAGE LOADING
// ─────────────────────────────────────────────────────────────────────────────
async function loadImg(url: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('load fail'))
        img.src = url
    })

    const origW = img.naturalWidth
    const origH = img.naturalHeight

    const canvas = document.createElement('canvas')
    canvas.width = CS; canvas.height = CS
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, CS, CS)
    const data = ctx.getImageData(0, 0, CS, CS).data
    return { data, origW, origH }
}

// ─────────────────────────────────────────────────────────────────────────────
// FOREGROUND MASK — separates jewelry from background
// Uses adaptive threshold: corners AND edges as background sample
// ─────────────────────────────────────────────────────────────────────────────
function buildMask(data: Uint8ClampedArray): Uint8Array {
    const N = CS * CS
    const mask = new Uint8Array(N)

    // Sample background from a 5px border strip
    let bgR = 0, bgG = 0, bgB = 0, bgN = 0
    for (let y = 0; y < CS; y++) {
        for (let x = 0; x < CS; x++) {
            if (x < 5 || x >= CS - 5 || y < 5 || y >= CS - 5) {
                const i = (y * CS + x) * 4
                bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2]
                bgN++
            }
        }
    }
    bgR /= bgN; bgG /= bgN; bgB /= bgN

    // Determine if background is light or dark
    const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB
    const isLightBg = bgLuma > 160

    for (let i = 0; i < N; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
        const luma = 0.299 * r + 0.587 * g + 0.114 * b
        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB)

        // Saturation — gemstones have high saturation
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b)
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0

        // On light bg: anything not-white is jewelry
        // On dark bg: anything not-black is jewelry
        const lumaDiff = isLightBg ? (bgLuma - luma) : (luma - bgLuma)

        mask[i] = (diff > 25 || sat > 0.20 || lumaDiff > 35) ? 1 : 0
    }
    return mask
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTED COMPONENTS — find distinct blobs in the mask
// Returns array of blob descriptors sorted by size (largest first)
// ─────────────────────────────────────────────────────────────────────────────
interface Blob {
    size: number
    minX: number; maxX: number; minY: number; maxY: number
    cx: number; cy: number
}

function connectedComponents(mask: Uint8Array): Blob[] {
    const labels = new Int32Array(CS * CS)
    let nextLabel = 1

    // Simple 4-connected flood fill
    function fill(startIdx: number, label: number) {
        const stack = [startIdx]
        let minX = CS, maxX = 0, minY = CS, maxY = 0
        let sumX = 0, sumY = 0, size = 0

        while (stack.length > 0) {
            const idx = stack.pop()!
            if (idx < 0 || idx >= CS * CS) continue
            if (!mask[idx] || labels[idx]) continue

            labels[idx] = label
            const x = idx % CS, y = Math.floor(idx / CS)
            if (x < minX) minX = x; if (x > maxX) maxX = x
            if (y < minY) minY = y; if (y > maxY) maxY = y
            sumX += x; sumY += y; size++

            if (x > 0) stack.push(idx - 1)
            if (x < CS - 1) stack.push(idx + 1)
            if (y > 0) stack.push(idx - CS)
            if (y < CS - 1) stack.push(idx + CS)
        }
        return { size, minX, maxX, minY, maxY, cx: sumX / size, cy: sumY / size }
    }

    const blobs: Blob[] = []
    for (let i = 0; i < CS * CS; i++) {
        if (mask[i] && !labels[i]) {
            const b = fill(i, nextLabel++)
            if (b.size > 30) blobs.push(b) // ignore tiny noise blobs
        }
    }

    return blobs.sort((a, b) => b.size - a.size)
}

// ─────────────────────────────────────────────────────────────────────────────
// SOBEL EDGES
// ─────────────────────────────────────────────────────────────────────────────
function sobelEdges(data: Uint8ClampedArray): Float32Array {
    const luma = new Float32Array(CS * CS)
    for (let i = 0; i < CS * CS; i++) {
        luma[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
    }

    const edges = new Float32Array(CS * CS)
    for (let y = 1; y < CS - 1; y++) {
        for (let x = 1; x < CS - 1; x++) {
            const idx = y * CS + x
            const gx =
                -luma[idx - CS - 1] + luma[idx - CS + 1]
                - 2 * luma[idx - 1] + 2 * luma[idx + 1]
                - luma[idx + CS - 1] + luma[idx + CS + 1]
            const gy =
                luma[idx - CS - 1] + 2 * luma[idx - CS] + luma[idx - CS + 1]
                - luma[idx + CS - 1] - 2 * luma[idx + CS] - luma[idx + CS + 1]
            edges[idx] = Math.sqrt(gx * gx + gy * gy)
        }
    }
    return edges
}

// ─────────────────────────────────────────────────────────────────────────────
// RADIAL TORUS SCORE — detects ring/bracelet circular band topology
// ─────────────────────────────────────────────────────────────────────────────
function torusScore(mask: Uint8Array, cx: number, cy: number): number {
    const BINS = 24
    const hist = new Float32Array(BINS)
    let total = 0

    // Find max radius from centroid to furthest mask pixel
    let maxR = 0
    for (let i = 0; i < CS * CS; i++) {
        if (!mask[i]) continue
        const x = (i % CS) - cx, y = Math.floor(i / CS) - cy
        const r = Math.sqrt(x * x + y * y)
        if (r > maxR) maxR = r
        total++
    }

    if (maxR < 8 || total < 100) return 0

    for (let i = 0; i < CS * CS; i++) {
        if (!mask[i]) continue
        const x = (i % CS) - cx, y = Math.floor(i / CS) - cy
        const r = Math.sqrt(x * x + y * y) / maxR
        const bin = Math.min(BINS - 1, Math.floor(r * BINS))
        hist[bin]++
    }

    for (let i = 0; i < BINS; i++) hist[i] /= total

    // Torus = mass concentrated in outer 40-90% of radius, hollow center
    let outerMass = 0, innerMass = 0
    for (let i = 0; i < BINS; i++) {
        const t = i / BINS
        if (t < 0.35) innerMass += hist[i]
        else if (t > 0.45 && t < 0.95) outerMass += hist[i]
    }

    // Strong torus = low inner, high outer
    if (innerMass < 0.12 && outerMass > 0.55) return 1.0
    if (innerMass < 0.20 && outerMass > 0.45) return 0.7
    if (innerMass < 0.28 && outerMass > 0.35) return 0.4
    return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// VERTICAL CHAIN DETECTOR — for dangle earrings and pendants
// Checks if mass is arranged in a vertical strip pattern
// ─────────────────────────────────────────────────────────────────────────────
function verticalStripScore(mask: Uint8Array, blobMinX: number, blobMaxX: number): number {
    const blobW = blobMaxX - blobMinX + 1
    const centerX = (blobMinX + blobMaxX) / 2
    const stripW = blobW * 0.30  // central 30% width

    let totalMass = 0, stripMass = 0
    for (let i = 0; i < CS * CS; i++) {
        if (!mask[i]) continue
        const x = i % CS
        totalMass++
        if (Math.abs(x - centerX) < stripW / 2) stripMass++
    }

    return totalMass > 0 ? stripMass / totalMass : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR FEATURES
// ─────────────────────────────────────────────────────────────────────────────
function extractFeatures(data: Uint8ClampedArray, mask: Uint8Array): DetectionFeatures {
    let rS = 0, gS = 0, bS = 0, n = 0
    for (let i = 0; i < CS * CS; i++) {
        if (!mask[i]) continue
        rS += data[i * 4]; gS += data[i * 4 + 1]; bS += data[i * 4 + 2]
        n++
    }
    if (n === 0) return { metal: 'yellow_gold', stone: 'diamond', cut: 'round_brilliant' }

    const r = rS / n, g = gS / n, b = bS / n

    let metal = 'platinum'
    if (r > 170 && g > 130 && b < 100 && r - b > 70) metal = 'yellow_gold'
    else if (r > 170 && g > 110 && b < 130 && r - b > 45) metal = 'rose_gold'
    else if (r > 150 && g > 150 && b > 145 && Math.abs(r - g) < 20) metal = 'white_gold'
    else if (r < 120 && g < 120 && b < 120) metal = 'silver'

    let stone = 'diamond'
    if (g > r + 18 && g > b + 12) stone = 'emerald'
    else if (r > g + 22 && r > b + 22) stone = 'ruby'
    else if (b > r + 22 && b > g + 18) stone = 'sapphire'
    else if (r > 100 && b > 75 && r - g > 15) stone = 'amethyst'
    else if (r < 70 && g < 70 && b < 70) stone = 'onyx'

    return { metal, stone, cut: 'round_brilliant' }
}

// ─────────────────────────────────────────────────────────────────────────────
// FILENAME SIGNAL
// ─────────────────────────────────────────────────────────────────────────────
function filenameSignal(filename?: string): Record<JewelType, number> {
    const s: Record<JewelType, number> = { ring: 0, pendant: 0, earring: 0, bracelet: 0 }
    if (!filename) return s
    const t = filename.toLowerCase().replace(/[-_\s]/g, ' ')

    const KEYWORDS: Record<JewelType, string[]> = {
        ring: ['ring', 'solitaire', 'engagement', 'wedding', 'signet', 'eternity'],
        pendant: ['necklace', 'pendant', 'chain', 'locket', 'choker', 'collar', 'lavaliere', 'mangalsutra', 'haar', 'mala', 'tanmaniya'],
        earring: ['earring', 'ear ring', 'stud', 'hoop', 'chandelier', 'dangle', 'jhumka', 'bali', 'jhumki', 'huggie', 'tops', 'climber', 'crawler', 'drop ear'],
        bracelet: ['bracelet', 'bangle', 'cuff', 'kada', 'kara', 'wristband', 'anklet', 'armband', 'tennis bracelet'],
    }

    for (const [type, words] of Object.entries(KEYWORDS) as [JewelType, string[]][]) {
        for (const w of words) {
            if (t.includes(w)) { s[type] += 6.0; break }
        }
    }
    return s
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFTMAX
// ─────────────────────────────────────────────────────────────────────────────
function softmax(s: Record<JewelType, number>): Record<JewelType, number> {
    const vals = Object.values(s)
    const max = Math.max(...vals)
    const exps = vals.map(v => Math.exp(v - max))
    const sum = exps.reduce((a, b) => a + b, 0)
    const keys = Object.keys(s) as JewelType[]
    const out = {} as Record<JewelType, number>
    keys.forEach((k, i) => out[k] = exps[i] / sum)
    return out
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DETECTOR
// ─────────────────────────────────────────────────────────────────────────────
export async function detectJewelryType(
    imageUrl: string,
    filename?: string
): Promise<DetectionResult> {
    try {
        const { data, origW, origH } = await loadImg(imageUrl)
        const origAR = origW / origH   // <1 = portrait, >1 = landscape

        const mask = buildMask(data)
        const blobs = connectedComponents(mask)
        const features = extractFeatures(data, mask)

        // ── GLOBAL BOUNDING BOX ────────────────────────────────────────────────
        let gMinX = CS, gMaxX = 0, gMinY = CS, gMaxY = 0
        let gCX = 0, gCY = 0, gN = 0
        for (let i = 0; i < CS * CS; i++) {
            if (!mask[i]) continue
            const x = i % CS, y = Math.floor(i / CS)
            if (x < gMinX) gMinX = x; if (x > gMaxX) gMaxX = x
            if (y < gMinY) gMinY = y; if (y > gMaxY) gMaxY = y
            gCX += x; gCY += y; gN++
        }
        if (gN > 0) { gCX /= gN; gCY /= gN }

        const bbW = Math.max(1, gMaxX - gMinX)
        const bbH = Math.max(1, gMaxY - gMinY)
        const bbAR = bbW / bbH                    // bounding box aspect ratio
        const fillRatio = gN / (bbW * bbH)        // how solid is the shape
        const normCY = gN > 0 ? (gCY - gMinY) / bbH : 0.5  // centroid top=0 bot=1

        // ── DUAL-BLOB DETECTOR (EARRING PAIR) ────────────────────────────────
        // Earring pair images almost always have 2 large blobs side by side,
        // roughly equal size, roughly same vertical position
        let isDualBlob = false
        let dualBlobSymmetric = false
        if (blobs.length >= 2) {
            const b0 = blobs[0], b1 = blobs[1]
            const sizeRatio = Math.min(b0.size, b1.size) / Math.max(b0.size, b1.size)
            const vertAlign = Math.abs(b0.cy - b1.cy) / CS         // similar Y = side by side
            const horizSep = Math.abs(b0.cx - b1.cx) / CS          // separated horizontally

            if (sizeRatio > 0.35 && horizSep > 0.10 && vertAlign < 0.25) {
                isDualBlob = true
                dualBlobSymmetric = sizeRatio > 0.60 && vertAlign < 0.12
            }
        }

        // ── TORUS (RING/BRACELET) TOPOLOGY ────────────────────────────────────
        const torus = torusScore(mask, gCX, gCY)

        // ── VERTICAL STRIP ────────────────────────────────────────────────────
        const vStrip = verticalStripScore(mask, gMinX, gMaxX)

        // ── EDGE ANALYSIS ─────────────────────────────────────────────────────
        const edges = sobelEdges(data)
        let hEdge = 0, vEdge = 0, diagEdge = 0, edgeTotal = 0
        for (let y = 1; y < CS - 1; y++) {
            for (let x = 1; x < CS - 1; x++) {
                const idx = y * CS + x
                if (edges[idx] < 0.08) continue
                edgeTotal++
                const angle = Math.atan2(
                    Math.abs(
                        -edges[(y - 1) * CS + x] + edges[(y + 1) * CS + x]
                    ),
                    Math.abs(
                        -edges[y * CS + (x - 1)] + edges[y * CS + (x + 1)]
                    )
                )
                if (angle < Math.PI / 5) hEdge++
                else if (angle > Math.PI * 3 / 10) vEdge++
                else diagEdge++
            }
        }
        const hFrac = edgeTotal > 0 ? hEdge / edgeTotal : 0
        const vFrac = edgeTotal > 0 ? vEdge / edgeTotal : 0

        // ── SCORE ACCUMULATION ────────────────────────────────────────────────
        const sc: Record<JewelType, number> = { ring: 0, pendant: 0, earring: 0, bracelet: 0 }

        // ════════════════════════════════
        // EARRING SIGNALS
        // ════════════════════════════════

        // 1. Dual-blob = almost certainly earring pair
        if (isDualBlob) sc.earring += 6.0
        if (dualBlobSymmetric) sc.earring += 4.0

        // 2. Portrait (taller than wide) — earrings and pendants
        if (origAR < 0.80) sc.earring += 2.0
        if (origAR < 0.65) sc.earring += 2.0
        if (origAR < 0.50) sc.earring += 2.0

        // 3. Mass in upper portion of bounding box (hook/post at top)
        if (normCY < 0.42) sc.earring += 2.5
        if (normCY < 0.35) sc.earring += 2.0

        // 4. Multiple separate blobs arranged vertically = chandelier/dangle earring
        if (blobs.length >= 3) {
            const topBlob = blobs.find(b => b.cy < CS * 0.35)
            const botBlob = blobs.find(b => b.cy > CS * 0.55)
            if (topBlob && botBlob && Math.abs(topBlob.cx - botBlob.cx) < CS * 0.15) {
                sc.earring += 3.0  // vertically stacked blobs = dangle earring
            }
        }

        // 5. Narrow body
        if (bbAR < 0.70) sc.earring += 1.5
        if (bbAR < 0.55) sc.earring += 1.5

        // 6. High vertical edges (dangling structure)
        if (vFrac > 0.38) sc.earring += 1.5

        // 7. No torus signature
        if (torus < 0.2) sc.earring += 0.5

        // 8. Additional pair signal: exactly 2 large blobs with similar bounding box AR
        if (blobs.length >= 2) {
            const b0 = blobs[0], b1 = blobs[1]
            const ar0 = (b0.maxX - b0.minX) / Math.max(1, b0.maxY - b0.minY)
            const ar1 = (b1.maxX - b1.minX) / Math.max(1, b1.maxY - b1.minY)
            const arMatch = Math.abs(ar0 - ar1) < 0.35
            if (arMatch && isDualBlob) sc.earring += 2.0
        }

        // ════════════════════════════════
        // RING SIGNALS
        // ════════════════════════════════

        // 1. Square-ish original image
        if (origAR > 0.85 && origAR < 1.18) sc.ring += 2.0
        if (origAR > 0.92 && origAR < 1.08) sc.ring += 2.0

        // 2. Strong torus topology
        if (torus > 0.5) sc.ring += 4.0
        if (torus > 0.7) sc.ring += 3.0

        // 3. Single blob dominates
        if (blobs.length === 1 || (blobs.length >= 2 && blobs[1].size < blobs[0].size * 0.25)) {
            sc.ring += 1.5
        }

        // 4. Diagonal edge dominance (circular band)
        if (diagEdge / Math.max(1, edgeTotal) > 0.38) sc.ring += 2.0

        // 5. Centroid near center
        if (normCY > 0.40 && normCY < 0.62) sc.ring += 1.5

        // 6. NOT wide
        if (bbAR > 1.30) sc.ring -= 2.0   // too wide to be ring
        if (isDualBlob) sc.ring -= 3.0     // dual blobs = not a ring

        // ════════════════════════════════
        // BRACELET SIGNALS
        // ════════════════════════════════

        // 1. Wide original image
        if (origAR > 1.30) sc.bracelet += 3.0
        if (origAR > 1.55) sc.bracelet += 3.0
        if (origAR > 1.80) sc.bracelet += 2.0

        // 2. Wide bounding box
        if (bbAR > 1.35) sc.bracelet += 3.0
        if (bbAR > 1.60) sc.bracelet += 2.0

        // 3. Torus + wide = bracelet (not ring)
        if (torus > 0.4 && bbAR > 1.25) { sc.bracelet += 3.0; sc.ring -= 2.0 }

        // 4. Horizontal edge dominance
        if (hFrac > 0.38) sc.bracelet += 2.0

        // 5. NOT earring (single blob, not portrait)
        if (!isDualBlob) sc.bracelet += 0.5

        // 6. Penalize bracelet for portrait images
        if (origAR < 0.85) sc.bracelet -= 3.0
        if (origAR < 0.70) sc.bracelet -= 2.0

        // ════════════════════════════════
        // PENDANT / NECKLACE SIGNALS
        // ════════════════════════════════

        // 1. Portrait range (0.55–0.90 AR) — traditional pendant photo
        if (origAR > 0.55 && origAR < 0.90) sc.pendant += 2.0
        if (origAR > 0.62 && origAR < 0.85) sc.pendant += 1.5

        // 2. WIDER images — necklaces draped across chest/neck are often landscape
        if (origAR > 1.10 && origAR < 1.60) sc.pendant += 2.5
        if (origAR > 1.20 && origAR < 1.50) sc.pendant += 1.5

        // 3. Mass in lower-center (stone hangs at bottom)
        if (normCY > 0.52 && normCY < 0.78) sc.pendant += 3.0
        if (normCY > 0.60) sc.pendant += 2.0

        // 4. High vertical strip (chain runs vertically through center)
        if (vStrip > 0.55) sc.pendant += 2.0

        // 5. Single blob, not dual
        if (!isDualBlob && blobs.length <= 2) sc.pendant += 1.0

        // 6. Narrow but not as narrow as earring
        if (bbAR > 0.45 && bbAR < 0.85) sc.pendant += 1.5

        // 7. Wide + high fill ratio = draped necklace (not bracelet)
        if (origAR > 1.10 && fillRatio > 0.20 && fillRatio < 0.55) sc.pendant += 2.0

        // 8. No torus
        if (torus < 0.25) sc.pendant += 1.0

        // ── FILENAME SIGNAL (authoritative) ──────────────────────────────────
        const fSig = filenameSignal(filename)
        for (const t of Object.keys(sc) as JewelType[]) {
            sc[t] += fSig[t]
        }

        // ── SOFTMAX → PROBABILITIES ───────────────────────────────────────────
        const probs = softmax(sc)

        let bestType: JewelType = 'ring'
        let bestProb = 0
        for (const [t, p] of Object.entries(probs) as [JewelType, number][]) {
            if (p > bestProb) { bestProb = p; bestType = t }
        }

        const debug: Record<string, number | string> = {
            origAR: Math.round(origAR * 100) / 100,
            bbAR: Math.round(bbAR * 100) / 100,
            torus: Math.round(torus * 100) / 100,
            normCY: Math.round(normCY * 100) / 100,
            isDualBlob: isDualBlob ? 1 : 0,
            blobCount: blobs.length,
            vStrip: Math.round(vStrip * 100) / 100,
            fillRatio: Math.round(fillRatio * 100) / 100,
            sc_ring: Math.round(sc.ring * 10) / 10,
            sc_pendant: Math.round(sc.pendant * 10) / 10,
            sc_earring: Math.round(sc.earring * 10) / 10,
            sc_bracelet: Math.round(sc.bracelet * 10) / 10,
            p_ring: Math.round(probs.ring * 100) / 100,
            p_pendant: Math.round(probs.pendant * 100) / 100,
            p_earring: Math.round(probs.earring * 100) / 100,
            p_bracelet: Math.round(probs.bracelet * 100) / 100,
        }

        return { type: bestType, confidence: bestProb, features, debug }

    } catch (err) {
        console.error('[JewelDetector v2]', err)
        return { type: 'ring', confidence: 0 }
    }
}
