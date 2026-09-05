import Link from "next/link"
import { Badge, JsonTree } from "@nessalabs/ui"
import { liveReport, serverClient } from "@/lib/ledger"
import { cn } from "@/lib/cn"

export const dynamic = "force-dynamic"

const outcomeClass: Record<string, string> = {
  pass: "text-emerald-400",
  fail: "text-red-400",
  missing: "text-amber-400",
  unbound: "text-amber-400",
  attested: "text-muted-foreground",
}

export default async function VerifyPage() {
  const client = serverClient()
  const [report, claims] = await Promise.all([liveReport(), client.getClaims()])
  const claimById = new Map(claims.map((c) => [c.id, c]))

  const required = report.claims.filter((c) => c.required)
  const requiredPass = required.filter((c) => c.outcome === "pass").length
  const counts = {
    pass: report.claims.filter((c) => c.outcome === "pass").length,
    fail: report.claims.filter((c) => c.outcome === "fail").length,
    missing: report.claims.filter(
      (c) => c.outcome === "missing" || c.outcome === "unbound",
    ).length,
    attested: report.claims.filter((c) => c.outcome === "attested").length,
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Evidence
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Evidence</h1>
          <Badge variant={report.claims.length === 0 && report.ok ? "outline" : report.ok ? "default" : "destructive"}>
            {report.claims.length === 0 && report.ok ? "No requirements checked" : report.ok ? "OK" : "FAIL"}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          See which requirements have current supporting evidence. Open one to inspect its tests, output and remaining gaps. Reading this page does not run tests.
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-border px-3 py-3 sm:col-span-2 lg:col-span-1">
          <p className="text-[11px] text-muted-foreground">Required covered</p>
          <p className="font-mono text-xl font-semibold tabular-nums">
            {requiredPass}/{required.length}
          </p>
        </div>
        {(
          [
            ["pass", counts.pass],
            ["fail", counts.fail],
            ["missing", counts.missing],
            ["attested", counts.attested],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="rounded-lg border border-border px-3 py-3">
            <p className="text-[11px] capitalize text-muted-foreground">{label}</p>
            <p className="font-mono text-xl tabular-nums">{n}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Requirements</h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {report.claims.map((c) => {
            const claim = claimById.get(c.claimId)
            return (
              <li key={c.claimId}>
                <Link
                  href={`/claims/${encodeURIComponent(c.claimId)}`}
                  className="grid gap-1 px-3 py-2.5 no-underline transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-3"
                >
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm text-foreground">
                      {claim?.statement ?? c.claimId}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{c.claimId}</span>
                      {c.required ? <span>required</span> : <span>optional</span>}
                      {claim?.kind ? <span>{claim.kind}</span> : null}
                      {c.detail ? <span className="truncate">{c.detail}</span> : null}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium capitalize",
                      outcomeClass[c.outcome] ?? "text-muted-foreground",
                    )}
                  >
                    {c.outcome}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <details className="rounded-lg border border-border/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Provenance & raw report
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">{report.producedAt}</p>
          <div className="font-mono text-xs">
            <JsonTree value={report.provenance} defaultExpandedDepth={1} collapsible />
          </div>
          {report.problems.length > 0 ? (
            <ul className="space-y-1 font-mono text-xs text-destructive">
              {report.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <JsonTree value={report} defaultExpandedDepth={0} collapsible />
        </div>
      </details>
    </div>
  )
}
