export type ColorCategory = "wood" | "upholstery" | "frame" | "dining"

export type Swatch = {
  hex: string
  label: string
}

export type FurnitureId =
  | "sofa"
  | "coffee-table"
  | "bookshelf"
  | "bed-frame"
  | "tv"
  | "ottoman"
  | "dining-table"

// Six anchor slots in a generic room view. Each placement is in % of the room
// canvas. zIndex orders the layering (higher = in front).
export type SlotId = "wall" | "back" | "center" | "front" | "left" | "right"

export type Placement = {
  xPercent: number
  yPercent: number
  widthPercent: number
  zIndex: number
}

export const SLOTS: Record<SlotId, Placement> = {
  wall: { xPercent: 50, yPercent: 28, widthPercent: 28, zIndex: 1 },
  back: { xPercent: 50, yPercent: 64, widthPercent: 56, zIndex: 2 },
  center: { xPercent: 50, yPercent: 78, widthPercent: 50, zIndex: 3 },
  front: { xPercent: 50, yPercent: 92, widthPercent: 22, zIndex: 5 },
  left: { xPercent: 14, yPercent: 60, widthPercent: 22, zIndex: 2 },
  right: { xPercent: 86, yPercent: 86, widthPercent: 16, zIndex: 4 },
}

export const SLOT_ORDER: SlotId[] = ["wall", "back", "center", "front", "left", "right"]

export const SLOT_LABEL: Record<SlotId, string> = {
  wall: "Back wall",
  back: "Back of room",
  center: "Center",
  front: "Front",
  left: "Left side",
  right: "Right corner",
}

// Per-pixel tint predicates. Returns true for pixels that should be recolored;
// pixels outside the predicate keep their original colour. This is what isolates
// the wood frame on a bed (sheets stay), the cushion on an ottoman (legs stay),
// etc.

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255
  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const l = (max + min) / 2
  let s = 0
  let h = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r1) h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6
    else if (max === g1) h = ((b1 - r1) / d + 2) / 6
    else h = ((r1 - g1) / d + 4) / 6
  }
  return { h, s, l }
}

export type TintPredicate = (r: number, g: number, b: number) => boolean

const TINT_ALL: TintPredicate = () => true

// Brown/wood pixels: warm hue band, with some saturation and not too dark/light.
// Excludes saturated reds/blues/greens (book spines, navy fabric) and near-greys
// (white sheets / bedding / pillows).
const TINT_WOOD: TintPredicate = (r, g, b) => {
  const { h, s, l } = rgbToHsl(r, g, b)
  const hueDeg = h * 360
  return hueDeg >= 12 && hueDeg <= 50 && s >= 0.12 && l >= 0.1 && l <= 0.85
}

// Cushion (any lighting), excluding the dark wooden legs. Anything in the
// warm-brown hue band with real saturation and low lightness is treated as
// leg/wood; everything else gets tinted — so shadowed cushion regions on the
// right side aren't skipped.
const TINT_FABRIC_NOT_WOOD: TintPredicate = (r, g, b) => {
  const { h, s, l } = rgbToHsl(r, g, b)
  const hueDeg = h * 360
  const isLeg = hueDeg >= 10 && hueDeg <= 50 && s >= 0.2 && l < 0.5
  return !isLeg
}

export const TINT_PREDICATES = {
  all: TINT_ALL,
  wood: TINT_WOOD,
  fabricNotWood: TINT_FABRIC_NOT_WOOD,
}

// Swatch palettes
const WOOD_SWATCHES: Swatch[] = [
  { hex: "", label: "Original" },
  { hex: "#d6a679", label: "Light Oak" },
  { hex: "#8a5a36", label: "Walnut" },
  { hex: "#5e3a1d", label: "Dark Walnut" },
  { hex: "#2a1810", label: "Espresso" },
]

const UPHOLSTERY_SWATCHES: Swatch[] = [
  { hex: "", label: "Original" },
  { hex: "#8a8a88", label: "Grey" },
  { hex: "#e8dcc4", label: "Cream" },
  { hex: "#1f2e4a", label: "Navy" },
  { hex: "#b85c3c", label: "Terracotta" },
  { hex: "#2e4a32", label: "Forest" },
]

const FRAME_SWATCHES: Swatch[] = [
  { hex: "", label: "Original" },
  { hex: "#0a0a0a", label: "Black" },
  { hex: "#f4f4f0", label: "White" },
  { hex: "#c89968", label: "Wood" },
  { hex: "#b08040", label: "Brass" },
]

// Five lighter wood-toned variants for dining table, per spec.
const DINING_SWATCHES: Swatch[] = [
  { hex: "", label: "Original" },
  { hex: "#d6a679", label: "Light Oak" },
  { hex: "#e8c89a", label: "Honey" },
  { hex: "#e8dcc4", label: "Whitewash" },
  { hex: "#cba07a", label: "Driftwood" },
  { hex: "#d49b7a", label: "Cherry" },
]

export type Furniture = {
  id: FurnitureId
  label: string
  src: string
  category: ColorCategory
  swatches: Swatch[]
  tintPredicate: TintPredicate
  // First entry is the primary slot the wheel/combos try first; the rest are
  // graceful fallbacks if the primary is already taken.
  preferredSlots: SlotId[]
  wheelColor: string
}

export const FURNITURE: Record<FurnitureId, Furniture> = {
  sofa: {
    id: "sofa",
    label: "Sofa",
    src: "/furniture/sofa.png",
    category: "upholstery",
    swatches: UPHOLSTERY_SWATCHES,
    tintPredicate: TINT_ALL,
    preferredSlots: ["center", "back", "left"],
    wheelColor: "#3a4a6b",
  },
  "coffee-table": {
    id: "coffee-table",
    label: "Coffee Table",
    src: "/furniture/coffee-table.png",
    category: "wood",
    swatches: WOOD_SWATCHES,
    tintPredicate: TINT_WOOD,
    preferredSlots: ["front", "center"],
    wheelColor: "#a07b54",
  },
  bookshelf: {
    id: "bookshelf",
    label: "Bookshelf",
    src: "/furniture/bookshelf.png",
    category: "wood",
    swatches: WOOD_SWATCHES,
    tintPredicate: TINT_WOOD,
    preferredSlots: ["left", "right"],
    wheelColor: "#7a4f2b",
  },
  "bed-frame": {
    id: "bed-frame",
    label: "Bed Frame",
    src: "/furniture/bed-frame.png",
    category: "wood",
    swatches: WOOD_SWATCHES,
    tintPredicate: TINT_WOOD,
    preferredSlots: ["back"],
    wheelColor: "#c89968",
  },
  tv: {
    id: "tv",
    label: "TV",
    src: "/furniture/tv.png",
    category: "frame",
    swatches: FRAME_SWATCHES,
    tintPredicate: TINT_ALL,
    preferredSlots: ["wall"],
    wheelColor: "#1a1a1a",
  },
  ottoman: {
    id: "ottoman",
    label: "Ottoman",
    src: "/furniture/ottoman.png",
    category: "upholstery",
    swatches: UPHOLSTERY_SWATCHES,
    tintPredicate: TINT_FABRIC_NOT_WOOD,
    preferredSlots: ["right", "front", "left"],
    wheelColor: "#d8cdb6",
  },
  "dining-table": {
    id: "dining-table",
    label: "Dining Table",
    src: "/furniture/dining-table.png",
    category: "dining",
    swatches: DINING_SWATCHES,
    tintPredicate: TINT_WOOD,
    preferredSlots: ["back", "center"],
    wheelColor: "#8a5a36",
  },
}

export const FURNITURE_ORDER: FurnitureId[] = [
  "sofa",
  "coffee-table",
  "bookshelf",
  "bed-frame",
  "tv",
  "ottoman",
  "dining-table",
]

export const MAX_SPINS = 4

// Pick the first preferred slot a piece can take, given which slots are already
// occupied. Falls back to ANY remaining slot if none of its preferred slots are
// free — better to place the piece somewhere than leave a hole.
export function pickSlotFor(
  id: FurnitureId,
  occupied: ReadonlySet<SlotId>,
): SlotId | null {
  const piece = FURNITURE[id]
  for (const slot of piece.preferredSlots) {
    if (!occupied.has(slot)) return slot
  }
  for (const slot of SLOT_ORDER) {
    if (!occupied.has(slot)) return slot
  }
  return null
}

// Assign a list of pieces to slots greedily — pieces with fewer slot options go
// first so they don't get squeezed out. Used for combo presets.
export function assignSlots(items: FurnitureId[]): Array<{ id: FurnitureId; slot: SlotId }> {
  const sorted = [...items].sort(
    (a, b) => FURNITURE[a].preferredSlots.length - FURNITURE[b].preferredSlots.length,
  )
  const occupied = new Set<SlotId>()
  const out: Array<{ id: FurnitureId; slot: SlotId }> = []
  for (const id of sorted) {
    const slot = pickSlotFor(id, occupied)
    if (slot) {
      occupied.add(slot)
      out.push({ id, slot })
    }
  }
  // Restore original order so combo browser cards render in the spec'd order.
  return items
    .map((id) => out.find((p) => p.id === id))
    .filter((p): p is { id: FurnitureId; slot: SlotId } => Boolean(p))
}

export type ComboSet = {
  id: string
  name: string
  blurb: string
  items: FurnitureId[]
}

export const NAMED_COMBOS: ComboSet[] = [
  {
    id: "living-room",
    name: "Living Room",
    blurb: "Sofa + coffee table + TV + ottoman",
    items: ["sofa", "coffee-table", "tv", "ottoman"],
  },
  {
    id: "bedroom",
    name: "Bedroom",
    blurb: "Bed + bookshelf + ottoman + TV",
    items: ["bed-frame", "bookshelf", "ottoman", "tv"],
  },
  {
    id: "dining",
    name: "Dining",
    blurb: "Dining table + bookshelf + sofa + coffee table",
    items: ["dining-table", "bookshelf", "sofa", "coffee-table"],
  },
  {
    id: "reading-nook",
    name: "Reading Nook",
    blurb: "Sofa + bookshelf + ottoman + coffee table",
    items: ["sofa", "bookshelf", "ottoman", "coffee-table"],
  },
  {
    id: "minimal",
    name: "Minimal",
    blurb: "Sofa + coffee table + bookshelf + TV",
    items: ["sofa", "coffee-table", "bookshelf", "tv"],
  },
]
