import { loadLedger } from "../fs/load.js"
import { loadWorkstream, listWorkstreams, checkSeal, writeWorkstream } from "../workstream/load.js"
import { evaluateDeferrals, activateDeferralsForWork, assertDeferralsSatisfied } from "../deferrals/index.js"
import { permissionStatus, planRevision } from "../permission/authority.js"
import { authorityStateDigest } from "../permission/local-ui.js"
import { verifyLedger } from "../verify/verify.js"
import { listDecisionsForTurn } from "../episodes/load.js"
import { writeDecision, assertOpenTurn } from "../episodes/write.js"
import { listAllReviews, codeBreakSatisfied, unresolvedBlockingReviews } from "../reviews/load.js"
import { computeTreeDigest } from "../git/tree.js"
import type { EpisodeDecision, Workstream } from "../types.js"

export interface ProgressUpdate {
  criterionIds: string[]
  implemented: boolean
  revisionDigest: string
  sourceDigest: string
  preview?: { url: string; label: string }
}

type ProgressDecision = EpisodeDecision & { progress?: ProgressUpdate }

/** Stable addresses within a revision; prose remains in the workstream spec. */
export function acceptanceItems(ws: Workstream) {
  const top = (ws.acceptanceCriteria ?? []).map((text, i) => ({ id: `AC-${i + 1}`, text }))
  return top.length ? top : (ws.suggestedSlices ?? []).flatMap(s =>
    s.acceptance.map((text, i) => ({ id: `${s.id}/AC-${i + 1}`, text })))
}

export function recordProgress(root: string, input: {
  turnId: string; summary: string; criterionIds: string[]; implemented: boolean
  preview?: { url: string; label: string }
}) {
  assertOpenTurn(root, input.turnId)
  const turn = loadLedger(root).turns.find(t => t.id === input.turnId)!
  const id = turn.intent.workstreamId
  if (!id) throw new Error("progress requires a workstream turn")
  if (!permissionStatus(root, id).allowed) throw new Error("permission does not allow progress writes")
  const ws = loadWorkstream(root, id)
  const ids = new Set(acceptanceItems(ws).map(c => c.id))
  if (!input.summary?.trim() || !Array.isArray(input.criterionIds) ||
      input.criterionIds.some(c => !ids.has(c)) || typeof input.implemented !== "boolean") {
    throw new Error("progress requires a summary, known criterion ids, and implemented boolean")
  }
  if (input.preview) {
    const url = new URL(input.preview.url)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !input.preview.label?.trim()) {
      throw new Error("preview must be a labeled HTTP(S) URL without credentials")
    }
  }
  const progress: ProgressUpdate = {
    criterionIds: [...new Set(input.criterionIds)], implemented: input.implemented,
    revisionDigest: planRevision(root, ws), sourceDigest: computeTreeDigest(root),
    ...(input.preview ? { preview: input.preview } : {}),
  }
  return writeDecision(root, {
    turnId: input.turnId, decision: input.summary, rationale: "Agent-reported progress; evidence is evaluated separately.",
    progress,
  } as Omit<ProgressDecision, "id" | "schemaVersion">)
}

export function getSession(root: string, workstreamId?: string) {
  const workstreams = listWorkstreams(root)
  const active = workstreams.filter(w => ["active", "sealed", "shaped", "draft"].includes(w.status))
  const choices = workstreams.filter(w => w.status !== "cancelled").sort((a,b) => b.id.localeCompare(a.id))
  const selected = workstreamId ?? (active.length === 1 ? active[0].id : active.length === 0 ? choices.find(w => w.status === "done")?.id : undefined)
  if (!selected) return {
    observedAt: new Date().toISOString(), selectionRequired: active.length > 1,
    choices: choices.map(w => ({ id: w.id, title: w.title })), session: null,
  }
  const ws = loadWorkstream(root, selected)
  const ledger = loadLedger(root)
  const report = verifyLedger(ledger)
  const permission = permissionStatus(root, selected)
  const revisionDigest = planRevision(root, ws)
  const sourceDigest = computeTreeDigest(root)
  const turns = ledger.turns.filter(t => t.intent.workstreamId === selected)
  const decisions = turns.flatMap(t => listDecisionsForTurn(root, t.id) as ProgressDecision[])
    .sort((a,b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  const current = decisions.filter(d => d.progress?.revisionDigest === revisionDigest && d.progress.sourceDigest === sourceDigest)
  const mapping = ws.acceptanceClaimIds ?? {}
  const criteria = acceptanceItems(ws).map(c => {
    const update = [...current].reverse().find(d => d.progress?.criterionIds.includes(c.id))
    const claimIds = mapping[c.id] ?? []
    const claims = claimIds.map(id => report.claims.find(r => r.claimId === id))
    const behavioral = claimIds.every(id => ledger.bindings.some(b => b.claimId === id && ["command", "results-row"].includes(b.locator.type)))
    const evidence = !claimIds.length || !behavioral || claims.some(r => !r) ? "missing"
      : claims.some(r => r?.outcome === "fail") ? "fail"
      : claims.some(r => r?.outcome === "missing" || r?.outcome === "unbound") ? "missing"
      : claims.some(r => r?.outcome === "attested") ? "attested" : "pass"
    return { ...c, implemented: update?.progress?.implemented ?? false, evidence, claimIds }
  })
  const reviews = listAllReviews(root).filter(r => r.workstreamId === selected || turns.some(t => t.id === r.turnId))
  const attention = permission.allowed ? [] : [...permission.reasons]
  const obligations = evaluateDeferrals(root, selected).filter(o => o.affected)
  for (const obligation of obligations.filter(o => o.state !== "resolved")) attention.push(`${obligation.decisionRef}: ${obligation.reasons.join("; ") || "Deferred commitment must be revisited before completion"}`)
  for (const criterion of criteria.filter(c => c.evidence === "fail")) attention.push(`A required check failed: ${criterion.text}`)
  if (unresolvedBlockingReviews(reviews).length) attention.push("Blocking review findings remain unresolved.")
  if (ws.policy?.requireCodeBreak !== false && !codeBreakSatisfied(reviews, sourceDigest)) attention.push("A code review of the current source is required.")
  const completionReasons = [...attention]
  if (!checkSeal(root, selected).ok) completionReasons.push("The spec snapshot is missing or has changed.")
  if (!criteria.length || criteria.some(c => !c.implemented || c.evidence !== "pass")) completionReasons.push("Every acceptance criterion needs current implementation and passing evidence.")
  if (turns.some(t => t.status === "open")) completionReasons.push("Close the open turn before completing the workstream.")
  if (ws.policy?.requireSpecBreak !== false && !reviews.some(r => r.id === ws.specBreakReviewId && r.target === "spec" && r.verdict === "approve" && (r.revisionDigest === revisionDigest || (!r.revisionDigest && permission.mode === "legacy-seal")))) completionReasons.push("The current spec needs its recorded independent review.")
  if (ws.policy?.requireCodeBreak !== false && (ws.suggestedSlices ?? []).some(s => !reviews.some(r => r.id === s.codeBreakReviewId && codeBreakSatisfied([r], sourceDigest)))) completionReasons.push("Every slice needs a review covering the current source.")
  const reportedPreview = [...current].reverse().find(d => d.progress?.preview)?.progress?.preview
  let latestPreview: ProgressUpdate["preview"]
  if (reportedPreview) {
    try {
      const url = new URL(reportedPreview.url)
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) latestPreview = reportedPreview
    } catch { /* Invalid stored preview remains unavailable. */ }
  }
  const seen = new Set<string>()
  const activity = [...decisions].reverse().filter(d => {
    if (seen.has(d.decision)) return false
    seen.add(d.decision); return true
  }).slice(0, 12)
    .map(d => ({ id: d.id, summary: d.decision, reason: d.rationale, discovery: d.discovery }))
  const handoff = (action: "approve" | "deny") =>
    `spec-ledger permission ${action} --workstream ${selected} --revision ${revisionDigest} --source 'user:cli-handoff'`
  return {
    observedAt: new Date().toISOString(), selectionRequired: false,
    choices: choices.map(w => ({ id: w.id, title: w.title })),
    session: {
      workstreamId: selected, title: ws.title, goal: ws.objective, specPath: ws.specPath,
      status: ws.status, revision: checkSeal(root, selected).ok ? ws.seal?.revision ?? null : null, revisionDigest, sourceDigest,
      permission, authorityDigest: authorityStateDigest(root), attention, criteria, activity, obligations,
      completion: { eligible: permission.allowed && completionReasons.length === 0, reasons: completionReasons },
      openTurnIds: turns.filter(t => t.status === "open").map(t => t.id),
      evidenceCount: criteria.filter(c => c.evidence === "pass").length,
      preview: latestPreview ? { ...latestPreview, availability: "unconfirmed", revisionDigest, sourceDigest } : null,
      handoff: { provenance: "portable-cli", approve: handoff("approve"), deny: handoff("deny") },
    },
  }
}

export type SessionProjection = ReturnType<typeof getSession>

/** Explicit completion checkpoint; observations never activate or mutate obligations. */
export function completeWorkstream(root: string, workstreamId: string) {
  activateDeferralsForWork(root, workstreamId)
  assertDeferralsSatisfied(root, workstreamId)
  const session = getSession(root, workstreamId).session!
  if (!session.completion.eligible) throw new Error(`Completion refused: ${session.completion.reasons.join("; ")}`)
  const ws = loadWorkstream(root, workstreamId)
  const next = { ...ws, status: "done" as const, updatedAt: new Date().toISOString() }
  writeWorkstream(root, next)
  return next
}
