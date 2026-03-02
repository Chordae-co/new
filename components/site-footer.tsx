import Image from "next/image"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[#0e0e0e] py-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/chordae-logo.jpg"
            alt="Chordae logo"
            width={28}
            height={28}
            className="rounded-full"
          />
          <p className="text-sm text-muted-foreground">
            © <span id="year">{new Date().getFullYear()}</span> Chordae. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
