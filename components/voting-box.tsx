"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const options = [
  {
    id: "clients",
    label: "Option 1: Proceed to matching with clients",
  },
  {
    id: "furniture",
    label: "Option 2: Allow model to insert furniture",
  },
  {
    id: "chatbot",
    label: "Option 3: Make an AI visualizer chatbot",
  },
]

export function VotingBox() {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (selected) setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm font-medium text-foreground">
          Thanks for your vote! We appreciate your feedback.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm transition-all",
              selected === option.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!selected}
        className={cn(
          "mt-4 rounded-full px-6 py-2 text-sm font-medium transition-colors",
          selected
            ? "bg-primary text-primary-foreground hover:bg-[#b08040]"
            : "cursor-not-allowed bg-border text-muted-foreground"
        )}
      >
        Submit Vote
      </button>
    </div>
  )
}
