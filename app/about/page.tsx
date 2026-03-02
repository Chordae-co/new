import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About - Chordae",
  description: "Learn about Chordae and the founders behind the platform.",
}

const founders = [
  {
    name: "Founder 1",
    role: "Co-Founder & CEO",
    bio: "Passionate about merging technology with interior design to make beautiful spaces accessible to everyone.",
  },
  {
    name: "Founder 2",
    role: "Co-Founder & CTO",
    bio: "Driven by a love for image processing and creating tools that empower creative expression.",
  },
]

export default function AboutPage() {
  return (
    <main className="px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          About Chordae
        </h1>
        <p className="mb-10 max-w-2xl leading-relaxed text-muted-foreground">
          Chordae is a next-generation interior design platform that transforms the way people visualize
          and refine their spaces. We believe everyone deserves to see their vision come to life before
          committing to a single can of paint.
        </p>

        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Why We Created Chordae
        </h2>
        <p className="mb-10 max-w-2xl leading-relaxed text-muted-foreground">
          We started Chordae because choosing paint colors and imagining renovations shouldn{"'"}t require
          expensive software or professional designers. By combining intelligent image processing with
          intuitive tools, we empower homeowners, designers, and developers to experiment freely, make
          informed decisions, and perfect their environments before a single brushstroke touches the wall.
        </p>

        <h2 className="mb-6 text-lg font-semibold text-foreground">
          Meet the Founders
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {founders.map((founder) => (
            <div
              key={founder.name}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {founder.name.split(" ").map((w) => w[0]).join("")}
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {founder.name}
              </h3>
              <p className="mb-2 text-xs uppercase tracking-wider text-primary">
                {founder.role}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {founder.bio}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
