"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Furniture } from "@/lib/spin-the-room/data"
import { tintImageData } from "@/lib/spin-the-room/tint"

export type FreePosition = {
  xPercent: number
  yPercent: number
  widthPercent: number
  zIndex: number
}

type Props = {
  furniture: Furniture
  position: FreePosition
  tintHex: string
  animateIn: boolean
  onSelect: () => void
  isSelected: boolean
  onPositionChange: (pos: Partial<FreePosition>) => void
  onRemove: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function FurnitureItem({
  furniture,
  position,
  tintHex,
  animateIn,
  onSelect,
  isSelected,
  onPositionChange,
  onRemove,
  containerRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceDataRef = useRef<ImageData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startXPct: number; startYPct: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startWidth: number; handle: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      sourceDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setLoaded(true)
    }
    img.src = furniture.src
    return () => { cancelled = true }
  }, [furniture.src])

  useEffect(() => {
    if (!loaded) return
    const canvas = canvasRef.current
    const src = sourceDataRef.current
    if (!canvas || !src) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (!tintHex) { ctx.putImageData(src, 0, 0); return }
    ctx.putImageData(tintImageData(src, tintHex, furniture.tintPredicate), 0, 0)
  }, [tintHex, loaded, furniture.tintPredicate])

  const getRect = useCallback(() => containerRef.current?.getBoundingClientRect() ?? null, [containerRef])
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onDragDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    onSelect()
    dragRef.current = { startX: e.clientX, startY: e.clientY, startXPct: position.xPercent, startYPct: position.yPercent }
  }, [position.xPercent, position.yPercent, onSelect])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const rect = getRect(); if (!rect) return
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100
    const hw = position.widthPercent / 2
    onPositionChange({
      xPercent: clamp(dragRef.current.startXPct + dx, hw, 100 - hw),
      yPercent: clamp(dragRef.current.startYPct + dy, 0, 100),
    })
  }, [getRect, position.widthPercent, onPositionChange])

  const onDragUp = useCallback(() => { dragRef.current = null }, [])

  // ── Resize ────────────────────────────────────────────────────────────────
  const onResizeDown = useCallback((e: React.PointerEvent, handle: string) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeRef.current = { startX: e.clientX, startWidth: position.widthPercent, handle }
  }, [position.widthPercent])

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return
    const rect = getRect(); if (!rect) return
    const dx = ((e.clientX - resizeRef.current.startX) / rect.width) * 100
    const sign = resizeRef.current.handle === "right" ? 1 : -1
    onPositionChange({ widthPercent: clamp(resizeRef.current.startWidth + sign * dx * 2, 5, 80) })
  }, [getRect, onPositionChange])

  const onResizeUp = useCallback(() => { resizeRef.current = null }, [])

  const { xPercent, yPercent, widthPercent, zIndex } = position

  const handleStyle: React.CSSProperties = {
    position: "absolute", width: 18, height: 18,
    background: "#c89968", border: "2px solid white", borderRadius: "50%",
    cursor: "ew-resize", top: "50%", transform: "translateY(-50%)",
    zIndex: 10, touchAction: "none",
  }

  return (
    <div style={{
      position: "absolute",
      left: `${xPercent}%`, top: `${yPercent}%`,
      width: `${widthPercent}%`,
      transform: "translate(-50%, -50%)",
      zIndex,
      animation: animateIn ? "drop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined,
      touchAction: "none", userSelect: "none",
    }}>
      <div
        onPointerDown={onDragDown}
        onPointerMove={(e) => { onDragMove(e); onResizeMove(e) }}
        onPointerUp={(e) => { onDragUp(); onResizeUp() }}
        onPointerCancel={(e) => { onDragUp(); onResizeUp() }}
        style={{ cursor: "grab", position: "relative" }}
      >
        <canvas
          ref={canvasRef}
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          style={{
            display: "block", width: "100%", height: "auto",
            filter: isSelected
              ? "drop-shadow(0 0 0 #c89968) drop-shadow(0 6px 12px rgba(0,0,0,0.45))"
              : "drop-shadow(0 6px 12px rgba(0,0,0,0.4))",
            outline: isSelected ? "2px solid #c89968" : "none",
            outlineOffset: 4, borderRadius: 4,
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s, outline 0.15s",
            pointerEvents: "none",
          }}
        />

        {isSelected && (
          <>
            {/* Delete button */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              aria-label="Remove furniture"
              style={{
                position: "absolute", top: -10, right: -10,
                width: 24, height: 24, borderRadius: "50%",
                background: "#e53e3e", border: "2px solid white",
                color: "white", fontSize: 14, lineHeight: "1",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                zIndex: 20, padding: 0,
              }}
            >×</button>

            {/* Left resize handle */}
            <div
              onPointerDown={(e) => onResizeDown(e, "left")}
              style={{ ...handleStyle, left: -9 }}
            />
            {/* Right resize handle */}
            <div
              onPointerDown={(e) => onResizeDown(e, "right")}
              style={{ ...handleStyle, right: -9 }}
            />
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes drop-in {
          0% { transform: translate(-50%, -150%) scale(0.6); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
