import Link from "next/link"
import { VotingBox } from "@/components/voting-box"

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="px-5 pb-12 pt-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-primary">
            Interior Design Studio
          </p>
          <h1 className="mb-4 max-w-xl text-balance text-3xl font-semibold leading-tight text-foreground md:text-4xl">
            Make your room the way you want
          </h1>
          <p className="mb-8 max-w-lg leading-relaxed text-muted-foreground">
            Chordae is a next-generation interior design platform that transforms the way people visualize
            and refine their spaces. By combining intelligent image processing with intuitive design tools,
            Chordae allows you to visualize your room the way you want. It empowers homeowners, designers,
            and developers to experiment freely, make informed decisions, and perfect their environments
            before a single brushstroke touches the wall.
          </p>
          <Link
            href="/visualizer"
            className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#b08040]"
          >
            Try Wall Color Visualizer
          </Link>
        </div>
      </section>

      {/* Voting Box */}
      <section className="bg-secondary px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Help Us Build What You Need
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Vote on which feature we should prioritize next.
          </p>
          <VotingBox />
        </div>
      </section>

      {/* Thank you */}
      <section className="px-5 py-16 text-center">
        <p
          className="text-3xl font-bold text-foreground md:text-4xl"
          style={{ fontFamily: "var(--font-kaushan)" }}
        >
          Thank you for being different
        </p>
      </section>
    </main>
  )
}
