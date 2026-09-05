import { CheckEvidencePanel } from "@/components/check-evidence"
import Link from "next/link"
import { Badge } from "@nessalabs/ui"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { presentationCopy } from "@/lib/features"

type Session = NonNullable<SessionProjection["session"]>
const label = (outcome: string) => outcome === "pass" ? "Passing" : outcome === "fail" ? "Failed" : outcome === "attested" ? "Attested only" : "Evidence needed"

export function WorkstreamEvidence({ session, observedAt, expandChecks = false }: { session: Session; observedAt: string; expandChecks?: boolean }) {
  return <section className="space-y-5" aria-label="Verification and evidence">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">What proves it</h2><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Check details</summary><p>Observed {observedAt}. Opening this page does not run tests.</p></details></div>
    {!session.criteria.length && <p className="text-sm">No acceptance criteria are available in this evidence view.</p>}
    {session.criteria.map(criterion => <article id={`acceptance-${encodeURIComponent(criterion.id)}`} key={criterion.id} className="scroll-mt-6 space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-medium">{presentationCopy(criterion.text)}</h3>
        <Badge variant={criterion.evidence === "fail" ? "destructive" : "outline"}>{label(criterion.evidence)}</Badge>
      </div>
      {criterion.evidence === "fail" && <p className="text-sm text-destructive">A check failed. Inspect the proof below.</p>}
      {criterion.evidence !== "pass" && criterion.evidence !== "fail" && criterion.claims.length > 0 && <p className="text-sm">{criterion.evidence === "attested" ? "A written observation is available; passing test evidence is still needed." : "Current passing evidence is not available."}</p>}
      {!criterion.claims.length && <p className="text-sm">No checks are mapped to this requirement yet.</p>}
      {criterion.claims.flatMap(claim => claim.checks).map((check, index, checks) => <CheckEvidencePanel key={check.id} bindingId={check.id} defaultOpen={expandChecks} label={checks.length === 1 ? "View proof" : `View proof ${index + 1} · ${label(check.outcome)}`} />)}
      <details><summary className="cursor-pointer text-xs text-muted-foreground">Evidence details and history</summary><div className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">{criterion.implemented ? "Implementation recorded · agent reported" : "Implementation not confirmed for this version"}</p>
      {criterion.reason && <p className="text-sm">{criterion.reason}</p>}
      {criterion.claims.map(claim => <div key={claim.id} className="space-y-2 border-t border-border pt-3">
        <p className="text-sm"><Link className="underline" href={`/claims/${encodeURIComponent(claim.id)}`}>{claim.id}</Link> · {presentationCopy(claim.statement)}</p>
        {claim.reason && <p className="text-sm text-muted-foreground">{claim.reason}</p>}
        {!claim.checks.length && <p className="text-xs">No check definitions found.</p>}
        {claim.checks.map(check => <details open={expandChecks} key={check.id} className="rounded-lg bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm">{label(check.outcome)} · {check.kind} check · {check.id}</summary>
          <div className="mt-3 space-y-3 text-xs">
            <p>{check.reason ?? (check.outcome === "pass" ? "Current verifier accepts this check." : "No current evidence available.")}</p>
            <div><p className="mb-1 font-medium">What was checked</p><pre className="whitespace-pre-wrap break-words rounded border border-border p-2">{check.definition.command ?? check.definition.path ?? check.definition.resultsKey ?? check.definition.note ?? check.definition.type}</pre></div>
            {check.definition.type === "path" && <p>File presence is structural evidence; it does not prove behavior.</p>}
            {!check.recorded.length && <p>No recorded execution result. A check definition is not a test run.</p>}
            {check.recorded.map((row, index) => <div key={index} className="space-y-1 border-t border-border pt-2">
              <p className="font-medium">Recorded outcome: {row.outcome} · historical observation</p>
              <p>Run: {row.runId ?? "Not recorded"}</p>
              <p>Run time: {row.receipt?.producedAt ?? "Not attributable to a saved receipt"}</p>
              <p>Producer: {row.receipt?.producer ?? "Unknown"}</p>
              <p className="break-all">Source: {row.sourceDigest ?? "Unknown"}</p>
              <p className="break-all">Check: {row.checkDigest ?? "Unknown"}</p>
              <p className="pt-2 font-medium">Recorded output</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-border p-2">{row.detail ?? "No detailed output was retained."}</pre>
              {(row.artifacts ?? []).map((artifact, i) => <p key={i} className="break-all">Artifact: {artifact.path ?? artifact.url ?? "Unspecified"} · {artifact.required ? "required" : "optional"} · SHA-256 {artifact.sha256}</p>)}
            </div>)}
          </div>
        </details>)}
      </div>)}
      </div></details>
    </article>)}
    <section className="space-y-3"><h3 className="font-medium">Reviews and remaining risks</h3>
      {!session.reviews.length && <p className="text-sm text-muted-foreground">No reviews recorded.</p>}
      <details><summary className="cursor-pointer text-sm">{session.reviews.filter(r => r.current).length} current · {session.reviews.filter(r => !r.current).length} historical reviews — read findings and risks</summary><div className="mt-3 space-y-2">
      {[...session.reviews].reverse().map(review => <details key={review.id} className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm">{review.current ? "Current" : "Historical"} · {review.target ?? "code"} review · {review.verdict} · {presentationCopy(review.summary)}</summary>
        <div className="mt-3 space-y-2 text-xs">
          {review.turnId ? <Link className="underline" href={`/turns/${review.turnId}`}>{review.id}</Link> : <p>{review.id}</p>}
          {!review.current && <p>This review is not bound to the current version.</p>}
          {review.findings.map(f => <p key={f.id}>{presentationCopy(f.plainImpact ?? f.gap)}{f.severity ? ` (${f.severity})` : ""}</p>)}
          {review.residualRisks.map((risk, i) => <p key={i}>{presentationCopy(risk)}</p>)}
          {!review.findings.length && !review.residualRisks.length && <p>No findings or residual risks recorded.</p>}
        </div>
      </details>)}
      </div></details>
    </section>
    <details className="space-y-3"><summary className="cursor-pointer font-medium">Supporting files · {session.artifacts.length}</summary>
      <p className="text-xs text-muted-foreground">These support the workstream history. Matching a file digest does not make a manual observation a current passing test.</p>
      {!session.artifacts.length && <p className="text-sm text-muted-foreground">No artifacts attached yet.</p>}
      {session.artifacts.map(artifact => <details key={artifact.id} className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm">{artifact.title} · {artifact.status === "verified" ? "Integrity checked" : artifact.status}</summary>
        <div className="mt-3 space-y-2 text-xs">
          <p className="break-all">{artifact.path}</p><p>{artifact.reason}</p>
          <Link className="underline" href={`/turns/${artifact.turnId}`}>Recorded in {artifact.turnId}</Link>
          {artifact.note && <p>{artifact.note}</p>}
          {artifact.text !== null && <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-border p-3">{artifact.text}</pre>}
        </div>
      </details>)}
    </details>
  </section>
}
