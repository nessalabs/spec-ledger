import { serverClient } from "@/lib/ledger"
import { buildRecordLabels } from "@/lib/record-labels"
import { RecordLabelsProvider } from "@/components/readable-text"
import type { Metadata, Viewport } from "next"
import { SpecLedgerShell } from "@/components/spec-ledger-shell"
import "./globals.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Spec Ledger",
  description: "Read-only Spec Ledger — specs, evidence, and what changed",
}

export const viewport: Viewport = {
  colorScheme: "light dark",
}

/**
 * Resolve the theme before first paint. Runs ahead of hydration, so the page
 * never flashes the wrong palette; `ThemeToggle` reads the class it sets.
 */
const themeScript = `try{var t=localStorage.getItem('spec-ledger-theme');
if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
document.documentElement.classList.toggle('dark',t==='dark');
document.documentElement.style.colorScheme=t}catch(e){}`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const client = serverClient()
  const [claims, turns, workstreams, bindings] = await Promise.all([client.getClaims(), client.getTurns(), client.listWorkstreams(), client.getBindings()])
  const labels = buildRecordLabels({ claims, turns, workstreams, bindings })
  return (
    <html lang="en" className="h-full overflow-hidden" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full overflow-hidden antialiased">
        <RecordLabelsProvider labels={labels}><SpecLedgerShell>{children}</SpecLedgerShell></RecordLabelsProvider>
      </body>
    </html>
  )
}
