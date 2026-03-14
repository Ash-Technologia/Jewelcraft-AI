/**
 * Pattern library for jewelry surface designs.
 * Each pattern has a normal map texture for surface embossing.
 */

export interface JewelryPattern {
    id: string
    name: string
    category: 'traditional' | 'modern' | 'nature' | 'geometric' | 'cultural'
    normalMapUrl: string
    thumbnailUrl: string
    description: string
    tags: string[]
    compatibleTypes: ('ring' | 'bracelet' | 'pendant' | 'chain' | 'earring' | 'cufflink')[]
    intensity: number
}

export const JEWELRY_PATTERNS: JewelryPattern[] = [
    {
        id: 'peacock', name: 'Peacock Feather', category: 'nature',
        normalMapUrl: '/textures/patterns/peacock_feather_normal.png',
        thumbnailUrl: '/textures/patterns/peacock_feather_normal.png',
        description: 'Intricate peacock feather motif inspired by royal Indian jewelry',
        tags: ['peacock', 'feather', 'indian', 'royal', 'ornate'],
        compatibleTypes: ['ring', 'bracelet', 'pendant', 'earring'], intensity: 0.6,
    },
    {
        id: 'filigree', name: 'Filigree Scrollwork', category: 'traditional',
        normalMapUrl: '/textures/patterns/filigree.png',
        thumbnailUrl: '/textures/patterns/filigree.png',
        description: 'Ornate Indian filigree with floral vine motifs',
        tags: ['filigree', 'scrollwork', 'floral', 'vine', 'classic'],
        compatibleTypes: ['ring', 'bracelet', 'pendant', 'chain', 'earring', 'cufflink'], intensity: 0.5,
    },
    {
        id: 'filigree_arabesque', name: 'Arabesque Filigree', category: 'traditional',
        normalMapUrl: '/textures/patterns/filigree_arabesque_normal.png',
        thumbnailUrl: '/textures/patterns/filigree_arabesque_normal.png',
        description: 'Islamic-inspired arabesque pattern with interlocking geometry',
        tags: ['arabesque', 'filigree', 'islamic', 'geometric', 'ornate'],
        compatibleTypes: ['ring', 'bracelet', 'pendant', 'earring', 'cufflink'], intensity: 0.55,
    },
    {
        id: 'lotus', name: 'Lotus Mandala', category: 'cultural',
        normalMapUrl: '/textures/patterns/lotus.png',
        thumbnailUrl: '/textures/patterns/lotus.png',
        description: 'Sacred lotus flower mandala with geometric petals',
        tags: ['lotus', 'mandala', 'geometric', 'spiritual', 'symmetry'],
        compatibleTypes: ['ring', 'bracelet', 'pendant'], intensity: 0.55,
    },
    {
        id: 'floral_vine', name: 'Floral Vine', category: 'nature',
        normalMapUrl: '/textures/patterns/floral_vine_normal.png',
        thumbnailUrl: '/textures/patterns/floral_vine_normal.png',
        description: 'Delicate intertwining vine with floral blossoms',
        tags: ['floral', 'vine', 'nature', 'delicate', 'romantic'],
        compatibleTypes: ['ring', 'bracelet', 'pendant', 'earring'], intensity: 0.45,
    },
    {
        id: 'chevron', name: 'Chevron Engraved', category: 'geometric',
        normalMapUrl: '/textures/patterns/chevron_engraved_normal.png',
        thumbnailUrl: '/textures/patterns/chevron_engraved_normal.png',
        description: 'Bold V-shaped chevron pattern — modern and geometric',
        tags: ['chevron', 'geometric', 'modern', 'bold', 'mens', 'engraved'],
        compatibleTypes: ['ring', 'bracelet', 'chain', 'cufflink'], intensity: 0.5,
    },
    {
        id: 'hammered', name: 'Hammered Texture', category: 'modern',
        normalMapUrl: '/textures/patterns/hammered_texture_normal.png',
        thumbnailUrl: '/textures/patterns/hammered_texture_normal.png',
        description: 'Hand-hammered artisan finish for rustic luxury',
        tags: ['hammered', 'rustic', 'artisan', 'textured', 'modern', 'mens'],
        compatibleTypes: ['ring', 'bracelet', 'pendant', 'cufflink'], intensity: 0.35,
    },
    {
        id: 'celtic', name: 'Celtic Knot', category: 'cultural',
        normalMapUrl: '/textures/patterns/filigree_arabesque_normal.png',
        thumbnailUrl: '/textures/patterns/filigree_arabesque_normal.png',
        description: 'Interlocking Celtic knot pattern symbolizing eternity',
        tags: ['celtic', 'knot', 'interlock', 'eternal', 'irish', 'mens'],
        compatibleTypes: ['ring', 'bracelet', 'cufflink'], intensity: 0.7,
    },
    {
        id: 'paisley', name: 'Paisley', category: 'traditional',
        normalMapUrl: '/textures/patterns/peacock_feather_normal.png',
        thumbnailUrl: '/textures/patterns/peacock_feather_normal.png',
        description: 'Classic paisley motif — a staple in Indian jewelry design',
        tags: ['paisley', 'indian', 'traditional', 'mango', 'ambi'],
        compatibleTypes: ['ring', 'bracelet', 'pendant', 'earring'], intensity: 0.5,
    },
    {
        id: 'minimal_lines', name: 'Minimal Lines', category: 'modern',
        normalMapUrl: '/textures/patterns/chevron_engraved_normal.png',
        thumbnailUrl: '/textures/patterns/chevron_engraved_normal.png',
        description: 'Clean parallel lines for contemporary minimalist look',
        tags: ['minimal', 'lines', 'modern', 'clean', 'contemporary', 'mens'],
        compatibleTypes: ['ring', 'bracelet', 'cufflink'], intensity: 0.25,
    },
    {
        id: 'dragon', name: 'Dragon Scale', category: 'nature',
        normalMapUrl: '/textures/patterns/hammered_texture_normal.png',
        thumbnailUrl: '/textures/patterns/hammered_texture_normal.png',
        description: 'Scaled dragon texture for bold statement pieces',
        tags: ['dragon', 'scale', 'bold', 'fantasy', 'mens'],
        compatibleTypes: ['ring', 'bracelet', 'chain', 'cufflink'], intensity: 0.65,
    },
]

export const MENS_PATTERNS = JEWELRY_PATTERNS.filter(p =>
    p.tags.some(t => ['bold', 'rustic', 'mens', 'dragon', 'celtic', 'hammered', 'minimal', 'chevron'].includes(t))
)

export function getPatternsForType(type: string): JewelryPattern[] {
    return JEWELRY_PATTERNS.filter(p => p.compatibleTypes.includes(type as JewelryPattern['compatibleTypes'][0]))
}

export function searchPatterns(query: string): JewelryPattern[] {
    const q = query.toLowerCase()
    return JEWELRY_PATTERNS.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q)) ||
        p.description.toLowerCase().includes(q)
    )
}

/** HDRI environment maps for realistic reflections */
export const HDRI_PRESETS = [
    { id: 'studio', name: 'Studio Small', path: '/textures/hdri/studio_small_09.hdr' },
    { id: 'loft', name: 'Photo Studio Loft', path: '/textures/hdri/photo_studio_loft_hall.hdr' },
]

/** Blender template scripts per jewelry type */
export const BLENDER_TEMPLATES: Record<string, string> = {
    ring: '/textures/blender/ring_template.py',
    bracelet: '/textures/blender/bracelet_template.py',
    chain: '/textures/blender/chain_template.py',
    pendant: '/textures/blender/pendant_template.py',
}
