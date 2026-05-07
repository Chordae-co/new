"use client"

import { useEffect, useRef, useState } from "react"
import type { Furniture, Placement } from "@/lib/spin-the-room/data"
import { tintImageData } from "@/lib/spin-the-room/tint"

type Props = {
  furniture: Furniture
  placement: Placement
  tintHex: string
  animateIn: boolean
  onSelect: () => void
  isSelected: boolean
}

export function FurnitureItem({
  furniture,
  placement,
  tintHex,
  animateIn,
  onSelect,
  isSelected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceDataRef = useRef<ImageData | null>(null)
  const [loaded, setLoaded] = useState(false)

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
    return () => {
      cancelled = true
    }
  }, [furniture.src])

  useEffect(() => {
    if (!loaded) return
    const canvas = canvasRef.current
    const src = sourceDataRef.current
    if (!canvas || !src) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (!tintHex) {
      ctx.putImageData(src, 0, 0)
      return
    }
    ctx.putImageData(tintImageData(src, tintHex, furniture.tintPredicate), 0, 0)
  }, [tintHex, loaded, furniture.tintPredicate])

  const { xPercent, yPercent, widthPercent, zIndex } = placement

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Select ${furniture.label}`}
      className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        width: `${widthPercent}%`,
        zIndex,
        animation: animateIn ? "drop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        className="h-auto w-full"
        style={{
          filter: isSelected
            ? "drop-shadow(0 0 0 #c89968) drop-shadow(0 6px 12px rgba(0,0,0,0.45))"
            : "drop-shadow(0 6px 12px rgba(0,0,0,0.4))",
          outline: isSelected ? "2px solid #c89968" : "none",
          outlineOffset: 4,
          borderRadius: 4,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s, outline 0.15s",
        }}
      />
      <style jsx>{`
        @keyframes drop-in {
          0% {
            transform: translate(-50%, -150%) scale(0.6);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </button>
  )
}
