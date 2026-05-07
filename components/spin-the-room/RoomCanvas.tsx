"use client"

import { useRef } from "react"
import type { FurnitureId, SlotId } from "@/lib/spin-the-room/data"
import { FURNITURE, SLOTS } from "@/lib/spin-the-room/data"
import { FurnitureItem } from "./FurnitureItem"

export type PlacedItem = {
  id: FurnitureId
  slot: SlotId
  tintHex: string
  isFresh: boolean
}

type Props = {
  roomImageUrl: string | null
  onUpload: (file: File) => void
  placedItems: PlacedItem[]
  selectedId: FurnitureId | null
  onSelectItem: (id: FurnitureId) => void
}

export function RoomCanvas({
  roomImageUrl,
  onUpload,
  placedItems,
  selectedId,
  onSelectItem,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  if (!roomImageUrl) {
    return (
      <label className="flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/40 transition-colors hover:border-primary">
        <div className="text-center">
          <p className="mb-1 text-sm font-medium text-foreground">Upload a room photo</p>
          <p className="mb-4 max-w-xs text-xs text-muted-foreground">
            Pick a wide shot of any empty or partially empty room. PNG or JPG.
          </p>
          <span className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground">
            Choose Photo
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFile}
        />
      </label>
    )
  }

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-[#121212]">
      <img
        src={roomImageUrl}
        alt="Uploaded room"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {placedItems.map(({ id, slot, tintHex, isFresh }) => (
        <FurnitureItem
          key={id}
          furniture={FURNITURE[id]}
          placement={SLOTS[slot]}
          tintHex={tintHex}
          animateIn={isFresh}
          isSelected={selectedId === id}
          onSelect={() => onSelectItem(id)}
        />
      ))}
    </div>
  )
}
