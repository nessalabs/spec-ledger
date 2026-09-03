import type { Metadata } from "next"
import { SpecLedgerShell } from "@/components/lattice-shell"
import "./globals.css"

export const metadata: Metadata = {
  title: "Spec Ledger",
  description: "Read-only Spec Ledger — workstreams, turns, and claim verify",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <body className="h-full overflow-hidden antialiased">
        <SpecLedgerShell>{children}</SpecLedgerShell>
      </body>
    </html>
  )
}
