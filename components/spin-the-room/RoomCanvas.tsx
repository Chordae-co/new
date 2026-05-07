"use client"

import { useRef } from "react"
import type { FurnitureId } from "@/lib/spin-the-room/data"
import { FURNITURE } from "@/lib/spin-the-room/data"
import { FurnitureItem, type FreePosition } from "./FurnitureItem"

export type PlacedItem = {
  id: FurnitureId
  position: FreePosition
  tintHex: string
  isFresh: boolean
}

type Props = {
  roomImageUrl: string | null
  onUpload: (file: File) => void
  placedItems: PlacedItem[]
  selectedId: FurnitureId | null
  onSelectItem: (id: FurnitureId | null) => void
  onPositionChange: (id: FurnitureId, pos: Partial<FreePosition>) => void
  onRemoveItem: (id: FurnitureId) => void
}

export function RoomCanvas({
  roomImageUrl,
  onUpload,
  placedItems,
  selectedId,
  onSelectItem,
  onPositionChange,
  onRemoveItem,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
    <div
      ref={containerRef}
      className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-[#121212]"
      // Only deselect when clicking the canvas background directly (not bubbled from a furniture item)
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "IMG") onSelectItem(null) }}
    >
      <img
        src={roomImageUrl}
        alt="Uploaded room"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {placedItems.map(({ id, position, tintHex, isFresh }) => (
        <FurnitureItem
          key={id}
          furniture={FURNITURE[id]}
          position={position}
          tintHex={tintHex}
          animateIn={isFresh}
          isSelected={selectedId === id}
          onSelect={() => onSelectItem(id)}
          onPositionChange={(pos) => onPositionChange(id, pos)}
          onRemove={() => onRemoveItem(id)}
          containerRef={containerRef}
        />
      ))}
    </div>
  )
}
