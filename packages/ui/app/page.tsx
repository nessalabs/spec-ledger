import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import Link from "next/link"
import { serverClient } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const client = serverClient()
  const snap = await client.getSnapshot()
  const violations = await client.layerViolations()
  const schemas = await client.listSchemas()
  const { report, graph, claims, bindings } = snap

  const pass = report.claims.filter((c) => c.outcome === "pass").length
  const fail = report.claims.filter((c) => c.outcome === "fail").length
  const missing = report.claims.filter(
    (c) => c.outcome === "missing" || c.outcome === "unbound",
  ).length

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Overview
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {graph?.system.name ?? "Spec Ledger"}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {graph?.system.description ??
            "Claim adherence gate and Lattice viewing layer."}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Verify"
          value={report.ok ? "OK" : "FAIL"}
          tone={report.ok ? "ok" : "bad"}
          hint={`${pass} pass · ${fail} fail · ${missing} missing`}
        />
        <Stat label="Claims" value={String(claims.length)} hint={`${bindings.length} bindings`} />
        <Stat
          label="Modules"
          value={String(graph?.nodes.length ?? 0)}
          hint={`${graph?.features.length ?? 0} features`}
        />
        <Stat
          label="Layer violations"
          value={String(violations.length)}
          tone={violations.length ? "bad" : "ok"}
          hint={`${schemas.length} schema contracts`}
        />
        <Stat
          label="Turns"
          value={String(snap.turns.length)}
          hint="change log"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
            <CardDescription>
              UI must treat mismatched digests as unknown — never pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs">
            <Row k="ledgerDigest" v={report.provenance.ledgerDigest} />
            <Row k="resultsDigest" v={report.provenance.resultsDigest} />
            <Row k="commit" v={report.provenance.commit ?? "(none)"} />
            <Row k="producedBy" v={report.producedBy} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contracts</CardTitle>
            <CardDescription>
              JSON Schema SSOT + read-only HTTP surface. Git is the write path.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {schemas.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
            <Link
              href="/contracts"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Open contracts →
            </Link>
          </CardContent>
        </Card>
      </section>

      {report.problems.length > 0 && (
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
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: "ok" | "bad"
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4 pb-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={
            tone === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : tone === "bad"
                ? "text-destructive"
                : undefined
          }
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="px-4 pt-0 text-xs text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 break-all sm:flex-row sm:gap-3">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  )
}
