// Touch gestures for list rows on phones: horizontal swipe reveals an action, a long press selects.
import { useRef, useState } from 'react'

export interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
  onClickCapture: (e: React.MouseEvent) => void
}

/**
 * dx > 0 = the row moves right (finger swiping right). Fires `onRight` / `onLeft` when released past
 * 30 % of the row width (at least 80 px); `onLong` after holding still for 500 ms.
 */
export function useSwipe(opts: { enabled: boolean; onLeft?: () => void; onRight?: () => void; onLong?: () => void }): { dx: number; armed: boolean; handlers: SwipeHandlers | Record<string, never> } {
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; id: number; w: number; horizontal: boolean | null } | null>(null)
  const long = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swallowClick = useRef(false)
  const threshold = () => Math.max(80, (start.current?.w || 300) * 0.3)
  const clearLong = () => {
    if (long.current) clearTimeout(long.current)
    long.current = null
  }
  const reset = () => {
    clearLong()
    start.current = null
    setDx(0)
  }
  if (!opts.enabled) return { dx: 0, armed: false, handlers: {} }
  return {
    dx,
    armed: Math.abs(dx) >= threshold(),
    handlers: {
      onPointerDown(e) {
        if (e.pointerType === 'mouse') return
        swallowClick.current = false
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, w: (e.currentTarget as HTMLElement).offsetWidth, horizontal: null }
        clearLong()
        if (opts.onLong) long.current = setTimeout(() => {
          swallowClick.current = true
          if (navigator.vibrate) navigator.vibrate(10)
          opts.onLong?.()
          reset()
        }, 500)
      },
      onPointerMove(e) {
        const s = start.current
        if (!s || e.pointerId !== s.id) return
        const mx = e.clientX - s.x
        const my = e.clientY - s.y
        if (Math.abs(mx) > 8 || Math.abs(my) > 8) clearLong()
        if (s.horizontal === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) {
          s.horizontal = Math.abs(mx) > Math.abs(my) * 1.3
          if (s.horizontal) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }
        if (!s.horizontal) return
        const allowed = (mx > 0 && opts.onRight) || (mx < 0 && opts.onLeft)
        setDx(allowed ? mx : 0)
      },
      onPointerUp() {
        const s = start.current
        const d = dx
        const passed = Math.abs(d) >= threshold()
        if (s?.horizontal) swallowClick.current = true
        reset()
        if (!passed) return
        if (d > 0) opts.onRight?.()
        else opts.onLeft?.()
      },
      onPointerCancel() {
        reset()
      },
      onClickCapture(e) {
        if (swallowClick.current) {
          e.stopPropagation()
          e.preventDefault()
          swallowClick.current = false
        }
      },
    },
  }
}
