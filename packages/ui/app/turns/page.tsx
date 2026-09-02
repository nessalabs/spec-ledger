import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import { serverClient } from "@/lib/ledger"
import { StaticMermaid } from "@/components/static-mermaid"
import type { Turn } from "@nessa/spec-ledger-client"

export const dynamic = "force-dynamic"

export default async function TurnsPage() {
  const client = serverClient()
  const turns = await client.getTurns()
  const closed = [...turns].reverse()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Change log
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Turns</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Intent is authored. Facts (files, digests, blast radius) come only from{" "}
          <code className="font-mono text-xs">spec-ledger turn close</code> — never
          agent self-report.
        </p>
      </header>

      {closed.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No turns yet. Open one with{" "}
          <code className="font-mono text-xs">spec-ledger turn open --goal …</code>
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {closed.map((turn) => (
            <TurnCard key={turn.id} turn={turn} />
          ))}
        </div>
      )}
    </div>
  )
}

function TurnCard({ turn }: { turn: Turn }) {
  const facts = turn.facts
  return (
    <Card id={turn.id}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-mono text-base">{turn.id}</CardTitle>
          <Badge variant={turn.status === "closed" ? "default" : "secondary"}>
            {turn.status}
          </Badge>
          {turn.intent.changeType ? (
            <Badge variant="outline">{turn.intent.changeType}</Badge>
          ) : null}
          {turn.intent.riskLevel ? (
            <Badge variant="outline">{turn.intent.riskLevel}</Badge>
          ) : null}
          {facts ? (
            <Badge variant={facts.verify.ok ? "default" : "destructive"}>
              verify {facts.verify.ok ? "OK" : "FAIL"}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="text-sm text-foreground">
          {turn.intent.restatedGoal}
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          opened {turn.openedAt}
          {turn.closedAt ? ` · closed ${turn.closedAt}` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Intent
          </h3>
          <p className="text-sm leading-relaxed">{turn.intent.userPrompt}</p>
          {turn.intent.acceptanceCriteria?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {turn.intent.acceptanceCriteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
          {turn.intent.decisions?.length ? (
            <div className="space-y-2">
              {turn.intent.decisions.map((d) => (
                <div key={d.decision} className="rounded-md border border-border px-3 py-2">
                  <p className="text-sm font-medium">{d.decision}</p>
                  <p className="text-xs text-muted-foreground">{d.rationale}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {facts ? (
          <section className="space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Facts (tool)
            </h3>
            <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
              <FactRow k="commit" v={facts.commit ?? "(none)"} />
              <FactRow k="files" v={String(facts.files.length)} />
              <FactRow k="ledgerDigest" v={facts.verify.ledgerDigest} />
              <FactRow k="resultsDigest" v={facts.verify.resultsDigest} />
              <FactRow
                k="claims"
                v={facts.touchedClaimIds.join(", ") || "—"}
              />
              <FactRow
                k="features"
                v={facts.touchedFeatureIds.join(", ") || "—"}
              />
              <FactRow
                k="blast direct"
                v={facts.blastRadius.direct.join(", ") || "—"}
              />
              <FactRow
                k="schema surface"
                v={facts.schemaSurfaceChanged ? "changed" : "unchanged"}
              />
            </div>
            {facts.files.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto font-mono text-[11px] text-muted-foreground">
                {facts.files.slice(0, 40).map((f) => (
                  <li key={f.path}>
                    <span className="text-foreground">{f.kind[0]}</span> {f.path}
                    {f.additions != null || f.deletions != null
                      ? ` (+${f.additions ?? 0}/-${f.deletions ?? 0})`
                      : ""}
                  </li>
                ))}
                {facts.files.length > 40 ? (
                  <li>… {facts.files.length - 40} more</li>
                ) : null}
              </ul>
            ) : null}
          </section>
        ) : null}

        {turn.intent.flows?.map((flow) => (
          <section key={flow.id} className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Flow · {flow.title}
            </h3>
            {flow.narrative ? (
              <p className="text-sm text-muted-foreground">{flow.narrative}</p>
            ) : null}
            <StaticMermaid chart={flow.after} className="[&_svg]:max-w-full" />
          </section>
        ))}
      </CardContent>
    </Card>
  )
}

function FactRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 truncate break-all">{v}</span>
    </div>
  )
}
