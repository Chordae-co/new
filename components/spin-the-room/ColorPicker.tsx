"use client"

import type { Furniture } from "@/lib/spin-the-room/data"

type Props = {
  furniture: Furniture
  currentHex: string
  onChange: (hex: string) => void
}

const CATEGORY_LABEL: Record<Furniture["category"], string> = {
  wood: "Wood Tone",
  upholstery: "Upholstery",
  frame: "Frame",
  dining: "Dining Wood",
}

export function ColorPicker({ furniture, currentHex, onChange }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-medium text-foreground">{furniture.label}</p>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {CATEGORY_LABEL[furniture.category]}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {furniture.swatches.map((swatch) => {
          const active = swatch.hex === currentHex
          const isOriginal = swatch.hex === ""
          return (
            <button
              key={swatch.label}
              type="button"
              onClick={() => onChange(swatch.hex)}
              title={swatch.label}
              aria-label={`Set ${furniture.label} to ${swatch.label}`}
              className="group flex flex-col items-center gap-1"
            >
              <span
                className="block h-9 w-9 rounded-full border-2 transition-all group-hover:scale-110"
                style={{
                  backgroundColor: isOriginal ? "transparent" : swatch.hex,
                  borderColor: active ? "#c89968" : "rgba(255,255,255,0.15)",
                  backgroundImage: isOriginal
                    ? "repeating-linear-gradient(45deg, #555 0 4px, #888 4px 8px)"
                    : undefined,
                }}
              />
              <span className="text-[10px] text-muted-foreground">{swatch.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
