import { useEffect, useRef } from 'react'
import './ParticleBackground.css'

export default function ParticleBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')!
        let animId: number

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()
        window.addEventListener('resize', resize)

        const particles = Array.from({ length: 60 }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: Math.random() * 1.5 + 0.5,
            speed: Math.random() * 0.4 + 0.1,
            opacity: Math.random() * 0.25 + 0.05,
            drift: (Math.random() - 0.5) * 0.3,
        }))

        function draw() {
            ctx.clearRect(0, 0, canvas!.width, canvas!.height)
            particles.forEach((p) => {
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(201, 168, 76, ${p.opacity})`
                ctx.fill()
                p.y -= p.speed
                p.x += p.drift
                if (p.y < -10) { p.y = canvas!.height + 10; p.x = Math.random() * canvas!.width }
                if (p.x < -10) p.x = canvas!.width + 10
                if (p.x > canvas!.width + 10) p.x = -10
            })
            animId = requestAnimationFrame(draw)
        }
        draw()

        return () => {
            cancelAnimationFrame(animId)
            window.removeEventListener('resize', resize)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="pb-canvas"
        />
    )
}
