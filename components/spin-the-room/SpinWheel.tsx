"use client"

import { useMemo, useState } from "react"
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

export function SpinWheel({ used, spinsLeft, onLanded, disabled }: Props) {
  const radius = 150
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)

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

  const handleSpin = () => {
    if (spinning || disabled || spinsLeft <= 0) return
    const available = FURNITURE_ORDER.filter((id) => !used.has(id))
    if (available.length === 0) return

    const target = available[Math.floor(Math.random() * available.length)]
    const targetIndex = FURNITURE_ORDER.indexOf(target)
    const targetCenter = targetIndex * SEGMENT_DEG + SEGMENT_DEG / 2
    const jitter = (Math.random() - 0.5) * (SEGMENT_DEG * 0.6)

    // The wheel's visible orientation is `rotation mod 360`. To put the target
    // segment under the (top-of-wheel) pointer, the wheel needs to end up with
    // visible rotation ≡ -targetCenter (mod 360). The previous version always
    // added (360 - targetCenter), which only works when starting from 0 — every
    // subsequent spin landed on the wrong segment. We compute the forward delta
    // from the current visible angle to the desired angle instead.
    const desiredVisible = ((360 - targetCenter + jitter) % 360 + 360) % 360
    const currentVisible = ((rotation % 360) + 360) % 360
    let delta = desiredVisible - currentVisible
    if (delta <= 0) delta += 360
    const finalRotation = rotation + 360 * 5 + delta

    setSpinning(true)
    setRotation(finalRotation)
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
            width: 0,
            height: 0,
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
