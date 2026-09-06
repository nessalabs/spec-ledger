import { Badge, JsonTree } from "@nessalabs/ui"
import { ClaimsList } from "@/components/claims-list"
import { liveReport, serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function EvidencePage() {
  const client = serverClient()
  const [claims, bindings, report] = await Promise.all([
    client.getClaims(),
    client.getBindings(),
    liveReport(),
  ])

  const required = report.claims.filter((c) => c.required)
  const requiredPass = required.filter((c) => c.outcome === "pass").length
  const count = (...outcomes: string[]) =>
    report.claims.filter((c) => outcomes.includes(c.outcome)).length
  const tiles: Array<[string, string]> = [
    ["Required covered", `${requiredPass}/${required.length}`],
    ["Pass", String(count("pass"))],
    ["Fail", String(count("fail"))],
    ["Missing", String(count("missing", "unbound"))],
    ["Attested", String(count("attested"))],
  ]
  const empty = report.claims.length === 0 && report.ok

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Evidence</h1>
          <Badge variant={empty ? "outline" : report.ok ? "default" : "destructive"}>
            {empty ? "No requirements checked" : report.ok ? "OK" : "FAIL"}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every requirement and the evidence behind it. Open one to inspect its
          tests, output and remaining gaps. Reading this page does not run tests.
        </p>
      </header>

      <section aria-label="Evidence summary" className="flex flex-wrap gap-2">
        {tiles.map(([label, value]) => (
          <div
            key={label}
            className="flex-1 basis-32 rounded-lg border border-border px-3 py-2"
          >
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <ClaimsList
        claims={claims}
        bindings={bindings}
        verdicts={report.claims.map((c) => ({
          claimId: c.claimId,
          outcome: c.outcome as
            | "pass"
            | "fail"
            | "missing"
            | "unbound"
            | "attested",
          detail: c.detail,
        }))}
      />

      <details className="rounded-lg border border-border/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Provenance &amp; raw report
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
