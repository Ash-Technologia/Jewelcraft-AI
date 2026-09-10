import { create } from 'zustand'
import { fetchMetalPrices, LivePrices } from '../api/metalPriceService'

export type Gender = 'womens' | 'mens' | 'unisex'
export type Page = 'generate' | 'designer' | 'export' | 'client'

export interface DesignParams {
    type?: string
    metal: { type: string; color: string; roughness: number; finish: string }
    band: { width: number; thickness: number; profile: string }
    stones: Array<{
        type: string;
        cut: string;
        size: number;
        color: string;
        transmission: number;
        ior: number;
        position?: 'center' | 'side' | 'halo' | 'pave';
        count?: number;
    }>
    halo: { enabled: boolean; stoneCount: number; stoneSize: number }
    prongs: { count: number; style: string; height: number; thickness: number }
    engraving: { enabled: boolean; text: string; font: string; depth: number }
    style_dna: { romance: number; boldness: number; modernity: number; luxury: number; complexity: number }
    setting: { type: string }
    gender?: Gender
    // Type-specific fields
    chainLength?: number
    chainType?: string
    earringDrop?: number
    braceletDiameter?: number
    signetShape?: 'round' | 'oval' | 'square' | 'cushion' | 'rectangular'
    chainStyle?: 'cable' | 'curb' | 'figaro' | 'rope' | 'box'
    cufflinkShape?: 'rectangular' | 'round' | 'oval'
    bailStyle?: 'hidden' | 'simple' | 'decorative' | 'v_bail'
    earringStyle?: 'stud' | 'drop' | 'hoop'
    braceletAccent?: 'none' | 'station' | 'pave_bar'
    motif?: string
    id?: string
    sectionCutAxis?: 'none' | 'x' | 'y' | 'z'
    sectionCutOffset?: number
}

export const DEFAULT_PARAMS: DesignParams = {
    type: 'ring',
    metal: { type: 'yellow_gold', color: '#FFD700', roughness: 0.15, finish: 'high_polish' },
    band: { width: 2.5, thickness: 1.8, profile: 'round' },
    stones: [{ type: 'diamond', cut: 'round_brilliant', size: 1.0, color: '#FFFFFF', transmission: 0.98, ior: 2.417 }],
    halo: { enabled: false, stoneCount: 16, stoneSize: 0.03 },
    prongs: { count: 4, style: 'round', height: 1.2, thickness: 0.9 },
    engraving: { enabled: false, text: '', font: 'serif', depth: 0.3 },
    style_dna: { romance: 0.6, boldness: 0.4, modernity: 0.5, luxury: 0.7, complexity: 0.4 },
    setting: { type: 'prong' },
    signetShape: 'oval',
    chainStyle: 'cable',
    cufflinkShape: 'rectangular',
    sectionCutAxis: 'none',
    sectionCutOffset: 0,
}

export interface Version {
    id: string
    timestamp: number
    label: string
    thumbnail: string
    params: DesignParams
    changeSummary: string
    priceEstimate: number
    manufactureScore: number
}

interface AppStore {
    gender: Gender
    setGender: (g: Gender) => void
    activePage: Page
    setActivePage: (p: Page) => void
    sessionId: string
    currentParams: DesignParams
    setCurrentParams: (p: DesignParams) => void
    versions: Version[]
    addVersion: (v: Version) => void
    activeVersionId: string | null
    setActiveVersionId: (id: string | null) => void
    budget: number
    setBudget: (b: number) => void
    uploadedImage: string | null
    setUploadedImage: (url: string | null) => void
    analysisData: unknown | null
    setAnalysisData: (d: unknown) => void
    selectedConceptIndex: number | null
    setSelectedConceptIndex: (i: number | null) => void
    concepts: unknown[]
    setConcepts: (c: unknown[]) => void
    isAnalyzing: boolean
    setIsAnalyzing: (v: boolean) => void
    isGenerating: boolean
    setIsGenerating: (v: boolean) => void
    isSandboxMode: boolean
    setSandboxMode: (v: boolean) => void
    hasDesignLoaded: boolean
    setHasDesignLoaded: (v: boolean) => void
    myDesigns: DesignParams[]
    addMyDesign: (p: DesignParams) => void
    removeMyDesign: (id: string) => void
    wishlist: string[]
    toggleWishlist: (id: string) => void
    liveMetalPrices: LivePrices | null
    isFetchingPrices: boolean
    fetchLivePrices: () => Promise<void>
    useLivePrices: boolean
    setUseLivePrices: (val: boolean) => void
    active3DModelUrl: string | null
    active3DObjUrl: string | null
    activePieceName: string | null
    colorMode: 'original' | 'recolored'
    setActive3DModel: (glbUrl: string | null, objUrl?: string | null, name?: string | null) => void
    setColorMode: (mode: 'original' | 'recolored') => void
}

export const useAppStore = create<AppStore>()((set) => ({
    gender: 'womens',
    setGender: (g) => set({ gender: g }),
    activePage: 'designer',
    setActivePage: (p) => set({ activePage: p }),
    sessionId: 'session-' + Date.now(),
    currentParams: DEFAULT_PARAMS,
    setCurrentParams: (p) => set({ currentParams: p, hasDesignLoaded: true }),
    versions: [],
    addVersion: (v) => set((state) => ({ versions: [...state.versions, v] })),
    activeVersionId: null,
    setActiveVersionId: (id) => set({ activeVersionId: id }),
    budget: 15000,
    setBudget: (b) => set({ budget: b }),
    uploadedImage: null,
    setUploadedImage: (url) => set({ uploadedImage: url }),
    analysisData: null,
    setAnalysisData: (d) => set({ analysisData: d }),
    selectedConceptIndex: null,
    setSelectedConceptIndex: (i) => set({ selectedConceptIndex: i }),
    concepts: [],
    setConcepts: (c) => set({ concepts: c }),
    isAnalyzing: false,
    setIsAnalyzing: (v) => set({ isAnalyzing: v }),
    isGenerating: false,
    setIsGenerating: (v) => set({ isGenerating: v }),
    isSandboxMode: false,
    setSandboxMode: (v) => set({ isSandboxMode: v }),
    hasDesignLoaded: false,
    setHasDesignLoaded: (v) => set({ hasDesignLoaded: v }),
    myDesigns: [],
    addMyDesign: (p) => set((state) => ({ myDesigns: [...state.myDesigns, p] })),
    removeMyDesign: (id) => set((state) => ({ myDesigns: state.myDesigns.filter((d: DesignParams) => d.id !== id) })),
    wishlist: [],
    toggleWishlist: (id) => set((state) => ({
        wishlist: state.wishlist.includes(id)
            ? state.wishlist.filter(w => w !== id)
            : [...state.wishlist, id]
    })),
    liveMetalPrices: null,
    isFetchingPrices: false,
    fetchLivePrices: async () => {
        set({ isFetchingPrices: true });
        const prices = await fetchMetalPrices();
        set({ liveMetalPrices: prices, isFetchingPrices: false });
    },
    useLivePrices: true,
    setUseLivePrices: (val) => set({ useLivePrices: val }),
    active3DModelUrl: null,
    active3DObjUrl: null,
    activePieceName: null,
    colorMode: 'original',
    setActive3DModel: (glbUrl, objUrl = null, name = null) => set({
        active3DModelUrl: glbUrl,
        active3DObjUrl: objUrl,
        activePieceName: name,
        hasDesignLoaded: Boolean(glbUrl)
    }),
    setColorMode: (mode) => set({ colorMode: mode }),
}))
