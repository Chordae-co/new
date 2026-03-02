import type { Metadata } from "next"
import { ContactForm } from "@/components/contact-form"

export const metadata: Metadata = {
  title: "Contact - Chordae",
  description: "Get in touch with Chordae. Share your concerns or suggestions.",
}

export default function ContactPage() {
  return (
    <main className="px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Contact
        </h1>
        <p className="mb-8 max-w-2xl leading-relaxed text-muted-foreground">
          Have questions, concerns, or suggestions? We{"'"}d love to hear from you.
          Fill out the form below and we{"'"}ll get back to you as soon as possible.
        </p>
        <ContactForm />
      </div>
    </main>
  )
}
