import Link from "next/link"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import type { Turn, VerifyReport } from "@nessa/spec-ledger-client"
import { StaticMermaid } from "@/components/static-mermaid"
import { FreshnessBadge, TurnVerifyBadge } from "@/components/freshness-badge"
import { turnFreshness } from "@/lib/turns"

export function TurnSummaryCard({
  turn,
  report,
}: {
  turn: Turn
  report: VerifyReport | null
}) {
  const freshness = turnFreshness(turn, report)
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/turns/${turn.id}`}
            className="font-mono text-base font-semibold text-foreground no-underline hover:underline"
          >
            {turn.id}
          </Link>
          <Badge variant={turn.status === "closed" ? "default" : "secondary"}>
            {turn.status}
          </Badge>
          {turn.intent.changeType ? (
            <Badge variant="outline">{turn.intent.changeType}</Badge>
          ) : null}
          <TurnVerifyBadge ok={turn.facts?.verify.ok} freshness={freshness} />
          <FreshnessBadge freshness={freshness} />
        </div>
        <CardDescription className="text-sm text-foreground">
          {turn.intent.restatedGoal}
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          opened {turn.openedAt}
          {turn.closedAt ? ` · closed ${turn.closedAt}` : ""}
          {turn.facts ? ` · ${turn.facts.files.length} files` : ""}
        </p>
      </CardHeader>
    </Card>
  )
}

export function TurnDetail({
  turn,
  report,
}: {
  turn: Turn
  report: VerifyReport | null
}) {
  const facts = turn.facts
  const freshness = turnFreshness(turn, report)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/turns" className="text-muted-foreground no-underline hover:underline">
            Turns
          </Link>
          {" / "}
          {turn.id}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{turn.id}</h1>
          <Badge variant={turn.status === "closed" ? "default" : "secondary"}>
            {turn.status}
          </Badge>
          {turn.intent.changeType ? (
            <Badge variant="outline">{turn.intent.changeType}</Badge>
          ) : null}
          {turn.intent.riskLevel ? (
            <Badge variant="outline">{turn.intent.riskLevel}</Badge>
          ) : null}
          <TurnVerifyBadge ok={facts?.verify.ok} freshness={freshness} />
          <FreshnessBadge freshness={freshness} />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {turn.intent.restatedGoal}
        </p>
        <p className="text-xs text-muted-foreground">
          opened {turn.openedAt}
          {turn.closedAt ? ` · closed ${turn.closedAt}` : ""}
        </p>
        {freshness === "stale" ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Turn digests no longer match the live ledger. Treat this turn&apos;s verify
            outcome as <strong>unknown</strong> — re-run{" "}
            <code className="font-mono text-xs">spec-ledger turn close</code> or trust
            live <Link href="/verify">/verify</Link> only.
          </p>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Intent</CardTitle>
          <CardDescription>Authored by human / agent — not verify truth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{turn.intent.userPrompt}</p>
          {turn.intent.acceptanceCriteria?.length ? (
            <div>
              <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Acceptance
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {turn.intent.acceptanceCriteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {turn.intent.outOfScope?.length ? (
            <div>
              <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Out of scope
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {turn.intent.outOfScope.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {turn.intent.decisions?.length ? (
            <div className="space-y-2">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Decisions
              </h3>
              {turn.intent.decisions.map((d) => (
                <div key={d.decision} className="rounded-md border border-border px-3 py-2">
                  <p className="text-sm font-medium">{d.decision}</p>
                  <p className="text-xs text-muted-foreground">{d.rationale}</p>
                  {d.alternativesRejected?.length ? (
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      Rejected: {d.alternativesRejected.join("; ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {facts ? (
        <Card>
          <CardHeader>
            <CardTitle>Facts</CardTitle>
            <CardDescription>
              Written only by <code className="font-mono text-xs">turn close</code>{" "}
              from git + verify.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
              <FactRow k="commit" v={facts.commit ?? "(none)"} />
              <FactRow k="producedBy" v={facts.producedBy} />
              <FactRow k="ledgerDigest" v={facts.verify.ledgerDigest} />
              <FactRow k="resultsDigest" v={facts.verify.resultsDigest} />
              <FactRow
                k="schema surface"
                v={facts.schemaSurfaceChanged ? "changed" : "unchanged"}
              />
              <FactRow k="files" v={String(facts.files.length)} />
            </div>

            <LinkRow
              label="Claims"
              hrefPrefix="/claims"
              ids={facts.touchedClaimIds}
            />
            <LinkRow
              label="Features"
              hrefPrefix="/features"
              ids={facts.touchedFeatureIds}
            />
            <LinkRow label="Nodes" hrefPrefix="/nodes" ids={facts.touchedNodeIds} />
            <LinkRow
              label="Blast · direct"
              hrefPrefix="/nodes"
              ids={facts.blastRadius.direct}
            />
            <LinkRow
              label="Blast · transitive"
              hrefPrefix="/nodes"
              ids={facts.blastRadius.transitive}
            />

            {facts.files.length > 0 ? (
              <ul className="max-h-64 overflow-y-auto rounded-md border border-border p-3 font-mono text-[11px] text-muted-foreground">
                {facts.files.map((f) => (
                  <li key={f.path}>
                    <span className="text-foreground">{f.kind[0]}</span> {f.path}
                    {f.additions != null || f.deletions != null
                      ? ` (+${f.additions ?? 0}/-${f.deletions ?? 0})`
                      : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Open turn — run{" "}
          <code className="font-mono text-xs">spec-ledger turn close --id {turn.id}</code>{" "}
          to attach git + verify facts.
        </p>
      )}

      {turn.intent.flows?.map((flow) => (
        <Card key={flow.id}>
          <CardHeader>
            <CardTitle>Flow · {flow.title}</CardTitle>
            {flow.narrative ? (
              <CardDescription>{flow.narrative}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {flow.before ? (
              <div className="space-y-2">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Before
                </h3>
                <StaticMermaid chart={flow.before} className="[&_svg]:max-w-full" />
              </div>
            ) : null}
            <div className="space-y-2">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                After
              </h3>
              <StaticMermaid chart={flow.after} className="[&_svg]:max-w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function FactRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="min-w-0 break-all">{v}</span>
    </div>
  )
}

function LinkRow({
  label,
  hrefPrefix,
  ids,
}: {
  label: string
  hrefPrefix: string
  ids: string[]
}) {
  if (!ids.length) return null
  return (
    <div>
      <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <Link key={id} href={`${hrefPrefix}/${encodeURIComponent(id)}`}>
            <Badge variant="secondary" className="font-mono">
              {id}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}
