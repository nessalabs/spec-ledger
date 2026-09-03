import Link from "next/link"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"
import type {
  Turn,
  TurnEpisode,
  VerifyReport,
  Workstream,
} from "@nessa/spec-ledger-client"

type EpisodeReview = TurnEpisode["reviews"][number]
import { StaticMermaid } from "@/components/static-mermaid"
import { TurnFilesCard } from "@/components/turn-files"
import {
  RelatedDocsList,
} from "@/components/turn-doc-split"
import { TurnPlanSection } from "@/components/turn-plan-section"
import { CompactTurnRow } from "@/components/compact-turn-row"
import { FreshnessBadge, TurnVerifyBadge } from "@/components/freshness-badge"
import {
  fileKindLabel,
  formatWhen,
  humanStatus,
  shortPath,
  turnImpactSummary,
} from "@/lib/impact"
import type { CommitInfo } from "@/lib/git"
import { turnFreshness } from "@/lib/turns"

export type RelatedDoc = {
  path: string
  label: string
  /** Repo file text when readable — enables right-pane FilePreview. */
  content?: string | null
}

export function TurnSummaryCard({
  turn,
  report,
  compact = false,
  workstreamTitle,
}: {
  turn: Turn
  report: VerifyReport | null
  /** One-line list row — use on index pages. */
  compact?: boolean
  /** Optional title for the workstream pill. */
  workstreamTitle?: string | null
}) {
  const freshness = turnFreshness(turn, report)
  const impact = turnImpactSummary(turn)
  const when = formatWhen(turn.closedAt ?? turn.openedAt)
  const fileBit = impact.product.length
    ? `${impact.product.length} files${
        impact.additions || impact.deletions
          ? ` +${impact.additions}/−${impact.deletions}`
          : ""
      }`
    : turn.facts
      ? "ledger-only"
      : "open"
  const areas = impact.areas
    .slice(0, 3)
    .map((a) => a.area.replace(/^packages\//, ""))
    .join(", ")
  const wsId = turn.intent.workstreamId

  if (compact) {
    return (
      <CompactTurnRow
        turn={turn}
        report={report}
        workstreamTitle={workstreamTitle}
      />
    )
  }

  return (
    <div className="rounded-lg border border-border/80 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {wsId ? (
            <Link
              href={`/workstreams/${encodeURIComponent(wsId)}`}
              title={workstreamTitle ?? wsId}
              className="no-underline"
            >
              <Badge
                variant="outline"
                className="font-mono text-[10px] font-normal"
              >
                {wsId}
              </Badge>
            </Link>
          ) : null}
          <Link
            href={`/turns/${turn.id}`}
            className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground no-underline hover:underline"
          >
            {turn.intent.restatedGoal}
          </Link>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">{when}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {humanStatus(turn.status)}
        {turn.intent.changeType ? ` · ${turn.intent.changeType}` : ""}
        {` · ${fileBit}`}
        {areas ? ` · ${areas}` : ""}
        {freshness === "stale" ? " · verify outdated" : ""}
      </p>
      {impact.previewPaths.length > 0 ? (
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/90">
          {impact.previewPaths
            .slice(0, 3)
            .map((f) => `${fileKindLabel(f.kind)}${shortPath(f.path)}`)
            .join("  ")}
          {impact.product.length > 3 ? `  +${impact.product.length - 3}` : ""}
        </p>
      ) : null}
    </div>
  )
}

export function TurnDetail({
  turn,
  report,
  episode,
  workstream,
  commit,
  relatedDocs,
  planMarkdown,
  planPath,
  featureMeta,
}: {
  turn: Turn
  report: VerifyReport | null
  episode?: TurnEpisode | null
  workstream?: Workstream | null
  commit?: CommitInfo | null
  relatedDocs?: RelatedDoc[]
  planMarkdown?: string | null
  planPath?: string | null
  featureMeta?: Array<{ id: string; name: string }>
}) {
  const facts = turn.facts
  const freshness = turnFreshness(turn, report)
  const impact = turnImpactSummary(turn)
  const slice = workstream?.suggestedSlices?.find(
    (s) => s.id === turn.intent.sliceId,
  )
  const flows = [
    ...(turn.intent.flows ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      narrative: f.narrative,
      before: f.before,
      after: f.after,
    })),
    ...(episode?.flows ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      narrative: undefined as string | undefined,
      before: undefined as string | undefined,
      after: f.after,
    })),
  ]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/turns" className="no-underline hover:underline">
            Changes
          </Link>
          {turn.intent.workstreamId ? (
            <>
              {" / "}
              <Link
                href={`/workstreams/${encodeURIComponent(turn.intent.workstreamId)}`}
                className="no-underline hover:underline"
              >
                {workstream?.title ?? turn.intent.workstreamId}
              </Link>
            </>
          ) : null}
        </p>
        <h1 className="max-w-3xl text-2xl font-semibold tracking-tight">
          {turn.intent.restatedGoal}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{humanStatus(turn.status)}</span>
          <span aria-hidden>·</span>
          <span>{formatWhen(turn.closedAt ?? turn.openedAt)}</span>
          {turn.intent.changeType ? (
            <>
              <span aria-hidden>·</span>
              <span className="capitalize">{turn.intent.changeType}</span>
            </>
          ) : null}
          <span className="font-mono text-xs text-muted-foreground/70">{turn.id}</span>
        </div>
        {freshness === "stale" ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200/90">
            Recorded verify no longer matches the live ledger — treat pass/fail as
            unknown. See{" "}
            <Link href="/verify" className="underline-offset-4 hover:underline">
              live verify
            </Link>
            .
          </p>
        ) : null}
      </header>

      {flows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Before → after</h2>
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardHeader>
                <CardTitle className="text-base">{flow.title}</CardTitle>
                {flow.narrative ? (
                  <CardDescription>{flow.narrative}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {flow.before ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground">
                      Before
                    </h3>
                    <StaticMermaid chart={flow.before} className="[&_svg]:max-w-full" />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    {flow.before ? "After" : "Flow"}
                  </h3>
                  <StaticMermaid chart={flow.after} className="[&_svg]:max-w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {commit ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Commit</h2>
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base font-medium leading-snug">
                {commit.subject}
              </CardTitle>
              <CardDescription className="font-mono text-[11px]">
                {commit.short}
              </CardDescription>
            </CardHeader>
            {commit.body ? (
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                  {commit.body}
                </pre>
              </CardContent>
            ) : null}
          </Card>
        </section>
      ) : null}

      {relatedDocs && relatedDocs.length > 0 ? (
        <RelatedDocsList docs={relatedDocs} />
      ) : null}

      {(workstream || turn.intent.userPrompt || planMarkdown) && (
        <TurnPlanSection
          workstream={workstream}
          sliceTitle={slice?.title}
          planMarkdown={planMarkdown}
          planPath={planPath}
          userPrompt={turn.intent.userPrompt}
        />
      )}

      {episode &&
      (episode.reviews.length ||
        episode.decisions.length ||
        episode.probes.length) ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Trail</h2>
          {episode.reviews.length ? (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">Reviews</h3>
              {episode.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          ) : null}
          {episode.decisions.length ? (
            <div className="space-y-2">
              {episode.decisions.map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <p className="font-medium">{d.decision}</p>
                  <p className="text-muted-foreground">{d.rationale}</p>
                </div>
              ))}
            </div>
          ) : null}
          {episode.probes.length ? (
            <div className="space-y-1 text-sm">
              {episode.probes.map((p) => (
                <p key={p.id}>
                  {p.question}
                  {p.outcome ? (
                    <span className="text-muted-foreground"> → {p.outcome}</span>
                  ) : null}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {turn.intent.acceptanceCriteria?.length ||
      turn.intent.outOfScope?.length ||
      turn.intent.decisions?.length ? (
        <details className="rounded-lg border border-border/60 px-4 py-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Turn intent details
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            {turn.intent.acceptanceCriteria?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {turn.intent.acceptanceCriteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            {turn.intent.outOfScope?.length ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Out of scope</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {turn.intent.outOfScope.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {turn.intent.decisions?.map((d) => (
              <div key={d.decision}>
                <p className="font-medium">{d.decision}</p>
                <p className="text-muted-foreground">{d.rationale}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {facts?.files?.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Files
            <span className="ms-2 font-normal">
              {impact.product.length} product
              {impact.additions || impact.deletions
                ? ` · +${impact.additions}/−${impact.deletions}`
                : ""}
            </span>
          </h2>
          <TurnFilesCard files={facts.files} />
        </section>
      ) : !facts ? (
        <p className="text-sm text-muted-foreground">
          Still open — close the turn to attach commit, files, and architecture.
        </p>
      ) : null}

      {(impact.features.length > 0 ||
        impact.nodes.length > 0 ||
        workstream) && (
        <details className="rounded-lg border border-border/60 px-4 py-3 text-sm" open>
          <summary className="cursor-pointer text-muted-foreground">
            Architecture touch
            {workstream || impact.features.length
              ? ` · ${workstream ? "1 workstream" : ""}${
                  workstream && impact.features.length ? " · " : ""
                }${
                  impact.features.length
                    ? `${impact.features.length} feature${impact.features.length === 1 ? "" : "s"}`
                    : ""
                }`
              : ""}
          </summary>
          <div className="mt-3 space-y-3">
            {workstream ? (
              <div>
                <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Workstream
                </h3>
                <Link
                  href={`/workstreams/${encodeURIComponent(workstream.id)}`}
                  className="text-sm hover:underline"
                >
                  {workstream.title}{" "}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {workstream.id}
                  </span>
                </Link>
              </div>
            ) : null}
            {impact.features.length ? (
              <div>
                <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Features
                </h3>
                <div className="flex flex-wrap gap-2">
                  {impact.features.map((id) => {
                    const meta = featureMeta?.find((f) => f.id === id)
                    return (
                      <Link key={id} href={`/features/${encodeURIComponent(id)}`}>
                        <Badge variant="secondary">
                          {meta?.name ?? id}
                          <span className="ms-1 font-mono text-[10px] text-muted-foreground">
                            {id}
                          </span>
                        </Badge>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <ChipRow label="Packages / nodes" hrefPrefix="/nodes" ids={impact.nodes} />
            <ChipRow
              label="Direct blast"
              hrefPrefix="/nodes"
              ids={impact.blastDirect}
            />
            {impact.claims.length ? (
              <ChipRow label="Claims" hrefPrefix="/claims" ids={impact.claims} />
            ) : null}
          </div>
        </details>
      )}

      {facts ? (
        <details className="rounded-lg border border-border/60 px-4 py-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Ledger internals
          </summary>
          <div className="mt-3 space-y-3 font-mono text-xs">
            <div className="flex flex-wrap gap-2">
              <TurnVerifyBadge ok={facts.verify.ok} freshness={freshness} />
              <FreshnessBadge freshness={freshness} />
            </div>
            <FactRow k="commit" v={facts.commit ?? "(none)"} />
            <FactRow k="ledgerDigest" v={facts.verify.ledgerDigest} />
            <FactRow k="resultsDigest" v={facts.verify.resultsDigest} />
          </div>
        </details>
      ) : null}
    </div>
  )
}

function ChipRow({
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
      <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <Link key={id} href={`${hrefPrefix}/${encodeURIComponent(id)}`}>
            <Badge variant="secondary">{id}</Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}

function ReviewCard({ review }: { review: EpisodeReview }) {
  const findings = review.findings ?? []
  const killers = review.killersCited ?? []
  const headline = review.plainSummary?.trim()
  return (
    <div className="rounded-lg border border-border px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{review.id}</span>
        <Badge variant="outline">{review.verdict}</Badge>
        {review.target ? (
          <Badge variant="secondary">{review.target}</Badge>
        ) : null}
        {review.kind ? (
          <Badge variant="outline" className="font-normal">
            {review.kind}
          </Badge>
        ) : null}
        {review.blocking ? <Badge variant="destructive">blocking</Badge> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{review.reviewer}</p>
      {headline ? (
        <p className="mt-2 text-foreground">{headline}</p>
      ) : (
        <p className="mt-2 text-muted-foreground">{review.summary}</p>
      )}
      {review.resolvesReviewId ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Resolves {review.resolvesReviewId}
        </p>
      ) : null}
      {findings.length ? (
        <ul className="mt-3 space-y-3 border-t border-border/60 pt-3">
          {findings.map((f) => {
            const impact = f.plainImpact?.trim()
            const hasTech = Boolean(f.gap || f.fixProposal)
            return (
              <li key={f.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px]">{f.id}</span>
                  <Badge variant="outline">{f.severity}</Badge>
                </div>
                {impact ? (
                  <p className="text-foreground/90">{impact}</p>
                ) : (
                  <p className="text-foreground/90">{f.gap}</p>
                )}
                {hasTech && impact ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Technical</summary>
                    <p className="mt-1">{f.gap}</p>
                    {f.fixProposal ? (
                      <p className="mt-1">Fix: {f.fixProposal}</p>
                    ) : null}
                  </details>
                ) : f.fixProposal && !impact ? (
                  <p className="text-xs text-muted-foreground">Fix: {f.fixProposal}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {(headline || killers.length) && review.summary ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Technical notes
            {killers.length ? ` · ${killers.length} killers` : ""}
          </summary>
          {headline ? (
            <p className="mt-2 text-xs text-muted-foreground">{review.summary}</p>
          ) : null}
          {killers.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[11px] text-muted-foreground">
              {killers.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : killers.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Killers cited ({killers.length})
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[11px] text-muted-foreground">
            {killers.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </details>
      ) : null}
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
