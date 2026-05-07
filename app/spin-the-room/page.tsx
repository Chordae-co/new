import type { Metadata } from "next"
import { SpinTheRoom } from "@/components/spin-the-room/SpinTheRoom"

export const metadata: Metadata = {
  title: "Spin the Room - Chordae",
  description:
    "Upload a room photo, spin the wheel, and watch furniture drop into your space. Recolor any piece in real time or browse curated combinations.",
}

export default function SpinTheRoomPage() {
  return (
    <main className="px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Spin the Room</h1>
        <p className="mb-6 max-w-2xl leading-relaxed text-muted-foreground">
          Upload a photo of your room, spin to randomize furniture, and recolor any piece. You get
          up to 4 spins per session — or browse curated combinations below.
        </p>
        <SpinTheRoom />
      </div>
    </main>
  )
}
