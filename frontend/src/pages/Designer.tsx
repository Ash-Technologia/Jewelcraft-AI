import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppStore, DesignParams, Version } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import JewelViewer from '../components/viewer/JewelViewer'
import AgentPanel from '../components/agent/AgentPanel'
import VersionFilmstrip from '../components/version/VersionFilmstrip'
import ComponentTree from '../components/designer/ComponentTree'
import ManualControls from '../components/designer/ManualControls'
import PricePanel from '../components/designer/PricePanel'
import ManufactureScore from '../components/designer/ManufactureScore'
import RadarChart from '../components/designer/RadarChart'
import SharePanel from '../components/designer/SharePanel'
import { Bot, Settings2, BarChart3 } from 'lucide-react'

import { validateConstraints, computeManufactureScore } from '../utils/constraints'
import './Designer.css'

type RenderMode = 'pbr' | 'clay' | 'wireframe'
type LightPreset = 'studio' | 'showroom' | 'dramatic'

export default function Designer() {
    const {
        currentParams, setCurrentParams, addVersion, versions,
        isSandboxMode, setSandboxMode, hasDesignLoaded, setHasDesignLoaded,
        active3DModelUrl, colorMode
    } = useAppStore()
    const previousParams = versions.length > 0 ? versions[versions.length - 1].params : undefined
    const [renderMode, setRenderMode] = useState<RenderMode>('pbr')
    const [lightPreset, setLightPreset] = useState<LightPreset>('showroom')
    const [activePanel, setActivePanel] = useState<'agent' | 'manual' | 'tree'>('agent')
    const [showUI, setShowUI] = useState(true)
    const [hiddenParts, setHiddenParts] = useState<Set<string>>(new Set())
    const [showShare, setShowShare] = useState(false)

    const viewerRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const location = useLocation()
    const { isLoggedIn } = useAuthStore()

    const { score: mfgScore, breakdown: mfgBreakdown } = computeManufactureScore(currentParams)
    const constraintWarnings = validateConstraints(currentParams)

    const createVersion = (params: DesignParams, label: string, summary: string) => {
        if (isSandboxMode) return
        const v: Version = {
            id: crypto.randomUUID(), timestamp: Date.now(), label, thumbnail: '',
            params, changeSummary: summary, priceEstimate: 95000,
            manufactureScore: computeManufactureScore(params).score,
        }
        addVersion(v)
    }

    const handleAgentParamChange = (newParams: DesignParams) => setCurrentParams(newParams)
    const handleManualParamChange = (newParams: DesignParams) => setCurrentParams(newParams)

    const saveToMyDesigns = () => {
        if (!isLoggedIn) {
            toast('Please sign in to save designs', { icon: '🔒' })
            navigate('/auth', { state: { from: location } })
            return
        }
        if (isSandboxMode) { toast('Cannot save in Sandbox mode', { icon: '⚠️' }); return }
        const currentToSave = { ...currentParams, id: currentParams.id || `custom-${Date.now()}` }
        useAppStore.getState().addMyDesign(currentToSave)
        toast.success('Added to My Designs in Catalog!', { icon: '💎' })
    }

    return (
        <div className={`page dsgn-page ${!showUI ? 'ui-hidden' : ''}`}>
            <div className="bg-animated dsgn-bg-fixed" />
            <div className="bg-noise dsgn-bg-fixed" />

            {/* ── Empty State — no design loaded yet ── */}
            {!hasDesignLoaded && !isSandboxMode && (
                <div className="dsgn-empty-state">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="dsgn-empty-card"
                    >
                        <div className="dsgn-empty-icon">💎</div>
                        <h2 className="dsgn-empty-title">No Design Loaded</h2>
                        <p className="dsgn-empty-subtitle">
                            Import a design from the <strong>Generate</strong> page or pick one from the <strong>Catalog</strong> to start editing in 3D.
                        </p>
                        <div className="dsgn-empty-actions">
                            <button className="btn btn-cyan dsgn-empty-btn" onClick={() => navigate('/generate')}>
                                ✨ Go to Generate
                            </button>
                            <button className="btn btn-ghost dsgn-empty-btn dsgn-empty-btn-catalog" onClick={() => navigate('/catalog')}>
                                📂 Browse Catalog
                            </button>
                        </div>
                        <button
                            className="dsgn-empty-sandbox-link"
                            onClick={() => { setSandboxMode(true); setHasDesignLoaded(true); }}
                        >
                            or enter <span>Sandbox Mode</span> to explore freely
                        </button>
                    </motion.div>
                </div>
            )}

            {/* ── Sandbox Banner ── */}
            <AnimatePresence>
                {isSandboxMode && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="dsgn-sandbox-banner-subtle"
                    >
                        <span className="dsgn-sandbox-text">
                            <span className="dsgn-sandbox-dot" />
                            SANDBOX MODE — DESIGN LAB
                        </span>
                        <button className="btn btn-sm btn-ghost dsgn-sandbox-exit-btn" onClick={() => setSandboxMode(false)}>Exit</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating UI Toggle ── */}
            <button
                className={`dsgn-ui-toggle-float ${!showUI ? 'hidden-ui' : ''}`}
                onClick={() => setShowUI(!showUI)}
                title={showUI ? 'Hide UI' : 'Show UI'}
            >
                {showUI ? '👁️' : '👁️‍🗨️'}
            </button>

            {/* ── Modals ── */}
            <AnimatePresence>
                {showShare && (
                    <div className="cat-modal-backdrop" onClick={() => setShowShare(false)}>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                            <SharePanel designName={currentParams.id || 'Design'} onClose={() => setShowShare(false)} />
                        </div>
                    </div>
                )}

            </AnimatePresence>

            {/* ── Toolbar ── */}
            {(hasDesignLoaded || isSandboxMode) && showUI && (
                <div className="dsgn-toolbar" style={{ position: 'relative', zIndex: 60 }}>
                    <div className="tab-bar designer-toolbar-tabs">
                        {(['pbr', 'clay', 'wireframe'] as RenderMode[]).map(mode => (
                            <button key={mode}
                                className={`tab ${renderMode === mode ? 'active' : ''} dsgn-tab-sm`}
                                onClick={() => setRenderMode(mode)}
                            >{mode}</button>
                        ))}
                    </div>

                    <div style={{ width: 1, height: 22, background: 'var(--glass-border, rgba(255,255,255,0.07))', margin: '0 6px' }} />

                    <div className="tab-bar designer-toolbar-tabs">
                        {([['studio', '🔆'], ['showroom', '✨'], ['dramatic', '🔥']] as [string, string][]).map(([preset, icon]) => (
                            <button key={preset}
                                className={`tab ${lightPreset === preset ? 'active' : ''} dsgn-tab-sm`}
                                onClick={() => setLightPreset(preset as LightPreset)}
                            >{icon} {preset}</button>
                        ))}
                    </div>

                    <div style={{ flex: 1 }} />

                    <div className="flex gap-2">
                        <button className="btn btn-sm btn-cyan font-bold text-[11px] rounded-[10px]"
                            onClick={() => createVersion(currentParams, 'Manual Save', 'User saved design state')}>
                            📸 Capture
                        </button>
                        <button className="btn btn-sm btn-ghost text-[11px] rounded-[10px]" onClick={saveToMyDesigns}>
                            💾 Export
                        </button>
                        <button className="btn btn-sm btn-ghost text-[11px] rounded-[10px]" onClick={() => navigate('/export')}>
                            📦 Package
                        </button>

                        <button className="btn btn-sm btn-cyan text-[11px] rounded-[10px]" onClick={() => setShowShare(true)}>
                            🔗 Share
                        </button>
                    </div>
                </div>
            )}

            {/* ── Body: main panels + filmstrip ── */}
            {(hasDesignLoaded || isSandboxMode) && <div className="dsgn-body" style={{ position: 'relative', zIndex: 10 }}>

                {/* ── 3-panel area ── */}
                <div className="dsgn-main">

                    {/* LEFT: Component Tree */}
                    <AnimatePresence>
                        {showUI && (
                            <motion.div
                                initial={{ x: -280, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -280, opacity: 0 }}
                                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                                className="dsgn-left"
                            >
                                <ComponentTree
                                    params={currentParams}
                                    onToggleComponent={(k, visible) => {
                                        setHiddenParts(prev => {
                                            const next = new Set(prev)
                                            if (visible) next.delete(k)
                                            else next.add(k)
                                            return next
                                        })
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* CENTER: 3D Viewport */}
                    <div ref={viewerRef} className="dsgn-center">
                        <JewelViewer
                            params={currentParams}
                            renderMode={renderMode}
                            lightPreset={lightPreset}
                            autoRotate
                            hiddenParts={hiddenParts}
                            modelUrl={active3DModelUrl || '/models/sample-ring.glb'}
                            colorMode={colorMode}
                        />
                        <div className="dsgn-score-overlay">
                            <ManufactureScore score={mfgScore} params={currentParams} />
                        </div>
                    </div>

                    {/* RIGHT: Agent + Controls + Analytics */}
                    <AnimatePresence>
                        {showUI && (
                            <motion.div
                                initial={{ x: 280, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 280, opacity: 0 }}
                                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                                className="dsgn-right"
                            >
                                {/* Tab selector */}
                                <div className="dsgn-panel-tabs">
                                    <div className="tab-bar">
                                        {[
                                            { id: 'agent', label: 'AI Agent', icon: Bot },
                                            { id: 'manual', label: 'Controls', icon: Settings2 },
                                            { id: 'tree', label: 'Analytics', icon: BarChart3 }
                                        ].map(({ id, label, icon: Icon }) => (
                                            <button
                                                key={id}
                                                className={`tab dsgn-panel-tab-btn ${activePanel === id ? 'active' : ''}`}
                                                onClick={() => setActivePanel(id as 'agent' | 'manual' | 'tree')}
                                            >
                                                <Icon size={13} />
                                                <span>{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="dsgn-panel-content">
                                    {activePanel === 'agent' && (
                                        <AgentPanel
                                            currentParams={currentParams}
                                            previousParams={previousParams}
                                            onParamChange={handleAgentParamChange}
                                        />
                                    )}
                                    {activePanel === 'manual' && (
                                        <ManualControls onParamChange={handleManualParamChange} />
                                    )}
                                    {activePanel === 'tree' && (
                                        <div className="dsgn-analytics">
                                            <PricePanel />

                                            <div className="card glass dsgn-radar-card">
                                                <RadarChart data={currentParams.style_dna} label="Style DNA" />
                                            </div>

                                            <div className="card dsgn-breakdown-card">
                                                <div className="dsgn-breakdown-title">Manufacture Breakdown</div>
                                                {Object.entries(mfgBreakdown).map(([key, val]) => (
                                                    <div key={key} className="dsgn-bd-row">
                                                        <span className="dsgn-bd-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                        <div className="dsgn-bd-track">
                                                            <div className="dsgn-bd-fill" style={{
                                                                width: `${val}%`,
                                                                background: val >= 80 ? 'var(--accent-green)' : val >= 50 ? 'var(--accent-indigo)' : 'var(--accent-rose)'
                                                            }} />
                                                        </div>
                                                        <span className="dsgn-bd-val">{val}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {constraintWarnings.length > 0 && (
                                                <div className="card dsgn-warnings-card">
                                                    <div className="dsgn-warnings-title">⚠️ Warnings ({constraintWarnings.length})</div>
                                                    {constraintWarnings.map(w => (
                                                        <div key={w.id} className={`dsgn-warning-item dsgn-warn-${w.severity}`}>
                                                            <span className="dsgn-warn-icon">
                                                                {w.severity === 'critical' ? '🔴' : w.severity === 'warning' ? '🟡' : '🔵'}
                                                            </span>
                                                            <div>
                                                                <div className="dsgn-warn-msg">{w.message}</div>
                                                                {w.suggestion && <div className="dsgn-warn-fix">{w.suggestion}</div>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── VERSION FILMSTRIP — inside layout flow at the bottom ── */}
                <AnimatePresence>
                    {showUI && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            className="dsgn-filmstrip-bar"
                        >
                            <VersionFilmstrip />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>}
        </div>
    )
}