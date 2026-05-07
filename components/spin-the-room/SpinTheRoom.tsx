"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ComboSet, FurnitureId, SlotId } from "@/lib/spin-the-room/data"
import {
  FURNITURE,
  FURNITURE_ORDER,
  MAX_SPINS,
  SLOT_LABEL,
  SLOT_ORDER,
  SLOTS,
  assignSlots,
  pickSlotFor,
} from "@/lib/spin-the-room/data"
import type { FreePosition } from "./FurnitureItem"
import { RoomCanvas, type PlacedItem } from "./RoomCanvas"
import { SpinWheel } from "./SpinWheel"
import { ColorPicker } from "./ColorPicker"
import { ComboSetBrowser } from "./ComboSetBrowser"
import { PieceActions } from "./PieceActions"

function slotToFreePosition(slot: SlotId): FreePosition {
  const s = SLOTS[slot]
  return { xPercent: s.xPercent, yPercent: s.yPercent, widthPercent: s.widthPercent, zIndex: s.zIndex }
}

export function SpinTheRoom() {
  const [roomImageUrl, setRoomImageUrl] = useState<string | null>(null)
  const [placed, setPlaced] = useState<PlacedItem[]>([])
  const [selectedId, setSelectedId] = useState<FurnitureId | null>(null)
  const [spinsUsed, setSpinsUsed] = useState(0)
  // Track which slots are in use so pickSlotFor still works for initial placement
  const [occupiedSlots, setOccupiedSlots] = useState<Set<SlotId>>(new Set())
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    FURNITURE_ORDER.forEach((id) => {
      const img = new Image()
      img.src = FURNITURE[id].src
    })
  }, [])

  useEffect(() => {
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }
  }, [])

  const usedIds = useMemo(() => new Set(placed.map((p) => p.id)), [placed])
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
      const slot = pickSlotFor(id, occupiedSlots)
      if (!slot) return prev
      setOccupiedSlots((s) => new Set([...s, slot]))
      return [
        ...prev.map((p) => ({ ...p, isFresh: false })),
        { id, position: slotToFreePosition(slot), tintHex: "", isFresh: true },
      ]
    })
    setSpinsUsed((n) => n + 1)
    setSelectedId(id)
  }

  const handleReset = () => {
    setPlaced([])
    setSpinsUsed(0)
    setSelectedId(null)
    setOccupiedSlots(new Set())
  }

  const handleSelectItem = (id: FurnitureId | null) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const handleTintChange = (hex: string) => {
    if (!selectedId) return
    setPlaced((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, tintHex: hex, isFresh: false } : p)),
    )
  }

  const handlePositionChange = (id: FurnitureId, pos: Partial<FreePosition>) => {
    setPlaced((prev) =>
      prev.map((p) => p.id === id ? { ...p, position: { ...p.position, ...pos }, isFresh: false } : p)
    )
  }

  const handleRemoveItem = (id: FurnitureId) => {
    setPlaced((prev) => prev.filter((p) => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const handleMoveSlot = (slot: SlotId) => {
    if (!selectedId) return
    setPlaced((prev) =>
      prev.map((p) =>
        p.id === selectedId ? { ...p, position: slotToFreePosition(slot), isFresh: true } : p
      ),
    )
  }

  const handleSwap = (newId: FurnitureId) => {
    if (!selectedId) return
    setPlaced((prev) => {
      const current = prev.find((p) => p.id === selectedId)
      if (!current) return prev
      return prev.map((p) =>
        p.id === selectedId ? { id: newId, position: current.position, tintHex: "", isFresh: true } : p,
      )
    })
    setSelectedId(newId)
  }

  const handleRemove = () => {
    if (!selectedId) return
    handleRemoveItem(selectedId)
  }

  const handlePickCombo = (combo: ComboSet) => {
    const assignments = assignSlots(combo.items)
    const newSlots = new Set<SlotId>(assignments.map((a) => a.slot))
    setOccupiedSlots(newSlots)
    setPlaced(
      assignments.map(({ id, slot }, i) => ({
        id,
        position: slotToFreePosition(slot),
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

  const availableMoveSlots: SlotId[] = SLOT_ORDER

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
          onPositionChange={handlePositionChange}
          onRemoveItem={handleRemoveItem}
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
            currentSlot={"center" as SlotId}
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
          Tap a piece to select it — then drag to move, pull the side handles to resize, or tap × to remove.
        </p>
      ) : null}

      <ComboSetBrowser onPick={handlePickCombo} disabled={!roomImageUrl} />
    </section>
  )
}
