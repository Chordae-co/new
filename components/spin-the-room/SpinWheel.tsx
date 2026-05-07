"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { FurnitureId } from "@/lib/spin-the-room/data"
import { FURNITURE, FURNITURE_ORDER } from "@/lib/spin-the-room/data"

type Props = {
  used: Set<FurnitureId>
  spinsLeft: number
  onLanded: (id: FurnitureId) => void
  disabled?: boolean
}

const SEGMENT_DEG = 360 / FURNITURE_ORDER.length
const SPIN_DURATION_MS = 3200

function segmentPath(index: number, radius: number): string {
  const start = (index * SEGMENT_DEG - 90) * (Math.PI / 180)
  const end = ((index + 1) * SEGMENT_DEG - 90) * (Math.PI / 180)
  const x1 = radius + radius * Math.cos(start)
  const y1 = radius + radius * Math.sin(start)
  const x2 = radius + radius * Math.cos(end)
  const y2 = radius + radius * Math.sin(end)
  const largeArc = SEGMENT_DEG > 180 ? 1 : 0
  return `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

// Synthesise a short tick using Web Audio — no audio file needed
function playTick(audioCtx: AudioContext, volume = 0.35) {
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.type = "triangle"
  osc.frequency.setValueAtTime(1200, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.04)
  gain.gain.setValueAtTime(volume, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06)
  osc.start(audioCtx.currentTime)
  osc.stop(audioCtx.currentTime + 0.06)
}

export function SpinWheel({ used, spinsLeft, onLanded, disabled }: Props) {
  const radius = 150
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinStartRef = useRef<number>(0)
  const startRotRef = useRef<number>(0)
  const endRotRef = useRef<number>(0)

  const segments = useMemo(
    () =>
      FURNITURE_ORDER.map((id, i) => ({
        id,
        index: i,
        path: segmentPath(i, radius),
        labelAngle: i * SEGMENT_DEG + SEGMENT_DEG / 2 - 90,
      })),
    [],
  )

  // Clean up tick interval on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    }
  }, [])

  const handleSpin = () => {
    if (spinning || disabled || spinsLeft <= 0) return
    const available = FURNITURE_ORDER.filter((id) => !used.has(id))
    if (available.length === 0) return

    const target = available[Math.floor(Math.random() * available.length)]
    const targetIndex = FURNITURE_ORDER.indexOf(target)
    const targetCenter = targetIndex * SEGMENT_DEG + SEGMENT_DEG / 2
    const jitter = (Math.random() - 0.5) * (SEGMENT_DEG * 0.6)

    const desiredVisible = ((360 - targetCenter + jitter) % 360 + 360) % 360
    const currentVisible = ((rotation % 360) + 360) % 360
    let delta = desiredVisible - currentVisible
    if (delta <= 0) delta += 360
    const finalRotation = rotation + 360 * 5 + delta

    // Initialise audio context on user gesture
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const audioCtx = audioCtxRef.current

    setSpinning(true)
    setRotation(finalRotation)

    spinStartRef.current = performance.now()
    startRotRef.current = rotation
    endRotRef.current = finalRotation

    // CSS cubic-bezier(0.17, 0.67, 0.16, 1) — approximate it for tick scheduling
    // by sampling the instantaneous angular velocity and firing a tick each time
    // the wheel crosses a segment boundary.
    let lastSegment = Math.floor(((rotation % 360) + 360) % 360 / SEGMENT_DEG)

    // Poll at ~60fps to detect segment crossings and fire ticks accordingly
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    tickIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - spinStartRef.current
      const t = Math.min(elapsed / SPIN_DURATION_MS, 1)

      // Approximate the CSS cubic-bezier(0.17, 0.67, 0.16, 1) easing
      // by computing the current interpolated rotation
      const eased = cubicBezierEase(t, 0.17, 0.67, 0.16, 1)
      const currentRot = startRotRef.current + (endRotRef.current - startRotRef.current) * eased
      const currentSeg = Math.floor(((currentRot % 360) + 360) % 360 / SEGMENT_DEG)

      if (currentSeg !== lastSegment) {
        // Volume ramps down as the wheel slows — louder at start, quieter at end
        const vol = Math.max(0.08, 0.45 * (1 - t))
        playTick(audioCtx, vol)
        lastSegment = currentSeg
      }

      if (t >= 1) {
        clearInterval(tickIntervalRef.current!)
        tickIntervalRef.current = null
      }
    }, 16)

    window.setTimeout(() => {
      setSpinning(false)
      onLanded(target)
    }, SPIN_DURATION_MS)
  }

  const canSpin = !spinning && !disabled && spinsLeft > 0
  const exhausted = spinsLeft <= 0
  const allUsed = used.size >= FURNITURE_ORDER.length

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: radius * 2, height: radius * 2 + 12 }}>
        {/* Pointer */}
        <div
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
          style={{
            width: 0, height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: "20px solid #c89968",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}
        />
        <svg
          width={radius * 2}
          height={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.16, 1)`
              : "none",
          }}
          className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          <circle cx={radius} cy={radius} r={radius} fill="#1a1a1a" />
          {segments.map(({ id, path, labelAngle }) => {
            const isUsed = used.has(id)
            const f = FURNITURE[id]
            return (
              <g key={id}>
                <path
                  d={path}
                  fill={isUsed ? "#2a2a2a" : f.wheelColor}
                  stroke="#0a0a0a"
                  strokeWidth={2}
                  opacity={isUsed ? 0.4 : 1}
                />
                <text
                  x={radius + Math.cos(labelAngle * (Math.PI / 180)) * (radius * 0.62)}
                  y={radius + Math.sin(labelAngle * (Math.PI / 180)) * (radius * 0.62)}
                  fill={isUsed ? "#666" : "#fff"}
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${labelAngle + 90} ${radius + Math.cos(labelAngle * (Math.PI / 180)) * (radius * 0.62)} ${radius + Math.sin(labelAngle * (Math.PI / 180)) * (radius * 0.62)})`}
                  style={{ pointerEvents: "none" }}
                >
                  {f.label}
                </text>
                {isUsed && (
                  <text
                    x={radius + Math.cos(labelAngle * (Math.PI / 180)) * (radius * 0.42)}
                    y={radius + Math.sin(labelAngle * (Math.PI / 180)) * (radius * 0.42)}
                    fill="#666"
                    fontSize="14"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents: "none" }}
                  >
                    ✓
                  </text>
                )}
              </g>
            )
          })}
          <circle cx={radius} cy={radius} r={radius * 0.18} fill="#0a0a0a" stroke="#c89968" strokeWidth={3} />
        </svg>
      </div>

      <button
        type="button"
        onClick={handleSpin}
        disabled={!canSpin}
        className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-[#b08040] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {spinning
          ? "Spinning…"
          : allUsed
            ? "All items placed"
            : exhausted
              ? "Out of spins — reset to play again"
              : `Spin (${spinsLeft} left)`}
      </button>
    </div>
  )
}

// Approximate CSS cubic-bezier easing via Newton's method
// Returns the y value (eased progress) for a given t (linear progress)
function cubicBezierEase(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  // Solve for the cubic bezier parameter s at x=t, then return y(s)
  let s = t
  for (let i = 0; i < 8; i++) {
    const x = cubicBez(s, p1x, p2x) - t
    const dx = cubicBezDeriv(s, p1x, p2x)
    if (Math.abs(dx) < 1e-6) break
    s -= x / dx
  }
  return cubicBez(s, p1y, p2y)
}

function cubicBez(t: number, p1: number, p2: number): number {
  return 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3
}

function cubicBezDeriv(t: number, p1: number, p2: number): number {
  return 3 * (1 - t) ** 2 * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t ** 2 * (1 - p2)
}
