// Pricing service for jewelry cost estimation INES

// Metal prices per gram (approximate INR)
const METAL_PRICES: Record<string, number> = {
    yellow_gold: 5800,   // 18K gold
    rose_gold: 5800,
    white_gold: 6200,
    platinum: 3200,
    silver: 80,
    tungsten: 15,
    titanium: 35,
    stainless_steel: 8,
}

// Stone prices per carat (approximate INR)
const STONE_PRICES: Record<string, number> = {
    diamond: 350000,
    ruby: 280000,
    emerald: 200000,
    sapphire: 180000,
    moissanite: 25000,
    onyx: 2000,
    black_diamond: 150000,
    obsidian: 1500,
    dark_sapphire: 160000,
}

// Estimate metal weight from design params (grams)
function estimateMetalWeight(params: Record<string, unknown>): number {
    const band = params.band as Record<string, number> | undefined
    const width = band?.width || 2.5
    const thickness = band?.thickness || 1.8

    // Simplified ring weight formula
    // Average ring finger circumference ~60mm, density of gold ~19.3 g/cm³
    const circumference = 60 // mm
    const crossSection = width * thickness // mm²
    const volume = circumference * crossSection // mm³
    const volumeCm3 = volume / 1000

    // Gold density ~19.3, platinum ~21.45, silver ~10.49
    const metalType = (params.metal as Record<string, string>)?.type || 'yellow_gold'
    const densityMap: Record<string, number> = {
        yellow_gold: 15.5, rose_gold: 15.5, white_gold: 16.0,
        platinum: 21.45, silver: 10.49, tungsten: 19.25, titanium: 4.51,
    }
    const density = densityMap[metalType] || 15.5

    return volumeCm3 * density
}

// Calculate total price of a jewelry design
export function calculatePrice(params: Record<string, unknown>): number {
    const metalType = (params.metal as Record<string, string>)?.type || 'yellow_gold'
    const stones = (params.stones as Array<Record<string, unknown>>) || []
    const halo = params.halo as Record<string, unknown> | undefined

    // Metal cost
    const metalWeight = estimateMetalWeight(params)
    const metalPricePerGram = METAL_PRICES[metalType] || METAL_PRICES.yellow_gold
    const metalCost = metalWeight * metalPricePerGram

    // Stone cost
    let stoneCost = 0
    for (const stone of stones) {
        const stoneType = (stone.type as string) || 'diamond'
        const size = (stone.size as number) || (stone.estimated_carat as number) || 1.0
        const pricePerCarat = STONE_PRICES[stoneType] || STONE_PRICES.diamond
        stoneCost += pricePerCarat * size
    }

    // Halo stone cost
    if (halo?.enabled) {
        const haloCount = (halo.stoneCount as number) || 16
        const haloSize = (halo.stoneSize as number) || 0.03
        stoneCost += haloCount * haloSize * (STONE_PRICES.diamond * 0.7) // smaller stones are cheaper per carat
    }

    // Labor cost (simplified)
    const laborCost = 8000 + metalWeight * 500

    // Total
    const total = Math.round(metalCost + stoneCost + laborCost)
    return total
}

// Generate a detailed cost breakdown
export function getCostBreakdown(params: Record<string, unknown>) {
    const metalType = (params.metal as Record<string, string>)?.type || 'yellow_gold'
    const stones = (params.stones as Array<Record<string, unknown>>) || []
    const halo = params.halo as Record<string, unknown> | undefined
    const metalWeight = estimateMetalWeight(params)
    const metalPricePerGram = METAL_PRICES[metalType] || METAL_PRICES.yellow_gold

    const metalCost = Math.round(metalWeight * metalPricePerGram)

    let stoneCost = 0
    const stoneDetails = stones.map((s) => {
        const type = (s.type as string) || 'diamond'
        const size = (s.size as number) || 1.0
        const price = Math.round((STONE_PRICES[type] || STONE_PRICES.diamond) * size)
        stoneCost += price
        return { type, cut: s.cut, size, price }
    })

    let haloCost = 0
    if (halo?.enabled) {
        const count = (halo.stoneCount as number) || 16
        const size = (halo.stoneSize as number) || 0.03
        haloCost = Math.round(count * size * STONE_PRICES.diamond * 0.7)
        stoneCost += haloCost
    }

    const laborCost = Math.round(8000 + metalWeight * 500)
    const total = metalCost + stoneCost + laborCost

    return {
        metal: { type: metalType, weightGrams: Math.round(metalWeight * 100) / 100, pricePerGram: metalPricePerGram, cost: metalCost },
        stones: stoneDetails,
        halo: halo?.enabled ? { count: (halo.stoneCount as number), totalCarats: (halo.stoneCount as number) * (halo.stoneSize as number), cost: haloCost } : null,
        labor: laborCost,
        total,
    }
}
