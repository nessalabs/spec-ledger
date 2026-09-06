import { checkVisualEvidence } from "../evidence/visual.js"
import { claimEvidence, attachmentEvidence } from "./evidence.js"
import { listAttachmentsForTurn } from "../episodes/load.js"
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
import { projectWorkflow } from "../workflows/index.js"
import { projectExecution } from "../execution/index.js"
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
  const choices = workstreams.filter(w => w.status !== "cancelled").sort((a,b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id))
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
    .sort((a,b) => (turns.findIndex(t=>t.id===a.turnId)-turns.findIndex(t=>t.id===b.turnId)) || (a.sequence ?? 0)-(b.sequence ?? 0) || (a.recordedAt ?? "").localeCompare(b.recordedAt ?? ""))
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
    const reason = !claimIds.length ? "No claims are mapped to this requirement."
      : !behavioral ? "Every mapped claim needs a behavioral result; file presence or attestation alone cannot verify this requirement."
      : claims.some(r => !r) ? "A mapped claim is missing from the current verification report."
      : claims.filter(r => r?.outcome !== "pass").map(r => r?.detail ?? r?.outcome).join("; ") || null
    return { ...c, implemented: update?.progress?.implemented ?? false, evidence, reason, claimIds, claims: claimEvidence(ledger, report, claimIds) }
  })
  const reviews = listAllReviews(root).filter(r => r.workstreamId === selected || turns.some(t => t.id === r.turnId))
  const attention = permission.allowed ? [] : [...permission.reasons]
  const obligations = evaluateDeferrals(root, selected).filter(o => o.affected)
  for (const obligation of obligations.filter(o => o.state !== "resolved")) attention.push(`${obligation.decisionRef}: ${obligation.reasons.join("; ") || "Deferred commitment must be revisited before completion"}`)
  for (const criterion of criteria.filter(c => c.evidence === "fail")) attention.push(`A required check failed: ${criterion.text}`)
  if (unresolvedBlockingReviews(reviews).length) attention.push("Blocking review findings remain unresolved.")
  if (ws.policy?.requireCodeBreak !== false && !codeBreakSatisfied(reviews, sourceDigest)) attention.push("A code review of the current source is required.")
  const visualEvidence = checkVisualEvidence(root, selected)
  const workflow = projectWorkflow(root, selected)
  const sealOk = checkSeal(root, selected).ok
  const criteriaDone = criteria.length > 0 && criteria.every(c => c.implemented && c.evidence === "pass")
  const criteriaStarted = criteria.some(c => c.implemented || c.evidence === "pass")
  const turnOpen = turns.some(t => t.status === "open")
  const specReviewed = reviews.some(r => r.id === ws.specBreakReviewId && r.target === "spec" && r.verdict === "approve" && (r.revisionDigest === revisionDigest || (!r.revisionDigest && permission.mode === "legacy-seal")))
  const slices = ws.suggestedSlices ?? []
  const slicesReviewed = slices.filter(sl => reviews.some(r => r.id === sl.codeBreakReviewId && codeBreakSatisfied([r], sourceDigest))).length
  const workflowSelected = Boolean(workflow.profile.snapshotId)

  const noBlockingFindings = unresolvedBlockingReviews(reviews).length === 0
  const currentCodeReview = codeBreakSatisfied(reviews, sourceDigest)
  const workflowOutputs = workflow.stages.filter(stage => stage.status !== "not-applicable").flatMap(stage => stage.requiredOutputs)
  const screenshotCount = visualEvidence.surfaces.length

  /** Stable completion tasks, rather than a count of disappearing diagnostics. */
  const state = (done: boolean, started = false): CompletionState => done ? "done" : started ? "in-progress" : "todo"
  const checklist: CompletionChecklistItem[] = [
    { id: "permission", label: "Permission to complete this work", state: state(permission.allowed) },
    { id: "seal", label: "Spec snapshot recorded and unchanged", state: state(sealOk) },
    { id: "criteria", label: "Every requirement implemented with passing evidence", state: state(criteriaDone, criteriaStarted), done: criteria.filter(c => c.implemented && c.evidence === "pass").length, total: criteria.length },
    { id: "turn", label: "No turn left open", state: state(!turnOpen) },
    { id: "review-findings", label: "No unresolved blocking review findings", state: state(noBlockingFindings) },
    ...(ws.policy?.requireSpecBreak !== false ? [{ id: "spec-review", label: "Independent review of the current spec", state: state(specReviewed) }] : []),
    ...(ws.policy?.requireCodeBreak !== false ? [{ id: "code-review", label: slices.length ? "Every slice reviewed against the current source" : "Independent review of the current source", state: state(currentCodeReview && slicesReviewed === slices.length, slicesReviewed > 0), done: slices.length ? slicesReviewed : Number(currentCodeReview), total: Math.max(1, slices.length) }] : []),
    ...(obligations.length ? [{ id: "deferrals", label: "Required deferred commitments resolved", state: state(obligations.every(o => o.state === "resolved"), obligations.some(o => o.state === "resolved")), done: obligations.filter(o => o.state === "resolved").length, total: obligations.length }] : []),
    ...(screenshotCount || !visualEvidence.ok ? [{ id: "screenshots", label: "Current screenshots for every required screen", state: state(visualEvidence.ok, visualEvidence.surfaces.some(surface => surface.satisfied)), done: visualEvidence.surfaces.filter(surface => surface.satisfied).length, total: Math.max(1, screenshotCount) }] : []),
    ...(workflowSelected ? [{ id: "workflow", label: "Chosen workflow's required results recorded", state: state(workflow.status === "satisfied", workflow.status === "running"), done: workflowOutputs.length ? workflowOutputs.filter(output => output.satisfied).length : Number(workflow.status === "satisfied"), total: Math.max(1, workflowOutputs.length) }] : []),
  ]

  const completionReasons = [...attention, ...visualEvidence.reasons]
  if (!sealOk) completionReasons.push("The spec snapshot is missing or has changed.")
  if (!criteriaDone) completionReasons.push("Every acceptance criterion needs current implementation and passing evidence.")
  if (turnOpen) completionReasons.push("Close the open turn before completing the workstream.")
  if (ws.policy?.requireSpecBreak !== false && !specReviewed) completionReasons.push("The current spec needs its recorded independent review.")
  if (ws.policy?.requireCodeBreak !== false && slicesReviewed !== slices.length) completionReasons.push("Every slice needs a review covering the current source.")
  const reportedPreview = [...current].reverse().find(d => d.progress?.preview)?.progress?.preview
  if (workflowSelected && workflow.status !== "satisfied") completionReasons.push("The selected workflow still has required current outputs.")
  const executionActivity = projectExecution(root, selected, { eligible: permission.allowed && completionReasons.length === 0, reasons: completionReasons, remaining: criteria.filter(c => !c.implemented || c.evidence !== "pass").map(c => `${c.id}: ${c.text} (implemented: ${c.implemented ? "reported" : "unconfirmed"}; evidence: ${c.evidence})`) })
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
    .map(d => ({ id: d.id, turnId: d.turnId, recordedAt: d.recordedAt ?? d.basis?.at ?? null, summary: d.decision, reason: d.rationale, discovery: d.discovery }))
  const handoff = (action: "approve" | "deny") =>
    `spec-ledger permission ${action} --workstream ${selected} --revision ${revisionDigest} --source 'user:cli-handoff'`
  return {
    observedAt: new Date().toISOString(), selectionRequired: false,
    choices: choices.map(w => ({ id: w.id, title: w.title })),
    session: {
      workstreamId: selected, title: ws.title, goal: ws.objective, specPath: ws.specPath,
      status: ws.status, revision: checkSeal(root, selected).ok ? ws.seal?.revision ?? null : null, revisionDigest, sourceDigest,
      reviews: reviews.map(r => ({ id: r.id, turnId: r.turnId, target: r.target, verdict: r.verdict,
        summary: r.plainSummary ?? r.summary, findings: r.findings ?? [], residualRisks: r.residualRisks ?? [],
        current: r.target === "spec" ? r.revisionDigest === revisionDigest : Boolean(sourceDigest && r.treeDigest === sourceDigest) })),
      artifacts: (() => { const budget = { remaining: 2 * 1024 * 1024 }; return turns.flatMap(t => listAttachmentsForTurn(root, t.id)).map(a => attachmentEvidence(root, a, budget)) })(),
      visualEvidence, permission, authorityDigest: authorityStateDigest(root), attention, criteria, activity, obligations, workflow, executionActivity,
      completion: { eligible: permission.allowed && completionReasons.length === 0, reasons: completionReasons, checklist },
      openTurnIds: turns.filter(t => t.status === "open").map(t => t.id),
      evidenceCount: criteria.filter(c => c.evidence === "pass").length,
      preview: latestPreview ? { ...latestPreview, availability: "unconfirmed", revisionDigest, sourceDigest } : null,
      handoff: { provenance: "portable-cli", approve: handoff("approve"), deny: handoff("deny") },
    },
  }
}

export type CompletionState = "done" | "in-progress" | "todo"

export interface CompletionChecklistItem {
  id: string
  label: string
  state: CompletionState
  /** Present when the requirement counts parts, e.g. 3 of 5 slices reviewed. */
  done?: number
  total?: number
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
