import { FURNITURE, type FurnitureId } from "./data"
import { tintImageData } from "./tint"

export type ExportItem = {
  id: FurnitureId
  xPercent: number
  yPercent: number
  widthPercent: number
  rotationDeg: number
  zIndex: number
  tintHex: string
}

const ASPECT = 16 / 10

export async function exportRoomImage(
  roomImageUrl: string,
  items: ExportItem[],
): Promise<Blob> {
  const room = await loadImage(roomImageUrl)

  // Match the on-screen 16:10 aspect by center-cropping the room image,
  // mirroring `object-cover` so the export looks like what's on screen.
  const roomAspect = room.naturalWidth / room.naturalHeight
  let canvasW: number
  let canvasH: number
  let srcX = 0
  let srcY = 0
  let srcW = room.naturalWidth
  let srcH = room.naturalHeight
  if (roomAspect > ASPECT) {
    canvasH = room.naturalHeight
    canvasW = Math.round(canvasH * ASPECT)
    srcW = canvasW
    srcX = Math.round((room.naturalWidth - srcW) / 2)
  } else {
    canvasW = room.naturalWidth
    canvasH = Math.round(canvasW / ASPECT)
    srcH = canvasH
    srcY = Math.round((room.naturalHeight - srcH) / 2)
  }

  const canvas = document.createElement("canvas")
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get 2D context")
  ctx.drawImage(room, srcX, srcY, srcW, srcH, 0, 0, canvasW, canvasH)

  const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex)
  for (const item of sorted) {
    const f = FURNITURE[item.id]
    const img = await loadImage(f.src)
    const off = document.createElement("canvas")
    off.width = img.naturalWidth
    off.height = img.naturalHeight
    const offCtx = off.getContext("2d")
    if (!offCtx) continue
    offCtx.drawImage(img, 0, 0)
    if (item.tintHex) {
      const data = offCtx.getImageData(0, 0, off.width, off.height)
      offCtx.putImageData(tintImageData(data, item.tintHex, f.tintPredicate), 0, 0)
    }

    const drawW = (item.widthPercent / 100) * canvasW
    const drawH = drawW * (img.naturalHeight / img.naturalWidth)
    const cx = (item.xPercent / 100) * canvasW
    const cy = (item.yPercent / 100) * canvasH

    ctx.save()
    ctx.translate(cx, cy)
    if (item.rotationDeg) ctx.rotate((item.rotationDeg * Math.PI) / 180)
    ctx.drawImage(off, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Failed to encode image"))
    }, "image/png")
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}
