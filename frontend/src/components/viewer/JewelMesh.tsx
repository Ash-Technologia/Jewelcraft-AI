import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { DesignParams } from '../../store/useAppStore'

interface Props {
    params: DesignParams
    renderMode?: 'pbr' | 'clay' | 'wireframe'
    variant?: 'classic' | 'modern' | 'ornate'
    hiddenParts?: Set<string>
    clippingPlanes?: THREE.Plane[]
}

// ─── BAND TEXTURE ─────────────────────────────────────────────────────────────
function useBandTexture(finish: string | undefined): THREE.DataTexture | null {
    return useMemo(() => {
        if (!finish || finish === 'high_polish') return null
        const size = 256
        const data = new Uint8Array(size * size * 4)
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4
                
                // Stable pseudo-random based on coordinate index instead of Math.random()
                const seededRandom = () => ((Math.sin(idx * 1.34159265 + x * 0.123 + y * 0.321) * 43758.5453123) % 1)
                
                let n = 128
                if (finish === 'hammered') {
                    const nx = (x / size) * 8, ny = (y / size) * 24
                    const d1 = Math.sin(nx) * Math.cos(ny) * 0.5 + 0.5
                    const d2 = Math.cos(nx * 1.5) * Math.sin(ny * 1.5) * 0.5 + 0.5
                    n = 128 + ((d1 * d2) - 0.25) * 80
                } else if (finish === 'brushed') {
                    n = 128 + (seededRandom() - 0.5) * 60
                } else if (finish === 'satin') {
                    n = 128 + (seededRandom() - 0.5) * 20
                } else if (finish === 'sandblasted' || finish === 'matte') {
                    n = 128 + (seededRandom() - 0.5) * 100
                }

                data[idx] = n       // R (x-tilt)
                data[idx + 1] = n   // G (y-tilt)
                if (finish === 'brushed') {
                    data[idx] = 128 + ((Math.sin(idx * 2.1) * 43758.5453) % 1 - 0.5) * 10
                    data[idx + 1] = 128 + ((Math.cos(idx * 1.8) * 43758.5453) % 1 - 0.5) * 80
                }
                data[idx + 2] = 255 // B (z-straight)
                data[idx + 3] = 255 // A
            }
        }

        if (finish === 'brushed') {
            for (let y = 0; y < size; y++) {
                for (let x = 1; x < size - 1; x++) {
                    const idx = (y * size + x) * 4
                    const p = ((y * size + x - 1) * 4)
                    const n = ((y * size + x + 1) * 4)
                    data[idx + 1] = (data[p + 1] + data[idx + 1] + data[n + 1]) / 3
                }
            }
        }

        const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
        tex.needsUpdate = true
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        return tex
    }, [finish])
}

// ─── MATERIALS — Per-metal-type PBR tuning ─────────────────────────────────────
function metalMat(p: DesignParams, mode: string, clippingPlanes: THREE.Plane[] = []) {
    if (mode === 'clay')
        return new THREE.MeshStandardMaterial({ 
            color: '#C2AA88', 
            roughness: 0.9, 
            metalness: 0, 
            clippingPlanes,
            side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide
        })
    if (mode === 'wireframe')
        return new THREE.MeshBasicMaterial({ color: '#C9A84C', wireframe: true, clippingPlanes })

    const metalType = (p.metal as { type?: string })?.type ?? 'yellow_gold'
    const isPolish = p.metal?.finish === 'high_polish' || !p.metal?.finish
    const baseRough = Math.max(0.008, p.metal?.roughness ?? 0.12)

    // Per-metal clearcoat and sheen tuning
    let clearcoat = isPolish ? 0.9 : 0.0
    let clearcoatRough = 0.05
    let envIntensity = 4.0
    let metalness = 1.0
    const sheenParams: { sheen?: number; sheenRoughness?: number; sheenColor?: THREE.Color } = {}

    if (metalType === 'rose_gold') {
        clearcoat = isPolish ? 0.85 : 0.0
        clearcoatRough = 0.08
        envIntensity = 3.8
        sheenParams.sheen = 0.3
        sheenParams.sheenRoughness = 0.25
        sheenParams.sheenColor = new THREE.Color('#FFB4A0')
    } else if (metalType === 'platinum' || metalType === 'white_gold') {
        clearcoat = isPolish ? 1.0 : 0.0
        clearcoatRough = 0.03
        envIntensity = 4.5
        sheenParams.sheen = 0.15
        sheenParams.sheenRoughness = 0.15
        sheenParams.sheenColor = new THREE.Color('#E8EAF0')
    } else if (metalType === 'silver') {
        metalness = 0.96
        clearcoat = isPolish ? 0.7 : 0.0
        clearcoatRough = 0.06
        envIntensity = 3.2
    } else {
        // yellow_gold
        clearcoat = isPolish ? 0.9 : 0.0
        clearcoatRough = 0.05
        envIntensity = 4.2
        sheenParams.sheen = 0.2
        sheenParams.sheenRoughness = 0.2
        sheenParams.sheenColor = new THREE.Color('#FFE066')
    }

    return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(p.metal?.color ?? '#FFD700'),
        metalness,
        roughness: baseRough,
        envMapIntensity: envIntensity,
        clearcoat,
        clearcoatRoughness: clearcoatRough,
        reflectivity: 1.0,
        clippingPlanes,
        side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
        ...sheenParams,
    })
}

// ─── STONE DATABASE — now with highly distinct visual identities ──────────────
const STONE_DB: Record<string, {
    c: string; tr: number; ior: number; r: number; thickness: number;
    clearcoat: number; clearcoatRoughness: number; iridescence: number;
    iridescenceIOR: number; metalness: number; emissive: string;
    emissiveIntensity: number; geometry: string; geoArgs: number[];
    attenuationColor: string; attenuationDist: number; envMapIntensity: number;
}> = {
    diamond: {
        c: '#F0F4FF',
        tr: 0.97, ior: 2.417, r: 0.008,
        thickness: 0.7, clearcoat: 1.0, clearcoatRoughness: 0.008,
        iridescence: 0.28, iridescenceIOR: 1.3, metalness: 0,
        emissive: '#000000', emissiveIntensity: 0,
        attenuationColor: '#CCE8FF', attenuationDist: 15.0,
        envMapIntensity: 6.5,
        geometry: 'octahedron', geoArgs: [1, 3]
    },
    moissanite: {
        c: '#EEF2FF',
        tr: 0.95, ior: 2.65, r: 0.012,
        thickness: 0.8, clearcoat: 1.0, clearcoatRoughness: 0.015,
        iridescence: 0.92, iridescenceIOR: 2.1, metalness: 0,
        emissive: '#000000', emissiveIntensity: 0,
        attenuationColor: '#D0D8FF', attenuationDist: 12.0,
        envMapIntensity: 7.5,
        geometry: 'octahedron', geoArgs: [1, 3]
    },
    ruby: {
        c: '#E00020',
        tr: 0.72, ior: 1.77, r: 0.045,
        thickness: 1.5, clearcoat: 0.9, clearcoatRoughness: 0.03,
        iridescence: 0.1, iridescenceIOR: 1.4, metalness: 0,
        emissive: '#CC0000', emissiveIntensity: 0.12,
        attenuationColor: '#FF1020', attenuationDist: 0.8,
        envMapIntensity: 3.8,
        geometry: 'octahedron', geoArgs: [1, 2]
    },
    sapphire: {
        c: '#1040D0',
        tr: 0.68, ior: 1.77, r: 0.05,
        thickness: 1.6, clearcoat: 0.85, clearcoatRoughness: 0.04,
        iridescence: 0.15, iridescenceIOR: 1.4, metalness: 0,
        emissive: '#001080', emissiveIntensity: 0.1,
        attenuationColor: '#2040FF', attenuationDist: 1.0,
        envMapIntensity: 3.2,
        geometry: 'octahedron', geoArgs: [1, 2]
    },
    emerald: {
        c: '#1B9A4E',
        tr: 0.58, ior: 1.58, r: 0.15,
        thickness: 2.2, clearcoat: 0.6, clearcoatRoughness: 0.15,
        iridescence: 0.0, iridescenceIOR: 1.0, metalness: 0,
        emissive: '#005020', emissiveIntensity: 0.08,
        attenuationColor: '#00CC55', attenuationDist: 1.2,
        envMapIntensity: 2.6,
        geometry: 'box', geoArgs: [1.4, 0.38, 1.0]
    },
    amethyst: {
        c: '#8B3D9B',
        tr: 0.82, ior: 1.54, r: 0.035,
        thickness: 1.2, clearcoat: 0.75, clearcoatRoughness: 0.05,
        iridescence: 0.22, iridescenceIOR: 1.35, metalness: 0,
        emissive: '#4A0E6B', emissiveIntensity: 0.05,
        attenuationColor: '#DDAAFF', attenuationDist: 1.5,
        envMapIntensity: 2.8,
        geometry: 'octahedron', geoArgs: [1, 2]
    },
    onyx: {
        c: '#050505',
        tr: 0.0, ior: 1.49, r: 0.1,
        thickness: 0, clearcoat: 0.9, clearcoatRoughness: 0.08,
        iridescence: 0, iridescenceIOR: 1.0, metalness: 0.1,
        emissive: '#000000', emissiveIntensity: 0,
        attenuationColor: '#000000', attenuationDist: 0,
        envMapIntensity: 2.0,
        geometry: 'pentagon', geoArgs: [1]
    },
    black_diamond: {
        c: '#111111', tr: 0.0, ior: 2.417, r: 0.018,
        thickness: 0, clearcoat: 1.0, clearcoatRoughness: 0.01,
        iridescence: 0.35, iridescenceIOR: 1.6, metalness: 0.2,
        emissive: '#110022', emissiveIntensity: 0.05,
        attenuationColor: '#000000', attenuationDist: 0,
        envMapIntensity: 4.0,
        geometry: 'octahedron', geoArgs: [1, 2]
    },
    citrine: {
        // Warm golden yellow
        c: '#E8A820', tr: 0.78, ior: 1.544, r: 0.012,
        thickness: 1.0, clearcoat: 0.9, clearcoatRoughness: 0.015,
        iridescence: 0.05, iridescenceIOR: 1.2, metalness: 0,
        emissive: '#AA6600', emissiveIntensity: 0.20,
        attenuationColor: '#FFCC00', attenuationDist: 1.5,
        envMapIntensity: 3.5,
        geometry: 'octahedron', geoArgs: [1, 2]
    },
    tanzanite: {
        // Trichroic blue-violet-burgundy
        c: '#4B2E83', tr: 0.60, ior: 1.692, r: 0.018,
        thickness: 1.2, clearcoat: 0.9, clearcoatRoughness: 0.02,
        iridescence: 0.45, iridescenceIOR: 1.5, metalness: 0,
        emissive: '#2A1060', emissiveIntensity: 0.25,
        attenuationColor: '#8844FF', attenuationDist: 0.9,
        envMapIntensity: 4.0,
        geometry: 'octahedron', geoArgs: [1, 2]
    },
}

function stoneMat(s: DesignParams['stones'][0] | undefined, mode: string, clippingPlanes: THREE.Plane[] = []) {
    if (!s) return null
    if (mode === 'clay') return new THREE.MeshStandardMaterial({ 
        color: '#7AAABB', 
        roughness: 0.85, 
        metalness: 0, 
        clippingPlanes,
        side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide
    })

    const db = STONE_DB[s.type] ?? STONE_DB.diamond
    const color = new THREE.Color(s.color ?? db.c)

    if (db.tr === 0) {
        return new THREE.MeshPhysicalMaterial({
            color,
            metalness: db.metalness,
            roughness: db.r,
            clearcoat: db.clearcoat,
            clearcoatRoughness: db.clearcoatRoughness,
            iridescenceIOR: db.iridescenceIOR,
            envMapIntensity: db.envMapIntensity,
            flatShading: true,
            clippingPlanes,
            side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
        })
    }

    return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0,
        roughness: db.r,
        transmission: db.tr,
        ior: db.ior,
        thickness: db.thickness,
        transparent: true,
        clearcoat: db.clearcoat,
        clearcoatRoughness: db.clearcoatRoughness,
        iridescence: db.iridescence,
        iridescenceIOR: db.iridescenceIOR,
        emissive: new THREE.Color(db.emissive),
        emissiveIntensity: db.emissiveIntensity,
        attenuationDistance: db.attenuationDist,
        envMapIntensity: db.envMapIntensity,
        side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
        flatShading: true,
        clippingPlanes,
    })
}

// ─── GEM — with girdle ring and higher-detail geometry ────────────────────────
function Gem({ mat, pos, r, cut, stoneType, rotation, metalMaterial }: {
    mat: THREE.Material
    pos: [number, number, number]
    r: number
    cut?: string
    stoneType?: string
    rotation?: [number, number, number]
    metalMaterial?: THREE.Material
}) {
    const db = STONE_DB[stoneType ?? 'diamond'] ?? STONE_DB.diamond

    const useBox = db.geometry === 'box' || cut === 'emerald' || cut === 'princess' || cut === 'cushion'
    const useSphere = db.geometry === 'sphere'
    const isOval = cut === 'oval'
    const isPear = cut === 'pear'
    const isMarquise = cut === 'marquise'
    const isRound = !useBox && !useSphere && !isOval && !isPear && !isMarquise

    const sx = r * (isOval ? 0.75 : isPear ? 0.68 : isMarquise ? 0.50 : 1.0)
    const sy = r * (isPear ? 1.35 : isOval ? 1.15 : isMarquise ? 1.60 : useSphere ? 0.52 : 1.0)
    const sz = r * (isOval ? 0.75 : isPear ? 0.68 : isMarquise ? 0.50 : 1.0)

    // Original detail geo args for faceted look
    const geoArgs = db.geometry === 'octahedron' ? [1, 2] as [number, number] : db.geoArgs

    return (
        <group position={pos} rotation={rotation ?? [0, 0, 0]}>
            {/* Main gem body */}
            <mesh material={mat} scale={[sx, sy, sz]} castShadow>
                {useSphere && <sphereGeometry args={geoArgs as [number, number, number]} />}
                {useBox && <boxGeometry args={geoArgs as [number, number, number]} />}
                {!useSphere && !useBox && <octahedronGeometry args={geoArgs as [number, number]} />}
            </mesh>

            {/* Crown table — flat top face for round brilliant */}
            {isRound && r > 0.08 && (
                <mesh material={mat} position={[0, sy * 0.85, 0]} scale={[sx * 0.55, 0.01, sz * 0.55]}>
                    <cylinderGeometry args={[1, 1, 1, 24]} />
                </mesh>
            )}

            {/* Girdle ring — thin band at widest point of gem */}
            {r > 0.06 && metalMaterial && (
                <mesh material={metalMaterial} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[sx * 1.02, r * 0.025, 8, 32]} />
                </mesh>
            )}
        </group>
    )
}

// ─── ENGRAVING — with shadow plane for carved-in illusion ────────────────────
function Engraving({ params, radius, width }: { params: DesignParams['engraving']; radius: number; width: number }) {
    if (!params?.enabled || !params.text) return null
    return (
        <group>
            {/* Shadow plane behind text for depth illusion */}
            <mesh position={[0, radius, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[radius * 1.6, width * 0.45]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.3} side={THREE.DoubleSide} depthTest={false} />
            </mesh>
            {/* Main engraved text */}
            <Text
                position={[0, radius + 0.005, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={width * 0.45}
                color="#050508"
                anchorX="center"
                anchorY="middle"
                maxWidth={radius * 1.8}
                fillOpacity={0.9}
                outlineWidth={width * 0.02}
                outlineColor="#000000"
                outlineOpacity={0.4}
                depthOffset={0.5}
                font={params.font === 'serif' ? undefined : 'https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmSU5fBBc4.woff'}
            >
                {params.text}
            </Text>
        </group>
    )
}

// ─── MOTIF SYSTEM — COMPLETELY REBUILT ────────────────────────────────────────
// Motifs are now placed as raised surface carvings correctly oriented on the band.
// Each motif is a small extruded mesh that sits tangentially on the ring surface.

function buildMotifShape(motif: string): THREE.Shape {
    const s = new THREE.Shape()
    if (motif === 'floral') {
        // Stylized 5-petal flower
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2
            const a2 = a + (Math.PI / 5)
            if (i === 0) s.moveTo(Math.cos(a) * 0.4, Math.sin(a) * 0.4)
            s.quadraticCurveTo(
                Math.cos(a2) * 0.85, Math.sin(a2) * 0.85,
                Math.cos(a + Math.PI * 2 / 5) * 0.4, Math.sin(a + Math.PI * 2 / 5) * 0.4
            )
        }
    } else if (motif === 'geometric') {
        // Hexagon
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6
            if (i === 0) s.moveTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5)
            else s.lineTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5)
        }
        s.closePath()
    } else if (motif === 'dolphin') {
        s.moveTo(-0.5, 0)
        s.bezierCurveTo(-0.3, 0.4, 0.2, 0.5, 0.5, 0.2)
        s.bezierCurveTo(0.7, 0, 0.5, -0.3, 0.2, -0.2)
        s.lineTo(0.0, -0.45)
        s.lineTo(-0.15, -0.2)
        s.bezierCurveTo(-0.35, -0.3, -0.6, -0.1, -0.5, 0)
    } else if (motif === 'peacock') {
        // Teardrop body
        s.moveTo(0, -0.5)
        s.bezierCurveTo(-0.3, -0.3, -0.4, 0.1, 0, 0.5)
        s.bezierCurveTo(0.4, 0.1, 0.3, -0.3, 0, -0.5)
    } else if (motif === 'tribal') {
        // Diamond with inner cuts
        s.moveTo(0, 0.6)
        s.lineTo(0.35, 0)
        s.lineTo(0, -0.6)
        s.lineTo(-0.35, 0)
        s.closePath()
    } else {
        // classic_scroll — spiral-esque leaf
        s.moveTo(-0.4, 0)
        s.bezierCurveTo(-0.4, 0.4, 0.0, 0.55, 0.3, 0.35)
        s.bezierCurveTo(0.55, 0.1, 0.4, -0.35, 0.0, -0.45)
        s.bezierCurveTo(-0.25, -0.55, -0.55, -0.2, -0.4, 0)
    }
    return s
}

function MotifInstance({ motif, size, material, ringRadius, angle, bandWidth }: {
    motif: string
    size: number
    material: THREE.Material
    ringRadius: number
    angle: number
    bandWidth: number
}) {
    const x = Math.cos(angle) * ringRadius
    const y = Math.sin(angle) * ringRadius

    // Build the shape and extrude it
    const shape = useMemo(() => buildMotifShape(motif), [motif])

    const extrudeSettings = useMemo(() => ({
        depth: bandWidth * 0.25,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.010,
        bevelSegments: 3
    }), [bandWidth])

    return (
        <group
            position={[x, y, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
        >
            {/* Base pad to curve into the torus slightly */}
            <mesh material={material} castShadow receiveShadow position={[0, 0, -bandWidth * 0.15]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[size * 0.65, size * 0.65, bandWidth * 0.35, 16]} />
            </mesh>
            <mesh
                material={material}
                scale={[size, size, 1]}
                castShadow
            >
                <extrudeGeometry args={[shape, extrudeSettings]} />
            </mesh>
        </group>
    )
}

// ─── RING ─────────────────────────────────────────────────────────────────────
function RingMesh({
    p, M, S, variant, hiddenParts,
}: { p: DesignParams; M: THREE.Material; S: THREE.Material | null; variant: 'classic' | 'modern' | 'ornate'; hiddenParts?: Set<string> }) {
    const RING_R = 1.05
    const isMens = p.gender === 'mens'
    const isUnisex = p.gender === 'unisex'

    const bw = Math.max(0.06, Math.min((p.band?.width ?? (isMens ? 6.0 : 2.5)) / 22, 0.40)) * (isMens ? 1.5 : isUnisex ? 1.2 : 1.0)
    const bt = (p.band?.thickness ?? (isMens ? 2.5 : 1.8)) * (isMens ? 1.3 : isUnisex ? 1.1 : 1.0)
    const profile = p.band?.profile ?? 'round'

    const sR = Math.min((p.stones?.[0]?.size ?? 1.0) * 0.20 + 0.14, 0.54)
    const pc = Math.max(0, Math.min(p.prongs?.count ?? 4, 8))
    const pAngles = useMemo(() => Array.from({ length: pc }, (_, i) => (i / pc) * Math.PI * 2), [pc])
    const hc = p.halo?.enabled ? Math.min(p.halo?.stoneCount ?? 16, 24) : 0
    const hAngles = useMemo(() => Array.from({ length: hc }, (_, i) => (i / hc) * Math.PI * 2), [hc])
    const showAccentStones = variant === 'ornate' && S
    const showFiligree = variant === 'ornate' && !isMens
    const showTensionGap = p.setting?.type === 'tension'
    const isSignet = isMens && (!S || p.setting?.type === 'flush' || p.setting?.type === 'none')
    
    // For signets, the top is flat. The stone needs to sit completely inside the top face.
    const SY = isSignet ? RING_R + bt * 1.5 - sR * 0.8 : RING_R + sR * 0.38 + (isMens ? 0.05 : 0)

    const accentAngles = useMemo(
        () => showAccentStones
            ? [Math.PI * 0.25, -Math.PI * 0.25, Math.PI * 0.40, -Math.PI * 0.40, Math.PI * 0.75, -Math.PI * 0.75]
            : [],
        [showAccentStones],
    )

    // Motif instances — spread evenly around band, skip top where stone sits
    const motifAngles = useMemo(() => {
        if (!p.motif) return []
        const count = isMens ? 12 : 10
        return Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2)
            // Skip motifs near the top (stone position) — skip ±30° from 0
            .filter(a => Math.abs(a) > 0.52 && Math.abs(a - Math.PI * 2) > 0.52)
    }, [p.motif, isMens])

    return (
        <group rotation={[Math.PI / 2, 0, 0]}>
            {/* Band */}
            {!hiddenParts?.has('band') && (
                <>
                    {showTensionGap ? (
                        <>
                            <mesh material={M} castShadow receiveShadow rotation={[0, Math.PI * 0.15, 0]}>
                                <torusGeometry args={[RING_R, bw, 80, 200, Math.PI * 1.70]} />
                            </mesh>
                            {S && (
                                <>
                                    <mesh material={M} position={[0, RING_R + sR * 0.10, 0]}>
                                        <cylinderGeometry args={[sR * 1.12, sR * 1.12, sR * 0.22, 40, 1, true]} />
                                    </mesh>
                                    <mesh material={M} position={[0, RING_R + sR * 0.10 + sR * 0.11, 0]}>
                                        <torusGeometry args={[sR * 1.12, 0.020, 12, 40]} />
                                    </mesh>
                                    <mesh material={M} position={[0, RING_R + sR * 0.10 - sR * 0.11, 0]}>
                                        <torusGeometry args={[sR * 1.12, 0.020, 12, 40]} />
                                    </mesh>
                                </>
                            )}
                        </>
                    ) : isSignet ? (
                        /* ═══ TRUE SIGNET RING GEOMETRY ═══ */
                        <group rotation={[Math.PI / 2, 0, 0]}>
                            {/* The Band - comfort fit profile */}
                            <mesh material={M} castShadow receiveShadow scale={[1, 1, 0.7]}>
                                <torusGeometry args={[RING_R, bw * 1.05, 60, 160]} />
                            </mesh>
                            {/* The Signet Face - Shape Customization */}
                            <mesh 
                                material={M} 
                                position={[0, RING_R + bw * 0.4, 0]} 
                                rotation={[-Math.PI / 2, 0, 0]}
                                castShadow 
                                receiveShadow
                            >
                                {p.signetShape === 'rectangular' || p.signetShape === 'square' ? (
                                    <boxGeometry args={[bw * 3.5, bw * 3.5, bw * 1.5]} />
                                ) : p.signetShape === 'round' ? (
                                    <cylinderGeometry args={[bw * 1.8, bw * 1.5, bw * 1.5, 40]} />
                                ) : (
                                    // Oval / Cushion (default)
                                    <cylinderGeometry args={[bw * 1.8, bw * 1.2, bw * 1.5, 40]} scale={[1, 1, 0.75]} />
                                )}
                            </mesh>
                            {/* Smoothing transition */}
                            <mesh material={M} position={[0, RING_R, 0]} scale={[1, 0.5, 1]}>
                                <sphereGeometry args={[bw * 1.4, 20, 20]} />
                            </mesh>
                        </group>
                    ) : (
                        /* ═══ PROFILE-DEPENDENT BAND GEOMETRY ═══ */
                        <>
                            {profile === 'flat' ? (
                                /* Flat profile: squished torus + sharp edge rings */
                                <>
                                    <mesh material={M} castShadow receiveShadow scale={[1, 1, 0.38]}>
                                        <torusGeometry args={[RING_R, bw, 80, 200]} />
                                    </mesh>
                                    {/* Sharp edge rings for flat silhouette */}
                                    <mesh material={M}>
                                        <torusGeometry args={[RING_R, bw * 0.92, 4, 200]} />
                                    </mesh>
                                </>
                            ) : profile === 'knife_edge' ? (
                                /* Knife-edge: very thin torus with triangular cross-section */
                                <>
                                    <mesh material={M} castShadow receiveShadow scale={[1, 1, 0.22]}>
                                        <torusGeometry args={[RING_R, bw * 1.15, 80, 200]} />
                                    </mesh>
                                    {/* Ridge line along outer edge */}
                                    <mesh material={M}>
                                        <torusGeometry args={[RING_R + bw * 0.85, bw * 0.08, 6, 200]} />
                                    </mesh>
                                </>
                            ) : profile === 'comfort_fit' ? (
                                /* Comfort-fit: rounder inner, slightly thicker */
                                <>
                                    <mesh material={M} castShadow receiveShadow scale={[1, 1, Math.max(0.6, bt / 2)]}>
                                        <torusGeometry args={[RING_R, bw * 1.08, 80, 200]} />
                                    </mesh>
                                    {/* Inner comfort bevel */}
                                    <mesh material={M}>
                                        <torusGeometry args={[RING_R - bw * 0.10, bw * 0.70, 32, 200]} />
                                    </mesh>
                                </>
                            ) : (
                                /* Round (default) */
                                <mesh material={M} castShadow receiveShadow scale={[1, 1, Math.max(0.5, bt / 2)]}>
                                    <torusGeometry args={[RING_R, bw, 80, 200]} />
                                </mesh>
                            )}
                        </>
                    )}
                    {/* Removed the buggy thick inner torus that generated when bw > 0.14 */}

                    {/* ── FIXED MOTIFS — properly placed on band surface ── */}
                    {p.motif && !hiddenParts?.has('band') && motifAngles.map((angle, i) => (
                        <MotifInstance
                            key={i}
                            motif={p.motif!}
                            size={bw * 0.9}
                            material={M}
                            ringRadius={RING_R + bw * 0.55}
                            angle={angle}
                            bandWidth={bw}
                        />
                    ))}
                </>
            )}

            {/* Stone seat */}
            {!hiddenParts?.has('setting') && !isSignet && (
                <>
                    {p.stones?.[0] && p.setting?.type !== 'tension' && (
                        <mesh material={M} position={[0, RING_R + sR * 0.08, 0]}>
                            <cylinderGeometry args={[sR * 1.10, sR * 0.92, sR * 0.30, 40]} />
                        </mesh>
                    )}

                    {p.setting?.type === 'bezel' && p.stones?.[0] && (
                        <mesh material={M} position={[0, RING_R + sR * 0.28, 0]}>
                            <torusGeometry args={[sR * 1.04, 0.038, 20, 64]} />
                        </mesh>
                    )}
                </>
            )}

            {/* Prongs — with sphere tips and taper */}
            {!hiddenParts?.has('prongs') && p.setting?.type !== 'bezel' && !showTensionGap && pAngles.map((a, i) => {
                const px = Math.cos(a) * sR * 0.88
                const pz = Math.sin(a) * sR * 0.88
                const py = RING_R + sR * 0.16
                const pt = Math.max(0.015, (p.prongs?.thickness ?? 0.9) / 55)
                const ph = Math.max(0.10, (p.prongs?.height ?? 1.2) / 8)
                const isClaw = p.prongs?.style === 'claw'
                const clawBend = isClaw ? 0.15 : 0
                return (
                    <group key={i} position={[px, py, pz]}
                        rotation={[Math.sin(a) * (0.25 + clawBend), 0, -Math.cos(a) * (0.25 + clawBend)]}>
                        {/* Prong shaft — tapered */}
                        <mesh material={M}>
                            <cylinderGeometry args={[pt * 0.55, pt * 0.85, ph, 10]} />
                        </mesh>
                        {/* Sphere tip — realistic grip */}
                        <mesh material={M} position={[0, ph * 0.5, 0]}>
                            <sphereGeometry args={[pt * 0.75, 10, 10]} />
                        </mesh>
                        {/* Base flare */}
                        <mesh material={M} position={[0, -ph * 0.48, 0]}>
                            <cylinderGeometry args={[pt * 0.85, pt * 1.1, ph * 0.12, 10]} />
                        </mesh>
                    </group>
                )
            })}

            {/* Center stone */}
            {!hiddenParts?.has('stone') && p.stones?.[0] && S && (
                <Gem mat={S} pos={[0, SY, 0]} r={sR} cut={p.stones[0].cut} stoneType={p.stones[0].type} metalMaterial={M} />
            )}

            {/* Halo — with bezel seats and micro-prong pairs */}
            {!hiddenParts?.has('halo') && p.halo?.enabled && (
                <>
                    {/* Halo bezel ring — metal seat for halo stones */}
                    <mesh material={M} position={[0, SY - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[sR * 1.72, 0.022, 12, 48]} />
                    </mesh>
                    {/* Outer rim ring */}
                    <mesh material={M} position={[0, SY - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[sR * 1.92, 0.015, 8, 48]} />
                    </mesh>
                    {S && hAngles.map((a, i) => {
                        const hr = sR * 1.72
                        const hs = Math.max(0.040, (p.halo?.stoneSize ?? 0.025) * 5.5)
                        const hx = Math.cos(a) * hr
                        const hz = Math.sin(a) * hr
                        return (
                            <group key={i} position={[hx, SY - 0.02, hz]}>
                                {/* Halo stone */}
                                <mesh material={S} castShadow scale={hs}>
                                    <octahedronGeometry args={[1, 2]} />
                                </mesh>
                                {/* Micro-prong pair */}
                                <mesh material={M} position={[hs * 0.6, 0, 0]}>
                                    <cylinderGeometry args={[0.005, 0.003, hs * 1.2, 6]} />
                                </mesh>
                                <mesh material={M} position={[-hs * 0.6, 0, 0]}>
                                    <cylinderGeometry args={[0.005, 0.003, hs * 1.2, 6]} />
                                </mesh>
                            </group>
                        )
                    })}
                    <mesh material={M}><torusGeometry args={[RING_R, bw * 0.45, 14, 200]} /></mesh>
                </>
            )}

            {/* Ornate side accent stones */}
            {!hiddenParts?.has('stone') && showAccentStones && accentAngles.map((a, i) => (
                <mesh key={`acc-${i}`} material={S!} castShadow
                    position={[Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0]}
                    rotation={[0, 0, a + Math.PI / 2]} scale={sR * 0.28}>
                    <octahedronGeometry args={[1, 2]} />
                </mesh>
            ))}

            {/* Ornate filigree shoulder loops */}
            {!hiddenParts?.has('band') && showFiligree && [-0.65, 0.65].map((offset, i) => (
                <group key={`fil-${i}`} position={[offset * 0.95, RING_R * 0.70, 0]}
                    rotation={[0, 0, offset > 0 ? -0.6 : 0.6]}>
                    <mesh material={M}><torusGeometry args={[0.22, 0.016, 12, 36]} /></mesh>
                    <mesh material={M} position={[0.15 * Math.sign(offset), 0.12, 0]}><torusGeometry args={[0.12, 0.012, 10, 24]} /></mesh>
                    <mesh material={M} position={[-0.10 * Math.sign(offset), -0.10, 0]}><torusGeometry args={[0.08, 0.010, 8, 20]} /></mesh>
                </group>
            ))}

            {/* Engraving */}
            {!hiddenParts?.has('engraving') && p.engraving?.enabled && (
                <Engraving params={p.engraving} radius={RING_R + bw * 0.95} width={bw * 1.5} />
            )}
        </group>
    )
}

// ─── NECKLACE ─────────────────────────────────────────────────────────────────
function NecklaceMesh({
    p, M, S, variant, hiddenParts,
}: { p: DesignParams; M: THREE.Material; S: THREE.Material | null; variant: 'classic' | 'modern' | 'ornate'; hiddenParts?: Set<string> }) {
    const isMens = p.gender === 'mens'
    const sR = Math.min((p.stones?.[0]?.size ?? 1.0) * 0.10 + 0.15, 0.28)
    const SW = 1.80
    const SH = 0.90
    const NL = 44
    const LT = isMens ? 0.025 : 0.011
    const OVAL = variant === 'ornate' ? 1.8 : isMens ? 1.1 : 1.4

    const chainLinks = useMemo(() => {
        const links: Array<{ x: number; y: number; angle: number; isAlt: boolean }> = []
        const a = SW, b = SH * 1.5
        const totalNL = NL * 2
        for (let i = 0; i < totalNL; i++) {
            const t = (i / totalNL) * Math.PI * 2
            const x = a * Math.cos(t)
            const y = b * Math.sin(t) + SH
            const dx = -a * Math.sin(t)
            const dy = b * Math.cos(t)
            links.push({ x, y, angle: Math.atan2(dy, dx), isAlt: i % 2 === 0 })
        }
        return links
    }, [NL, SW, SH])

    const yMin = SH - SH * 1.5
    const BAIL_Y = yMin - 0.08
    const PEND_Y = BAIL_Y - 0.22 - sR * 1.20
    const PSZ = sR * 1.10

    const LR = isMens ? 0.065 : variant === 'modern' ? 0 : 0.038

    return (
        <group>
            {!hiddenParts?.has('chain') && chainLinks.map((lk, i) => {
                const style = p.chainStyle || 'cable'
                
                if (style === 'cable' || style === 'rope') {
                    return (
                        <mesh key={`lk${i}`} material={M}
                            position={[lk.x, lk.y, 0]}
                            rotation={[lk.isAlt ? Math.PI / 2 : 0, 0, lk.angle]}
                            scale={[OVAL, 1, 1]}
                            castShadow>
                            <torusGeometry args={[LR, style === 'rope' ? LT * 1.5 : LT, 8, 24]} />
                        </mesh>
                    )
                }

                if (style === 'box') {
                    return (
                        <mesh key={`lk${i}`} material={M}
                            position={[lk.x, lk.y, 0]}
                            rotation={[0, lk.isAlt ? Math.PI / 2 : 0, lk.angle]}
                            castShadow>
                            <boxGeometry args={[0.08, 0.02, 0.02]} />
                        </mesh>
                    )
                }

                // Curb / Figaro (flatter)
                return (
                    <mesh key={`lk${i}`} material={M}
                        position={[lk.x, lk.y, 0]}
                        rotation={[lk.isAlt ? Math.PI / 2 : 0, 0, lk.angle]}
                        scale={[OVAL, 0.6, 1.2]}
                        castShadow>
                        <torusGeometry args={[LR, LT * 0.8, 6, 20]} />
                    </mesh>
                )
            })}

            {!hiddenParts?.has('chain') && !isMens && (
                <>
                    <mesh material={M} position={[-SW, SH, 0]} castShadow>
                        <cylinderGeometry args={[0.02, 0.02, 0.08, 10]} />
                    </mesh>
                    <mesh material={M} position={[SW, SH, 0]} castShadow>
                        <cylinderGeometry args={[0.02, 0.02, 0.08, 10]} />
                    </mesh>
                </>
            )}

            {!hiddenParts?.has('bail') && !isMens && (
                <group position={[0, BAIL_Y + 0.02, 0]}>
                    {(!p.bailStyle || p.bailStyle === 'simple') && (
                        <mesh material={M} rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 1.0, 0.6]}>
                            <torusGeometry args={[0.055, 0.014, 10, 28]} />
                        </mesh>
                    )}
                    {p.bailStyle === 'hidden' && (
                        // Hidden bail - small loop in back
                        <mesh material={M} position={[0, -0.05, -0.04]} rotation={[0, Math.PI / 2, 0]}>
                            <torusGeometry args={[0.03, 0.015, 10, 28]} />
                        </mesh>
                    )}
                    {p.bailStyle === 'v_bail' && (
                        // V shape
                        <group>
                            <mesh material={M} position={[-0.03, -0.01, 0]} rotation={[0, 0, -Math.PI / 6]}>
                                <cylinderGeometry args={[0.012, 0.012, 0.1, 10]} />
                            </mesh>
                            <mesh material={M} position={[0.03, -0.01, 0]} rotation={[0, 0, Math.PI / 6]}>
                                <cylinderGeometry args={[0.012, 0.012, 0.1, 10]} />
                            </mesh>
                            <mesh material={M} position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
                                <torusGeometry args={[0.015, 0.01, 10, 20]} />
                            </mesh>
                        </group>
                    )}
                    {p.bailStyle === 'decorative' && (
                        // Ornate oval
                        <mesh material={M} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 1.2, 0.5]}>
                            <torusGeometry args={[0.06, 0.02, 16, 32]} />
                        </mesh>
                    )}
                    {p.motif && p.bailStyle !== 'hidden' && (
                        <MotifInstance
                            motif={p.motif}
                            size={0.025}
                            material={M}
                            ringRadius={0.055 + 0.012}
                            angle={Math.PI / 2}
                            bandWidth={0.014}
                        />
                    )}
                </group>
            )}

            {variant === 'classic' && !isMens && (
                <>
                    {!hiddenParts?.has('bail') && (
                        <mesh material={M} position={[0, (BAIL_Y + PEND_Y) / 2 + 0.06, 0]}>
                            <cylinderGeometry args={[0.010, 0.010, Math.abs(BAIL_Y - PEND_Y) * 0.55, 8]} />
                        </mesh>
                    )}
                    {!hiddenParts?.has('setting') && (
                        <>
                            <mesh material={M} position={[0, PEND_Y, 0]} rotation={[Math.PI / 2, 0, Math.PI / 4]} castShadow>
                                <torusGeometry args={[PSZ, 0.032, 4, 4]} />
                            </mesh>
                            <mesh material={M} position={[0, PEND_Y, -sR * 0.12]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
                                <cylinderGeometry args={[PSZ * 1.04, PSZ * 1.04, 0.026, 4]} />
                            </mesh>
                            {Array.from({ length: 4 }, (_, i) => {
                                const ca = (i / 4) * Math.PI * 2 + Math.PI / 4
                                return (
                                    <mesh key={i} material={M} position={[Math.cos(ca) * PSZ * 1.10, PEND_Y, Math.sin(ca) * PSZ * 1.10]}>
                                        <sphereGeometry args={[0.022, 8, 8]} />
                                    </mesh>
                                )
                            })}
                        </>
                    )}
                    {!hiddenParts?.has('stone') && p.stones?.[0] && S && (
                        <Gem mat={S} pos={[0, PEND_Y, 0]} r={PSZ * 0.90} cut={p.stones[0].cut} stoneType={p.stones[0].type} rotation={[Math.PI / 2, 0, Math.PI / 4]} metalMaterial={M} />
                    )}
                </>
            )}

            {variant === 'modern' && !isMens && (
                <>
                    {!hiddenParts?.has('bail') && (
                        <mesh material={M} position={[0, (BAIL_Y + PEND_Y) / 2, 0]}>
                            <cylinderGeometry args={[0.012, 0.012, Math.abs(BAIL_Y - PEND_Y), 8]} />
                        </mesh>
                    )}
                    {!hiddenParts?.has('setting') && (
                        <>
                            <mesh material={M} position={[0, PEND_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                                <torusGeometry args={[PSZ * 1.05, 0.028, 6, 6]} />
                            </mesh>
                            <mesh material={M} position={[0, PEND_Y, -sR * 0.10]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[PSZ * 0.96, PSZ * 0.96, 0.020, 6]} />
                            </mesh>
                        </>
                    )}
                    {!hiddenParts?.has('stone') && p.stones?.[0] && S && (
                        <Gem mat={S} pos={[0, PEND_Y, 0]} r={PSZ * 0.82} cut={p.stones[0].cut} stoneType={p.stones[0].type} rotation={[Math.PI / 2, 0, 0]} metalMaterial={M} />
                    )}
                </>
            )}

            {variant === 'ornate' && !isMens && (
                <>
                    {!hiddenParts?.has('setting') && (
                        <>
                            <mesh material={M} position={[0, PEND_Y + sR * 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.3, 1]} castShadow>
                                <torusGeometry args={[PSZ * 1.0, 0.030, 20, 48]} />
                            </mesh>
                            <mesh material={M} position={[0, PEND_Y + sR * 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.3, 1]}>
                                <torusGeometry args={[PSZ * 1.28, 0.012, 12, 48]} />
                            </mesh>
                        </>
                    )}
                    {!hiddenParts?.has('stone') && p.stones?.[0] && S && (
                        <Gem mat={S} pos={[0, PEND_Y + sR * 0.2, sR * 0.05]} r={PSZ * 0.78} cut={p.stones[0].cut} stoneType={p.stones[0].type} metalMaterial={M} />
                    )}
                    {!hiddenParts?.has('stone') && S && [[-0.22, -0.18], [0, -0.20], [0.22, -0.18]].map(([dx, dy], i) => (
                        <group key={`drop-${i}`} position={[dx, PEND_Y + dy, 0]}>
                            <mesh material={S} scale={[0.060, 0.090, 0.060]} castShadow>
                                <octahedronGeometry args={[1, 2]} />
                            </mesh>
                        </group>
                    ))}
                </>
            )}
        </group>
    )
}

// ─── SINGLE EARRING UNIT ──────────────────────────────────────────────────────
function SingleEarring({
    M, S, p, variant, hiddenParts, isRight = false,
}: { M: THREE.Material; S: THREE.Material | null; p: DesignParams; variant: 'classic' | 'modern' | 'ornate'; hiddenParts?: Set<string>; isRight?: boolean }) {

    const sR = Math.min((p.stones?.[0]?.size ?? 1.0) * 0.080 + 0.14, 0.24)
    const nProng = Math.min(p.prongs?.count ?? 4, 6)
    const pA = useMemo(() => Array.from({ length: nProng }, (_, i) => (i / nProng) * Math.PI * 2), [nProng])

    const eStyle = p.earringStyle || 'drop'
    const isStud = eStyle === 'stud'
    const isHoop = eStyle === 'hoop'
    const isDrop = eStyle === 'drop' || (!isStud && !isHoop)

    const HOOK_R = 0.190
    const HOOK_TUBE = 0.013
    const CUSTOM_DROP = (p.earringDrop || 15) / 30 // Scale down mm to units
    const POST_LEN = variant === 'classic' ? 0.35 : variant === 'modern' ? 0.60 : 1.10
    const ACTUAL_POST = isDrop ? Math.max(CUSTOM_DROP, POST_LEN) : 0
    const CUP_TOP_Y = isStud ? sR * 0.3 : isHoop ? -0.45 : -(ACTUAL_POST)
    const CUP_H = sR * 0.66
    const CUP_BOT_Y = CUP_TOP_Y - CUP_H
    const STONE_Y = CUP_TOP_Y - sR * 0.28

    // Mirror for right earring — hook curves opposite direction
    const hookMirror = isRight ? -1 : 1

    return (
        <group>
            {/* ── Hook & Hoop ── */}
            {!hiddenParts?.has('hook') && (
                <group>
                    {isDrop && (
                        <>
                            <mesh material={M} position={[0, HOOK_R * 0.6, 0]} castShadow
                                rotation={[0, 0, isRight ? Math.PI : 0]}>
                                <torusGeometry args={[HOOK_R, HOOK_TUBE, 14, 48, Math.PI * 1.15]} />
                            </mesh>
                            <mesh material={M} position={[HOOK_R * hookMirror, HOOK_R * 0.6, 0]}>
                                <sphereGeometry args={[HOOK_TUBE * 1.8, 10, 10]} />
                            </mesh>
                        </>
                    )}
                    {isHoop && (
                        <mesh material={M} position={[0, -0.15, 0]} castShadow rotation={[0, Math.PI / 2, 0]}>
                            <torusGeometry args={[0.3, 0.02, 16, 64]} />
                        </mesh>
                    )}
                    {isStud && (
                        <mesh material={M} position={[0, CUP_TOP_Y + 0.05, -0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                            <cylinderGeometry args={[0.012, 0.012, 0.3, 10]} />
                        </mesh>
                    )}
                </group>
            )}

            {/* ── Post / stem ── */}
            {isDrop && !hiddenParts?.has('cup') && (
                <mesh material={M} position={[0, CUP_TOP_Y / 2, 0]} castShadow>
                    <cylinderGeometry args={[0.013, 0.010, ACTUAL_POST, 10]} />
                </mesh>
            )}

            {/* ── Stone cup + prongs (classic & ornate) ── */}
            {variant !== 'modern' && (
                <>
                    {!hiddenParts?.has('cup') && (
                        <>
                            <mesh material={M}
                                position={[0, CUP_TOP_Y - CUP_H / 2, 0]}
                                rotation={[Math.PI / 2, 0, 0]} castShadow>
                                <cylinderGeometry args={[sR * 1.05, sR * 0.32, CUP_H, 40, 1, true]} />
                            </mesh>
                            
                            {/* Earring cup motifs */}
                            {p.motif && Array.from({ length: 4 }).map((_, i) => {
                                const angle = (i / 4) * Math.PI * 2
                                return (
                                    <group key={`ear-motif-${i}`} position={[0, CUP_TOP_Y - CUP_H / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                                        <MotifInstance
                                            motif={p.motif!}
                                            size={CUP_H * 0.4}
                                            material={M}
                                            ringRadius={sR * 1.06} // Slanted placement simplified to cylinder edge
                                            angle={angle}
                                            bandWidth={0.05}
                                        />
                                    </group>
                                )
                            })}

                            <mesh material={M} position={[0, CUP_TOP_Y, 0]}>
                                <torusGeometry args={[sR * 1.05, 0.018, 14, 56]} />
                            </mesh>
                            <mesh material={M} position={[0, CUP_BOT_Y, 0]}>
                                <torusGeometry args={[sR * 0.34, 0.016, 12, 40]} />
                            </mesh>
                        </>
                    )}
                    {!hiddenParts?.has('prongs') && p.setting?.type !== 'bezel' && pA.map((a, i) => {
                        const pt = Math.max(0.010, (p.prongs?.thickness ?? 0.9) / 75)
                        return (
                            <group key={i}
                                position={[Math.cos(a) * sR * 0.92, CUP_TOP_Y + sR * 0.12, Math.sin(a) * sR * 0.92]}
                                rotation={[Math.cos(a) * 0.30, 0, -Math.sin(a) * 0.30]}>
                                {/* Tapered prong shaft */}
                                <mesh material={M} castShadow>
                                    <cylinderGeometry args={[pt * 0.45, pt * 0.70, sR * 0.46, 8]} />
                                </mesh>
                                {/* Sphere tip */}
                                <mesh material={M} position={[0, sR * 0.23, 0]}>
                                    <sphereGeometry args={[pt * 0.6, 8, 8]} />
                                </mesh>
                            </group>
                        )
                    })}
                </>
            )}

            {/* ── MODERN: geometric stud ── */}
            {variant === 'modern' && (
                <>
                    {!hiddenParts?.has('cup') && (
                        <>
                            <mesh material={M} position={[0, CUP_TOP_Y * 0.4, 0]} castShadow>
                                <boxGeometry args={[sR * 0.32, sR * 2.0, sR * 0.20]} />
                            </mesh>
                            <mesh material={M} position={[0, CUP_TOP_Y - 0.10, 0]}>
                                <boxGeometry args={[sR * 1.4, 0.018, 0.018]} />
                            </mesh>
                        </>
                    )}
                    {!hiddenParts?.has('stone') && p.stones?.[0] && S && (
                        <mesh material={S}
                            position={[0, CUP_TOP_Y * 0.4, sR * 0.12]}
                            scale={[sR * 0.68, sR * 0.68, sR * 0.40]} castShadow>
                            <octahedronGeometry args={[1, 2]} />
                        </mesh>
                    )}
                </>
            )}

            {/* ── Center stone ── */}
            {!hiddenParts?.has('stone') && p.stones?.[0] && S && variant !== 'modern' && (
                <Gem mat={S} pos={[0, STONE_Y, sR * 0.24]} r={sR} cut={p.stones[0].cut} stoneType={p.stones[0].type} metalMaterial={M} />
            )}

            {/* ── Halo — with bezel ring ── */}
            {!hiddenParts?.has('halo') && p.halo?.enabled && S && (
                <>
                    {/* Bezel ring seat */}
                    <mesh material={M} position={[0, STONE_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[sR * 1.20, 0.016, 10, 36]} />
                    </mesh>
                    {Array.from({ length: Math.min(p.halo?.stoneCount ?? 12, 16) }, (_, i) => {
                        const nH = Math.min(p.halo?.stoneCount ?? 12, 16)
                        const a = (i / nH) * Math.PI * 2
                        const hr = sR * 1.20
                        const hs = Math.max(0.022, (p.halo?.stoneSize ?? 0.022) * 3.5)
                        const hx = Math.cos(a) * hr
                        const hz = Math.sin(a) * hr
                        return (
                            <group key={i} position={[hx, STONE_Y, hz]}>
                                <mesh material={S} castShadow scale={hs}>
                                    <octahedronGeometry args={[1, 2]} />
                                </mesh>
                                {/* Micro-prong pair */}
                                <mesh material={M} position={[hs * 0.5, 0, 0]}>
                                    <cylinderGeometry args={[0.004, 0.002, hs * 1.0, 5]} />
                                </mesh>
                                <mesh material={M} position={[-hs * 0.5, 0, 0]}>
                                    <cylinderGeometry args={[0.004, 0.002, hs * 1.0, 5]} />
                                </mesh>
                            </group>
                        )
                    })}
                </>
            )}

            {/* ── ORNATE chandelier drops ── */}
            {!hiddenParts?.has('stone') && variant === 'ornate' && S && [[-0.18, -0.28], [0, -0.32], [0.18, -0.28]].map(([dx, dy], i) => (
                <group key={`chandelier-${i}`} position={[dx, STONE_Y + dy, 0]}>
                    <mesh material={M} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.014, 0.005, 6, 14]} />
                    </mesh>
                    <mesh material={S} scale={[0.050, 0.070, 0.050]} castShadow>
                        <octahedronGeometry args={[1, 2]} />
                    </mesh>
                </group>
            ))}

            {/* ── Classic butterfly back — improved with wings ── */}
            {!hiddenParts?.has('cup') && variant === 'classic' && (
                <group position={[0, -(POST_LEN + 0.08), 0]}>
                    {/* Main body */}
                    <mesh material={M} castShadow><boxGeometry args={[0.12, 0.050, 0.060]} /></mesh>
                    <mesh material={M}><cylinderGeometry args={[0.015, 0.015, 0.065, 10]} /></mesh>
                    {/* Wing tabs */}
                    <mesh material={M} position={[-0.07, 0, 0]} rotation={[0, 0, -0.15]}>
                        <boxGeometry args={[0.04, 0.035, 0.045]} />
                    </mesh>
                    <mesh material={M} position={[0.07, 0, 0]} rotation={[0, 0, 0.15]}>
                        <boxGeometry args={[0.04, 0.035, 0.045]} />
                    </mesh>
                </group>
            )}

            {/* ── Ornate leverback mechanism ── */}
            {!hiddenParts?.has('hook') && variant === 'ornate' && (
                <group position={[0, HOOK_R * 0.3, 0]}>
                    {/* Leverback arm */}
                    <mesh material={M} rotation={[0, 0, isRight ? Math.PI : 0]}>
                        <torusGeometry args={[HOOK_R * 0.75, HOOK_TUBE * 1.2, 12, 32, Math.PI * 0.8]} />
                    </mesh>
                    {/* Hinge joint */}
                    <mesh material={M} position={[0, -HOOK_R * 0.45, 0]}>
                        <sphereGeometry args={[HOOK_TUBE * 2.2, 10, 10]} />
                    </mesh>
                </group>
            )}
        </group>
    )
}

// ─── EARRING PAIR — FIXED: unified group, right earring correctly offset ──────
function EarringMesh({
    p, M, S, variant, hiddenParts,
}: { p: DesignParams; M: THREE.Material; S: THREE.Material | null; variant: 'classic' | 'modern' | 'ornate'; hiddenParts?: Set<string> }) {
    // Both earrings share the same root group center.
    // Separation based on typical human ear-to-ear distance in scene units.
    const SPREAD = 0.55

    return (
        <group>
            {/* Left earring */}
            <group position={[-SPREAD, 0, 0]}>
                <SingleEarring M={M} S={S} p={p} variant={variant} hiddenParts={hiddenParts} isRight={false} />
            </group>
            {/* Right earring — mirrored hook, same stone */}
            <group position={[SPREAD, 0, 0]}>
                <SingleEarring M={M} S={S} p={p} variant={variant} hiddenParts={hiddenParts} isRight={true} />
            </group>
        </group>
    )
}

// ─── BRACELET ─────────────────────────────────────────────────────────────────
function BraceletMesh({
    p, M, S, variant, hiddenParts,
}: { p: DesignParams; M: THREE.Material; S: THREE.Material | null; variant: 'classic' | 'modern' | 'ornate'; hiddenParts?: Set<string> }) {
    const BR = 1.65
    const bw = Math.max(0.14, Math.min((p.band?.width ?? 5.0) / 22, 0.32))
    const diameterScale = p.braceletDiameter ? p.braceletDiameter / 65 : 1.0
    const hc = p.braceletAccent === 'pave_bar' ? 24 : p.braceletAccent === 'station' ? 8 : (p.halo?.enabled || variant === 'ornate' ? 14 : 0)
    const hA = useMemo(() => Array.from({ length: hc }, (_, i) => (i / hc) * Math.PI * 2), [hc])
    const isCuff = variant === 'modern'
    const torusArc = isCuff ? Math.PI * 1.50 : Math.PI * 2

    return (
        <group rotation={[0.45, 0.20, 0]} scale={[diameterScale, diameterScale, diameterScale]}>
            <group rotation={[Math.PI / 2, 0, 0]}>
                {!hiddenParts?.has('band') && (
                    <>
                        <mesh material={M} castShadow receiveShadow rotation={isCuff ? [0, 0, Math.PI * 0.25] : [0, 0, 0]}>
                            <torusGeometry args={[BR, bw, 80, 240, torusArc]} />
                        </mesh>
                        {/* Edge bevels */}
                        <mesh material={M} rotation={isCuff ? [0, 0, Math.PI * 0.25] : [0, 0, 0]}><torusGeometry args={[BR + bw * 0.95, bw * 0.15, 8, 240, torusArc]} /></mesh>
                        <mesh material={M} rotation={isCuff ? [0, 0, Math.PI * 0.25] : [0, 0, 0]}><torusGeometry args={[BR - bw * 0.95, bw * 0.15, 8, 240, torusArc]} /></mesh>
                    </>
                )}

                {variant === 'classic' && (
                    <>
                        {!hiddenParts?.has('band') && (
                            <>
                                <mesh material={M}><torusGeometry args={[BR, bw * 0.80, 20, 240, torusArc]} /></mesh>
                                <mesh material={M}><torusGeometry args={[BR + bw * 0.28, bw * 0.64, 12, 240, torusArc]} /></mesh>
                                <mesh material={M}><torusGeometry args={[BR - bw * 0.28, bw * 0.64, 12, 240, torusArc]} /></mesh>
                                
                                {/* Bracelet motifs looping around the band */}
                                {p.motif && Array.from({ length: 18 }).map((_, i) => {
                                    const angle = (i / 18) * Math.PI * 2
                                    if (isCuff && (angle > torusArc || angle < 0.2)) return null
                                    return (
                                        <MotifInstance
                                            key={`br-motif-${i}`}
                                            motif={p.motif!}
                                            size={bw * 1.2}
                                            material={M}
                                            ringRadius={BR + bw * 0.82}
                                            angle={angle}
                                            bandWidth={bw * 0.8}
                                        />
                                    )
                                })}
                            </>
                        )}
                        {!hiddenParts?.has('clasp') && !isCuff && (
                            <mesh material={M} position={[0, -BR, 0]} castShadow>
                                <boxGeometry args={[bw * 2.2, bw * 1.1, bw * 1.5]} />
                            </mesh>
                        )}
                    </>
                )}

                {(p.braceletAccent === 'station' || p.braceletAccent === 'pave_bar' || variant === 'ornate') && (
                    <>
                        {!hiddenParts?.has('pave') && S && hA.map((ha, i) => {
                            if (Math.abs(ha) < 0.22 && !isCuff) return null
                            if (p.braceletAccent === 'pave_bar' && Math.abs(ha) > 0.45 && Math.abs(ha - Math.PI*2) > 0.45) return null
                            
                            const bs = p.braceletAccent === 'station' ? 0.08 : 0.042
                            return (
                                <group key={`pave-${i}`} position={[Math.cos(ha) * BR, Math.sin(ha) * BR, 0]} rotation={[0, 0, ha + Math.PI / 2]}>
                                    {p.braceletAccent === 'station' && (
                                        <mesh material={M} position={[0, -0.01, 0]} scale={[1.2, 1.2, 1.2]}><torusGeometry args={[bs * 1.4, bs * 0.4, 10, 20]} /></mesh>
                                    )}
                                    <mesh material={S} castShadow scale={bs}>
                                        <octahedronGeometry args={[1, 2]} />
                                    </mesh>
                                </group>
                            )
                        })}
                    </>
                )}
            </group>
        </group>
    )
}

// ─── CUFFLINKS ────────────────────────────────────────────────────────────────
function CufflinkMesh({ p, M }: { p: DesignParams; M: THREE.Material }) {
    const shape = p.cufflinkShape || 'rectangular'
    const bw = (p.band?.width ?? 2.5) * 0.12

    return (
        <group>
            {/* Pair of cufflinks */}
            {[-1.5, 1.5].map(x => (
                <group key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    {/* Face */}
                    <mesh material={M} position={[0, 0, 0]} castShadow receiveShadow>
                        {shape === 'rectangular' ? (
                            <boxGeometry args={[bw * 4, bw * 3, bw * 0.5]} />
                        ) : shape === 'round' ? (
                            <cylinderGeometry args={[bw * 2.5, bw * 2.5, bw * 0.5, 32]} />
                        ) : (
                            <sphereGeometry args={[bw * 2.5, 32, 32]} scale={[1, 0.7, 0.1]} />
                        )}
                    </mesh>
                    {/* Stem */}
                    <mesh material={M} position={[0, 0, -bw * 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <cylinderGeometry args={[bw * 0.3, bw * 0.3, bw * 4, 16]} />
                    </mesh>
                    {/* Back bar */}
                    <mesh material={M} position={[0, 0, -bw * 4]} castShadow>
                        <boxGeometry args={[bw * 3.5, bw * 0.4, bw * 0.6]} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

// ─── TIE BAR ──────────────────────────────────────────────────────────────────
function TieBarMesh({ p, M }: { p: DesignParams; M: THREE.Material }) {
    const bw = (p.band?.width ?? 2.5) * 0.15
    return (
        <group rotation={[0.4, 0, Math.PI / 8]}>
            {/* Front Bar */}
            <mesh material={M} castShadow receiveShadow>
                <boxGeometry args={[bw * 12, bw * 1.5, bw * 0.3]} />
            </mesh>
            {/* Back Clip */}
            <mesh material={M} position={[0, -bw * 0.4, -bw * 0.6]} castShadow>
                <boxGeometry args={[bw * 10, bw * 1.2, bw * 0.2]} />
            </mesh>
            {/* Hinge detail */}
            <mesh material={M} position={[-bw * 5, -bw * 0.2, -bw * 0.3]} castShadow>
                <cylinderGeometry args={[bw * 0.4, bw * 0.4, bw * 1.8, 16]} />
            </mesh>
        </group>
    )
}

// ─── LAPEL PIN ────────────────────────────────────────────────────────────────
function LapelPinMesh({ p, M, S }: { p: DesignParams; M: THREE.Material; S: THREE.Material | null }) {
    const bw = (p.band?.width ?? 2.5) * 0.12
    const sR = Math.min((p.stones?.[0]?.size ?? 1.0) * 0.20 + 0.14, 0.54)
    return (
        <group rotation={[0, 0, 0]}>
            {/* Round / Shield base */}
            <mesh material={M} position={[0, 0, -bw * 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[bw * 3, bw * 2.8, bw * 0.4, 32]} />
            </mesh>
            {/* Pin shaft */}
            <mesh material={M} position={[0, 0, -bw * 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[bw * 0.1, bw * 0.1, bw * 4, 16]} />
            </mesh>
            {/* Clutch back */}
            <mesh material={M} position={[0, 0, -bw * 4.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[bw * 0.8, bw * 0.8, bw * 1.2, 16]} />
            </mesh>
            {/* Center stone if applicable */}
            {p.stones?.[0] && S && (
                <Gem mat={S} pos={[0, 0, bw * 0.2]} r={sR * 0.8} cut={p.stones[0].cut} stoneType={p.stones[0].type} metalMaterial={M} />
            )}
        </group>
    )
}

export default function JewelMesh({ params, renderMode = 'pbr', variant = 'classic', hiddenParts = new Set<string>(), clippingPlanes = [] }: Props) {
    const ref = useRef<THREE.Group>(null)

    const normalMap = useBandTexture(params.metal?.finish)

    const M = useMemo(() => {
        const mat = metalMat(params, renderMode, clippingPlanes)
        if (normalMap && mat instanceof THREE.MeshStandardMaterial) {
            mat.normalMap = normalMap
            // Adjust roughness slightly for textured finishes
            if (params.metal?.finish === 'matte' || params.metal?.finish === 'sandblasted') mat.roughness = Math.max(mat.roughness as number, 0.4)
            if (params.metal?.finish === 'satin') mat.roughness = Math.max(mat.roughness as number, 0.25)
        }
        return mat
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.metal?.color, params.metal?.roughness, params.metal?.finish, renderMode, normalMap, clippingPlanes])

    const S = useMemo(
        () => stoneMat(params.stones?.[0], renderMode, clippingPlanes),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [params.stones?.[0]?.type, params.stones?.[0]?.color, renderMode, clippingPlanes],
    )

    const t = (params.type ?? 'ring').toLowerCase()
    const isNecklace = t === 'necklace' || t === 'pendant' || t === 'chain'
    const isEarring = t === 'earring' || t === 'earrings'
    const isBracelet = t === 'bracelet' || t === 'bangle'
    const isCufflinks = t === 'cufflinks'
    const isTieBar = t === 'tiebar' || t === 'tie_bar'
    const isLapelPin = t === 'lapel_pin'
    const isRing = !isNecklace && !isEarring && !isBracelet && !isCufflinks && !isTieBar && !isLapelPin

    return (
        <group ref={ref}>
            {isRing && <RingMesh p={params} M={M} S={S} variant={variant} hiddenParts={hiddenParts} />}
            {isNecklace && <NecklaceMesh p={params} M={M} S={S} variant={variant} hiddenParts={hiddenParts} />}
            {isEarring && <EarringMesh p={params} M={M} S={S} variant={variant} hiddenParts={hiddenParts} />}
            {isBracelet && <BraceletMesh p={params} M={M} S={S} variant={variant} hiddenParts={hiddenParts} />}
            {isCufflinks && <CufflinkMesh p={params} M={M} />}
            {isTieBar && <TieBarMesh p={params} M={M} />}
            {isLapelPin && <LapelPinMesh p={params} M={M} S={S} />}
        </group>
    )
}
