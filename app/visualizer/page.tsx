import type { Metadata } from "next"
import { WallColorVisualizer } from "@/components/wall-color-visualizer"

export const metadata: Metadata = {
  title: "Wall Color Visualizer - Chordae",
  description:
    "Upload a room photo, pick any color, and recolor the major wall area while keeping furniture and objects untouched.",
}

export default function VisualizerPage() {
  return (
    <main className="px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Wall Color Visualizer
        </h1>
        <p className="mb-6 max-w-2xl leading-relaxed text-muted-foreground">
          Upload a room photo, pick any color, and we recolor the major wall area while trying to keep
          furniture and objects untouched. Refine the selection with Magic select to add painted regions,
          Paint brush to draw, and Eraser to remove paint.
        </p>
        <WallColorVisualizer />
      </div>
    </main>
  )
}
