'use client'
/**
 * AgentPanel.tsx — JewelCraft AI Design Agent
 * Updated: uses proper CSS classes for clean layout & vertical scrolling
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Send, Mic, MicOff, Check, X, Sparkles,
    RotateCcw, AlertTriangle, ChevronRight, PenLine
} from 'lucide-react'
import toast from 'react-hot-toast'
import './AgentPanel.css'
import type { DesignParams } from '../../store/useAppStore'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

// ── TYPES ─────────────────────────────────────────────────────
interface DiffEntry { from: unknown; to: unknown }

interface AgentSuggestion {
    params: DesignParams
    changes: Record<string, DiffEntry>
    summary: string
    priceChange: number
    manufactureWarnings?: string[]
    proactiveSuggestion?: string
}

interface Message {
    id: string
    role: 'user' | 'agent'
    text: string
    suggestion?: AgentSuggestion
    timestamp: number
    status?: 'pending' | 'accepted' | 'rejected'
}

interface Props {
    currentParams: DesignParams
    previousParams?: DesignParams
    onParamChange: (params: DesignParams, summary: string, priceChange: number) => void
    onPriceUpdate?: (delta: number) => void
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SpeechRecognition: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webkitSpeechRecognition: any
    }
}

// ── SAFE DEFAULT PARAMS ───────────────────────────────────────
const DEFAULT_PARAMS: DesignParams = {
    type: 'ring',
    metal: { type: 'yellow_gold', color: '#FFD700', roughness: 0.15, finish: 'high_polish' },
    band: { width: 2.5, thickness: 1.6, profile: 'comfort_fit' },
    stones: [{
        type: 'diamond', cut: 'round_brilliant', size: 1.0,
        color: '#F8F8FF', transmission: 0.98, ior: 2.417
    }],
    halo: { enabled: false, stoneCount: 0, stoneSize: 0.025 },
    prongs: { count: 4, style: 'round', height: 1.2, thickness: 0.9 },
    setting: { type: 'prong' },
    style_dna: { romance: 0.5, boldness: 0.5, modernity: 0.5, luxury: 0.5, complexity: 0.5 },
    engraving: { enabled: false, text: '', font: 'serif', depth: 0.3 },
    chainLength: 45,
    chainType: 'cable',
    earringDrop: 15,
    braceletDiameter: 65,
}

function sanitizeParams(raw: Partial<DesignParams> | undefined): DesignParams {
    if (!raw) return { ...DEFAULT_PARAMS }
    return {
        type: raw.type || DEFAULT_PARAMS.type,
        metal: { ...DEFAULT_PARAMS.metal, ...(raw.metal ?? {}) },
        band: { ...DEFAULT_PARAMS.band, ...(raw.band ?? {}) },
        stones: raw.stones?.length ? raw.stones : DEFAULT_PARAMS.stones,
        halo: { ...DEFAULT_PARAMS.halo, ...(raw.halo ?? {}) },
        prongs: { ...DEFAULT_PARAMS.prongs, ...(raw.prongs ?? {}) },
        setting: { ...DEFAULT_PARAMS.setting, ...(raw.setting ?? {}) },
        style_dna: { ...DEFAULT_PARAMS.style_dna, ...(raw.style_dna ?? {}) },
        engraving: { ...DEFAULT_PARAMS.engraving, ...(raw.engraving ?? {}) },
        chainLength: raw.chainLength ?? DEFAULT_PARAMS.chainLength,
        chainType: raw.chainType ?? DEFAULT_PARAMS.chainType,
        earringDrop: raw.earringDrop ?? DEFAULT_PARAMS.earringDrop,
        braceletDiameter: raw.braceletDiameter ?? DEFAULT_PARAMS.braceletDiameter,
    } as DesignParams
}

// ── API CALL ──────────────────────────────────────────────────
async function callAgentAPI(
    message: string,
    currentParams: DesignParams,
    sessionHistory: Array<{ role: 'user' | 'assistant'; text: string }>,
    previousParams?: DesignParams
) {
    const res = await fetch(`${API_BASE}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, currentParams, sessionHistory, previousParams }),
        signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    return res.json()
}

// ── CLIENT FALLBACK ───────────────────────────────────────────
const FALLBACK_RULES: Array<{
    keywords: string[]
    apply: (p: DesignParams) => Partial<DesignParams>
    message: string
    summary: string
    priceChange: number
    tip?: string
}> = [
        {
            keywords: ['thinner', 'thin', 'slim', 'narrow', 'delicate'],
            apply: () => ({ band: { width: 1.5, thickness: 1.2, profile: 'knife_edge' } }),
            message: "Slimmed to 1.5mm knife-edge — modern and elegant.",
            summary: 'Thinner band', priceChange: -3200,
            tip: 'Loving thin? Try a bezel setting to complete the minimalist look.',
        },
        {
            keywords: ['rose gold'],
            apply: (p) => ({ metal: { ...p.metal, type: 'rose_gold', color: '#E8A090', roughness: 0.12 } }),
            message: "Switched to rose gold — warm blush tone, very romantic.",
            summary: 'Rose gold', priceChange: 0,
            tip: 'Rose gold + sapphire is a stunning 2025 combination.',
        },
        {
            keywords: ['white gold'],
            apply: (p) => ({ metal: { ...p.metal, type: 'white_gold', color: '#E8E8E8', roughness: 0.12 } }),
            message: "Changed to white gold — sleek and modern.",
            summary: 'White gold', priceChange: 1500,
        },
        {
            keywords: ['yellow gold'],
            apply: (p) => ({ metal: { ...p.metal, type: 'yellow_gold', color: '#FFD700', roughness: 0.15 } }),
            message: "Back to classic yellow gold — timeless and warm.",
            summary: 'Yellow gold', priceChange: -1500,
        },
        {
            keywords: ['platinum'],
            apply: (p) => ({ metal: { ...p.metal, type: 'platinum', color: '#D0D0D8', roughness: 0.08 } }),
            message: "Upgraded to platinum — the most prestigious metal.",
            summary: 'Platinum', priceChange: 12000,
        },
        {
            keywords: ['sapphire', 'blue'],
            apply: () => ({ stones: [{ type: 'sapphire', cut: 'oval', size: 1.0, color: '#0F52BA', transmission: 0.72, ior: 1.77, position: 'center' as const, count: 1 }] }),
            message: "Changed to sapphire — deep blue, saves ~₹60K vs diamond.",
            summary: 'Sapphire', priceChange: -60000,
        },
        {
            keywords: ['ruby', 'red'],
            apply: () => ({ stones: [{ type: 'ruby', cut: 'round_brilliant', size: 1.0, color: '#E0115F', transmission: 0.70, ior: 1.76, position: 'center' as const, count: 1 }] }),
            message: "Switched to ruby — the king of gems, deep pigeon-blood red.",
            summary: 'Ruby', priceChange: -48000,
        },
        {
            keywords: ['emerald', 'green'],
            apply: () => ({ stones: [{ type: 'emerald', cut: 'emerald', size: 1.0, color: '#046307', transmission: 0.65, ior: 1.58, position: 'center' as const, count: 1 }] }),
            message: "Changed to emerald — Cleopatra's favourite, rich verdant green.",
            summary: 'Emerald', priceChange: -72000,
        },
        {
            keywords: ['moissanite', 'budget', 'cheaper', 'affordable'],
            apply: () => ({ stones: [{ type: 'moissanite', cut: 'round_brilliant', size: 1.0, color: '#F0F8FF', transmission: 0.95, ior: 2.65, position: 'center' as const, count: 1 }] }),
            message: "Smart! Moissanite saves ~95% vs diamond with 97% visual similarity.",
            summary: 'Moissanite', priceChange: -114000,
        },
        {
            keywords: ['add halo', 'halo on', 'with halo'],
            apply: () => ({ halo: { enabled: true, stoneCount: 20, stoneSize: 0.025 } }),
            message: "Added a 20-stone diamond halo — makes centre stone look 30% larger!",
            summary: 'Added halo', priceChange: 18000,
        },
        {
            keywords: ['remove halo', 'no halo', 'halo off'],
            apply: () => ({ halo: { enabled: false, stoneCount: 0, stoneSize: 0 } }),
            message: "Removed the halo — centre stone stands alone in elegant simplicity.",
            summary: 'No halo', priceChange: -18000,
        },
        {
            keywords: ['minimal', 'minimalist', 'simple'],
            apply: (p) => ({
                band: { width: 1.0, thickness: 1.1, profile: 'knife_edge' },
                setting: { type: 'bezel' },
                halo: { enabled: false, stoneCount: 0, stoneSize: 0 },
                prongs: { ...p.prongs, count: 0, style: 'bezel' },
                metal: { ...p.metal, roughness: 0.38, finish: 'brushed' },
                style_dna: { romance: 0.2, boldness: 0.15, modernity: 0.95, luxury: 0.7, complexity: 0.08 },
            }),
            message: "Applied Minimalist preset — knife-edge band, bezel, no halo, brushed finish.",
            summary: 'Minimalist', priceChange: -9000,
            tip: 'The tension setting is the ultimate minimalist statement — zero prongs.',
        },
        {
            keywords: ['art deco', 'deco', 'geometric'],
            apply: (p) => ({
                band: { width: 3.2, thickness: 2.0, profile: 'flat' },
                metal: { ...p.metal, finish: 'high_polish', roughness: 0.09 },
                style_dna: { romance: 0.45, boldness: 0.85, modernity: 0.65, luxury: 0.82, complexity: 0.78 },
            }),
            message: "Applied Art Deco — 3.2mm flat band, mirror-high polish. 1920s Paris glamour.",
            summary: 'Art Deco', priceChange: 5500,
        },
        {
            keywords: ['longer chain', 'longer necklace'],
            apply: (p) => ({ chainLength: (p.chainLength || 45) + 5 }),
            message: "Added 5cm to the chain length.",
            summary: 'Longer chain', priceChange: 600,
        },
        {
            keywords: ['shorter chain', 'shorter necklace'],
            apply: (p) => ({ chainLength: Math.max(40, (p.chainLength || 45) - 5) }),
            message: "Reduced chain length by 5cm.",
            summary: 'Shorter chain', priceChange: -600,
        },
    ]

function clientFallback(
    message: string,
    current: DesignParams,
    previous?: DesignParams
): {
    message: string
    params: DesignParams
    changes: Record<string, DiffEntry>
    summary: string
    priceChange: number
    proactiveSuggestion?: string
} {
    const lower = message.toLowerCase()

    if ((lower.includes('undo') || lower.includes('revert')) && previous) {
        return {
            message: "Restored your previous design.",
            params: sanitizeParams(previous),
            changes: {},
            summary: 'Reverted',
            priceChange: 0,
        }
    }

    const rule = FALLBACK_RULES.find(r => r.keywords.some(k => lower.includes(k)))
    if (rule) {
        const patch = rule.apply(current)
        const merged: Partial<DesignParams> = { ...current, ...patch }
        if (patch.metal) merged.metal = { ...current.metal, ...patch.metal }
        if (patch.band) merged.band = { ...current.band, ...patch.band }
        if (patch.halo) merged.halo = { ...current.halo, ...patch.halo }
        if (patch.prongs) merged.prongs = { ...current.prongs, ...patch.prongs }
        if (patch.style_dna) merged.style_dna = { ...current.style_dna, ...patch.style_dna }
        if (patch.setting) merged.setting = { ...current.setting, ...patch.setting }
        if (patch.stones) merged.stones = patch.stones

        return {
            message: rule.message,
            params: sanitizeParams(merged),
            changes: {},
            summary: rule.summary,
            priceChange: rule.priceChange,
            proactiveSuggestion: rule.tip,
        }
    }

    return {
        message: `I hear you want to "${message.trim()}". Try:\n• "switch to rose gold"\n• "make the band thinner"\n• "change to sapphire"\n• "add a halo"\n• "apply minimalist style"\n• "engrave Forever Yours"`,
        params: sanitizeParams(current),
        changes: {},
        summary: '',
        priceChange: 0,
        proactiveSuggestion: 'Try "apply Art Deco style" or "minimalist" for a full transformation.',
    }
}

// ── TYPEWRITER ────────────────────────────────────────────────
function TypewriterText({ text, speed = 16 }: { text: string; speed?: number }) {
    const [displayed, setDisplayed] = useState('')
    const [done, setDone] = useState(false)

    useEffect(() => {
        setDisplayed('')
        setDone(false)
        let i = 0
        const iv = setInterval(() => {
            i++
            if (i >= text.length) {
                setDisplayed(text)
                setDone(true)
                clearInterval(iv)
                return
            }
            setDisplayed(text.slice(0, i))
        }, speed)
        return () => clearInterval(iv)
    }, [text, speed])

    return (
        <span style={{ whiteSpace: 'pre-line' }}>
            {displayed}
            {!done && (
                <span style={{
                    display: 'inline-block', width: 7, height: 12,
                    background: 'var(--accent-cyan, #00f2ff)', marginLeft: 2,
                    animation: 'pulse 1s ease-in-out infinite',
                    verticalAlign: 'middle'
                }} />
            )}
        </span>
    )
}

// ── DIFF BADGES ───────────────────────────────────────────────
function DiffBadges({ changes }: { changes: Record<string, DiffEntry> }) {
    const entries = Object.entries(changes).slice(0, 6)
    if (!entries.length) return null

    return (
        <div className="agent-diff-block">
            {entries.map(([key, { from, to }]) => (
                <div key={key} className="agent-diff-row">
                    <span className="agent-diff-key">{key.split('.').pop()}</span>
                    <span className="agent-diff-from">{String(from)?.slice(0, 14)}</span>
                    <ChevronRight size={8} style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                    <span className="agent-diff-to">{String(to)?.slice(0, 14)}</span>
                </div>
            ))}
        </div>
    )
}

// ── QUICK CHIPS ───────────────────────────────────────────────
const QUICK_CHIPS = [
    { label: '💎 Rose gold', msg: 'switch to rose gold' },
    { label: '✦ Add halo', msg: 'add a diamond halo' },
    { label: '◇ Minimal', msg: 'apply minimalist style' },
    { label: '◈ Art Deco', msg: 'apply art deco style' },
    { label: '💙 Sapphire', msg: 'change to sapphire' },
    { label: '💡 Budget', msg: 'suggest a moissanite alternative' },
]

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function AgentPanel({ currentParams, previousParams, onParamChange, onPriceUpdate }: Props) {
    const [messages, setMessages] = useState<Message[]>([{
        id: 'init',
        role: 'agent',
        timestamp: Date.now(),
        text: "I'm your AI jewelry design assistant.\n\nDescribe any change in plain English:\n• \"switch to rose gold and thin band\"\n• \"change to sapphire\"\n• \"apply minimalist style\"\n• \"engrave Forever Yours\"\n• \"undo that\"",
    }])
    const [input, setInput] = useState('')
    const [isThinking, setIsThinking] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [showChips, setShowChips] = useState(true)
    const [backendOk, setBackendOk] = useState<boolean | null>(null)

    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null)
    const sessionHistory = useRef<Array<{ role: 'user' | 'assistant'; text: string }>>([])

    // Health check
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const r = await fetch(`${API_BASE}/api/agent/health`, { signal: AbortSignal.timeout(3000) })
                setBackendOk(r.ok)
            } catch {
                setBackendOk(false)
            }
        }
        checkHealth()
    }, [])

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isThinking])

    // ── Send ─────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed || isThinking) return

        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: trimmed, timestamp: Date.now() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsThinking(true)
        setShowChips(false)
        sessionHistory.current = [...sessionHistory.current, { role: 'user', text: trimmed }]

        try {
            let result

            if (backendOk) {
                try {
                    result = await callAgentAPI(trimmed, currentParams, sessionHistory.current.slice(-8), previousParams)
                    if (result?.params) result.params = sanitizeParams(result.params)
                } catch (fetchErr) {
                    console.warn('[AgentPanel] Backend call failed, using fallback:', fetchErr)
                    result = clientFallback(trimmed, currentParams, previousParams)
                }
            } else {
                await new Promise(r => setTimeout(r, 600 + Math.random() * 400))
                result = clientFallback(trimmed, currentParams, previousParams)
            }

            const hasSuggestion = !!(result.params && result.summary?.length > 0)
            const agentMsg: Message = {
                id: crypto.randomUUID(),
                role: 'agent',
                text: result.message ?? 'Done.',
                timestamp: Date.now(),
                status: hasSuggestion ? 'pending' : undefined,
                suggestion: hasSuggestion ? {
                    params: result.params,
                    changes: result.changes ?? {},
                    summary: result.summary,
                    priceChange: result.priceChange ?? 0,
                    manufactureWarnings: result.manufactureWarnings ?? [],
                    proactiveSuggestion: result.proactiveSuggestion,
                } : undefined,
            }

            sessionHistory.current = [...sessionHistory.current, { role: 'assistant', text: result.message ?? '' }]
            setMessages(prev => [...prev, agentMsg])

        } catch (err) {
            console.error('[AgentPanel]', err)
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(), role: 'agent',
                text: "Something went wrong. Please try again.", timestamp: Date.now(),
            }])
        } finally {
            setIsThinking(false)
            setTimeout(() => inputRef.current?.focus(), 80)
        }
    }, [isThinking, backendOk, currentParams, previousParams])

    // ── Accept ────────────────────────────────────────────────────
    const handleAccept = useCallback((msg: Message) => {
        if (!msg.suggestion) return
        const safeParams = sanitizeParams(msg.suggestion.params)
        onParamChange(safeParams, msg.suggestion.summary, msg.suggestion.priceChange)
        onPriceUpdate?.(msg.suggestion.priceChange)

        if (msg.suggestion.manufactureWarnings?.length) {
            toast(msg.suggestion.manufactureWarnings[0], { icon: '⚠️', duration: 4500 })
        } else {
            toast.success(`✓ ${msg.suggestion.summary}`, { duration: 2200 })
        }
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'accepted' as const } : m))
    }, [onParamChange, onPriceUpdate])

    // ── Reject ────────────────────────────────────────────────────
    const handleReject = useCallback((msg: Message) => {
        toast('Change discarded', { icon: '↩', duration: 1600 })
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'rejected' as const } : m))
    }, [])

    // ── Voice ─────────────────────────────────────────────────────
    const toggleVoice = useCallback(() => {
        const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
        if (!SR) { toast.error('Voice not supported in this browser'); return }

        if (isRecording) {
            recognitionRef.current?.stop()
            setIsRecording(false)
            return
        }

        const r = new SR()
        r.lang = 'en-IN'
        r.continuous = false
        r.interimResults = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        r.onresult = (e: any) => {
            const transcript = e.results[0][0].transcript
            setInput(transcript)
            setIsRecording(false)
            toast.success(`🎙️ "${transcript}"`, { duration: 2000 })
            setTimeout(() => sendMessage(transcript), 200)
        }
        r.onerror = () => { setIsRecording(false); toast.error('Voice recognition failed') }
        r.onend = () => setIsRecording(false)

        r.start()
        recognitionRef.current = r
        setIsRecording(true)
    }, [isRecording, sendMessage])

    // ── Clear ─────────────────────────────────────────────────────
    const clearHistory = useCallback(() => {
        setMessages([{
            id: crypto.randomUUID(), role: 'agent',
            text: "Fresh start — what would you like to change?", timestamp: Date.now(),
        }])
        sessionHistory.current = []
        setShowChips(true)
    }, [])

    // ── Engraving ─────────────────────────────────────────────────
    const [engravingDraft, setEngravingDraft] = useState('')
    const sendEngraving = useCallback(() => {
        if (!engravingDraft.trim()) return
        sendMessage(`engrave ${engravingDraft.trim()}`)
        setEngravingDraft('')
    }, [engravingDraft, sendMessage])

    const chips = useMemo(() => QUICK_CHIPS, [])

    // Status dot colour
    const statusDotColor = backendOk === null
        ? 'var(--accent-indigo)'
        : backendOk ? '#3DD68C' : '#E87070'

    return (
        <div className="agent-panel">

            {/* ── HEADER ── */}
            <div className="agent-header">
                <div className="agent-header-left">
                    <div className="agent-header-icon">AI</div>
                    <div>
                        <div className="agent-header-title">AI Agent</div>
                        <div className="agent-header-status">
                            <span className="agent-status-dot" style={{ background: statusDotColor }} />
                            <span className="agent-status-label">
                                {backendOk === null ? 'Connecting…' : backendOk ? 'GPT-4o connected' : 'Smart fallback'}
                            </span>
                        </div>
                    </div>
                </div>
                <button className="agent-clear-btn" onClick={clearHistory} title="Clear history">
                    <RotateCcw size={12} />
                </button>
            </div>

            {/* ── MESSAGES ── */}
            <div className="agent-messages">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18 }}
                        >
                            {msg.role === 'user' ? (
                                <div className="agent-msg-user">{msg.text}</div>
                            ) : (
                                <div>
                                    <div className="agent-msg-bot">
                                        <TypewriterText key={msg.id} text={msg.text} />
                                    </div>

                                    {/* Diff badges */}
                                    {msg.suggestion && Object.keys(msg.suggestion.changes).length > 0 && (
                                        <DiffBadges changes={msg.suggestion.changes} />
                                    )}

                                    {/* Manufacture warnings */}
                                    {(msg.suggestion?.manufactureWarnings?.length ?? 0) > 0 && (
                                        <div className="agent-mfg-warning">
                                            <AlertTriangle size={10} style={{ flexShrink: 0 }} />
                                            <span>{msg.suggestion!.manufactureWarnings![0]}</span>
                                        </div>
                                    )}

                                    {/* Accept / Reject */}
                                    {msg.suggestion && msg.status === 'pending' && (
                                        <motion.div
                                            className="agent-action-row"
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.25 }}
                                        >
                                            <button className="agent-accept-btn" onClick={() => handleAccept(msg)}>
                                                <Check size={10} /> Accept
                                            </button>
                                            <button className="agent-reject-btn" onClick={() => handleReject(msg)}>
                                                <X size={10} /> Reject
                                            </button>
                                            {msg.suggestion.priceChange !== 0 && (
                                                <div className={`agent-price-badge ${msg.suggestion.priceChange > 0 ? 'positive' : 'negative'}`}>
                                                    {msg.suggestion.priceChange > 0 ? '+' : ''}₹{Math.abs(msg.suggestion.priceChange).toLocaleString('en-IN')}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Status badge */}
                                    {msg.suggestion && msg.status && msg.status !== 'pending' && (
                                        <div className={`agent-status-badge ${msg.status}`}>
                                            {msg.status === 'accepted' ? <Check size={9} /> : <X size={9} />}
                                            {msg.status === 'accepted' ? 'Applied' : 'Discarded'}
                                        </div>
                                    )}

                                    {/* Proactive suggestion */}
                                    {msg.suggestion?.proactiveSuggestion && msg.status === 'accepted' && (
                                        <motion.div
                                            className="agent-proactive"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.4 }}
                                        >
                                            <Sparkles size={9} style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: 2 }} />
                                            <span style={{ flex: 1 }}>{msg.suggestion.proactiveSuggestion}</span>
                                            <button
                                                className="agent-proactive-try"
                                                onClick={() => sendMessage(msg.suggestion!.proactiveSuggestion!)}
                                            >
                                                Try →
                                            </button>
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Thinking dots */}
                {isThinking && (
                    <motion.div
                        className="agent-thinking"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {[0, 0.2, 0.4].map((delay) => (
                            <span key={delay} className="agent-thinking-dot"
                                style={{ animation: `bounce 1.2s ${delay}s infinite` }} />
                        ))}
                        <span className="agent-thinking-label">Thinking…</span>
                    </motion.div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* ── ENGRAVING ── */}
            <div className="agent-engraving">
                <div className="agent-engraving-label">
                    <PenLine size={9} style={{ color: 'rgba(0,242,255,0.4)' }} />
                    <span>Inner Band Engraving</span>
                </div>
                <div className="agent-engraving-row">
                    <input
                        className="agent-engraving-input"
                        value={engravingDraft}
                        onChange={e => setEngravingDraft(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') sendEngraving() }}
                        placeholder='e.g. "Forever Yours"'
                        maxLength={40}
                    />
                    <button
                        className="agent-engraving-add"
                        onClick={sendEngraving}
                        disabled={!engravingDraft.trim()}
                    >
                        Add
                    </button>
                </div>
                {currentParams?.engraving?.text && (
                    <div className="agent-engraving-current">
                        <span className="agent-engraving-current-text">
                            Current: "{currentParams.engraving.text}"
                        </span>
                        <button className="agent-engraving-remove" onClick={() => sendMessage('remove engraving')}>
                            Remove
                        </button>
                    </div>
                )}
            </div>

            {/* ── QUICK CHIPS ── */}
            <AnimatePresence>
                {showChips && (
                    <motion.div
                        className="agent-chips"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <div className="agent-chips-title">
                            <Sparkles size={9} style={{ color: 'rgba(0,242,255,0.35)' }} />
                            <span>Quick actions</span>
                        </div>
                        <div className="agent-chips-grid">
                            {chips.map(c => (
                                <button key={c.msg} className="agent-chip" onClick={() => sendMessage(c.msg)}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── INPUT ROW ── */}
            <div className="agent-input-container">
                <button
                    className={`agent-voice-btn ${isRecording ? 'recording' : 'idle'}`}
                    onClick={toggleVoice}
                    title={isRecording ? 'Stop recording' : 'Voice input'}
                >
                    {isRecording ? <MicOff size={13} /> : <Mic size={13} />}
                </button>

                <input
                    ref={inputRef}
                    className="agent-text-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                    onFocus={() => setShowChips(false)}
                    placeholder="Describe a change…"
                    disabled={isThinking}
                />

                <button
                    className={`agent-send-btn ${!input.trim() || isThinking ? 'inactive' : 'active'}`}
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isThinking}
                    title="Send"
                >
                    <Send size={12} />
                </button>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
                    40%           { transform: translateY(-5px); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.8; }
                    50%      { opacity: 0.2; }
                }
            `}</style>
        </div>
    )
}