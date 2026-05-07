export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "")
  const value = parseInt(
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned,
    16,
  )
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  }
}

// Brightness-preserving tint, masked by the source pixel's alpha.
// Mirrors the algorithm in /public/script.js (wall-color-visualizer):
//   out_rgb = target_rgb * brightness, where brightness is BT.601 luma.
//
// The optional predicate decides per-pixel whether to apply the tint or keep
// the original color — this is how we tint just the wood frame on a bed (the
// sheets stay), or just the cushion on an ottoman (the legs stay).

export type Predicate = (r: number, g: number, b: number) => boolean

export function tintImageData(
  src: ImageData,
  hex: string,
  predicate?: Predicate,
): ImageData {
  if (!hex) return src
  const { r: tr, g: tg, b: tb } = hexToRgb(hex)
  const data = src.data
  const out = new ImageData(src.width, src.height)
  const outData = out.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a === 0) {
      outData[i + 3] = 0
      continue
    }
    if (predicate && !predicate(r, g, b)) {
      outData[i] = r
      outData[i + 1] = g
      outData[i + 2] = b
      outData[i + 3] = a
      continue
    }
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    outData[i] = Math.min(255, tr * brightness)
    outData[i + 1] = Math.min(255, tg * brightness)
    outData[i + 2] = Math.min(255, tb * brightness)
    outData[i + 3] = a
  }
  return out
}
