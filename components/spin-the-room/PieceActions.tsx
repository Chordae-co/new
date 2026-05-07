"use client"

import type { FurnitureId, SlotId } from "@/lib/spin-the-room/data"
import { FURNITURE } from "@/lib/spin-the-room/data"

type Props = {
  currentSlot: SlotId
  availableSlots: SlotId[]
  slotLabel: Record<SlotId, string>
  swapCandidates: FurnitureId[]
  onMove: (slot: SlotId) => void
  onSwap: (id: FurnitureId) => void
  onRemove: () => void
}

export function PieceActions({
  currentSlot,
  availableSlots,
  slotLabel,
  swapCandidates,
  onMove,
  onSwap,
  onRemove,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">Position & Swap</p>

      <div className="mb-3">
        <p className="mb-2 text-xs text-muted-foreground">Move to</p>
        <div className="flex flex-wrap gap-2">
          {availableSlots.map((slot) => {
            const active = slot === currentSlot
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onMove(slot)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-secondary/60 text-foreground hover:border-primary"
                }`}
              >
                {slotLabel[slot]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-2 text-xs text-muted-foreground">Swap with</p>
        {swapCandidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">All items are placed.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {swapCandidates.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSwap(id)}
                className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary"
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: FURNITURE[id].wheelColor }}
                />
                {FURNITURE[id].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-300 transition-colors hover:border-red-400 hover:bg-red-500/20"
        >
          Remove from room
        </button>
      </div>
    </div>
  )
}
