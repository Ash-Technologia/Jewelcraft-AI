/**
 * JewelViewer.tsx — Updated to support Section Cut and refined lighting.
 */

import { Suspense, useEffect, useRef, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { DesignParams } from '../../store/useAppStore'
import JewelMesh from './JewelMesh'
import { ZoomIn, ZoomOut } from 'lucide-react'
import './JewelViewer.css'

interface Props {
    params: DesignParams
    mini?: boolean
    autoRotate?: boolean
    renderMode?: 'pbr' | 'clay' | 'wireframe'
    lightPreset?: 'studio' | 'showroom' | 'dramatic'
    /** Drives structural design variant in JewelMesh */
    variant?: 'classic' | 'modern' | 'ornate'
    hiddenParts?: Set<string>
}

type CamCfg = {
    pos: [number, number, number]
    target: [number, number, number]
    fov: number
    mPos: [number, number, number]
    mTarget: [number, number, number]
    mFov: number
}

function camFor(type: string): CamCfg {
    const t = (type || 'ring').toLowerCase()

    if (t === 'necklace' || t === 'pendant' || t === 'chain') return {
        pos: [0, 0.10, 6.8], target: [0, 0.00, 0], fov: 42,
        mPos: [0, 0.05, 6.2], mTarget: [0, 0.00, 0], mFov: 46,
    }
    if (t === 'earring' || t === 'earrings') return {
        pos: [0, 0.00, 3.6], target: [0, -0.10, 0], fov: 34,
        mPos: [0, -0.05, 3.2], mTarget: [0, -0.10, 0], mFov: 38,
    }
    if (t === 'bracelet' || t === 'bangle') return {
        pos: [0, 0.80, 6.0], target: [0, 0.30, 0], fov: 40,
        mPos: [0, 0.60, 5.4], mTarget: [0, 0.20, 0], mFov: 44,
    }
    if (t === 'tiebar' || t === 'tie_bar' || t === 'lapel_pin') return {
        pos: [0, 0.4, 4.0], target: [0, 0, 0], fov: 32,
        mPos: [0, 0.3, 3.6], mTarget: [0, 0, 0], mFov: 36,
    }
    return {
        pos: [0, 1.2, 5.2], target: [0, 0.5, 0], fov: 36,
        mPos: [0, 0.9, 4.8], mTarget: [0, 0.4, 0], mFov: 40,
    }
}

function CameraSync({ params, mini }: { params: DesignParams; mini: boolean }) {
    const { camera } = useThree()
    useEffect(() => {
        const cfg = camFor(params.type ?? 'ring')
        const p = mini ? cfg.mPos : cfg.pos
        camera.position.set(...p)
            ; (camera as THREE.PerspectiveCamera).fov = mini ? cfg.mFov : cfg.fov
            ; (camera as THREE.PerspectiveCamera).updateProjectionMatrix()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.type])
    return null
}

function Loader() {
    const { progress, active } = useProgress()
    if (!active) return null
    return (
        <div className="jv-loader">
            <div className="jv-loader-gem">💎</div>
            <div className="jv-loader-bar-bg">
                <div className="jv-loader-bar-fg" style={{ width: `${progress}%` }} />
            </div>
            <div className="jv-loader-text">
                Rendering… {Math.round(progress)}%
            </div>
        </div>
    )
}

export default function JewelViewer({
    params,
    mini = false,
    autoRotate = true,
    renderMode = 'pbr',
    lightPreset = 'showroom',
    variant = 'classic',
    hiddenParts = new Set<string>(),
}: Props) {
    const cfg = camFor(params.type ?? 'ring')
    const pos = mini ? cfg.mPos : cfg.pos
    const target = mini ? cfg.mTarget : cfg.target
    const fov = mini ? cfg.mFov : cfg.fov
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controlsRef = useRef<any>(null)

    const clippingPlanes = useMemo(() => {
        if (!params.sectionCutAxis || params.sectionCutAxis === 'none') return []
        const axis = params.sectionCutAxis
        const offset = params.sectionCutOffset ?? 0
        const normal = new THREE.Vector3()
        if (axis === 'x') normal.set(-1, 0, 0)
        else if (axis === 'y') normal.set(0, -1, 0)
        else if (axis === 'z') normal.set(0, 0, -1)
        return [new THREE.Plane(normal, offset)]
    }, [params.sectionCutAxis, params.sectionCutOffset])

    const handleZoom = (delta: number) => {
        if (controlsRef.current) {
            const controls = controlsRef.current
            const factor = delta > 0 ? 0.83 : 1.2
            controls.object.position.multiplyScalar(factor)
            controls.update()
        }
    }

    return (
        <div className={`jv-root ${mini ? 'mini' : 'full'}`}>
            <Loader />

            {!mini && (
                <div className="jv-zoom-controls">
                    <button className="jv-zoom-btn" onClick={() => handleZoom(1)} title="Zoom In">
                        <ZoomIn size={16} />
                    </button>
                    <button className="jv-zoom-btn" onClick={() => handleZoom(-1)} title="Zoom Out">
                        <ZoomOut size={16} />
                    </button>
                </div>
            )}

            <Canvas
                shadows
                gl={{
                    antialias: true,
                    alpha: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.15,
                    outputColorSpace: THREE.SRGBColorSpace,
                    localClippingEnabled: true,
                }}
                camera={{ position: pos, fov }}
                className={`jv-canvas ${mini ? 'mini' : 'full'}`}
            >
                <CameraSync params={params} mini={mini} />

                <ambientLight intensity={0.35} />

                {lightPreset === 'studio' && (<>
                    <ambientLight intensity={1.5} color="#ffffff" />
                    <directionalLight position={[5, 12, 10]} intensity={2.0} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} />
                    <directionalLight position={[-8, 6, -6]} intensity={1.5} color="#f0f4ff" />
                    <spotLight position={[0, 15, 0]} intensity={2.0} angle={0.4} penumbra={1} castShadow />
                </>)}
                {lightPreset === 'showroom' && (<>
                    <color attach="background" args={['#0a0a0c']} />
                    <ambientLight intensity={0.8} color="#ffe8cc" />
                    <directionalLight position={[4, 10, 8]} intensity={3.5} color="#fff8f0" castShadow
                        shadow-mapSize={[2048, 2048]}
                        shadow-camera-near={0.5} shadow-camera-far={50}
                        shadow-camera-left={-8} shadow-camera-right={8}
                        shadow-camera-top={8} shadow-camera-bottom={-8}
                    />
                    <directionalLight position={[-6, -4, -4]} intensity={1.8} color="#ddecff" />
                    <pointLight position={[0, 5, -5]} intensity={2.5} color="#ffaa60" />
                    <pointLight position={[5, -2, 2]} intensity={1.5} color="#ffffff" />
                </>)}
                {lightPreset === 'dramatic' && (<>
                    <color attach="background" args={['#020204']} />
                    <ambientLight intensity={0.15} color="#222" />
                    <spotLight position={[6, 12, 6]} intensity={15.0} angle={0.25} penumbra={0.9} color="#ffd700" castShadow shadow-mapSize={[2048, 2048]} />
                    <spotLight position={[-6, 4, -6]} intensity={12.0} angle={0.5} penumbra={1} color="#00aaff" />
                    <pointLight position={[0, -3, 4]} intensity={5.0} color="#ff0055" />
                    <rectAreaLight width={10} height={10} position={[0, 10, -5]} intensity={2} color="#ffffff" />
                </>)}

                <Suspense fallback={null}>
                    <Environment preset="studio" background={false} blur={0.5} />
                    
                    <JewelMesh 
                        params={params} 
                        renderMode={renderMode} 
                        variant={variant} 
                        hiddenParts={hiddenParts} 
                        clippingPlanes={clippingPlanes}
                    />

                    {!mini && (
                        <ContactShadows
                            position={[0, -2.6, 0]}
                            opacity={0.45}
                            scale={12}
                            blur={3.5}
                            far={8}
                        />
                    )}
                </Suspense>

                <OrbitControls
                    ref={controlsRef}
                    makeDefault
                    target={target}
                    autoRotate={autoRotate}
                    autoRotateSpeed={0.8}
                    minDistance={1.0}
                    maxDistance={10.0}
                    enablePan={false}
                />
            </Canvas>
        </div>
    )
}