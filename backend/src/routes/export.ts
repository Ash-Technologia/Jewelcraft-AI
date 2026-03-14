import { Router, Request, Response } from 'express'
import { calculatePrice, getCostBreakdown } from '../services/pricing.js'
import { generateWithBlender } from '../services/blender.js'
import { createReadStream, existsSync } from 'fs'

const router = Router()

// POST /api/export/glb — Export GLB via Blender
router.post('/glb', async (req: Request, res: Response) => {
    const { params } = req.body
    if (!params) return res.status(400).json({ error: 'params required' })

    try {
        const result = await generateWithBlender(params, 'glb')
        if (result.success && existsSync(result.outputPath)) {
            res.setHeader('Content-Type', 'model/gltf-binary')
            res.setHeader('Content-Disposition', 'attachment; filename="jewelry.glb"')
            createReadStream(result.outputPath).pipe(res)
        } else {
            // Fall back to client-side
            res.json({
                success: true,
                method: 'client-side',
                message: 'Blender unavailable — use Three.js GLTFExporter on the client',
                error: result.error,
            })
        }
    } catch {
        res.json({ success: true, method: 'client-side', message: 'Use Three.js GLTFExporter' })
    }
})

// POST /api/export/stl — Export STL via Blender
router.post('/stl', async (req: Request, res: Response) => {
    const { params } = req.body
    if (!params) return res.status(400).json({ error: 'params required' })

    try {
        const result = await generateWithBlender(params, 'stl')
        if (result.success && existsSync(result.outputPath)) {
            res.setHeader('Content-Type', 'application/sla')
            res.setHeader('Content-Disposition', 'attachment; filename="jewelry.stl"')
            createReadStream(result.outputPath).pipe(res)
        } else {
            res.json({ success: true, method: 'client-side', message: 'Use Three.js STLExporter', error: result.error })
        }
    } catch {
        res.json({ success: true, method: 'client-side', message: 'Use Three.js STLExporter' })
    }
})

// POST /api/export/pdf — Generate specs PDF
router.post('/pdf', async (req: Request, res: Response) => {
    const { params, designName = 'JewelCraft Design' } = req.body
    if (!params) return res.status(400).json({ error: 'params required' })

    try {
        const { default: PDFDocument } = await import('pdfkit')
        const breakdown = getCostBreakdown(params)

        const doc = new PDFDocument({ size: 'A4', margin: 50 })
        const buffers: Buffer[] = []

        doc.on('data', (chunk: Buffer) => buffers.push(chunk))
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers)
            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', `attachment; filename="${designName}.pdf"`)
            res.send(pdfBuffer)
        })

        // Title
        doc.fontSize(28).fillColor('#C9A84C').text('JewelCraft AI', { align: 'center' })
        doc.fontSize(12).fillColor('#888888').text('Design Specification Sheet', { align: 'center' })
        doc.moveDown(2)

        // Design name
        doc.fontSize(20).fillColor('#FFFFFF').text(designName)
        doc.moveDown()

        // Metal specs
        doc.fontSize(14).fillColor('#C9A84C').text('Metal Specifications')
        doc.fontSize(11).fillColor('#CCCCCC')
        doc.text(`Type: ${breakdown.metal.type.replace(/_/g, ' ')}`)
        doc.text(`Weight: ${breakdown.metal.weightGrams}g`)
        doc.text(`Finish: ${(params.metal as Record<string, string>)?.finish || 'high_polish'}`)
        doc.text(`Cost: ₹${breakdown.metal.cost.toLocaleString()}`)
        doc.moveDown()

        // Stone specs
        doc.fontSize(14).fillColor('#C9A84C').text('Stone Specifications')
        doc.fontSize(11).fillColor('#CCCCCC')
        for (const stone of breakdown.stones) {
            doc.text(`${stone.type} — ${stone.cut || 'round_brilliant'} cut — ${stone.size} carat — ₹${stone.price.toLocaleString()}`)
        }
        if (breakdown.halo) {
            doc.text(`Halo: ${breakdown.halo.count} stones, ${breakdown.halo.totalCarats.toFixed(2)} ct total — ₹${breakdown.halo.cost.toLocaleString()}`)
        }
        doc.moveDown()

        // Band specs
        const band = params.band as Record<string, unknown> | undefined
        doc.fontSize(14).fillColor('#C9A84C').text('Band Specifications')
        doc.fontSize(11).fillColor('#CCCCCC')
        doc.text(`Width: ${band?.width || 2.5}mm`)
        doc.text(`Thickness: ${band?.thickness || 1.8}mm`)
        doc.text(`Profile: ${band?.profile || 'round'}`)
        doc.moveDown()

        // Price summary
        doc.fontSize(14).fillColor('#C9A84C').text('Cost Summary')
        doc.fontSize(11).fillColor('#CCCCCC')
        doc.text(`Metal: ₹${breakdown.metal.cost.toLocaleString()}`)
        doc.text(`Stones: ₹${breakdown.stones.reduce((s, st) => s + st.price, 0).toLocaleString()}`)
        if (breakdown.halo) doc.text(`Halo: ₹${breakdown.halo.cost.toLocaleString()}`)
        doc.text(`Labor: ₹${breakdown.labor.toLocaleString()}`)
        doc.moveDown()
        doc.fontSize(16).fillColor('#C9A84C').text(`Total Estimated Price: ₹${breakdown.total.toLocaleString()}`)

        // Footer
        doc.moveDown(3)
        doc.fontSize(9).fillColor('#666666').text('Generated by JewelCraft AI — This is an estimate only', { align: 'center' })

        doc.end()
    } catch (error) {
        console.error('[Export PDF] Error:', error)
        res.status(500).json({ error: 'PDF generation failed' })
    }
})

// POST /api/export/csv — Generate gemstone CSV
router.post('/csv', (req: Request, res: Response) => {
    const { params } = req.body
    if (!params) return res.status(400).json({ error: 'params required' })

    const breakdown = getCostBreakdown(params)
    const lines = ['Stone_ID,Type,Cut,Estimated_Carat,Color_Grade,Quantity,Unit_Cost_INR,Total_Cost_INR']

    breakdown.stones.forEach((stone, i) => {
        lines.push(`S${String(i + 1).padStart(3, '0')},${stone.type},${stone.cut || 'round_brilliant'},${stone.size},G,1,${stone.price},${stone.price}`)
    })

    if (breakdown.halo) {
        lines.push(`HALO,diamond,round_brilliant,${(breakdown.halo.totalCarats).toFixed(3)},G/H,${breakdown.halo.count},${Math.round(breakdown.halo.cost / breakdown.halo.count)},${breakdown.halo.cost}`)
    }

    const totalCost = breakdown.stones.reduce((s, st) => s + st.price, 0) + (breakdown.halo?.cost || 0)
    lines.push(`,,,,TOTAL,,, ${totalCost}`)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="gemstone_specs.csv"')
    res.send(lines.join('\n'))
})

// POST /api/export/xlsx — Generate cost breakdown Excel
router.post('/xlsx', async (req: Request, res: Response) => {
    const { params } = req.body
    if (!params) return res.status(400).json({ error: 'params required' })

    try {
        const ExcelJS = await import('exceljs')
        const breakdown = getCostBreakdown(params)
        const price = calculatePrice(params)

        const workbook = new ExcelJS.default.Workbook()

        // Tab 1: Summary
        const summary = workbook.addWorksheet('Summary')
        summary.columns = [{ header: 'Item', key: 'item', width: 25 }, { header: 'Cost (₹)', key: 'cost', width: 15 }]
        summary.addRow({ item: 'Metal', cost: breakdown.metal.cost })
        summary.addRow({ item: 'Stones', cost: breakdown.stones.reduce((s, st) => s + st.price, 0) })
        if (breakdown.halo) summary.addRow({ item: 'Halo', cost: breakdown.halo.cost })
        summary.addRow({ item: 'Labor', cost: breakdown.labor })
        summary.addRow({ item: 'TOTAL', cost: price })

        // Tab 2: Materials
        const materials = workbook.addWorksheet('Materials')
        materials.columns = [
            { header: 'Material', key: 'material', width: 20 },
            { header: 'Weight (g)', key: 'weight', width: 12 },
            { header: '₹/gram', key: 'pricePerGram', width: 12 },
            { header: 'Total ₹', key: 'total', width: 15 },
        ]
        materials.addRow({ material: breakdown.metal.type, weight: breakdown.metal.weightGrams, pricePerGram: breakdown.metal.pricePerGram, total: breakdown.metal.cost })

        // Tab 3: Stones
        const stonesSheet = workbook.addWorksheet('Stones')
        stonesSheet.columns = [
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Cut', key: 'cut', width: 18 },
            { header: 'Carats', key: 'size', width: 10 },
            { header: 'Cost ₹', key: 'price', width: 15 },
        ]
        for (const stone of breakdown.stones) {
            stonesSheet.addRow(stone)
        }

        // Tab 4: Labor
        const labor = workbook.addWorksheet('Labor')
        labor.columns = [{ header: 'Component', key: 'comp', width: 25 }, { header: 'Cost ₹', key: 'cost', width: 15 }]
        labor.addRow({ comp: 'Casting & Assembly', cost: Math.round(breakdown.labor * 0.4) })
        labor.addRow({ comp: 'Stone Setting', cost: Math.round(breakdown.labor * 0.35) })
        labor.addRow({ comp: 'Finishing & Polish', cost: Math.round(breakdown.labor * 0.25) })

        // Tab 5: Comparison (same design in different materials)
        const comparison = workbook.addWorksheet('Comparison')
        comparison.columns = [
            { header: 'Variant', key: 'variant', width: 20 },
            { header: 'Metal Cost ₹', key: 'metalCost', width: 15 },
            { header: 'Total ₹', key: 'total', width: 15 },
        ]
        const variants = ['yellow_gold', 'rose_gold', 'white_gold', 'platinum', 'silver']
        for (const v of variants) {
            const varParams = JSON.parse(JSON.stringify(params))
                ; (varParams.metal as Record<string, string>).type = v
            const varPrice = calculatePrice(varParams)
            const varBreakdown = getCostBreakdown(varParams)
            comparison.addRow({ variant: v.replace(/_/g, ' '), metalCost: varBreakdown.metal.cost, total: varPrice })
        }

        const buffer = await workbook.xlsx.writeBuffer()
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', 'attachment; filename="cost_breakdown.xlsx"')
        res.send(Buffer.from(buffer as ArrayBuffer))
    } catch (error) {
        console.error('[Export XLSX] Error:', error)
        res.status(500).json({ error: 'XLSX generation failed' })
    }
})

// POST /api/export/package — Download all exports as ZIP
router.post('/package', async (req: Request, res: Response) => {
    const { params, designName = 'JewelCraft Design' } = req.body
    if (!params) return res.status(400).json({ error: 'params required' })

    try {
        const archiver = await import('archiver')
        const archive = archiver.default('zip', { zlib: { level: 9 } })

        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${designName}.zip"`)
        archive.pipe(res)

        // Add CSV
        const breakdown = getCostBreakdown(params)
        const csvLines = ['Stone_ID,Type,Cut,Estimated_Carat,Color_Grade,Quantity,Unit_Cost_INR,Total_Cost_INR']
        breakdown.stones.forEach((stone, i) => {
            csvLines.push(`S${String(i + 1).padStart(3, '0')},${stone.type},${stone.cut || 'round_brilliant'},${stone.size},G,1,${stone.price},${stone.price}`)
        })
        archive.append(csvLines.join('\n'), { name: 'gemstone_specs.csv' })

        // Add a README
        archive.append(`JewelCraft AI Export Package\n\nDesign: ${designName}\nTotal Price: ₹${calculatePrice(params).toLocaleString()}\n\nContents:\n- gemstone_specs.csv\n- Open the app to export GLB/STL/PDF individually\n`, { name: 'README.txt' })

        await archive.finalize()
    } catch (error) {
        console.error('[Export Package] Error:', error)
        res.status(500).json({ error: 'Package generation failed' })
    }
})

export { router as exportRouter }
