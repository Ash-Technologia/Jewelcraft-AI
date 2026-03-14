import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import toast from 'react-hot-toast'

interface ShortcutMap {
    [key: string]: () => void
}

export function useKeyboardShortcuts() {
    const navigate = useNavigate()
    const { versions, setCurrentParams } = useAppStore()

    useEffect(() => {
        const shortcuts: ShortcutMap = {
            // Navigation
            'g': () => navigate('/generate'),
            'd': () => navigate('/designer'),
            'c': () => navigate('/catalog'),
            'e': () => navigate('/export'),
            'a': () => navigate('/ar-tryon'),

            // Version undo (Ctrl/Cmd+Z)
            'ctrl+z': () => {
                const prev = versions[versions.length - 2]
                if (prev) {
                    setCurrentParams(prev.params)
                    toast.success(`Restored: ${prev.label}`)
                } else {
                    toast.error('Nothing to undo')
                }
            },

            // Help overlay
            '?': () => {
                const help = [
                    'G → Generate  |  D → Designer  |  C → Catalog',
                    'E → Export    |  A → AR Try-On',
                    'Ctrl+Z → Undo version',
                    '? → Show shortcuts',
                ].join('\n')
                toast(help, { icon: '⌨️', duration: 4000, style: { fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre' } })
            },
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't fire shortcuts in input fields
            const tag = (e.target as HTMLElement).tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

            const key = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.key.toLowerCase()}`
            if (shortcuts[key]) {
                e.preventDefault()
                shortcuts[key]()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [navigate, versions, setCurrentParams])
}
