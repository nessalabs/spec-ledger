import Link from "next/link"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import type { Turn, TurnEpisode, VerifyReport } from "@nessa/spec-ledger-client"
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
        {(turn.intent.workstreamId || turn.opened?.contextDigest) && (
          <p className="font-mono text-[11px] text-muted-foreground">
            {turn.intent.workstreamId ? (
              <span>
                {turn.intent.workstreamId}
                {turn.intent.sliceId ? ` / ${turn.intent.sliceId}` : ""}
              </span>
            ) : null}
            {turn.opened?.contextDigest ? (
              <span>
                {turn.intent.workstreamId ? " · " : ""}
                ctx {turn.opened.contextDigest.slice(0, 12)}…
              </span>
            ) : null}
          </p>
        )}
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
  episode,
}: {
  turn: Turn
  report: VerifyReport | null
  episode?: TurnEpisode | null
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
        {(turn.intent.workstreamId || turn.opened?.contextDigest) && (
          <p className="font-mono text-xs text-muted-foreground">
            {turn.intent.workstreamId ? (
              <span>
                workstream{" "}
                <Link
                  href={`/workstreams/${encodeURIComponent(turn.intent.workstreamId)}`}
                  className="underline-offset-4 hover:underline"
                >
                  {turn.intent.workstreamId}
                </Link>
                {turn.intent.sliceId ? ` · slice ${turn.intent.sliceId}` : ""}
              </span>
            ) : null}
            {turn.opened?.contextDigest ? (
              <span>
                {turn.intent.workstreamId ? " · " : ""}
                contextDigest {turn.opened.contextDigest}
              </span>
            ) : null}
            {turn.opened?.contextSealRevision != null ? (
              <span> · seal rev {turn.opened.contextSealRevision}</span>
            ) : null}
          </p>
        )}
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
          {(turn.intent.workstreamId || turn.intent.featureIds?.length) && (
            <div className="flex flex-wrap gap-2 font-mono text-xs">
              {turn.intent.workstreamId ? (
                <Link href={`/workstreams/${encodeURIComponent(turn.intent.workstreamId)}`}>
                  <Badge variant="outline">{turn.intent.workstreamId}</Badge>
                </Link>
              ) : null}
              {turn.intent.sliceId ? (
                <Badge variant="outline">{turn.intent.sliceId}</Badge>
              ) : null}
              {turn.intent.featureIds?.map((f) => (
                <Link key={f} href={`/features/${encodeURIComponent(f)}`}>
                  <Badge variant="secondary">{f}</Badge>
                </Link>
              ))}
            </div>
          )}
          {turn.opened?.contextDigest ? (
            <div>
              <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Context digest
              </h3>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {turn.opened.contextDigest}
              </p>
            </div>
          ) : null}
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

      {episode &&
      (episode.reviews.length ||
        episode.decisions.length ||
        episode.attachments.length ||
        episode.sources.length ||
        episode.probes.length ||
        episode.flows.length) ? (
        <Card>
          <CardHeader>
            <CardTitle>Episode</CardTitle>
            <CardDescription>
              Side collections for this turn (history — not verify truth).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {episode.reviews.length ? (
              <EpisodeBlock title="Reviews">
                {episode.reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{r.id}</span>
                      <Badge variant="outline">{r.verdict}</Badge>
                      {r.blocking ? <Badge variant="destructive">blocking</Badge> : null}
                    </div>
                    <p className="mt-1 text-muted-foreground">{r.summary}</p>
                    {r.killersCited?.length ? (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        killers: {r.killersCited.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </EpisodeBlock>
            ) : null}
            {episode.decisions.length ? (
              <EpisodeBlock title="Decisions">
                {episode.decisions.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <p className="font-mono text-xs text-muted-foreground">{d.id}</p>
                    <p className="font-medium">{d.decision}</p>
                    <p className="text-muted-foreground">{d.rationale}</p>
                  </div>
                ))}
              </EpisodeBlock>
            ) : null}
            {episode.attachments.length ? (
              <EpisodeBlock title="Attachments">
                {episode.attachments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-border px-3 py-2 font-mono text-xs"
                  >
                    <span>{a.id}</span>
                    {a.kind ? (
                      <Badge variant="outline" className="ml-2">
                        {a.kind}
                      </Badge>
                    ) : null}
                    <p className="mt-1 break-all text-muted-foreground">{a.path}</p>
                    {a.mediaType ? (
                      <p className="text-muted-foreground">{a.mediaType}</p>
                    ) : null}
                  </div>
                ))}
              </EpisodeBlock>
            ) : null}
            {episode.sources.length ? (
              <EpisodeBlock title="Sources">
                {episode.sources.map((s) => (
                  <div key={s.id} className="font-mono text-xs text-muted-foreground">
                    {s.id} · {s.kind} · {s.ref}
                  </div>
                ))}
              </EpisodeBlock>
            ) : null}
            {episode.probes.length ? (
              <EpisodeBlock title="Probes">
                {episode.probes.map((p) => (
                  <div key={p.id} className="text-sm">
                    <span className="font-mono text-xs">{p.id}</span> {p.question}
                    {p.outcome ? (
                      <span className="text-muted-foreground"> → {p.outcome}</span>
                    ) : null}
                  </div>
                ))}
              </EpisodeBlock>
            ) : null}
            {episode.flows.length
              ? episode.flows.map((flow) => (
                  <div key={flow.id} className="space-y-2">
                    <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Flow · {flow.title}
                    </h3>
                    <StaticMermaid chart={flow.after} className="[&_svg]:max-w-full" />
                  </div>
                ))
              : null}
          </CardContent>
        </Card>
      ) : null}

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

function EpisodeBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
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
