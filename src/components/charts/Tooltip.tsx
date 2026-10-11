import { useState, type ReactNode } from 'react'

export interface TipState {
  x: number
  y: number
  content: ReactNode
}

export function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = (e: { clientX: number; clientY: number }, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content })
  const hide = () => setTip(null)
  const node = tip ? (
    <div className="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 280), top: tip.y + 14 }}>
      {tip.content}
    </div>
  ) : null
  return { show, hide, node }
}
