/**
 * Constraint validation for jewelry design parameters.
 * Returns advisory warnings (does not block changes).
 */

import { DesignParams } from '../store/useAppStore'

export interface ConstraintWarning {
    id: string
    severity: 'info' | 'warning' | 'critical'
    message: string
    field: string
    suggestion?: string
}

export function validateConstraints(params: DesignParams): ConstraintWarning[] {
    const warnings: ConstraintWarning[] = []

    // Band width check
    if (params.band.width < 1.0) {
        warnings.push({
            id: 'band-too-thin',
            severity: 'warning',
            message: `Band width ${params.band.width}mm is below 1.0mm minimum`,
            field: 'band.width',
            suggestion: 'Increase to at least 1.0mm for structural integrity',
        })
    }

    // Band thickness check
    if (params.band.thickness < 1.0) {
        warnings.push({
            id: 'band-too-thin-thickness',
            severity: 'warning',
            message: `Band thickness ${params.band.thickness}mm is very thin`,
            field: 'band.thickness',
            suggestion: 'Increase to at least 1.2mm to avoid deformation',
        })
    }

    // Prong thickness check
    if (params.prongs.count > 0 && params.prongs.thickness < 0.8) {
        warnings.push({
            id: 'prong-too-thin',
            severity: 'critical',
            message: `Prong thickness ${params.prongs.thickness}mm is below 0.8mm safe limit`,
            field: 'prongs.thickness',
            suggestion: 'Thicker prongs prevent stone loss. Increase to 0.8mm+',
        })
    }

    // Prong height vs stone size
    if (params.prongs.count > 0 && params.stones[0]) {
        const stoneSize = params.stones[0].size || 1.0
        if (params.prongs.height < stoneSize * 0.6) {
            warnings.push({
                id: 'prong-too-short',
                severity: 'warning',
                message: 'Prongs may not adequately secure the center stone',
                field: 'prongs.height',
                suggestion: `Increase prong height to at least ${(stoneSize * 0.6).toFixed(1)}mm`,
            })
        }
    }

    // Halo count validation
    if (params.halo.enabled && params.halo.stoneCount < 8) {
        warnings.push({
            id: 'halo-sparse',
            severity: 'info',
            message: 'Halo with fewer than 8 stones may appear sparse',
            field: 'halo.stoneCount',
            suggestion: 'Consider 12-24 stones for a full halo effect',
        })
    }

    // Band width vs halo enabled
    if (params.halo.enabled && params.band.width < 2.0) {
        warnings.push({
            id: 'halo-narrow-band',
            severity: 'info',
            message: 'Narrow band with halo may look disproportionate',
            field: 'band.width',
            suggestion: 'Consider widening band to 2.5mm+ for halo designs',
        })
    }

    // Extremely wide band warning
    if (params.band.width > 6.0) {
        warnings.push({
            id: 'band-too-wide',
            severity: 'info',
            message: 'Band width exceeds 6mm — may be uncomfortable',
            field: 'band.width',
            suggestion: 'Standard range is 2-5mm for daily wear',
        })
    }

    // Stone too large for setting
    if (params.stones[0] && params.stones[0].size > 3.0) {
        warnings.push({
            id: 'stone-oversized',
            severity: 'info',
            message: `${params.stones[0].size} carat stone is very large — ensure adequate setting support`,
            field: 'stones[0].size',
        })
    }

    return warnings
}

/**
 * Compute manufacture readiness score from params.
 * Returns 0-100 where 100 is fully manufacture-ready.
 */
export function computeManufactureScore(params: DesignParams): { score: number; breakdown: Record<string, number> } {
    let score = 95
    const breakdown: Record<string, number> = {
        geometry: 100,
        wallThickness: 100,
        prongIntegrity: 100,
        settingSafety: 100,
        overallComplexity: 100,
    }

    // Band thickness penalties (Precision refined)
    if (params.band.width < 1.2) { score -= 12; breakdown.wallThickness -= 25 }
    else if (params.band.width < 1.8) { score -= 6; breakdown.wallThickness -= 12 }

    if (params.band.thickness < 1.2) { score -= 10; breakdown.wallThickness -= 20 }

    // Prong integrity logic
    if (params.prongs.count > 0) {
        if (params.prongs.thickness < 0.8) { score -= 15; breakdown.prongIntegrity -= 30 }
        if (params.prongs.height < params.band.thickness * 0.5) { score -= 5; breakdown.prongIntegrity -= 15 }
        if (params.prongs.count < 3) { score -= 10; breakdown.prongIntegrity -= 25 } // unstable
    }

    // Complexity scaling (Nuanced)
    if (params.halo.enabled) {
        score -= 5; breakdown.overallComplexity -= 12
        if (params.halo.stoneCount > 24) { score -= 3; breakdown.overallComplexity -= 8 }
    }
    if (params.engraving?.enabled) { score -= 2; breakdown.overallComplexity -= 5 }
    if (params.motif) { score -= 7; breakdown.overallComplexity -= 15 }

    // Setting difficulty
    const settingDiff: Record<string, number> = {
        tension: 12, invisible: 15, pave: 8, bezel: 3, prong: 2
    }
    const diff = settingDiff[params.setting.type] || 0
    score -= diff
    breakdown.settingSafety -= diff * 2

    // Material machining difficulty
    if (params.metal.type === 'platinum') { score -= 3; breakdown.geometry -= 8 }
    if (params.metal.type === 'titanium') { score -= 8; breakdown.geometry -= 20 }

    return {
        score: Math.max(30, Math.min(100, score)),
        breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, Math.max(0, Math.min(100, v))])),
    }
}
