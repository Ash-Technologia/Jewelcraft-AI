/**
 * Blender CLI runner — executes Blender in headless mode to generate jewelry models.
 */

import { exec } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface GenerateParams {
    jewelry_type: string // ring, bracelet, pendant, chain, earring, cufflink
    metal: { type: string; color: string; roughness: number }
    stones: Array<{ type: string; color: string; size: number; ior: number; transmission: number }>
    band: { width: number; thickness: number; profile: string }
    prongs: { count: number; thickness: number; height: number }
    setting: { type: string }
    halo: { enabled: boolean; stoneCount: number; stoneSize: number }
    engraving: { enabled: boolean; text: string; font: string; depth: number }
    pattern_texture_path?: string
    pattern_intensity?: number
    style_dna: Record<string, number>
}

interface GenerateResult {
    success: boolean
    outputPath: string
    format: string
    error?: string
    duration: number
}

const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/generate_jewelry.py')
const OUTPUT_DIR = path.resolve(__dirname, '../../output')

export async function generateWithBlender(
    params: GenerateParams,
    outputFormat: 'glb' | 'stl' | 'fbx' = 'glb'
): Promise<GenerateResult> {
    const startTime = Date.now()
    const jobId = uuid()
    const paramsPath = path.join(OUTPUT_DIR, `${jobId}_params.json`)
    const outputPath = path.join(OUTPUT_DIR, `${jobId}.${outputFormat}`)

    try {
        // Write params to temp JSON
        await writeFile(paramsPath, JSON.stringify(params, null, 2))

        // Execute Blender
        const blenderCmd = `blender --background --python "${SCRIPT_PATH}" -- --params "${paramsPath}" --output "${outputPath}"`

        await new Promise<void>((resolve, reject) => {
            const proc = exec(blenderCmd, { timeout: 120_000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Blender] Error:', stderr)
                    reject(new Error(`Blender failed: ${error.message}`))
                } else {
                    console.log('[Blender] Output:', stdout)
                    resolve()
                }
            })
            proc.stdout?.on('data', (data) => console.log('[Blender]', data.toString().trim()))
        })

        // Cleanup params file
        await unlink(paramsPath).catch(() => { /* ignore */ })

        return {
            success: true,
            outputPath,
            format: outputFormat,
            duration: Date.now() - startTime,
        }
    } catch (err) {
        // Cleanup
        await unlink(paramsPath).catch(() => { /* ignore */ })

        return {
            success: false,
            outputPath: '',
            format: outputFormat,
            error: err instanceof Error ? err.message : 'Unknown error',
            duration: Date.now() - startTime,
        }
    }
}
