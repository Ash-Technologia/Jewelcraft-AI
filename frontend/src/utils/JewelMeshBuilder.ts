import * as THREE from 'three'
import { DesignParams } from '../store/useAppStore'

// ─── STONE DATABASE ───────────────────────────────────────────────────────────
const STONE_DB: Record<string, {
    c: string; tr: number; ior: number; r: number; thickness: number;
    clearcoat: number; clearcoatRoughness: number; iridescence: number;
    iridescenceIOR: number; metalness: number; emissive: string;
    emissiveIntensity: number; geometry: string; geoArgs: number[];
    attenuationColor: string; attenuationDist: number; envMapIntensity: number;
}> = {
    diamond: {
        c: '#F0F4FF', tr: 0.97, ior: 2.417, r: 0.008, thickness: 0.7,
        clearcoat: 1.0, clearcoatRoughness: 0.008, iridescence: 0.28, iridescenceIOR: 1.3, metalness: 0,
        emissive: '#000000', emissiveIntensity: 0, attenuationColor: '#CCE8FF', attenuationDist: 15.0,
        envMapIntensity: 6.5, geometry: 'octahedron', geoArgs: [1, 3]
    },
    moissanite: {
        c: '#EEF2FF', tr: 0.95, ior: 2.65, r: 0.012, thickness: 0.8,
        clearcoat: 1.0, clearcoatRoughness: 0.015, iridescence: 0.92, iridescenceIOR: 2.1, metalness: 0,
        emissive: '#000000', emissiveIntensity: 0, attenuationColor: '#D0D8FF', attenuationDist: 12.0,
        envMapIntensity: 7.5, geometry: 'octahedron', geoArgs: [1, 3]
    },
    ruby: {
        c: '#E00020', tr: 0.72, ior: 1.77, r: 0.045, thickness: 1.5,
        clearcoat: 0.9, clearcoatRoughness: 0.03, iridescence: 0.1, iridescenceIOR: 1.4, metalness: 0,
        emissive: '#CC0000', emissiveIntensity: 0.12, attenuationColor: '#FF1020', attenuationDist: 0.8,
        envMapIntensity: 3.8, geometry: 'octahedron', geoArgs: [1, 2]
    },
    sapphire: {
        c: '#1040D0', tr: 0.68, ior: 1.77, r: 0.05, thickness: 1.6,
        clearcoat: 0.85, clearcoatRoughness: 0.04, iridescence: 0.15, iridescenceIOR: 1.4, metalness: 0,
        emissive: '#001080', emissiveIntensity: 0.1, attenuationColor: '#2040FF', attenuationDist: 1.0,
        envMapIntensity: 3.2, geometry: 'octahedron', geoArgs: [1, 2]
    },
    emerald: {
        c: '#1B9A4E', tr: 0.58, ior: 1.58, r: 0.15, thickness: 2.2,
        clearcoat: 0.6, clearcoatRoughness: 0.15, iridescence: 0.0, iridescenceIOR: 1.0, metalness: 0,
        emissive: '#005020', emissiveIntensity: 0.08, attenuationColor: '#00CC55', attenuationDist: 1.2,
        envMapIntensity: 2.6, geometry: 'box', geoArgs: [1.4, 0.38, 1.0]
    },
    amethyst: {
        c: '#8B3D9B', tr: 0.82, ior: 1.54, r: 0.035, thickness: 1.2,
        clearcoat: 0.75, clearcoatRoughness: 0.05, iridescence: 0.22, iridescenceIOR: 1.35, metalness: 0,
        emissive: '#4A0E6B', emissiveIntensity: 0.05, attenuationColor: '#DDAAFF', attenuationDist: 1.5,
        envMapIntensity: 2.8, geometry: 'octahedron', geoArgs: [1, 2]
    },
    onyx: {
        c: '#050505', tr: 0.0, ior: 1.49, r: 0.1, thickness: 0,
        clearcoat: 0.9, clearcoatRoughness: 0.08, iridescence: 0, iridescenceIOR: 1.0, metalness: 0.1,
        emissive: '#000000', emissiveIntensity: 0, attenuationColor: '#000000', attenuationDist: 0,
        envMapIntensity: 2.0, geometry: 'pentagon', geoArgs: [1]
    },
    citrine: {
        c: '#E8A820', tr: 0.78, ior: 1.544, r: 0.012, thickness: 1.0,
        clearcoat: 0.9, clearcoatRoughness: 0.015, iridescence: 0.05, iridescenceIOR: 1.2, metalness: 0,
        emissive: '#AA6600', emissiveIntensity: 0.20, attenuationColor: '#FFCC00', attenuationDist: 1.5,
        envMapIntensity: 3.5, geometry: 'octahedron', geoArgs: [1, 2]
    },
    tanzanite: {
        c: '#4B2E83', tr: 0.60, ior: 1.692, r: 0.018, thickness: 1.2,
        clearcoat: 0.9, clearcoatRoughness: 0.02, iridescence: 0.45, iridescenceIOR: 1.5, metalness: 0,
        emissive: '#2A1060', emissiveIntensity: 0.25, attenuationColor: '#8844FF', attenuationDist: 0.9,
        envMapIntensity: 4.0, geometry: 'octahedron', geoArgs: [1, 2]
    },
}

// ─── PROCEDURAL BAND TEXTURE — generates bump-like normal variation ───────────
function createBandTexture(style: 'hammered' | 'brushed' | 'milgrain' | 'smooth' | 'braided'): THREE.DataTexture {
    const size = 256
    const data = new Uint8Array(size * size * 4)

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4
            let val = 128

            if (style === 'hammered') {
                // Random hammer dents — multi-frequency noise
                const freq1 = Math.sin(x * 0.31) * Math.cos(y * 0.29) * 40
                const freq2 = Math.sin(x * 0.87 + y * 0.53) * 20
                const freq3 = Math.sin(x * 2.1 - y * 1.7) * 10
                val = Math.max(0, Math.min(255, 128 + freq1 + freq2 + freq3))
            } else if (style === 'brushed') {
                // Horizontal brush lines
                val = 128 + Math.sin(y * 2.5) * 25 + Math.sin(y * 7.3) * 10 + Math.sin(y * 15.1) * 5
            } else if (style === 'milgrain') {
                // Beaded edge pattern
                const bead = Math.sin(x * 0.4) * Math.sin(y * 0.4)
                val = 128 + bead * 50 + Math.sin(x * 12) * 15
            } else if (style === 'braided') {
                // Diagonal weave
                const weave = Math.sin((x + y) * 0.3) * Math.sin((x - y) * 0.3)
                val = 128 + weave * 60
            } else {
                // smooth with subtle grain
                val = 128 + (Math.random() - 0.5) * 8
            }

            data[idx] = Math.max(0, Math.min(255, val))
            data[idx + 1] = 128
            data[idx + 2] = 200
            data[idx + 3] = 255
        }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 2)
    tex.needsUpdate = true
    return tex
}

// ─── METAL MATERIAL WITH TEXTURE VARIETY ─────────────────────────────────────
function getMetalMaterial(p: DesignParams): THREE.MeshPhysicalMaterial {
    const finish = p.metal?.finish ?? 'high_polish'
    const normalTex = createBandTexture(
        finish === 'hammered' ? 'hammered' :
            finish === 'brushed' ? 'brushed' :
                finish === 'satin' ? 'milgrain' : 'smooth'
    )

    return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(p.metal?.color ?? '#FFD700'),
        metalness: 0.98,
        roughness: Math.max(0.02, p.metal?.roughness ?? 0.12),
        envMapIntensity: 3.2,
        clearcoat: finish === 'high_polish' ? 0.8 : 0.2,
        clearcoatRoughness: finish === 'high_polish' ? 0.05 : 0.3,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(
            finish === 'hammered' ? 0.8 :
                finish === 'brushed' ? 0.3 :
                    finish === 'satin' ? 0.2 : 0.05,
            finish === 'hammered' ? 0.8 :
                finish === 'brushed' ? 0.3 :
                    finish === 'satin' ? 0.2 : 0.05
        ),
    })
}

function getStoneMaterial(s: DesignParams['stones'][0] | undefined): THREE.Material | null {
    if (!s) return null
    const db = STONE_DB[s.type] ?? STONE_DB.diamond
    const color = new THREE.Color(s.color ?? db.c)

    if (db.tr === 0) {
        return new THREE.MeshPhysicalMaterial({
            color, metalness: db.metalness, roughness: db.r,
            clearcoat: db.clearcoat, clearcoatRoughness: db.clearcoatRoughness,
            iridescence: db.iridescence, iridescenceIOR: db.iridescenceIOR,
            envMapIntensity: db.envMapIntensity, flatShading: true,
        })
    }

    return new THREE.MeshPhysicalMaterial({
        color, metalness: 0, roughness: db.r,
        transmission: db.tr, ior: db.ior, thickness: db.thickness, transparent: true,
        clearcoat: db.clearcoat, clearcoatRoughness: db.clearcoatRoughness,
        iridescence: db.iridescence, iridescenceIOR: db.iridescenceIOR,
        emissive: new THREE.Color(db.emissive), emissiveIntensity: db.emissiveIntensity,
        envMapIntensity: db.envMapIntensity,
        attenuationColor: new THREE.Color(db.attenuationColor),
        attenuationDistance: db.attenuationDist, flatShading: true,
    })
}

// ─── GEM MESH ─────────────────────────────────────────────────────────────────
function createGemMesh(mat: THREE.Material, r: number, cut?: string, stoneType?: string): THREE.Mesh {
    const db = STONE_DB[stoneType ?? 'diamond'] ?? STONE_DB.diamond
    const useBox = db.geometry === 'box' || cut === 'emerald' || cut === 'princess' || cut === 'cushion'
    const isOval = cut === 'oval'
    const isPear = cut === 'pear'
    const isMarquise = cut === 'marquise'

    let geo: THREE.BufferGeometry
    if (useBox) {
        geo = new THREE.BoxGeometry(...(db.geoArgs as [number, number, number]))
    } else {
        geo = new THREE.OctahedronGeometry(...(db.geoArgs as [number, number]))
    }

    const mesh = new THREE.Mesh(geo, mat)
    const sx = r * (isOval ? 0.75 : isPear ? 0.68 : isMarquise ? 0.50 : 1.0)
    const sy = r * (isPear ? 1.35 : isOval ? 1.15 : isMarquise ? 1.60 : 1.0)
    const sz = r * (isOval ? 0.75 : isPear ? 0.68 : isMarquise ? 0.50 : 1.0)
    mesh.scale.set(sx, sy, sz)
    mesh.castShadow = true
    return mesh
}

// ─── MOTIF SHAPE BUILDER ──────────────────────────────────────────────────────
function buildMotifShape(motif: string, bw: number): THREE.Shape {
    const s = new THREE.Shape()
    // Scale everything relative to band width (bw)
    const sz = bw * 0.95
    if (motif === 'floral') {
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2
            const a2 = a + (Math.PI / 5)
            if (i === 0) s.moveTo(Math.cos(a) * sz * 0.4, Math.sin(a) * sz * 0.4)
            s.quadraticCurveTo(Math.cos(a2) * sz * 0.85, Math.sin(a2) * sz * 0.85,
                Math.cos(a + Math.PI * 2 / 5) * sz * 0.4, Math.sin(a + Math.PI * 2 / 5) * sz * 0.4)
        }
    } else if (motif === 'geometric') {
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6
            if (i === 0) s.moveTo(Math.cos(a) * sz * 0.5, Math.sin(a) * sz * 0.5)
            else s.lineTo(Math.cos(a) * sz * 0.5, Math.sin(a) * sz * 0.5)
        }
        s.closePath()
    } else if (motif === 'dolphin') {
        s.moveTo(-sz * 0.5, 0)
        s.bezierCurveTo(-sz * 0.3, sz * 0.4, sz * 0.2, sz * 0.5, sz * 0.5, sz * 0.2)
        s.bezierCurveTo(sz * 0.7, 0, sz * 0.5, -sz * 0.3, sz * 0.2, -sz * 0.2)
        s.lineTo(0.0, -sz * 0.45)
        s.lineTo(-sz * 0.15, -sz * 0.2)
        s.bezierCurveTo(-sz * 0.35, -sz * 0.3, -sz * 0.6, -sz * 0.1, -sz * 0.5, 0)
    } else if (motif === 'peacock') {
        s.moveTo(0, -sz * 0.5)
        s.bezierCurveTo(-sz * 0.3, -sz * 0.3, -sz * 0.4, sz * 0.1, 0, sz * 0.5)
        s.bezierCurveTo(sz * 0.4, sz * 0.1, sz * 0.3, -sz * 0.3, 0, -sz * 0.5)
    } else if (motif === 'tribal') {
        s.moveTo(0, sz * 0.6); s.lineTo(sz * 0.35, 0); s.lineTo(0, -sz * 0.6); s.lineTo(-sz * 0.35, 0)
        s.closePath()
    } else {
        // classic_scroll with interior hole
        s.moveTo(-sz * 0.4, 0)
        s.bezierCurveTo(-sz * 0.4, sz * 0.4, 0.0, sz * 0.55, sz * 0.3, sz * 0.35)
        s.bezierCurveTo(sz * 0.55, sz * 0.1, sz * 0.4, -sz * 0.35, 0.0, -sz * 0.45)
        s.bezierCurveTo(-sz * 0.25, -sz * 0.55, -sz * 0.55, -sz * 0.2, -sz * 0.4, 0)
        const hole = new THREE.Path()
        hole.absarc(0, 0, sz * 0.12, 0, Math.PI * 2, true)
        s.holes.push(hole)
    }
    return s
}

// ─── PLACE MOTIFS CORRECTLY AROUND RING BAND ─────────────────────────────────
// Key fix: motifs must be placed mathematically ON the torus surface perfectly.
// Using exact parametric equations of the Torus to align normal vectors and sit them on the borders.
function addMotifsToBand(
    group: THREE.Group,
    motif: string,
    RING_R: number,
    bw: number, // tube radius
    M: THREE.Material,
    count = 14,
    skipAngle = Math.PI / 2, // skip near stone (top)
    skipRange = 0.45
): void {
    // Scale motif to ~40% of the band width to fill the borders elegantly
    const shape = buildMotifShape(motif, bw * 0.40)
    // Deep depth so it sinks into the ring material, only exposing its outer bevels
    const depth = bw * 0.25;
    const extrudeSettings = {
        depth: depth,
        bevelEnabled: true,
        bevelThickness: bw * 0.05,
        bevelSize: bw * 0.04,
        bevelSegments: 6,
        curveSegments: 24
    }

    // We want the carved sections to look darkened/oxidized for deep realism
    const carvedMaterial = M.clone() as THREE.MeshPhysicalMaterial
    if (carvedMaterial.color) {
        carvedMaterial.color = carvedMaterial.color.clone().multiplyScalar(0.65) // Dark carved recess
    }

    for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2

        // Skip the stone zone at top (theta ≈ π/2)
        const diff = Math.abs(((theta - skipAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        if (diff < skipRange) continue

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)

        // Place a motif specifically on the left and right side borders (faces) of the ring
        // PI/2 is exactly the topmost flat side, slightly offset to PI/2.1 to catch the soft bevel
        const borderAngles = [Math.PI / 2.15, -Math.PI / 2.15]

        for (const alpha of borderAngles) {
            const mesh = new THREE.Mesh(geo, carvedMaterial)
            mesh.castShadow = true
            mesh.receiveShadow = true

            // The exact position on the surface of the TubeGeometry
            // Center of tube cross-section at angle theta: C = (RING_R * cos(theta), RING_R * sin(theta), 0)
            const cx = RING_R * Math.cos(theta)
            const cy = RING_R * Math.sin(theta)
            // Surface point P: C + bw * [cos(alpha)*cos(theta), cos(alpha)*sin(theta), sin(alpha)]
            const px = cx + bw * Math.cos(alpha) * Math.cos(theta)
            const py = cy + bw * Math.cos(alpha) * Math.sin(theta)
            const pz = bw * Math.sin(alpha)

            const container = new THREE.Group()
            container.position.set(px, py, pz)

            // Construct basis vectors for exact tangent space orientation
            // Normal (outward) -> Local Z
            const N = new THREE.Vector3(Math.cos(alpha) * Math.cos(theta), Math.cos(alpha) * Math.sin(theta), Math.sin(alpha)).normalize()
            // Tangent along ring -> Local Y
            const T = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0).normalize()
            // Binormal across band -> Local X (T x N)
            const B = new THREE.Vector3().crossVectors(T, N).normalize()

            const m = new THREE.Matrix4().makeBasis(B, T, N)
            container.quaternion.setFromRotationMatrix(m)

            // Sink the motif 80% into the ring! This ensures it does not float.
            // The remaining 20% forms a beautiful darkened carved inlet.
            mesh.position.set(0, 0, -depth * 0.8)

            container.add(mesh)
            group.add(container)
        }
    }
}

// ─── DECORATIVE GROOVES around a torus ring ───────────────────────────────────
function addRingGrooves(group: THREE.Group, RING_R: number, bw: number, M: THREE.Material): void {
    // Two parallel grooves near the edges of the band
    const groovePositions = [bw * 0.62, -bw * 0.62]
    groovePositions.forEach(z => {
        const groove = new THREE.Mesh(
            new THREE.TorusGeometry(RING_R, 0.007, 12, 120),
            new THREE.MeshPhysicalMaterial({ ...(M as THREE.MeshPhysicalMaterial), roughness: 0.9, metalness: 0.7 })
        )
        groove.position.z = z
        group.add(groove)
    })

    // Optional: milgrain beaded edge (tiny spheres)
    const beadCount = 80
    for (let b = 0; b < beadCount; b++) {
        const a = (b / beadCount) * Math.PI * 2
        const bead = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 6, 6),
            M
        )
        bead.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, bw * 0.70)
        group.add(bead)
        const bead2 = bead.clone()
        bead2.position.z = -bw * 0.70
        group.add(bead2)
    }
}

// ─── PRONG SYSTEM ─────────────────────────────────────────────────────────────
function addProngs(
    group: THREE.Group,
    count: number,
    sR: number,
    stoneY: number,
    M: THREE.Material,
    thickness = 0.022,
    height = 0.18
): void {
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const px = Math.cos(a) * sR * 0.90
        const pz = Math.sin(a) * sR * 0.90

        // Tapered prong body
        const prong = new THREE.Mesh(
            new THREE.CylinderGeometry(thickness * 0.5, thickness, height, 8),
            M
        )
        prong.position.set(px, stoneY + height * 0.3, pz)
        prong.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3)
        prong.castShadow = true
        group.add(prong)

        // Prong tip cap
        const cap = new THREE.Mesh(new THREE.SphereGeometry(thickness * 0.6, 8, 8), M)
        cap.position.set(px * 1.0, stoneY + height * 0.7, pz * 1.0)
        group.add(cap)
    }
}

// ─── RING ─────────────────────────────────────────────────────────────────────
function buildRing(p: DesignParams, M: THREE.Material, S: THREE.Material | null): THREE.Group {
    const group = new THREE.Group()
    const RING_R = 1.05
    const bw = Math.max(0.08, Math.min((p.band?.width ?? 2.5) / 20, 0.34))
    const bt = Math.max(0.6, Math.min(p.band?.thickness ?? 1.8, 3.0)) / 2.5
    // Auto-adjust stone size based on band width so it never looks disproportionately small
    let sR = Math.min((p.stones?.[0]?.size ?? 1.0) * 0.20 + 0.14, 0.54)
    sR = Math.max(sR, bw * 1.35)

    const pc = Math.max(0, Math.min(p.prongs?.count ?? 4, 8))
    const isMens = p.gender === 'mens'

    // ── BAND: tube cross-section profile using LatheGeometry approach ─────────
    // Use a proper comfort-fit cross-section (rounded inside, flat outside)
    const bandProfile = new THREE.Shape()
    const numPts = 32
    for (let i = 0; i <= numPts; i++) {
        const t = (i / numPts) * Math.PI * 2
        // Comfort-fit: inside is rounded (larger radius), outside is slightly flattened
        const outerR = bw
        const innerR = bw * 0.82
        const r = i < numPts / 2 ? outerR : innerR
        const x = r * Math.cos(t) * bt
        const y = r * Math.sin(t)
        if (i === 0) bandProfile.moveTo(x, y)
        else bandProfile.lineTo(x, y)
    }

    // Use TubeGeometry along a circular path for smooth, non-planar ring
    const ringPath = new THREE.CatmullRomCurve3(
        Array.from({ length: 64 }, (_, i) => {
            const a = (i / 64) * Math.PI * 2
            return new THREE.Vector3(RING_R * Math.cos(a), RING_R * Math.sin(a), 0)
        }),
        true
    )

    const bandGeo = new THREE.TubeGeometry(ringPath, 128, bw, 24, true)
    const band = new THREE.Mesh(bandGeo, M)
    band.castShadow = true
    band.receiveShadow = true
    group.add(band)

    // ── Decorative grooves ─────────────────────────────────────────────────────
    if (!isMens) {
        addRingGrooves(group, RING_R, bw, M)
    } else {
        // Mens: bold single center groove
        const groove = new THREE.Mesh(
            new THREE.TorusGeometry(RING_R, 0.011, 12, 120),
            new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(p.metal?.color ?? '#FFD700').multiplyScalar(0.7),
                metalness: 0.6, roughness: 0.9
            })
        )
        group.add(groove)
    }

    // ── Motifs on band ─────────────────────────────────────────────────────────
    if (p.motif) {
        addMotifsToBand(group, p.motif, RING_R, bw, M, isMens ? 14 : 10, Math.PI / 2, 0.5)
    }

    // ── Stone setting ──────────────────────────────────────────────────────────
    if (p.stones?.[0]) {
        const SY = RING_R + bw + sR * 0.30

        // Setting base (cathedral shoulders)
        if (p.setting?.type !== 'tension') {
            // Cathedral shoulders
            for (let side = -1; side <= 1; side += 2) {
                const shoulderPath = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(side * sR * 0.6, RING_R + bw * 0.3, 0),
                    new THREE.Vector3(side * sR * 0.4, RING_R + bw * 0.7, 0),
                    new THREE.Vector3(side * sR * 0.1, RING_R + bw + sR * 0.1, 0),
                ])
                const shoulderGeo = new THREE.TubeGeometry(shoulderPath, 12, 0.018, 8, false)
                group.add(new THREE.Mesh(shoulderGeo, M))
            }

            // Stone basket/seat
            const seatGeo = new THREE.CylinderGeometry(sR * 1.12, sR * 0.88, sR * 0.42, 48)
            const seat = new THREE.Mesh(seatGeo, M)
            seat.position.y = RING_R + bw + sR * 0.10
            group.add(seat)

            if (p.setting?.type === 'bezel') {
                const bezelGeo = new THREE.TorusGeometry(sR * 1.08, 0.040, 20, 64)
                const bezel = new THREE.Mesh(bezelGeo, M)
                bezel.position.y = RING_R + bw + sR * 0.35
                bezel.rotation.x = Math.PI / 2
                group.add(bezel)
            }
        }

        // Prongs
        if (p.setting?.type !== 'bezel' && p.setting?.type !== 'tension' && p.setting?.type !== 'flush' && pc > 0) {
            addProngs(group, pc, sR, SY, M, 0.022, sR * 0.55)
        }

        // Center stone
        if (S) {
            const gem = createGemMesh(S, sR, p.stones[0].cut, p.stones[0].type)
            gem.position.y = SY + sR * 0.18
            group.add(gem)
        }

        // Halo
        if (p.halo?.enabled && S) {
            const hc = Math.min(p.halo?.stoneCount ?? 16, 24)
            const hr = sR * 1.72
            for (let i = 0; i < hc; i++) {
                const a = (i / hc) * Math.PI * 2
                const hs = Math.max(0.040, (p.halo?.stoneSize ?? 0.025) * 5.5)
                const hStone = new THREE.Mesh(new THREE.OctahedronGeometry(1, 1), S)
                hStone.position.set(Math.cos(a) * hr, SY + 0.02, Math.sin(a) * hr)
                hStone.scale.setScalar(hs)
                hStone.castShadow = true
                group.add(hStone)
            }
            // Halo ring accent
            const haloRing = new THREE.Mesh(
                new THREE.TorusGeometry(sR * 1.72, 0.014, 10, 64),
                M
            )
            haloRing.position.y = SY + 0.02
            haloRing.rotation.x = Math.PI / 2
            group.add(haloRing)
        }
    }

    return group
}

// ─── NECKLACE ─────────────────────────────────────────────────────────────────
function buildNecklace(p: DesignParams, M: THREE.Material, S: THREE.Material | null): THREE.Group {
    const group = new THREE.Group()
    const isMens = p.gender === 'mens'
    const sR = Math.min((p.stones?.[0]?.size ?? 1.0) * 0.10 + 0.15, 0.28)
    const SW = 1.80, SH = 0.90
    const NL = 52
    const a = SW, b = SH * 1.5
    const totalNL = NL * 2
    const yMin = SH - SH * 1.5
    const BAIL_Y = yMin - 0.08
    const PEND_Y = BAIL_Y - 0.22 - sR * 1.20
    const PSZ = sR * 1.10
    const LT = isMens ? 0.025 : 0.012
    const LR = isMens ? 0.068 : 0.040

    // Chain with proper oval links
    for (let i = 0; i < totalNL; i++) {
        const t = (i / totalNL) * Math.PI * 2
        const x = a * Math.cos(t)
        const y = b * Math.sin(t) + SH
        const dx = -a * Math.sin(t)
        const dy = b * Math.cos(t)
        const angle = Math.atan2(dy, dx)
        const link = new THREE.Mesh(new THREE.TorusGeometry(LR, LT, 10, 28), M)
        link.position.set(x, y, 0)
        link.rotation.set(i % 2 === 0 ? Math.PI / 2 : 0, 0, angle)
        link.scale.x = isMens ? 1.1 : 1.5
        link.castShadow = true
        group.add(link)
    }

    if (!isMens) {
        // Bail
        const bail = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.015, 12, 30), M)
        bail.position.set(0, BAIL_Y + 0.02, 0)
        bail.rotation.x = Math.PI / 2
        bail.scale.set(0.6, 1.0, 0.6)
        group.add(bail)

        // Connector rod
        const rod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, Math.abs(BAIL_Y - PEND_Y) * 0.7, 10),
            M
        )
        rod.position.y = (BAIL_Y + PEND_Y) / 2 + 0.05
        group.add(rod)

        // Pendant frame with decorative wire work
        const frame = new THREE.Mesh(new THREE.TorusGeometry(PSZ * 1.05, 0.032, 6, 6), M)
        frame.position.y = PEND_Y
        frame.rotation.x = Math.PI / 2
        frame.castShadow = true
        group.add(frame)

        // Outer decorative ring
        const outerFrame = new THREE.Mesh(new THREE.TorusGeometry(PSZ * 1.32, 0.014, 10, 48), M)
        outerFrame.position.y = PEND_Y
        outerFrame.rotation.x = Math.PI / 2
        group.add(outerFrame)

        // 4 prong accents on pendant
        if (p.setting?.type !== 'bezel') {
            addProngs(group, 4, PSZ * 0.85, PEND_Y, M, 0.018, PSZ * 0.45)
        }

        // Stone
        if (p.stones?.[0] && S) {
            const gem = createGemMesh(S, PSZ * 0.82, p.stones[0].cut, p.stones[0].type)
            gem.position.set(0, PEND_Y, 0)
            gem.rotation.x = Math.PI / 2
            group.add(gem)
        }

        // Drop accent stones
        if (p.halo?.enabled && S) {
            const drops = [[-0.24, -0.20], [0, -0.22], [0.24, -0.20]]
            drops.forEach(([dx, dy]) => {
                const dropStone = createGemMesh(S, PSZ * 0.28, 'oval', p.stones?.[0]?.type)
                dropStone.position.set(dx, PEND_Y + dy, 0)
                group.add(dropStone)
                // Drop connector
                const wire = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.006, 0.006, 0.10, 6),
                    M
                )
                wire.position.set(dx, PEND_Y + dy + 0.08, 0)
                group.add(wire)
            })
        }
    }

    return group
}

// ─── EARRING ──────────────────────────────────────────────────────────────────
function buildEarring(p: DesignParams, M: THREE.Material, S: THREE.Material | null): THREE.Group {
    const group = new THREE.Group()
    const SPREAD = 0.55

    function buildSingleEarring(isRight: boolean): THREE.Group {
        const ear = new THREE.Group()
        const sR = Math.min((p.stones?.[0]?.size ?? 1.0) * 0.080 + 0.14, 0.24)
        const HOOK_R = 0.195
        const HOOK_TUBE = 0.014
        const POST_LEN = 0.38
        const CUP_TOP_Y = -POST_LEN
        const CUP_H = sR * 0.70
        const STONE_Y = CUP_TOP_Y - sR * 0.28
        const hookMirror = isRight ? -1 : 1

        // Hook with taper
        const hook = new THREE.Mesh(new THREE.TorusGeometry(HOOK_R, HOOK_TUBE, 14, 52, Math.PI * 1.18), M)
        hook.position.y = HOOK_R * 0.62
        hook.rotation.z = isRight ? Math.PI : 0
        ear.add(hook)

        // Hook tip ball
        const tip = new THREE.Mesh(new THREE.SphereGeometry(HOOK_TUBE * 2.0, 10, 10), M)
        tip.position.set(HOOK_R * hookMirror, HOOK_R * 0.62, 0)
        ear.add(tip)

        // Decorative groove on hook
        const hookGroove = new THREE.Mesh(
            new THREE.TorusGeometry(HOOK_R, 0.005, 6, 48, Math.PI * 1.0),
            new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.metal?.color ?? '#FFD700').multiplyScalar(0.8), metalness: 0.8, roughness: 0.8 })
        )
        hookGroove.position.y = HOOK_R * 0.62
        hookGroove.rotation.z = isRight ? Math.PI : 0
        ear.add(hookGroove)

        // Post
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.010, POST_LEN, 10), M)
        post.position.y = CUP_TOP_Y / 2
        ear.add(post)

        // Cup (tapered setting)
        const cup = new THREE.Mesh(
            new THREE.CylinderGeometry(sR * 1.08, sR * 0.35, CUP_H, 44, 1, true),
            M
        )
        cup.position.y = CUP_TOP_Y - CUP_H / 2
        cup.rotation.x = Math.PI / 2
        ear.add(cup)

        // Rim torus
        const rim = new THREE.Mesh(new THREE.TorusGeometry(sR * 1.08, 0.020, 14, 60), M)
        rim.position.y = CUP_TOP_Y
        rim.rotation.x = Math.PI / 2
        ear.add(rim)

        // Base plate
        const base = new THREE.Mesh(new THREE.TorusGeometry(sR * 0.36, 0.018, 10, 36), M)
        base.position.y = CUP_TOP_Y - CUP_H
        base.rotation.x = Math.PI / 2
        ear.add(base)

        // Prongs
        if (p.setting?.type !== 'bezel') {
            addProngs(ear, Math.min(p.prongs?.count ?? 4, 6), sR, STONE_Y, M, 0.016, sR * 0.50)
        }

        // Center stone
        if (p.stones?.[0] && S) {
            const gem = createGemMesh(S, sR, p.stones[0].cut, p.stones[0].type)
            gem.position.set(0, STONE_Y, sR * 0.22)
            ear.add(gem)
        }

        // Halo
        if (p.halo?.enabled && S) {
            const nH = Math.min(p.halo?.stoneCount ?? 12, 16)
            const hr = sR * 1.22
            for (let i = 0; i < nH; i++) {
                const a = (i / nH) * Math.PI * 2
                const hs = Math.max(0.022, (p.halo?.stoneSize ?? 0.022) * 3.5)
                const hStone = new THREE.Mesh(new THREE.OctahedronGeometry(1, 1), S)
                hStone.position.set(Math.cos(a) * hr, STONE_Y, Math.sin(a) * hr)
                hStone.scale.setScalar(hs)
                group.add(hStone)
            }
        }

        // Butterfly back
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.065), M)
        back.position.y = -(POST_LEN + 0.08)
        ear.add(back)
        const backHole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 10), M)
        backHole.position.y = -(POST_LEN + 0.08)
        ear.add(backHole)

        return ear
    }

    const leftEar = buildSingleEarring(false)
    leftEar.position.x = -SPREAD
    leftEar.name = 'leftEar'
    group.add(leftEar)

    const rightEar = buildSingleEarring(true)
    rightEar.position.x = SPREAD
    rightEar.name = 'rightEar'
    group.add(rightEar)

    return group
}

// ─── BRACELET ─────────────────────────────────────────────────────────────────
function buildBracelet(p: DesignParams, M: THREE.Material, S: THREE.Material | null): THREE.Group {
    const group = new THREE.Group()
    const BR = 1.65
    const bw = Math.max(0.14, Math.min((p.band?.width ?? 5.0) / 22, 0.32))
    const isCuff = p.band?.profile === 'flat'
    const torusArc = isCuff ? Math.PI * 1.52 : Math.PI * 2

    // Main band (tube geometry for proper 3D profile)
    const braceletPath = new THREE.CatmullRomCurve3(
        Array.from({ length: 80 }, (_, i) => {
            const a = (i / 80) * torusArc - (isCuff ? Math.PI * 0.76 : 0)
            return new THREE.Vector3(BR * Math.cos(a), 0, BR * Math.sin(a))
        }),
        !isCuff
    )
    const bandGeo = new THREE.TubeGeometry(braceletPath, 160, bw, 20, !isCuff)
    const band = new THREE.Mesh(bandGeo, M)
    band.castShadow = true
    band.receiveShadow = true
    group.add(band)

    // Edge grooves
    const edgeCount = 80
    for (let e = 0; e < edgeCount; e++) {
        const a = (e / edgeCount) * torusArc
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), M)
        bead.position.set(Math.cos(a) * BR, bw * 0.78, Math.sin(a) * BR)
        group.add(bead)
        const bead2 = bead.clone()
        bead2.position.y = -bw * 0.78
        group.add(bead2)
    }

    // Motifs on bracelet
    if (p.motif) {
        const mCount = 14
        const shape = buildMotifShape(p.motif, bw)
        const extrudeSettings = { depth: bw * 0.28, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 }

        for (let i = 0; i < mCount; i++) {
            const angle = (i / mCount) * torusArc
            if (isCuff && (angle < 0.3 || angle > torusArc - 0.3)) continue

            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
            const mesh = new THREE.Mesh(geo, M)
            mesh.castShadow = true

            const surfaceR = BR + bw * 0.55
            const container = new THREE.Group()
            container.position.set(Math.cos(angle) * surfaceR, 0, Math.sin(angle) * surfaceR)
            container.rotation.y = -angle + Math.PI / 2
            mesh.position.set(-bw * 0.4, -bw * 0.4, -bw * 0.12)
            mesh.scale.set(bw * 0.8, bw * 0.8, 1)
            container.add(mesh)
            group.add(container)
        }
    }

    // Main gemstone at top
    if (p.stones?.[0] && S) {
        const stonePos = BR + bw
        const gem = createGemMesh(S, bw * 0.85, p.stones[0].cut, p.stones[0].type)
        gem.position.set(stonePos, 0, 0)
        gem.rotation.z = -Math.PI / 2

        // Setting for bracelet stone
        const seatGeo = new THREE.CylinderGeometry(bw * 0.98, bw * 0.78, bw * 0.38, 40)
        const seat = new THREE.Mesh(seatGeo, M)
        seat.position.set(BR + bw * 0.25, 0, 0)
        seat.rotation.z = Math.PI / 2
        group.add(seat)

        addProngs(group, 4, bw * 0.80, 0, M, 0.022, bw * 0.5)
        group.add(gem)

        // Pave stones along top of bracelet
        if (p.halo?.enabled && S) {
            const pavCount = 12
            for (let i = -pavCount / 2; i <= pavCount / 2; i++) {
                if (Math.abs(i) < 1) continue
                const a = (i / pavCount) * Math.PI * 0.4
                const pStone = new THREE.Mesh(new THREE.OctahedronGeometry(1, 1), S)
                pStone.position.set(Math.cos(a) * (BR + bw * 0.5), 0, Math.sin(a) * (BR + bw * 0.5))
                pStone.scale.setScalar(bw * 0.22)
                group.add(pStone)
            }
        }
    }

    // Clasp
    const claspGeo = new THREE.BoxGeometry(bw * 2.4, bw * 1.2, bw * 1.6)
    const clasp = new THREE.Mesh(claspGeo, M)
    clasp.position.set(-BR, 0, 0)
    clasp.castShadow = true
    group.add(clasp)

    // Clasp hinge
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, bw * 1.2, 12), M)
    hinge.position.set(-BR + bw * 1.0, 0, 0)
    hinge.rotation.z = Math.PI / 2
    group.add(hinge)

    group.rotation.set(0.45, 0.20, 0)
    return group
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function getJewelryMesh(params: DesignParams): THREE.Group {
    const root = new THREE.Group()
    const M = getMetalMaterial(params)
    const S = getStoneMaterial(params.stones?.[0])
    const type = (params.type || 'ring').toLowerCase()

    let jewelry: THREE.Group
    if (type === 'necklace' || type === 'pendant') {
        jewelry = buildNecklace(params, M, S)
    } else if (type === 'earring' || type === 'earrings') {
        jewelry = buildEarring(params, M, S)
    } else if (type === 'bracelet' || type === 'bangle') {
        jewelry = buildBracelet(params, M, S)
    } else {
        jewelry = buildRing(params, M, S)
    }

    root.add(jewelry)
    return root
}