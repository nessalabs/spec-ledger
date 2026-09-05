import { startSavedCheck, getCheckRun, getCheckEvidence, validateCheckStorage } from "../verify/saved-check.js"
import { randomUUID } from "node:crypto"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { alignCheck } from "../align/check.js"
import { assertAlignApproveValid, alignPolicy } from "../align/approve.js"
import { listAlignWaiversForTurn } from "../align/waiver.js"
import { getVerticalContext } from "../context/vertical.js"
import { writeDecision } from "../episodes/write.js"
import { recordEvidence, type EvidenceInput } from "../evidence/record.js"
import { sourceFingerprint } from "../evidence/fingerprint.js"
import { findRepoRoot, loadLedger } from "../fs/load.js"
import {
  permissionStatus,
  planRevision,
  recordAuthority,
  recordSpecReview,
  type Authority,
} from "../permission/authority.js"
import { getRelatedPack } from "../related/pack.js"
import { listAllReviews, nextReviewId, writeReview } from "../reviews/load.js"
import {
  completeWorkstream,
  getSession,
  recordProgress,
  type ProgressUpdate,
} from "../session/project.js"
import { closeTurn, abandonTurn, openTurn } from "../turns/close.js"
import type { EpisodeDecision, Review, TurnIntent } from "../types.js"
import { checkLedger } from "../verify/execute.js"
import { loadWorkstream, writeWorkstream } from "../workstream/load.js"
import {
  addWorkflowOutput,
  preserveWorkflow,
  projectWorkflow,
  writeWorkflowAttemptReport,
  resolveWorkflow,
  selectedWorkflow,
  startWorkflowStep,
  type WorkflowOutputKind,
  type WorkflowProfile,
} from "../workflows/index.js"
import {
  writeExecutionPolicy,
  findExecutionAssociation,
  recordActivity as ingestActivity,
  registerExecutionAssociation,
  writeExecutionStop,
  type ActivityEvent,
  projectExecution,
} from "../execution/index.js"
import { operationError, normalizeOperationError } from "./errors.js"
import { runMutation } from "./receipts.js"
import { OPERATION_SCHEMAS, validateOperationInput, type OperationName } from "./schemas.js"

export type { OperationName } from "./schemas.js"

export function newRequestId(): string {
  return randomUUID()
}

function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw operationError("invalid_input", "operation input must be an object")
  }
}

/** Validate configured ledger paths before any core loader can follow them. */
function assertCheckoutConfiguration(root: string): void {
  const repoRoot = findRepoRoot(root)
  const ledgerDir = realpathSync(join(repoRoot, ".spec-ledger"))
  const config = JSON.parse(readFileSync(join(ledgerDir, "ledger.json"), "utf8")) as Record<string, unknown>
  for (const [key, value] of Object.entries(config)) {
    if (!/(?:Dir|Path)$/.test(key) || typeof value !== "string") continue
    if (!value || isAbsolute(value) || value.replace(/\\/g, "/").split("/").includes("..")) {
      throw operationError("invalid_input", `configured ${key} must stay inside .spec-ledger`)
    }
    const target = resolve(ledgerDir, value)
    const lexical = relative(ledgerDir, target)
    if (!lexical || lexical === ".." || lexical.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(lexical)) {
      throw operationError("invalid_input", `configured ${key} escapes .spec-ledger`)
    }
    let existing = target
    while (!existsSync(existing) && existing !== ledgerDir) existing = dirname(existing)
    const physical = relative(ledgerDir, realpathSync(existing))
    if (physical === ".." || physical.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(physical)) {
      throw operationError("invalid_input", `configured ${key} escapes .spec-ledger through a symlink`)
    }
  }
}

function validated(root: string, name: OperationName, raw: unknown): Record<string, unknown> {
  assertCheckoutConfiguration(root)
  return validateOperationInput(name, raw)
}

function stringField(input: Record<string, unknown>, key: string, optional = false): string | undefined {
  const value = input[key]
  if (value === undefined && optional) return undefined
  if (typeof value !== "string" || !value.trim()) {
    throw operationError("invalid_input", `${key} must be a nonempty string`)
  }
  return value
}

function stringArray(input: Record<string, unknown>, key: string, optional = false): string[] | undefined {
  const value = input[key]
  if (value === undefined && optional) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw operationError("invalid_input", `${key} must be an array of nonempty strings`)
  }
  return value as string[]
}

function assertRevision(root: string, workstreamId: string, expected?: string): string {
  const current = planRevision(root, loadWorkstream(root, workstreamId))
  if (expected !== current) {
    throw operationError("revision_conflict", "workstream revision has changed", false, {
      expected,
      current,
    })
  }
  return current
}

function assertSource(root: string, expected?: string): string {
  const current = sourceFingerprint(root, loadLedger(root).config.generatedArtifactPaths)
  if (!current || expected !== current) {
    throw operationError("source_conflict", "source content has changed", false, {
      expected,
      current,
    })
  }
  return current
}

function assertPermission(root: string, workstreamId: string): void {
  const permission = permissionStatus(root, workstreamId)
  if (!permission.allowed) {
    throw operationError("permission_denied", "work is not authorized", false, permission)
  }
}

export function planWork(root: string, raw: unknown) {
  const input = validated(root, "plan_work", raw)
  const workstreamId = stringField(input, "workstreamId")!
  const permission = permissionStatus(root, workstreamId)
  return {
    workstream: loadWorkstream(root, workstreamId),
    related: getRelatedPack(root, workstreamId),
    permission,
    nextAction: permission.allowed ? "work" : "permission",
    missingPrerequisites: permission.allowed ? [] : permission.reasons,
  }
}

export function getContext(root: string, raw: unknown) {
  const input = validated(root, "get_context", raw)
  return getVerticalContext(
    root,
    stringField(input, "workstreamId")!,
    stringField(input, "sliceId")!,
  )
}

export function observeSession(root: string, raw: unknown = {}) {
  const input = validated(root, "get_session", raw)
  return getSession(root, stringField(input, "workstreamId", true))
}

export function previewWorkflow(root: string, raw: unknown) {
  const input = validated(root, "preview_workflow", raw)
  return resolveWorkflow(root, stringField(input, "workstreamId")!, input.profile as WorkflowProfile | undefined)
}

export function getWorkflow(root: string, raw: unknown) {
  const input = validated(root, "get_workflow", raw)
  return projectWorkflow(root, stringField(input, "workstreamId")!)
}

export function getExecution(root: string, raw: unknown) {
  const input = validated(root, "get_execution", raw)
  const registrationId = stringField(input, "registrationId", true)
  const requestedWorkstream = stringField(input, "workstreamId", true)
  const association = registrationId ? findExecutionAssociation(root, registrationId) : undefined
  const workstreamId = requestedWorkstream ?? association?.workstreamId
  if (!workstreamId) throw operationError("invalid_input", "get_execution requires registrationId or workstreamId")
  if (association && requestedWorkstream && association.workstreamId !== requestedWorkstream) throw operationError("invalid_input", "registrationId does not belong to workstreamId")
  const session = observeSession(root, { workstreamId }).session!
  return registrationId ? projectExecution(root, workstreamId, { eligible: session.completion.eligible, reasons: session.completion.reasons, remaining: session.executionActivity.continuation.guidance }, registrationId) : session.executionActivity
}

export function submitPermission(root: string, raw: unknown) {
  const input = mutationInput(root, "record_permission", raw)
  const authority = input.authority
  assertObject(authority)
  return runMutation({
    root,
    requestId: input.requestId,
    operation: "record_permission",
    input,
    effect: () => recordAuthority(root, authority as unknown as Authority),
  })
}

function mutationInput(root: string, name: OperationName, raw: unknown): Record<string, unknown> & { requestId: string } {
  const input = validated(root, name, raw)
  const requestId = stringField(input, "requestId")!
  return { ...input, requestId }
}

export function beginWork(root: string, raw: unknown) {
  const input = mutationInput(root, "begin_work", raw)
  const workstreamId = stringField(input, "workstreamId")!
  const noContext = input.noContext === true
  if (input.noContext !== undefined && typeof input.noContext !== "boolean") {
    throw operationError("invalid_input", "noContext must be a boolean")
  }
  const sliceId = stringField(input, "sliceId", noContext)
  const noContextReason = stringField(input, "noContextReason", !noContext)
  if (noContext && !noContextReason) {
    throw operationError("invalid_input", "noContext requires noContextReason")
  }
  const goal = stringField(input, "goal")!
  const expectedRevisionDigest = stringField(input, "expectedRevisionDigest")!
  const workstream = loadWorkstream(root, workstreamId)
  const requestedFeatureIds = stringArray(input, "featureIds", true)
  if (requestedFeatureIds?.some((id) => !workstream.featureIds.includes(id))) {
    throw operationError("invalid_input", "featureIds must belong to the workstream")
  }
  const featureIds = requestedFeatureIds ?? workstream.featureIds
  const changeType = stringField(input, "changeType", true) ?? workstream.changeType ?? "feature"
  const riskLevel = stringField(input, "riskLevel", true) ?? workstream.riskLevel ?? "moderate"
  if (!["feature", "refactor", "fix", "migration", "chore", "docs"].includes(changeType)) {
    throw operationError("invalid_input", "invalid changeType")
  }
  if (!["low", "moderate", "elevated", "high"].includes(riskLevel)) {
    throw operationError("invalid_input", "invalid riskLevel")
  }
  if (sliceId && !(workstream.suggestedSlices ?? []).some((slice) => slice.id === sliceId)) {
    throw operationError("invalid_input", `slice ${sliceId} not found on ${workstreamId}`)
  }
  if (input.allowDirty !== undefined && typeof input.allowDirty !== "boolean") {
    throw operationError("invalid_input", "allowDirty must be a boolean")
  }
  const receiptInput = { ...input }
  return runMutation({ root, requestId: input.requestId, operation: "begin_work", input: receiptInput, effect: () => {
    assertRevision(root, workstreamId, expectedRevisionDigest)
    assertPermission(root, workstreamId)
    const intent: TurnIntent = {
      userPrompt: stringField(input, "prompt", true) ?? goal,
      restatedGoal: goal,
      changeType: changeType as TurnIntent["changeType"],
      riskLevel: riskLevel as TurnIntent["riskLevel"],
      workstreamId,
      sliceId,
      featureIds,
    }
    return openTurn(root, intent, {
      idHint: stringField(input, "turnId", true),
      workstreamId,
      sliceId,
      featureIds,
      noContext,
      noContextReason,
      allowDirty: input.allowDirty === true,
    })
  } })
}

function workstreamForTurn(root: string, turnId: string): string {
  const turn = loadLedger(root).turns.find((candidate) => candidate.id === turnId)
  if (!turn) throw operationError("not_found", `turn not found: ${turnId}`)
  if (!turn.intent.workstreamId) throw operationError("invalid_input", "turn has no workstream")
  return turn.intent.workstreamId
}

export function submitProgress(root: string, raw: unknown) {
  const input = mutationInput(root, "record_progress", raw)
  const turnId = stringField(input, "turnId")!
  const workstreamId = workstreamForTurn(root, turnId)
  if (typeof input.implemented !== "boolean") {
    throw operationError("invalid_input", "implemented must be a boolean")
  }
  return runMutation({ root, requestId: input.requestId, operation: "record_progress", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    assertPermission(root, workstreamId)
    return recordProgress(root, {
      turnId,
      summary: stringField(input, "summary")!,
      criterionIds: stringArray(input, "criterionIds")!,
      implemented: input.implemented as boolean,
      preview: input.preview as ProgressUpdate["preview"],
    })
  } })
}

export function submitDecision(root: string, raw: unknown) {
  const input = mutationInput(root, "record_decision", raw)
  const turnId = stringField(input, "turnId")!
  const workstreamId = workstreamForTurn(root, turnId)
  if (input.discovery !== undefined) {
    assertObject(input.discovery)
    const kind = stringField(input.discovery, "kind")
    const reportedVia = stringField(input.discovery, "reportedVia")
    stringField(input.discovery, "observation")
    if (!["code-defect", "spec-gap", "spec-conflict", "verification-gap", "workflow-gap"].includes(kind!)) {
      throw operationError("invalid_input", "invalid discovery kind")
    }
    if (!["user", "test", "review", "runtime"].includes(reportedVia!)) {
      throw operationError("invalid_input", "invalid discovery reportedVia")
    }
  }
  stringArray(input, "alternativesRejected", true)
  stringArray(input, "addressesFindingIds", true)
  return runMutation({ root, requestId: input.requestId, operation: "record_decision", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    assertPermission(root, workstreamId)
    const turn = loadLedger(root).turns.find((candidate) => candidate.id === turnId)!
    return writeDecision(root, {
      turnId,
      decision: stringField(input, "decision")!,
      rationale: stringField(input, "rationale")!,
      basis: {
        at: new Date().toISOString(),
        contextDigest: turn.opened?.contextDigest,
        sealRevision: loadWorkstream(root, workstreamId).seal?.revision,
      },
      discovery: input.discovery as EpisodeDecision["discovery"],
      alternativesRejected: input.alternativesRejected as string[] | undefined,
      addressesFindingIds: input.addressesFindingIds as string[] | undefined,
    })
  } })
}

export function submitEvidence(root: string, raw: unknown) {
  const input = mutationInput(root, "record_evidence", raw)
  const evidence = input.evidence
  assertObject(evidence)
  return runMutation({ root, requestId: input.requestId, operation: "record_evidence", input, effect: () =>
    recordEvidence(root, evidence as unknown as EvidenceInput),
  })
}

export function submitReview(root: string, raw: unknown) {
  const input = mutationInput(root, "record_review", raw)
  const target = stringField(input, "target")!
  const reviewInput = input.review
  assertObject(reviewInput)
  if (reviewInput.kind === "human") {
    throw operationError("invalid_input", "record_review cannot claim human review provenance")
  }
  return runMutation({ root, requestId: input.requestId, operation: "record_review", input, effect: () => {
    if (target === "spec") {
      const workstreamId = stringField(input, "workstreamId")!
      assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
      const review = reviewInput
      if (review.workstreamId !== undefined && review.workstreamId !== workstreamId) {
        throw operationError("invalid_input", "spec review workstreamId must match the operation target")
      }
      const sequence = listAllReviews(root)
        .filter((candidate) => candidate.workstreamId === workstreamId && candidate.target === "spec")
        .reduce((max, candidate) => Math.max(max, Number(candidate.id.split("-").at(-1)) || 0), 0) + 1
      const id = (review.id as string | undefined) ?? `${workstreamId}/SR-${String(sequence).padStart(2, "0")}`
      const written = recordSpecReview(root, { ...review, schemaVersion: 1, id, workstreamId, target: "spec" } as unknown as Review)
      if (written.verdict === "approve") {
        const workstream = loadWorkstream(root, workstreamId)
        writeWorkstream(root, { ...workstream, specBreakReviewId: written.id, updatedAt: new Date().toISOString() })
      }
      return written
    }
    if (target !== "code") throw operationError("invalid_input", "review target must be spec or code")
    const turnId = stringField(input, "turnId")!
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    const turn = loadLedger(root).turns.find((candidate) => candidate.id === turnId)
    if (!turn) throw operationError("not_found", `turn not found: ${turnId}`)
    if (turn.status !== "open") throw operationError("prerequisite_missing", `turn ${turnId} is not open`)
    if (!turn.intent.workstreamId) throw operationError("invalid_input", "turn has no workstream")
    assertPermission(root, turn.intent.workstreamId)
    const review = reviewInput
    if (review.workstreamId !== undefined && review.workstreamId !== turn.intent.workstreamId) {
      throw operationError("invalid_input", "code review workstreamId must match its turn")
    }
    const verdict = stringField(review, "verdict") as Review["verdict"]
    const killersCited = stringArray(review, "killersCited", true)
    if (verdict === "approve" && !killersCited?.length) {
      throw operationError("invalid_input", "code review approval requires killersCited")
    }
    const written = writeReview(root, {
      ...review,
      schemaVersion: 1,
      id: (review.id as string | undefined) ?? nextReviewId(root, turnId),
      turnId,
      kind: (review.kind as Review["kind"] | undefined) ?? "adversarial",
      target: "code",
    } as unknown as Review)
    if (written.verdict === "approve" && turn.intent.workstreamId && turn.intent.sliceId) {
      const workstream = loadWorkstream(root, turn.intent.workstreamId)
      writeWorkstream(root, {
        ...workstream,
        suggestedSlices: (workstream.suggestedSlices ?? []).map((slice) =>
          slice.id === turn.intent.sliceId ? { ...slice, codeBreakReviewId: written.id } : slice,
        ),
        updatedAt: new Date().toISOString(),
      })
    }
    return written
  } })
}

export function approveAlignment(root: string, raw: unknown) {
  const input = mutationInput(root, "approve_alignment", raw)
  const turnId = stringField(input, "turnId")!
  return runMutation({ root, requestId: input.requestId, operation: "approve_alignment", input, effect: () => {
    const expectedSourceDigest = stringField(input, "expectedSourceDigest")!
    assertSource(root, expectedSourceDigest)
    const turn = loadLedger(root).turns.find((candidate) => candidate.id === turnId)
    if (!turn) throw operationError("not_found", `turn not found: ${turnId}`)
    const report = alignCheck(root, { turnId })
    const workstreamId = turn.intent.workstreamId
    if (workstreamId) assertPermission(root, workstreamId)
    const policy = workstreamId ? alignPolicy(loadWorkstream(root, workstreamId)) : { alignReviewerPrefix: "agent:align" }
    const review: Review = {
      schemaVersion: 1,
      id: nextReviewId(root, turnId),
      turnId,
      ...(workstreamId ? { workstreamId } : {}),
      kind: "human",
      target: "code",
      reviewer: stringField(input, "reviewer", true) ?? "agent:align",
      verdict: "approve",
      summary: stringField(input, "summary", true) ?? "align: path coverage OK",
      plainSummary: stringField(input, "plainSummary")!,
      treeDigest: report.treeDigest,
      uncoveredPaths: report.coverage.uncoveredPaths,
      coverageSource: report.coverage.coverageSource,
      waiverIds: stringArray(input, "waiverIds", true),
    }
    assertAlignApproveValid({ review, turn, policy, waivers: listAlignWaiversForTurn(root, turnId) })
    return writeReview(root, review)
  } })
}

export function runChecks(root: string, raw: unknown) {
  const input = mutationInput(root, "run_checks", raw)
  return runMutation({ root, requestId: input.requestId, operation: "run_checks", input, effect: () => {
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    return checkLedger(root, true)
  } })
}

export function finishTurn(root: string, raw: unknown) {
  const input = mutationInput(root, "finish_turn", raw)
  const turnId = stringField(input, "turnId")!
  const action = stringField(input, "action")!
  return runMutation({ root, requestId: input.requestId, operation: "finish_turn", input, effect: () => {
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    if (action === "close") return closeTurn(root, turnId)
    if (action === "abandon") return abandonTurn(root, turnId)
    throw operationError("invalid_input", "finish action must be close or abandon")
  } })
}

export function completeWork(root: string, raw: unknown) {
  const input = mutationInput(root, "complete_work", raw)
  const workstreamId = stringField(input, "workstreamId")!
  return runMutation({ root, requestId: input.requestId, operation: "complete_work", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    return completeWorkstream(root, workstreamId)
  } })
}

function assertWorkflowSnapshot(root: string, workstreamId: string, expected: string) {
  const snapshot = selectedWorkflow(root, workstreamId)
  if (!snapshot || snapshot.snapshotDigest !== expected) {
    throw operationError("revision_conflict", "workflow snapshot has changed", false, { expected, current: snapshot?.snapshotDigest })
  }
  return snapshot
}

export function setWorkflow(root: string, raw: unknown) {
  const input = mutationInput(root, "set_workflow", raw)
  const workstreamId = stringField(input, "workstreamId")!
  return runMutation({ root, requestId: input.requestId, operation: "set_workflow", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    assertPermission(root, workstreamId)
    return preserveWorkflow(root, workstreamId, input.profile as WorkflowProfile | undefined,
      stringField(input, "reason", true), stringField(input, "expectedSnapshotDigest", true))
  } })
}

export function beginWorkflowStep(root: string, raw: unknown) {
  const input = mutationInput(root, "begin_workflow_step", raw)
  const workstreamId = stringField(input, "workstreamId")!
  return runMutation({ root, requestId: input.requestId, operation: "begin_workflow_step", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    assertPermission(root, workstreamId)
    const expectedSnapshotDigest = stringField(input, "expectedSnapshotDigest")!
    assertWorkflowSnapshot(root, workstreamId, expectedSnapshotDigest)
    return startWorkflowStep(root, { workstreamId, stageId: stringField(input, "stageId")!, stepId: stringField(input, "stepId")!,
      attemptId: stringField(input, "attemptId", true), reason: stringField(input, "reason", true), expectedSnapshotDigest })
  } })
}

export function reportWorkflowAttempt(root: string, raw: unknown) {
  const input = mutationInput(root, "report_workflow_attempt", raw)
  const workstreamId = stringField(input, "workstreamId")!
  return runMutation({ root, requestId: input.requestId, operation: "report_workflow_attempt", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    assertPermission(root, workstreamId)
    assertWorkflowSnapshot(root, workstreamId, stringField(input, "expectedSnapshotDigest")!)
    return writeWorkflowAttemptReport(root, workstreamId, stringField(input, "attemptId")!,
      stringField(input, "status") as "reported-complete" | "blocked", stringField(input, "reason", true))
  } })
}

export function recordWorkflowOutput(root: string, raw: unknown) {
  const input = mutationInput(root, "record_workflow_output", raw)
  const workstreamId = stringField(input, "workstreamId")!
  return runMutation({ root, requestId: input.requestId, operation: "record_workflow_output", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!)
    assertSource(root, stringField(input, "expectedSourceDigest")!)
    assertPermission(root, workstreamId)
    assertWorkflowSnapshot(root, workstreamId, stringField(input, "expectedSnapshotDigest")!)
    return addWorkflowOutput(root, { workstreamId, attemptId: stringField(input, "attemptId")!,
      kind: stringField(input, "kind") as WorkflowOutputKind,
      recordType: stringField(input, "recordType") as "snapshot" | "review" | "decision" | "result",
      recordIds: stringArray(input, "recordIds")!, criterionIds: stringArray(input, "criterionIds", true) ?? [] })
  } })
}

export function registerExecution(root: string, raw: unknown) {
  const input = mutationInput(root, "register_execution", raw); const workstreamId = stringField(input, "workstreamId")!
  return runMutation({ root, requestId: input.requestId, operation: "register_execution", input, effect: () => {
    assertRevision(root, workstreamId, stringField(input, "expectedRevisionDigest")!); assertSource(root, stringField(input, "expectedSourceDigest")!); assertPermission(root, workstreamId)
    return registerExecutionAssociation(root, { workstreamId, turnId: stringField(input, "turnId")!, workflowAttemptId: stringField(input, "workflowAttemptId", true), hostSessionRef: stringField(input, "hostSessionRef")! })
  } })
}

export function configureExecution(root: string, raw: unknown) {
  const input = mutationInput(root, "configure_execution", raw); const registrationId = stringField(input, "registrationId")!; const association = findExecutionAssociation(root, registrationId)
  if (!association) throw operationError("not_found", "execution registration not found")
  return runMutation({ root, requestId: input.requestId, operation: "configure_execution", input, effect: () => {
    assertRevision(root, association.workstreamId, stringField(input, "expectedRevisionDigest")!); assertSource(root, stringField(input, "expectedSourceDigest")!); assertPermission(root, association.workstreamId)
    return writeExecutionPolicy(root, registrationId, { continuation: input.continuation as never, timeout: input.timeout as never, source: input.source as never })
  } })
}

export function stopExecution(root: string, raw: unknown) {
  const input = mutationInput(root, "stop_execution", raw); const registrationId = stringField(input, "registrationId")!; const association = findExecutionAssociation(root, registrationId)
  if (!association) throw operationError("not_found", "execution registration not found")
  return runMutation({ root, requestId: input.requestId, operation: "stop_execution", input, effect: () => {
    assertRevision(root, association.workstreamId, stringField(input, "expectedRevisionDigest")!); assertSource(root, stringField(input, "expectedSourceDigest")!)
    return writeExecutionStop(root, registrationId, stringField(input, "reason")!, input.source as never)
  } })
}

/** Transient, bounded telemetry intentionally does not create durable operation receipts. */
export function recordExecutionActivity(root: string, raw: unknown) {
  const input = validated(root, "record_activity", raw)
  try { return ingestActivity(root, stringField(input, "registrationId")!, input.event as ActivityEvent) }
  catch (error) { if (error instanceof Error && /activity collector is busy/.test(error.message)) throw operationError("operation_busy", error.message, true); throw error }
}

export function executeOperation(root: string, operation: OperationName, input: unknown): unknown {
  try {
    switch (operation) {
      case "plan_work": return planWork(root, input)
      case "get_context": return getContext(root, input)
      case "get_session": return observeSession(root, input)
      case "preview_workflow": return previewWorkflow(root, input)
      case "get_workflow": return getWorkflow(root, input)
      case "get_execution": return getExecution(root, input)
      case "record_permission": return submitPermission(root, input)
      case "begin_work": return beginWork(root, input)
      case "record_progress": return submitProgress(root, input)
      case "record_decision": return submitDecision(root, input)
      case "record_evidence": return submitEvidence(root, input)
      case "record_review": return submitReview(root, input)
      case "approve_alignment": return approveAlignment(root, input)
      case "run_saved_check": {
        const args = mutationInput(root, "run_saved_check", input)
        validateCheckStorage(root)
        return runMutation({root, requestId: args.requestId, operation: "run_saved_check", input: args, effect: () => startSavedCheck(root, args as unknown as Parameters<typeof startSavedCheck>[1])})
      }
      case "get_check_run": return getCheckRun(root, stringField(validated(root, "get_check_run", input), "runId")!)
      case "get_check_evidence": return getCheckEvidence(root, stringField(validated(root, "get_check_evidence", input), "bindingId")!)
      case "run_checks": return runChecks(root, input)
      case "finish_turn": return finishTurn(root, input)
      case "complete_work": return completeWork(root, input)
      case "set_workflow": return setWorkflow(root, input)
      case "begin_workflow_step": return beginWorkflowStep(root, input)
      case "report_workflow_attempt": return reportWorkflowAttempt(root, input)
      case "record_workflow_output": return recordWorkflowOutput(root, input)
      case "register_execution": return registerExecution(root, input)
      case "configure_execution": return configureExecution(root, input)
      case "stop_execution": return stopExecution(root, input)
      case "record_activity": return recordExecutionActivity(root, input)
    }
  } catch (error) {
    throw normalizeOperationError(error)
  }
}

export const OPERATION_NAMES: readonly OperationName[] = [
  ...(Object.keys(OPERATION_SCHEMAS) as OperationName[]),
]
