/**
 * JewelCraft AI — Frontend API Client
 * Connects to the backend REST API and WebSocket for real-time events.
 *
 * Config is driven by Vite env vars:
 *   VITE_API_URL  — defaults to http://localhost:8000/api  (FastAPI default port)
 *   VITE_WS_URL   — defaults to ws://localhost:8000/ws
 */

const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').trim().replace(/\/+$/, '')
export const API_BASE = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`

export function getBackendOrigin(): string {
    return API_BASE.replace(/\/api$/, '')
}

export const WS_BASE = (import.meta.env.VITE_WS_URL || (
    getBackendOrigin().startsWith('https://')
        ? getBackendOrigin().replace('https://', 'wss://') + '/ws'
        : getBackendOrigin().replace('http://', 'ws://') + '/ws'
)).trim().replace(/\/+$/, '')

// ── WebSocket Manager ──────────────────────────────────────────────────────────

type EventHandler = (data: unknown) => void
const eventHandlers: Map<string, Set<EventHandler>> = new Map()

let ws: WebSocket | null = null
let wsSessionId: string | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let wsReconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

export function connectWebSocket(sessionId?: string) {
    const sid = sessionId || wsSessionId
    if (!sid) return   // Need a session ID to connect to /ws/{session_id}

    // If already connected to the same session, skip
    if (ws?.readyState === WebSocket.OPEN && wsSessionId === sid) return

    // Close previous connection if switching sessions
    if (ws && wsSessionId !== sid) {
        ws.close()
        ws = null
    }

    wsSessionId = sid

    try {
        ws = new WebSocket(`${WS_BASE}/${sid}`)

        ws.onopen = () => {
            console.log(`[WS] Connected to session ${sid}`)
            wsReconnectAttempts = 0
            if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer)
                wsReconnectTimer = null
            }
            // Dispatch connected event
            const handlers = eventHandlers.get('connected')
            handlers?.forEach(h => h({ session_id: sid }))
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                // Backend sends: { type: "...", ...data }
                const eventName = msg.type || msg.event
                if (eventName) {
                    const handlers = eventHandlers.get(eventName)
                    handlers?.forEach(h => h(msg))
                }
                // Also dispatch raw 'message' event
                const rawHandlers = eventHandlers.get('message')
                rawHandlers?.forEach(h => h(msg))
            } catch (e) {
                console.warn('[WS] Failed to parse message:', e)
            }
        }

        ws.onclose = (event) => {
            console.log(`[WS] Disconnected (code ${event.code})`)
            ws = null
            if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 10000)
                wsReconnectAttempts++
                wsReconnectTimer = setTimeout(() => connectWebSocket(sid), delay)
            }
        }

        ws.onerror = (err) => {
            console.warn('[WS] Connection error:', err)
            // onclose will handle reconnection
        }
    } catch {
        console.warn('[WS] Could not connect to backend WebSocket, using mock mode')
    }
}

export function onWsEvent(event: string, handler: EventHandler) {
    if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())
    }
    eventHandlers.get(event)!.add(handler)

    return () => {
        eventHandlers.get(event)?.delete(handler)
    }
}

export function sendWsMessage(data: Record<string, unknown>) {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data))
        return true
    }
    return false
}

export function isBackendConnected(): boolean {
    return ws?.readyState === WebSocket.OPEN
}

export function disconnectWebSocket() {
    if (ws) {
        ws.close()
        ws = null
    }
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer)
        wsReconnectTimer = null
    }
}

// ── REST API helpers ───────────────────────────────────────────────────────────

async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
    retries = 2
): Promise<T> {
    const url = `${API_BASE}${path}`
    let lastError: Error = new Error('Unknown error')

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...(options.headers || {}),
                },
            })
            if (!response.ok) {
                const body = await response.text().catch(() => '')
                throw new Error(`API ${response.status}: ${body || response.statusText}`)
            }
            return response.json()
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
            }
        }
    }
    throw lastError
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
    return apiRequest<T>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
    return apiRequest<T>(path, { method: 'POST', body: formData })
}

async function apiGet<T>(path: string): Promise<T> {
    return apiRequest<T>(path, { method: 'GET' })
}

async function apiPostBlob(path: string, body: unknown): Promise<Blob> {
    const url = `${API_BASE}${path}`
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    return response.blob()
}

// ── API Functions ──────────────────────────────────────────────────────────────

/** Upload a jewelry image for AI vision analysis.
 *  Backend: POST /api/analyze (form: file, session_id)
 */
export async function analyzeImage(file: File, sessionId?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (sessionId) formData.append('session_id', sessionId)
    return apiPostForm<{
        session_id: string
        analysis: AnalysisResult
        design?: ConceptResult
        params?: Record<string, unknown>
        ai_used: string
    }>('/analyze', formData)
}

/** Get exact 1:1 CAD design for a session.
 *  Backend: POST /api/generate (form: session_id)
 */
export async function generateConcepts(sessionId: string) {
    const formData = new FormData()
    formData.append('session_id', sessionId)
    return apiPostForm<{
        session_id: string
        design?: ConceptResult
        concepts: ConceptResult[]
        count: number
        ai_used: string
    }>('/generate', formData)
}

/** Generate exact 1:1 parametric 3D CAD design directly from a natural language prompt.
 *  Backend: POST /api/generate-from-prompt (body: { prompt, session_id? })
 */
export async function generateFromPrompt(prompt: string, sessionId?: string) {
    return apiPost<{
        session_id: string
        prompt: string
        design?: ConceptResult
        params?: Record<string, unknown>
        concepts: ConceptResult[]
        count: number
        ai_used: string
    }>('/generate-from-prompt', { prompt, session_id: sessionId })
}

/** Generate real 3D .GLB and .OBJ mesh from an image using Hugging Face TripoSR.
 *  Backend: POST /api/generate-3d/image (form: file, session_id)
 */
export async function generate3DFromImage(file?: File, sessionId?: string) {
    const formData = new FormData()
    if (file) formData.append('file', file)
    if (sessionId) formData.append('session_id', sessionId)
    return apiPostForm<{
        success: boolean
        glb_url?: string
        obj_url?: string
        source?: string
        error?: string
    }>('/generate-3d/image', formData)
}

/** Generate real 3D mesh from a text prompt using Hugging Face Shap-E.
 *  Backend: POST /api/generate-3d/text (body: { prompt })
 */
export async function generate3DFromText(prompt: string) {
    return apiPost<{
        success: boolean
        obj_url?: string
        source?: string
        error?: string
    }>('/generate-3d/text', { prompt })
}

/** Get live metal prices (backend proxies GoldAPI — avoids CORS) */
export async function getMetalPrices() {
    return apiGet<{
        gold_per_gram: number
        platinum_per_gram: number
        silver_per_gram: number
        timestamp: number
        source: 'live' | 'cached' | 'fallback'
    }>('/metal-prices')
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

/** Budget substitution suggestions */
export async function getBudgetSuggestions(params: unknown, currentPrice: number, targetBudget: number) {
    return apiPost<{ suggestions: BudgetSuggestion[]; current_price: number; target_budget: number; within_budget: boolean }>(
        '/budget-suggest',
        { params, current_price: currentPrice, target_budget: targetBudget }
    )
}

/** Create share link */
export async function createShare(params: unknown, label?: string, sessionId?: string) {
    return apiPost<{ share_id: string; url: string }>('/share', { params, label, session_id: sessionId })
}

/** Get shared design */
export async function getShare(shareId: string) {
    return apiGet<{ params: unknown; label: string; created_at: number }>(`/share/${shareId}`)
}

/** Health check */
export async function healthCheck(): Promise<{
    status: string
    vision_ai: string
    blender_available: boolean
} | null> {
    try {
        const response = await fetch(`${API_BASE.replace('/api', '')}/health`)
        if (!response.ok) return null
        return response.json()
    } catch {
        return null
    }
}

// ── Download helper ────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
    type: string
    confidence: number
    components: Array<{ name: string; type: string; position: { x: number; y: number } }>
    metal: { type: string; color: string; finish: string; roughness: number }
    stones: Array<{
        type: string
        cut: string
        size: number
        position: { x: number; y: number }
    }>
    style_dna: { romance: number; boldness: number; modernity: number; luxury: number; complexity: number }
    session_id?: string
    ai_used?: string
}

export interface ConceptResult {
    id: string
    name?: string
    persona?: string
    label?: string
    description?: string
    metal?: string
    setting?: string
    finish?: string
    priceEstimate?: number
    manufactureScore?: number
    color?: string
    params: Record<string, unknown>
}

export interface BudgetSuggestion {
    type: 'stone_substitution' | 'metal_substitution' | 'design_simplification'
    original?: string
    substitute?: string
    change?: string
    note: string
    estimated_price?: number
    savings_pct: number
    within_budget?: boolean
    params_patch: Record<string, unknown>
}
