import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { analyzeRouter } from './routes/analyze.js'
import { generateRouter } from './routes/generate.js'
import { agentRouter } from './routes/agent.js'
import { exportRouter } from './routes/export.js'

const app = express()
const PORT = process.env.PORT || 3001

// ── CORS — allow any localhost:PORT (covers Vite's :5173, :5174, :5175 ...) ──
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true)  // curl / same-origin / SSR
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true)
        cb(new Error(`CORS blocked: ${origin}`))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}))
app.options('*', cors())  // respond 200 to ALL preflight OPTIONS requests

app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static('uploads'))

// ── HTTP + WebSocket ───────────────────────────────────────────────────────────
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })
const clients = new Set<WebSocket>()

wss.on('connection', (ws) => {
    clients.add(ws)
    console.log(`[WS] Client connected (${clients.size} total)`)
    ws.on('close', () => { clients.delete(ws); console.log(`[WS] Disconnected (${clients.size} total)`) })
    ws.on('error', (e) => { console.error('[WS]', e.message); clients.delete(ws) })
})

export function broadcast(event: string, data: unknown) {
    const msg = JSON.stringify({ event, data })
    for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(msg)
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/analyze', analyzeRouter)
app.use('/api/generate', generateRouter)
app.use('/api/agent', agentRouter)
app.use('/api/export', exportRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: Date.now() }))

server.listen(PORT, () => {
    console.log(`\n  🔷 JewelCraft AI Backend`)
    console.log(`  ├─ REST API:   http://localhost:${PORT}/api`)
    console.log(`  ├─ WebSocket:  ws://localhost:${PORT}/ws`)
    console.log(`  └─ Health:     http://localhost:${PORT}/api/health\n`)
})