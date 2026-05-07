"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ComboSet, FurnitureId, SlotId } from "@/lib/spin-the-room/data"
import {
  FURNITURE,
  FURNITURE_ORDER,
  MAX_SPINS,
  SLOT_LABEL,
  SLOT_ORDER,
  assignSlots,
  pickSlotFor,
} from "@/lib/spin-the-room/data"
import { RoomCanvas, type PlacedItem } from "./RoomCanvas"
import { SpinWheel } from "./SpinWheel"
import { ColorPicker } from "./ColorPicker"
import { ComboSetBrowser } from "./ComboSetBrowser"
import { PieceActions } from "./PieceActions"

export function SpinTheRoom() {
  const [roomImageUrl, setRoomImageUrl] = useState<string | null>(null)
  const [placed, setPlaced] = useState<PlacedItem[]>([])
  const [selectedId, setSelectedId] = useState<FurnitureId | null>(null)
  const [spinsUsed, setSpinsUsed] = useState(0)
  const objectUrlRef = useRef<string | null>(null)

  // Pre-load all furniture PNGs into the browser cache on mount.
  useEffect(() => {
    FURNITURE_ORDER.forEach((id) => {
      const img = new Image()
      img.src = FURNITURE[id].src
    })
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const usedIds = useMemo(() => new Set(placed.map((p) => p.id)), [placed])
  const occupiedSlots = useMemo<Set<SlotId>>(
    () => new Set(placed.map((p) => p.slot)),
    [placed],
  )
  const spinsLeft = Math.max(0, MAX_SPINS - spinsUsed)

  const handleUpload = (file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setRoomImageUrl(url)
  }

  const handleLanded = (id: FurnitureId) => {
    setPlaced((prev) => {
      if (prev.some((p) => p.id === id)) return prev
      const occupied = new Set(prev.map((p) => p.slot))
      const slot = pickSlotFor(id, occupied)
      if (!slot) return prev
      return [
        ...prev.map((p) => ({ ...p, isFresh: false })),
        { id, slot, tintHex: "", isFresh: true },
      ]
    })
    setSpinsUsed((n) => n + 1)
    setSelectedId(id)
  }

  const handleReset = () => {
    setPlaced([])
    setSpinsUsed(0)
    setSelectedId(null)
  }

  const handleSelectItem = (id: FurnitureId) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const handleTintChange = (hex: string) => {
    if (!selectedId) return
    setPlaced((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, tintHex: hex, isFresh: false } : p)),
    )
  }

  const handleMoveSlot = (slot: SlotId) => {
    if (!selectedId) return
    setPlaced((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, slot, isFresh: true } : p)),
    )
  }

  const handleSwap = (newId: FurnitureId) => {
    if (!selectedId) return
    setPlaced((prev) => {
      const current = prev.find((p) => p.id === selectedId)
      if (!current) return prev
      // Swap keeps the slot but switches the piece. Reset tint since the new
      // piece has a different color category.
      return prev.map((p) =>
        p.id === selectedId
          ? { id: newId, slot: current.slot, tintHex: "", isFresh: true }
          : p,
      )
    })
    setSelectedId(newId)
  }

  const handleRemove = () => {
    if (!selectedId) return
    setPlaced((prev) => prev.filter((p) => p.id !== selectedId))
    setSelectedId(null)
  }

  const handlePickCombo = (combo: ComboSet) => {
    const assignments = assignSlots(combo.items)
    setPlaced(
      assignments.map(({ id, slot }, i) => ({
        id,
        slot,
        tintHex: "",
        isFresh: i === assignments.length - 1,
      })),
    )
    setSpinsUsed(MAX_SPINS)
    const last = assignments[assignments.length - 1]
    setSelectedId(last ? last.id : null)
  }

  const selectedFurniture = selectedId ? FURNITURE[selectedId] : null
  const selectedPlaced = selectedId ? placed.find((p) => p.id === selectedId) : null
  const wheelDisabled = !roomImageUrl

  // Compute available "Move to" slots for the selected piece: slots that are
  // free OR the slot the piece already occupies (so we can show it as active).
  const availableMoveSlots: SlotId[] = useMemo(() => {
    if (!selectedPlaced) return []
    return SLOT_ORDER.filter(
      (s) => !occupiedSlots.has(s) || s === selectedPlaced.slot,
    )
  }, [selectedPlaced, occupiedSlots])

  // Unused furniture for "Swap with"
  const swapCandidates: FurnitureId[] = useMemo(
    () => FURNITURE_ORDER.filter((id) => !usedIds.has(id)),
    [usedIds],
  )

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <RoomCanvas
          roomImageUrl={roomImageUrl}
          onUpload={handleUpload}
          placedItems={placed}
          selectedId={selectedId}
          onSelectItem={handleSelectItem}
        />

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/40 p-5">
          <div>
            <h2 className="mb-1 text-base font-semibold text-foreground">Spin the Wheel</h2>
            <p className="text-xs text-muted-foreground">
              {wheelDisabled
                ? "Upload a room photo first to start spinning."
                : `${spinsLeft} spin${spinsLeft === 1 ? "" : "s"} left. Already-picked items grey out.`}
            </p>
          </div>

          <SpinWheel
            used={usedIds}
            spinsLeft={spinsLeft}
            onLanded={handleLanded}
            disabled={wheelDisabled}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-full border border-border bg-secondary/60 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
              disabled={placed.length === 0 && spinsUsed === 0}
            >
              Reset Room
            </button>
          </div>
        </div>
      </div>

      {selectedFurniture && selectedPlaced ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ColorPicker
            furniture={selectedFurniture}
            currentHex={selectedPlaced.tintHex}
            onChange={handleTintChange}
          />
          <PieceActions
            currentSlot={selectedPlaced.slot}
            availableSlots={availableMoveSlots}
            slotLabel={SLOT_LABEL}
            swapCandidates={swapCandidates}
            onMove={handleMoveSlot}
            onSwap={handleSwap}
            onRemove={handleRemove}
          />
        </div>
      ) : placed.length > 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-center text-xs text-muted-foreground">
          Tap any placed piece to recolor, move, swap, or remove it.
        </p>
      ) : null}

      <ComboSetBrowser onPick={handlePickCombo} disabled={!roomImageUrl} />
    </section>
  )
}
