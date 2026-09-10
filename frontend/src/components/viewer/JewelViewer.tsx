/**
 * JewelViewer.tsx — Updated to support Section Cut and refined lighting.
 */

import { Suspense, useEffect, useRef, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, useProgress, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import { DesignParams } from '../../store/useAppStore'
import { ZoomIn, ZoomOut, Gem } from 'lucide-react'
import './JewelViewer.css'

interface Props {
    params: DesignParams
    mini?: boolean
    autoRotate?: boolean
    renderMode?: 'pbr' | 'clay' | 'wireframe'
    lightPreset?: 'studio' | 'showroom' | 'dramatic'
    variant?: 'classic' | 'modern' | 'ornate'
    hiddenParts?: Set<string>
    modelUrl?: string
    allowFallback?: boolean
    colorMode?: 'original' | 'recolored'
    onModelLoaded?: (scene: THREE.Group) => void
}

function Neural3DModel({
    url,
    params,
    renderMode = 'pbr',
    colorMode = 'original',
    onLoaded,
}: {
    url: string
    params: DesignParams
    renderMode?: 'pbr' | 'clay' | 'wireframe'
    colorMode?: 'original' | 'recolored'
    onLoaded?: (scene: THREE.Group) => void
}) {
    const gltf = useGLTF(url)

    useEffect(() => {
        if (!gltf?.scene) return

        // Reset transform before re-measuring to prevent compounding scales
        gltf.scene.scale.set(1, 1, 1)
        gltf.scene.position.set(0, 0, 0)
        gltf.scene.rotation.set(0, 0, 0)
        gltf.scene.updateMatrixWorld(true)

        // 1. Center & normalize the 3D mesh precisely in the viewer
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        const scaleFactor = 2.4 / maxDim

        gltf.scene.scale.setScalar(scaleFactor)
        gltf.scene.position.set(-center.x * scaleFactor, -center.y * scaleFactor, -center.z * scaleFactor)
        gltf.scene.updateMatrixWorld(true)

        const metalHex = params.metal?.color || '#FFD700'
        const metalColor = new THREE.Color(metalHex)

        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                mesh.castShadow = true
                mesh.receiveShadow = true

                // Compute smooth normals across all vertices to eliminate faceted/broken artifacts!
                if (mesh.geometry) {
                    mesh.geometry.computeVertexNormals()
                }

                if (renderMode === 'wireframe') {
                    mesh.material = new THREE.MeshBasicMaterial({
                        color: new THREE.Color('#C5A059'),
                        wireframe: true,
                    })
                } else if (renderMode === 'clay') {
                    mesh.material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color('#C8C2BA'),
                        metalness: 0.05,
                        roughness: 0.85,
                    })
                } else {
                    const origMat = mesh.material as THREE.MeshStandardMaterial
                    const hasTexture = Boolean(origMat?.map)
                    const hasVertexColors = Boolean(mesh.geometry?.attributes?.color)

                    if (colorMode === 'original') {
                        // 100% faithful raw photo-captured colors & textures!
                        // Avoid high metalness which wipes out diffuse colors with environment reflections!
                        const physicalMat = new THREE.MeshPhysicalMaterial({
                            color: new THREE.Color('#FFFFFF'),
                            map: origMat?.map || null,
                            vertexColors: hasVertexColors,
                            metalness: 0.18,          // Preserves 82% authentic diffuse color (rich gold & diamonds)
                            roughness: 0.22,          // Smooth lustrous finish
                            clearcoat: 0.85,          // Liquid diamond clearcoat brilliance
                            clearcoatRoughness: 0.05,
                            ior: 2.417,               // Diamond refractive index
                            envMapIntensity: 0.95,    // Natural, rich lighting without blowout
                        })
                        mesh.material = physicalMat
                    } else {
                        // Atelier Recolor mode: apply the selected precious metal alloy!
                        const physicalMat = new THREE.MeshPhysicalMaterial({
                            color: metalColor,
                            map: null,
                            vertexColors: false,
                            metalness: 0.92,
                            roughness: Math.max(0.06, params.metal?.roughness ?? 0.12),
                            clearcoat: 1.0,
                            clearcoatRoughness: 0.04,
                            ior: 2.417,
                            envMapIntensity: 2.2,
                        })
                        mesh.material = physicalMat
                    }
                    mesh.material.needsUpdate = true
                }
            }
        })

        onLoaded?.(gltf.scene)
    }, [gltf, params.metal?.color, params.metal?.roughness, renderMode, colorMode, onLoaded])

    return gltf?.scene ? <primitive object={gltf.scene} /> : null
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

function ModelLoadingFallback() {
    const { progress } = useProgress()
    return (
        <Html center>
            <div className="jewel-loading-hud">
                <div className="jewel-loading-pulse">
                    <Gem size={26} className="text-gold" />
                </div>
                <div className="jewel-loading-txt">Synthesizing Neural 3D Geometry</div>
                <div className="jewel-loading-prog">{Math.round(progress)}% • 256³ Marching Cubes</div>
            </div>
        </Html>
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
    modelUrl,
    allowFallback = false,
    colorMode = 'original',
    onModelLoaded,
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

                {lightPreset === 'showroom' && (<>
                    <color attach="background" args={['#0E0D0B']} />
                    <ambientLight intensity={1.5} color="#FAF7F0" />
                    {/* Primary Haute Joaillerie key light */}
                    <directionalLight
                        position={[6, 12, 8]}
                        intensity={4.8}
                        color="#FFF8E7"
                        castShadow
                        shadow-mapSize={[2048, 2048]}
                        shadow-camera-near={0.5}
                        shadow-camera-far={25}
                        shadow-camera-left={-8} shadow-camera-right={8}
                        shadow-camera-top={8} shadow-camera-bottom={-8}
                    />
                    {/* Diamond scintillation pin-lights */}
                    <spotLight position={[3, 8, 4]} intensity={9.0} angle={0.32} penumbra={0.5} color="#FFFFFF" castShadow />
                    <spotLight position={[-3, 8, 4]} intensity={7.5} angle={0.35} penumbra={0.6} color="#FFE8B0" />
                    <directionalLight position={[-8, 6, -6]} intensity={2.2} color="#F5EFEB" />
                    <pointLight position={[0, -4, 5]} intensity={1.5} color="#FAF8F5" />
                </>)}

                {lightPreset === 'studio' && (<>
                    <color attach="background" args={['#12110F']} />
                    <ambientLight intensity={1.9} color="#FFFFFF" />
                    {/* Balanced dual softbox macro studio (5500K neutral daylight) */}
                    <directionalLight position={[0, 14, 8]} intensity={4.2} color="#FFFFFF" castShadow />
                    <directionalLight position={[-10, 4, 0]} intensity={3.0} color="#F8F9FA" />
                    <directionalLight position={[10, 4, 0]} intensity={3.0} color="#FAF8F5" />
                    <directionalLight position={[0, -6, -8]} intensity={1.8} color="#FFFFFF" />
                    <spotLight position={[0, 12, 0]} intensity={3.5} angle={0.5} penumbra={0.8} color="#FFFFFF" />
                </>)}

                {lightPreset === 'dramatic' && (<>
                    <color attach="background" args={['#070605']} />
                    <ambientLight intensity={0.20} color="#1C1A17" />
                    {/* Museum vitrine chiaroscuro spotlight with warm champagne rim light */}
                    <spotLight position={[4, 15, 6]} intensity={20.0} angle={0.26} penumbra={0.65} color="#FFF5E5" castShadow shadow-mapSize={[2048, 2048]} />
                    <spotLight position={[-6, 7, -6]} intensity={8.0} angle={0.35} penumbra={0.9} color="#EDE4D8" />
                    <pointLight position={[0, 3, 5]} intensity={6.0} color="#D4AF37" />
                    <pointLight position={[0, -4, 0]} intensity={2.5} color="#C5A059" />
                </>)}

                <Suspense fallback={<ModelLoadingFallback />}>
                    <Environment
                        preset={lightPreset === 'showroom' ? 'lobby' : (lightPreset === 'studio' ? 'studio' : 'night')}
                        background={false}
                        blur={0.4}
                    />

                    {modelUrl ? (
                        <Neural3DModel
                            url={modelUrl}
                            params={params}
                            renderMode={renderMode}
                            colorMode={colorMode}
                            onLoaded={onModelLoaded}
                        />
                    ) : null}

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