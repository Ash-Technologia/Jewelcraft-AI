/**
 * JewelCraft AI — Frontend API Client
 * Connects to the backend REST API and WebSocket for real-time events.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'

// ── WebSocket Manager ──

type EventHandler = (data: unknown) => void
const eventHandlers: Map<string, Set<EventHandler>> = new Map()
let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

export function connectWebSocket() {
    if (ws?.readyState === WebSocket.OPEN) return

    try {
        ws = new WebSocket(WS_BASE)

        ws.onopen = () => {
            console.log('[WS] Connected to backend')
            if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer)
                wsReconnectTimer = null
            }
        }

        ws.onmessage = (event) => {
            try {
                const { event: eventName, data } = JSON.parse(event.data)
                const handlers = eventHandlers.get(eventName)
                if (handlers) {
                    handlers.forEach(h => h(data))
                }
            } catch (e) {
                console.warn('[WS] Failed to parse message:', e)
            }
        }

        ws.onclose = () => {
            console.log('[WS] Disconnected, reconnecting in 3s...')
            wsReconnectTimer = setTimeout(connectWebSocket, 3000)
        }

        ws.onerror = () => {
            // Will trigger onclose, which handles reconnection
        }
    } catch {
        // Backend may not be running — continue with mock mode
        console.warn('[WS] Could not connect to backend, using mock mode')
    }
}

export function onWsEvent(event: string, handler: EventHandler) {
    if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())
    }
    eventHandlers.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
        eventHandlers.get(event)?.delete(handler)
    }
}

export function isBackendConnected(): boolean {
    return ws?.readyState === WebSocket.OPEN
}

// ── REST API helpers ──

async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return response.json()
}

async function apiPostFile<T>(path: string, formData: FormData): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        body: formData,
    })
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return response.json()
}

async function apiPostBlob(path: string, body: unknown): Promise<Blob> {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return response.blob()
}

// ── API Functions ──

/** Upload an image for vision analysis */
export async function analyzeImage(file: File) {
    const formData = new FormData()
    formData.append('image', file)
    return apiPostFile<{
        success: boolean
        analysis: AnalysisResult
        mock?: boolean
    }>('/analyze', formData)
}

/** Generate 3 parametric concepts from analysis */
export async function generateConcepts(analysis: AnalysisResult, personas?: string[]) {
    return apiPost<{
        success: boolean
        concepts: ConceptResult[]
    }>('/generate', { analysis, personas })
}

/** Send a natural language instruction to the AI agent */
export async function sendAgentMessage(message: string, currentParams: unknown, sessionHistory?: Array<{ role: string; text: string }>) {
    return apiPost<{
        success: boolean
        message: string
        params: unknown
        summary: string
        priceChange: number
    }>('/agent', { message, currentParams, sessionHistory })
}

/** Export specs PDF */
export async function exportPDF(params: unknown, designName?: string) {
    return apiPostBlob('/export/pdf', { params, designName })
}

/** Export gemstone CSV */
export async function exportCSV(params: unknown) {
    return apiPostBlob('/export/csv', { params })
}

/** Export cost breakdown XLSX */
export async function exportXLSX(params: unknown) {
    return apiPostBlob('/export/xlsx', { params })
}

/** Export full package ZIP */
export async function exportPackage(params: unknown, designName?: string) {
    return apiPostBlob('/export/package', { params, designName })
}

/** Health check */
export async function healthCheck() {
    try {
        const response = await fetch(`${API_BASE}/health`)
        return response.ok
    } catch {
        return false
    }
}

// ── Download helper ──

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

// ── Types ──

export interface AnalysisResult {
    jewelry_type: string
    confidence: number
    gender: string
    metal: { type: string; purity?: string; finish: string }
    stones: Array<{
        type: string
        cut: string
        count: number
        estimated_carat: number
        position: string
        color_grade?: string
        clarity?: string
    }>
    setting: { type: string; prong_count: number; style: string }
    band: { width_mm: number; profile: string }
    halo: { present: boolean; stone_count?: number }
    style_dna: { romance: number; boldness: number; modernity: number; luxury: number; complexity: number }
    components: Array<{
        name: string
        type: string
        position: { x: number; y: number }
    }>
}

export interface ConceptResult {
    id: string
    persona: string
    label: string
    params: unknown
    priceEstimate: number
    score: number
    thumbnail: string | null
}
