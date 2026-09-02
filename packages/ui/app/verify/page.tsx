import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  JsonTree,
} from "@nessa-ui/react"
import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function VerifyPage() {
  const client = serverClient()
  const report = await client.verify()

  const counts = {
    pass: report.claims.filter((c) => c.outcome === "pass").length,
    fail: report.claims.filter((c) => c.outcome === "fail").length,
    missing: report.claims.filter(
      (c) => c.outcome === "missing" || c.outcome === "unbound",
    ).length,
    attested: report.claims.filter((c) => c.outcome === "attested").length,
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Verify
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
          <Badge variant={report.ok ? "default" : "destructive"}>
            {report.ok ? "OK" : "FAIL"}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pure function of ledger files + source tree + ingested results. Digests
          below are what CI and agents must paste.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["pass", counts.pass],
            ["fail", counts.fail],
            ["missing", counts.missing],
            ["attested", counts.attested],
          ] as const
        ).map(([label, n]) => (
          <Card key={label} className="gap-1 py-4">
            <CardHeader className="px-4 pb-0">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="font-mono">{n}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
          <CardDescription>{report.producedAt}</CardDescription>
        </CardHeader>
        <CardContent className="font-mono text-xs">
          <JsonTree value={report.provenance} defaultExpandedDepth={2} collapsible />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claim verdicts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {report.claims.map((c) => (
              <li
                key={c.claimId}
                className="flex flex-wrap items-center gap-2 py-2 text-sm"
              >
                <span className="font-mono text-xs">{c.claimId}</span>
                <Badge
                  variant={
                    c.outcome === "pass"
                      ? "default"
                      : c.outcome === "fail"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {c.outcome}
                </Badge>
                {c.required ? <Badge variant="secondary">required</Badge> : null}
                {c.detail ? (
                  <span className="text-xs text-muted-foreground">{c.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {report.graph ? (
        <Card>
          <CardHeader>
            <CardTitle>Graph check</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonTree value={report.graph} defaultExpandedDepth={2} collapsible />
          </CardContent>
        </Card>
      ) : null}

      {report.problems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Problems</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono text-xs text-destructive">
              {report.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Full report JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonTree value={report} defaultExpandedDepth={1} collapsible />
        </CardContent>
      </Card>
    </div>
  )
}
