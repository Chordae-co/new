"use client"

import { useEffect } from "react"

const PRESET_COLORS = [
  { hex: "#ffffff", label: "White" },
  { hex: "#d24a4a", label: "Red" },
  { hex: "#f3c94a", label: "Yellow" },
  { hex: "#4f7fdc", label: "Blue" },
  { hex: "#90949b", label: "Gray" },
]

export function WallColorVisualizer() {
  useEffect(() => {
    const existing = document.getElementById("visualizer-engine-script")
    if (existing) existing.remove()

    const script = document.createElement("script")
    script.id = "visualizer-engine-script"
    // Cache-buster so the browser never serves a stale /script.js from the
    // disk/memory cache when remounting (e.g. after navigating away and back).
    script.src = `/script.js?v=${Date.now()}`
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return (
    <section className="rounded-3xl border border-border bg-card/80 p-4 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.9)] sm:p-6">
      <div className="flex flex-col gap-6">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-primary/45 bg-gradient-to-r from-secondary/70 to-card px-4 py-4 transition-colors hover:border-primary">
          <div>
            <p className="text-sm font-medium text-foreground">Upload Wall Photo</p>
            <p className="text-xs text-muted-foreground">PNG or JPG, up to 900x500 render area</p>
          </div>
          <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Choose File
          </span>
          <input id="imageInput" type="file" accept="image/*" className="sr-only" />
        </label>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-background/30 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Color System</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="colorPicker"
                type="color"
                defaultValue="#ffffff"
                aria-label="Wall color picker"
                className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-0"
              />
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(({ hex, label }) => (
                  <button
                    key={hex}
                    type="button"
                    className="color-btn h-8 w-8 rounded-full border border-border transition-all hover:scale-[1.03]"
                    data-color={hex}
                    title={label}
                    aria-label={`Set ${label}`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/30 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Actions</p>
            <div className="flex flex-wrap gap-2">
              <button id="undoBtn" type="button" className="viz-action-btn">Undo</button>
              <button id="redoBtn" type="button" className="viz-action-btn">Redo</button>
              <button id="saveImage" type="button" className="viz-action-btn">Save Snapshot</button>
              <button id="resetImage" type="button" className="viz-action-btn">Reset</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-border bg-background/30 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Tools</p>
            <div className="flex flex-wrap gap-2">
              <button id="toolWand" type="button" className="tool-btn active">Magic Select</button>
              <button id="toolPaint" type="button" className="tool-btn">Paint</button>
              <button id="toolEraser" type="button" className="tool-btn">Eraser</button>
              <button id="toolLasso" type="button" className="tool-btn">✂ Lasso Erase</button>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/30 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Precision</p>
            <div className="space-y-3">
              <label className="block text-xs text-muted-foreground">
                Wand Sensitivity
                <input id="wandRange" type="range" min={10} max={80} defaultValue={45} className="mt-1 w-full" />
              </label>
              <label className="block text-xs text-muted-foreground">
                Paint Size
                <input id="paintRange" type="range" min={3} max={40} defaultValue={10} className="mt-1 w-full" />
              </label>
              <label className="block text-xs text-muted-foreground">
                Eraser Size
                <input id="eraserRange" type="range" min={3} max={40} defaultValue={10} className="mt-1 w-full" />
              </label>
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          1) Upload 2) Pick color 3) Use Magic Select to add regions, Paint to draw in, Eraser to clean edges, and ✂ Lasso Erase to draw around anything you want removed — it&apos;ll be filled in automatically.
          Saved snapshots appear below and open in preview when clicked.
        </p>

        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <div className="flex min-h-[320px] items-center justify-center overflow-auto rounded-xl border border-border/70 bg-[#121212] p-2">
            <canvas id="previewCanvas" style={{ display: "none", maxWidth: "100%" }} />
            <div id="placeholder" className="max-w-sm text-center text-sm text-muted-foreground">
              Upload an image to start. Visual output and editing behavior are powered by the production visualizer engine.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/30 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Saved Gallery</p>
          <div id="savedGallery" className="flex min-h-[72px] flex-wrap gap-2">
            <p className="gallery-placeholder text-sm text-muted-foreground">Saved snapshots will appear here.</p>
          </div>
        </div>

        <div id="snapshotPreviewWrapper" className="rounded-2xl border border-border bg-background/30 p-4" style={{ display: "none" }}>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Snapshot Preview</p>
          <img id="snapshotPreview" alt="Snapshot preview" className="max-w-full rounded-xl border border-border" />
        </div>
      </div>
    </section>
  )
}
