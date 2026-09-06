import Link from "next/link"
import { LiveSession } from "@/components/live-session"
import { liveReport, serverClient } from "@/lib/ledger"
import { turnFreshness } from "@/lib/turns"

export const dynamic = "force-dynamic"

const UNPROVEN = ["fail", "missing", "unbound"]

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ workstream?: string }>
}) {
  const { workstream } = await searchParams
  const client = serverClient()
  const [session, report, workstreams, turns] = await Promise.all([
    client.getSession(workstream),
    liveReport(),
    client.listWorkstreams(),
    client.getTurns(),
  ])

  const unproven = report.claims.filter(c => UNPROVEN.includes(c.outcome))
  const active = workstreams.filter(w => !["done", "cancelled"].includes(w.status))
  const stale = turns.filter(t => turnFreshness(t, report) === "stale")

  const stats: Array<{ label: string; value: string; href: string }> = [
    {
      label: "Evidence",
      value: unproven.length ? `${unproven.length} unproven` : "All proven",
      href: "/claims",
    },
    {
      label: "Specs",
      value: `${active.length} active · ${workstreams.length} total`,
      href: "/workstreams",
    },
    {
      label: "Changes",
      value: stale.length ? `${stale.length} verify outdated` : "All current",
      href: "/turns",
    },
  ]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <ul className="flex list-none flex-wrap gap-2 p-0">
          {stats.map(stat => (
            <li key={stat.label} className="flex-1 basis-48">
              <Link
                href={stat.href}
                className="block rounded-lg border border-border px-3 py-2 no-underline transition-colors hover:bg-muted/40"
              >
                <span className="block text-[11px] text-muted-foreground">{stat.label}</span>
                <span className="block text-sm font-medium">{stat.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </header>

      {unproven.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Requirements without proof</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {unproven.slice(0, 8).map(c => (
              <li key={c.claimId}>
                <Link
                  href={`/claims/${encodeURIComponent(c.claimId)}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm no-underline transition-colors hover:bg-muted/40"
                >
                  <span className="font-mono text-xs">{c.claimId}</span>
                  <span className="capitalize text-amber-600 dark:text-amber-400">
                    {c.outcome}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {unproven.length > 8 ? (
            <Link className="text-sm underline" href="/claims">
              {unproven.length - 8} more on Evidence
            </Link>
          ) : null}
        </section>
      ) : null}

      <LiveSession initial={session} />
    </div>
  )
}
