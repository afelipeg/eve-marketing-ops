import { useEffect, useRef } from "react"
import { cn } from "cn"

// Deterministic per-dot value so the field reads as noise, not a flat grid.
function grain(i: number, j: number) {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Static dot field adapted from card-5's reviewed background effect.
 * The dots resolve from the current text color, so the surface stays
 * neutral and theme-aware without hard-coded colors.
 */
export function CardDotField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const GAP = 3
    const DOT = 1.5
    const BASE = 0.03
    const PEAK = 0.2

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)

      ctx.fillStyle = getComputedStyle(canvas).color || "rgb(115,115,115)"
      ctx.fillRect(0, 0, 1, 1)
      const px = ctx.getImageData(0, 0, 1, 1).data
      const color = `rgb(${px[0]}, ${px[1]}, ${px[2]})`

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.fillStyle = color

      const cols = Math.ceil(rect.width / GAP) + 1
      const rows = Math.ceil(rect.height / GAP) + 1
      for (let i = 0; i < cols; i++) {
        const x = i * GAP
        for (let j = 0; j < rows; j++) {
          const q = grain(i, j)
          const amp = 0.7 + 0.6 * grain(j * 2 + 1, i * 2 + 1)
          let a = (BASE + (PEAK - BASE) * q * q) * amp
          if (a > 1) a = 1
          ctx.globalAlpha = a
          ctx.fillRect(x, j * GAP, DOT, DOT)
        }
      }
      ctx.globalAlpha = 1
    }

    draw()

    const resizeObserver = new ResizeObserver(() => draw())
    resizeObserver.observe(canvas)

    const themeObserver = new MutationObserver(() => draw())
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    })

    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className
      )}
    />
  )
}