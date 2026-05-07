"use client"

import type { ComboSet } from "@/lib/spin-the-room/data"
import { FURNITURE, NAMED_COMBOS } from "@/lib/spin-the-room/data"

type Props = {
  onPick: (combo: ComboSet) => void
  disabled?: boolean
}

export function ComboSetBrowser({ onPick, disabled }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-foreground">Preset Combinations</h3>
        <p className="text-xs text-muted-foreground">
          Tap a card to instantly furnish the room
        </p>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {NAMED_COMBOS.map((combo) => (
          <button
            key={combo.id}
            type="button"
            onClick={() => onPick(combo)}
            disabled={disabled}
            className="group flex min-w-[210px] snap-start flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 text-left transition-all hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/40 p-2">
              {combo.items.map((id) => (
                <div
                  key={id}
                  className="flex h-12 items-center justify-center rounded-md bg-background/40"
                >
                  <img
                    src={FURNITURE[id].src}
                    alt={FURNITURE[id].label}
                    className="max-h-10 max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{combo.name}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{combo.blurb}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
