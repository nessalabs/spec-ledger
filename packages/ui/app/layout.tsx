import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { LatticeShell } from "@/components/lattice-shell"
import "./globals.css"

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Spec Ledger Lattice",
  description: "Claim adherence, contracts, and structure — nessalabs",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <body
        className={`${sans.variable} ${mono.variable} h-full overflow-hidden antialiased`}
      >
        <LatticeShell>{children}</LatticeShell>
      </body>
    </html>
  )
}
