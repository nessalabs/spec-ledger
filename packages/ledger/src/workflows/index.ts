import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { ledgerRoot, sha256Stable } from "../fs/load.js"
import { computeTreeDigest } from "../git/tree.js"
import { planRevision } from "../permission/authority.js"
import { listDecisionsForTurn } from "../episodes/load.js"
import { listAllReviews, codeBreakSatisfied, unresolvedBlockingReviews } from "../reviews/load.js"
import { checkSeal, loadWorkstream } from "../workstream/load.js"
import { loadLedger } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"
import type { Workstream } from "../types.js"
import type {
  ResolvedWorkflowSkill, ResolvedWorkflowStage, WorkflowAttempt, WorkflowAttemptReport,
  WorkflowOutputKind, WorkflowOutputProjection, WorkflowOutputReference,
  WorkflowProfile, WorkflowProjection, WorkflowSnapshot, WorkflowStageRole,
} from "./types.js"
export * from "./types.js"

const MAX_SKILL_BYTES = 64 * 1024
const MAX_TOTAL_SKILL_BYTES = 512 * 1024
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/
const BUNDLED: Record<string, { content: string; capabilities: WorkflowOutputKind[] }> = {
  plan: { content: `# Plan

Shape the smallest coherent vertical that delivers the requested behavior. Read the vision, current work model, applicable permission, existing architecture, and cheap-to-change guidance before choosing boundaries. Preserve observable acceptance criteria, explicit exclusions, trust boundaries, source-sensitive checks, and a rollback or repair path. Prefer simple ownership and durable interfaces over speculative flexibility. Preserve the reviewed revision before implementation.`, capabilities: ["spec-revision"] },
  "spec-review": { content: `# Break the plan

Review the preserved revision independently before implementation. Trace the highest-risk behavior and try to falsify permission, evidence, path confinement, failure recovery, compatibility, and user-facing claims. Record concrete findings with reproduction conditions and plain impact. Approval requires a current revision, no unresolved blocking findings, and a plan whose checks can distinguish success from a plausible false positive.`, capabilities: ["spec-review"] },
  implement: { content: `# Implement

Work only within current permission and the selected revision. Build one end-to-end slice with clear ownership, bounded inputs, explicit failure behavior, and no hidden authority. Keep security and data integrity invariants outside replaceable skill prose. Report criterion-scoped progress against the current source; implementation reports describe what changed and never claim that checks or independent review passed.`, capabilities: ["implementation-report"] },
  verify: { content: `# Verify

Run the smallest behavioral checks that can expose the likely failure, then run the applicable regression gates. Exercise real boundaries when the contract crosses a process or package. Preserve result identity, source digest, check definition, artifacts, and failure detail. Missing, stale, attested, or interrupted evidence remains visibly distinct from a current pass.`, capabilities: ["check-results"] },
  "code-review": { content: `# Break the implementation

Review the current source as an adversary. Start with permission and data-integrity boundaries, then probe concurrency, retries, malformed input, stale evidence, packaging, and the user's actual path. Cite the killers exercised, preserve actionable findings and residual risks, and stamp the source that was reviewed. Do not approve from a summary or from agent-reported completion alone.`, capabilities: ["code-review"] },
}

function defaultStages(ws: Workstream): ResolvedWorkflowStage[] {
  const stage = (id: string, title: string, role: WorkflowStageRole, kind: WorkflowOutputKind): ResolvedWorkflowStage => {
    const bundled = BUNDLED[id]!
    return { id, title, role, steps: [{ id, title, outputs: [{ kind }], skill: {
      id, source: "bundled", digest: sha256Stable(bundled.content), content: bundled.content,
      capabilities: bundled.capabilities, capability: "declared", uncertaintyAcknowledged: false,
    } }] }
  }
  return [
    stage("plan", "Preserve the plan", "plan", "spec-revision"),
    stage("spec-review", "Review the plan", "spec-review", "spec-review"),
    stage("implement", "Implement the work", "implement", "implementation-report"),
    stage("verify", "Verify behavior", "verify", "check-results"),
    stage("code-review", "Review the code", "code-review", "code-review"),
  ].map(s => s.role === "implement" || s.role === "verify" ? { ...s, steps: s.steps.map(step => ({ ...step, outputs: step.outputs.map(o => ({ ...o, criterionIds: criterionIds(ws) })) })) } : s)
}

function criterionIds(ws: Workstream): string[] {
  const top = (ws.acceptanceCriteria ?? []).map((_, index) => `AC-${index + 1}`)
  return top.length ? top : (ws.suggestedSlices ?? []).flatMap(slice => slice.acceptance.map((_, index) => `${slice.id}/AC-${index + 1}`))
}

function assertId(value: string, label: string): void {
  if (!ID.test(value)) throw new Error(`${label} must be a bounded identifier`)
}

function localSkill(root: string, id: string, ref: { path: string; capabilities?: WorkflowOutputKind[]; acknowledgeUncertain?: boolean }): ResolvedWorkflowSkill {
  if (!ref.path || isAbsolute(ref.path) || ref.path.replace(/\\/g, "/").split("/").includes("..")) throw new Error(`skill ${id} path must stay inside the checkout`)
  const checkout = realpathSync(root)
  const target = resolve(checkout, ref.path)
  if (!existsSync(target)) throw new Error(`skill ${id} is missing: ${ref.path}`)
  const physical = realpathSync(target)
  const rel = relative(checkout, physical)
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) throw new Error(`skill ${id} escapes the checkout through a symlink`)
  if (!lstatSync(physical).isFile()) throw new Error(`skill ${id} must be a regular file`)
  const bytes = readFileSync(physical)
  if (bytes.byteLength > MAX_SKILL_BYTES) throw new Error(`skill ${id} exceeds ${MAX_SKILL_BYTES} bytes`)
  const capabilities = ref.capabilities ?? []
  if (!capabilities.length && !ref.acknowledgeUncertain) throw new Error(`skill ${id} has unknown capabilities; acknowledge uncertainty explicitly`)
  const content = bytes.toString("utf8")
  return { id, source: "local", path: ref.path.replace(/\\/g, "/"), digest: createHash("sha256").update(content, "utf8").digest("hex"), content,
    capabilities, capability: capabilities.length ? "declared" : "uncertain", uncertaintyAcknowledged: ref.acknowledgeUncertain === true }
}

export function resolveWorkflow(root: string, workstreamId: string, profile?: WorkflowProfile): Omit<WorkflowSnapshot, "snapshotId" | "createdAt" | "reason" | "supersedesSnapshotDigest"> {
  const ws = loadWorkstream(root, workstreamId)
  const revisionDigest = planRevision(root, ws)
  let stages = defaultStages(ws)
  let source: "default" | "custom" = "default"
  let profileId = "spec-ledger/default"
  let title = "Spec Ledger default"
  if (profile) {
    source = "custom"; profileId = profile.id; title = profile.title
    assertId(profile.id, "profile id")
    if (profile.extends && profile.extends !== "spec-ledger/default") throw new Error("workflow may only extend spec-ledger/default")
    const aliases = profile.skills ?? {}
    if (Object.keys(aliases).length > 30) throw new Error("workflow has too many skill aliases")
    const rawStages = profile.stages
    if (!rawStages && profile.extends !== "spec-ledger/default") throw new Error("custom workflow requires stages or extends spec-ledger/default")
    if (rawStages) {
      if (!rawStages.length || rawStages.length > 20) throw new Error("workflow needs 1-20 ordered stages")
      const stageIds = new Set<string>(); let stepCount = 0; let totalBytes = 0
      stages = rawStages.map(stage => {
        assertId(stage.id, "stage id")
        if (stageIds.has(stage.id)) throw new Error(`duplicate workflow stage: ${stage.id}`)
        stageIds.add(stage.id)
        if (!stage.steps.length || stage.steps.length > 20) throw new Error(`stage ${stage.id} needs 1-20 steps`)
        const stepIds = new Set<string>()
        const steps = stage.steps.map(step => {
          stepCount += 1; assertId(step.id, "step id")
          if (stepIds.has(step.id)) throw new Error(`duplicate workflow step: ${stage.id}/${step.id}`)
          stepIds.add(step.id)
          if (!step.outputs.length || step.outputs.length > 6) throw new Error(`step ${stage.id}/${step.id} requires a finite output contract`)
          const ref = typeof step.skill === "string" ? aliases[step.skill] : step.skill
          if (!ref && !(typeof step.skill === "string" && step.skill.startsWith("spec-ledger/") && BUNDLED[step.skill.slice(12)])) throw new Error(`skill alias is missing: ${String(step.skill)}`)
          const bundledId = typeof step.skill === "string" && step.skill.startsWith("spec-ledger/") ? step.skill.slice(12) : null
          const bundled = bundledId ? BUNDLED[bundledId] : undefined
          const skill = bundled ? { id: bundledId!, source: "bundled" as const, digest: sha256Stable(bundled.content), content: bundled.content, capabilities: bundled.capabilities, capability: "declared" as const, uncertaintyAcknowledged: false } : localSkill(root, typeof step.skill === "string" ? step.skill : step.id, ref!)
          totalBytes += Buffer.byteLength(skill.content)
          for (const output of step.outputs) {
            if (skill.capability === "declared" && !skill.capabilities.includes(output.kind)) throw new Error(`skill ${skill.id} does not declare ${output.kind}`)
            const known = new Set(criterionIds(ws)); if ((output.criterionIds ?? []).some(id => !known.has(id))) throw new Error(`step ${stage.id}/${step.id} references an unknown criterion`)
          }
          return { ...step, skill }
        })
        return { ...stage, steps }
      })
      if (stepCount > 50 || totalBytes > MAX_TOTAL_SKILL_BYTES) throw new Error("workflow skill content exceeds the bounded limit")
    } else if (profile.extends === "spec-ledger/default") {
      const knownAliases = new Set(stages.flatMap(stage => stage.steps.map(step => step.skill.id)))
      if (Object.keys(aliases).some(alias => !knownAliases.has(alias))) throw new Error("workflow contains an unknown default skill alias")
      stages = stages.map(stage => ({ ...stage, steps: stage.steps.map(step => {
        const ref = aliases[step.skill.id]
        if (!ref) return step
        const skill = localSkill(root, step.skill.id, ref)
        if (skill.capability === "declared" && step.outputs.some(output => !skill.capabilities.includes(output.kind))) throw new Error(`skill ${skill.id} does not declare its required output`)
        return { ...step, skill }
      }) }))
    }
  }
  validateOrder(stages, ws)
  const body = { schemaVersion: 1 as const, workstreamId, revisionDigest, profile: { id: profileId, title, source }, stages }
  return { ...body, snapshotDigest: sha256Stable(body) }
}

function validateOrder(stages: ResolvedWorkflowStage[], ws: Workstream): void {
  const roles = stages.map(s => s.role)
  const implement = roles.indexOf("implement")
  if (implement < 0) throw new Error("workflow requires an implementation stage")
  if (ws.policy?.requireSpecBreak !== false) {
    const review = roles.indexOf("spec-review")
    if (review < 0 || review > implement) throw new Error("policy-required spec review must precede implementation")
  }
  const required: Array<[WorkflowStageRole, WorkflowOutputKind]> = [["implement", "implementation-report"], ["verify", "check-results"]]
  if (ws.policy?.requireSpecBreak !== false) required.push(["spec-review", "spec-review"])
  if (ws.policy?.requireCodeBreak !== false) required.push(["code-review", "code-review"])
  for (const [role, kind] of required) {
    if (!stages.some(stage => stage.role === role && stage.steps.some(step => step.outputs.some(output => output.kind === kind)))) throw new Error(`workflow requires ${kind} output in ${role} stage`)
  }
  if (roles.indexOf("verify") < implement || (roles.includes("code-review") && roles.indexOf("code-review") < roles.indexOf("verify"))) throw new Error("verification and code review must follow implementation in order")
  if (!roles.includes("verify")) throw new Error("workflow requires a verification stage")
  if (ws.policy?.requireCodeBreak !== false && !roles.includes("code-review")) throw new Error("policy requires a code-review stage")
}

function base(root: string) {
  const ledger = realpathSync(ledgerRoot(root)); const target = join(ledger, "workflows")
  let existing = target
  while (!existsSync(existing) && existing !== ledger) existing = dirname(existing)
  const physical = realpathSync(existing); const rel = relative(ledger, physical)
  if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) throw new Error("workflow storage escapes .spec-ledger through a symlink")
  return target
}
function selectionPath(root: string, ws: string) { return join(base(root), "selections", `${ws}.json`) }
function listJson<T>(directory: string): T[] { return existsSync(directory) ? readdirSync(directory).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(readFileSync(join(directory, f), "utf8")) as T) : [] }
function immutable(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  try { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("workflow record id already exists"); throw error }
}
function replace(path: string, value: unknown): void { mkdirSync(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.${randomUUID()}.tmp`; writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`); renameSync(temp, path) }

export function selectedWorkflow(root: string, workstreamId: string): WorkflowSnapshot | null {
  const path = selectionPath(root, workstreamId); if (!existsSync(path)) return null
  const selection = JSON.parse(readFileSync(path, "utf8")) as { snapshotId: string }
  const snapshot = listJson<WorkflowSnapshot>(join(base(root), "snapshots", workstreamId)).find(item => item.snapshotId === selection.snapshotId)
  if (!snapshot) throw new Error("selected workflow snapshot is missing or corrupt")
  const { snapshotDigest: _digest, ...body } = snapshot
  void _digest
  if (sha256Stable(body) !== snapshot.snapshotDigest) throw new Error("selected workflow snapshot is missing or corrupt")
  return snapshot
}

export function preserveWorkflow(root: string, workstreamId: string, profile: WorkflowProfile | undefined, reason: string | undefined, expectedSnapshotDigest?: string): WorkflowSnapshot {
  const current = selectedWorkflow(root, workstreamId)
  if (current && expectedSnapshotDigest !== current.snapshotDigest) throw new Error("workflow snapshot has changed")
  if (current && !reason?.trim()) throw new Error("workflow amendment requires a reason")
  if (!current && expectedSnapshotDigest) throw new Error("no workflow snapshot exists for expectedSnapshotDigest")
  const resolved = resolveWorkflow(root, workstreamId, profile)
  const existing = listJson<WorkflowSnapshot>(join(base(root), "snapshots", workstreamId))
  const snapshotId = `${workstreamId}/M-${String(existing.length + 1).padStart(2, "0")}`
  const { snapshotDigest: _configurationDigest, ...resolvedBody } = resolved
  void _configurationDigest
  const snapshotBody = { ...resolvedBody, snapshotId, createdAt: new Date().toISOString(), ...(reason ? { reason } : {}), ...(current ? { supersedesSnapshotDigest: current.snapshotDigest } : {}) }
  const snapshot: WorkflowSnapshot = { ...snapshotBody, snapshotDigest: sha256Stable(snapshotBody) }
  immutable(join(base(root), "snapshots", workstreamId, `${snapshotId.split("/").at(-1)}.json`), snapshot)
  replace(selectionPath(root, workstreamId), { schemaVersion: 1, workstreamId, snapshotId, snapshotDigest: snapshot.snapshotDigest })
  return snapshot
}

export function listWorkflowAttempts(root: string, ws: string): WorkflowAttempt[] { return listJson(join(base(root), "attempts", ws)) }
export function listWorkflowOutputs(root: string, ws: string): WorkflowOutputReference[] { return listJson(join(base(root), "outputs", ws)) }
export function listWorkflowReports(root: string, ws: string): WorkflowAttemptReport[] { return listJson(join(base(root), "reports", ws)) }

export function startWorkflowStep(root: string, args: { workstreamId: string; stageId: string; stepId: string; attemptId?: string; reason?: string; expectedSnapshotDigest: string }): WorkflowAttempt {
  const snapshot = selectedWorkflow(root, args.workstreamId)
  if (!snapshot || snapshot.snapshotDigest !== args.expectedSnapshotDigest) throw new Error("current preserved workflow snapshot is required")
  const projection = projectWorkflow(root, args.workstreamId)
  const stage = projection.stages.find(s => s.id === args.stageId); const step = stage?.steps.find(s => s.id === args.stepId)
  if (!stage || !step) throw new Error("workflow stage or step not found")
  const attempts = listWorkflowAttempts(root, args.workstreamId)
  const priorAttempt = attempts.some(a => a.snapshotDigest === snapshot.snapshotDigest && a.stageId === args.stageId && a.stepId === args.stepId)
  const stageIndex = projection.stages.findIndex(candidate => candidate.id === args.stageId)
  const stepIndex = stage.steps.findIndex(candidate => candidate.id === args.stepId)
  const prerequisitesSatisfied = projection.stages.slice(0, stageIndex).every(candidate => ["satisfied", "not-applicable"].includes(candidate.status)) &&
    stage.steps.slice(0, stepIndex).every(candidate => ["satisfied", "not-applicable"].includes(candidate.status))
  if (!prerequisitesSatisfied || (!["ready", "running"].includes(step.status) && !(step.status === "blocked" && priorAttempt && args.reason?.trim()))) throw new Error(`workflow step is not ready: ${step.status}`)
  if (priorAttempt && !args.reason?.trim()) {
    throw new Error("a new workflow attempt requires a reason")
  }
  const id = args.attemptId ?? `${args.workstreamId}/A-${String(attempts.length + 1).padStart(3, "0")}`
  if (!new RegExp(`^${args.workstreamId}/A-[0-9]{3,}$`).test(id)) throw new Error("invalid workflow attempt id")
  const attempt: WorkflowAttempt = { schemaVersion: 1, id, workstreamId: args.workstreamId, stageId: args.stageId, stepId: args.stepId,
    snapshotDigest: snapshot.snapshotDigest, revisionDigest: snapshot.revisionDigest, sourceDigest: computeTreeDigest(root), startedAt: new Date().toISOString(), ...(args.reason ? { reason: args.reason } : {}) }
  immutable(join(base(root), "attempts", args.workstreamId, `${id.split("/").at(-1)}.json`), attempt); return attempt
}

export function writeWorkflowAttemptReport(root: string, ws: string, attemptId: string, status: "reported-complete" | "blocked", reason?: string): WorkflowAttemptReport {
  const attempt = listWorkflowAttempts(root, ws).find(a => a.id === attemptId)
  const snapshot = selectedWorkflow(root, ws)
  if (!attempt || !snapshot || attempt.snapshotDigest !== snapshot.snapshotDigest || attempt.revisionDigest !== planRevision(root, loadWorkstream(root, ws))) throw new Error("current workflow attempt not found")
  if (status === "blocked" && !reason?.trim()) throw new Error("blocked workflow attempt requires a reason")
  const report: WorkflowAttemptReport = { schemaVersion: 1, attemptId, status, ...(reason ? { reason } : {}), reportedAt: new Date().toISOString() }
  immutable(join(base(root), "reports", ws, `${attemptId.split("/").at(-1)}.json`), report); return report
}

export function addWorkflowOutput(root: string, args: Omit<WorkflowOutputReference, "schemaVersion" | "id" | "snapshotDigest" | "revisionDigest" | "sourceDigest" | "recordedAt">): WorkflowOutputReference {
  const snapshot = selectedWorkflow(root, args.workstreamId); if (!snapshot) throw new Error("preserved workflow snapshot is required")
  const attempt = listWorkflowAttempts(root, args.workstreamId).find(a => a.id === args.attemptId)
  if (!attempt || attempt.snapshotDigest !== snapshot.snapshotDigest) throw new Error("current workflow attempt is required")
  const step = snapshot.stages.find(s => s.id === attempt.stageId)?.steps.find(s => s.id === attempt.stepId)
  if (!step?.outputs.some(contract => contract.kind === args.kind && sameCriteria(contract.criterionIds, args.criterionIds))) throw new Error("output does not match the workflow step contract")
  if (args.kind !== "spec-revision" && !recordProducedAfterAttempt(root, args.recordType, args.recordIds, attempt.startedAt)) {
    throw new Error("workflow output records must be produced after the current attempt begins")
  }
  const probe: WorkflowOutputReference = { schemaVersion: 1, id: "probe", ...args, criterionIds: args.criterionIds ?? [], snapshotDigest: snapshot.snapshotDigest,
    revisionDigest: snapshot.revisionDigest, sourceDigest: computeTreeDigest(root), recordedAt: new Date().toISOString() }
  const evaluated = evaluateRef(root, probe, snapshot)
  if (!evaluated.current) throw new Error(`workflow output is not current: ${evaluated.reason}`)
  const outputs = listWorkflowOutputs(root, args.workstreamId); const id = `${args.workstreamId}/O-${String(outputs.length + 1).padStart(3, "0")}`
  const output = { ...probe, id }; immutable(join(base(root), "outputs", args.workstreamId, `${id.split("/").at(-1)}.json`), output); return output
}

function recordProducedAfterAttempt(root: string, recordType: WorkflowOutputReference["recordType"], recordIds: string[], startedAt: string): boolean {
  if (recordType === "snapshot") return false
  if (recordType === "result") {
    const results = loadLedger(root).results
    if (results && results.producedAt >= startedAt && recordIds.every(id => results.rows.some(row => row.key === id))) return true
  }
  const directory = join(ledgerRoot(root), "operations")
  if (!existsSync(directory)) return false
  return readdirSync(directory).filter(file => file.endsWith(".finished.json")).some(file => {
    const receipt = JSON.parse(readFileSync(join(directory, file), "utf8")) as { finishedAt?:string; outcome?:string; operation?:string; result?:unknown }
    if (receipt.outcome !== "succeeded" || !receipt.finishedAt || receipt.finishedAt < startedAt) return false
    const expectedOperations = recordType === "review" ? ["record_review", "approve_alignment"] : recordType === "decision" ? ["record_decision", "record_progress"] : ["record_evidence", "run_checks"]
    if (!expectedOperations.includes(receipt.operation ?? "")) return false
    if (recordType === "result") return recordIds.every(id => JSON.stringify(receipt.result).includes(`\"${id}\"`)) || receipt.operation === "run_checks"
    const result = receipt.result as { id?:string } | undefined
    return recordIds.every(id => result?.id === id)
  })
}

function sameCriteria(a: string[] | undefined, b: string[] | undefined): boolean { return JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort()) }

function evaluateRef(root: string, ref: WorkflowOutputReference, snapshot: WorkflowSnapshot): WorkflowOutputProjection {
  const ws = loadWorkstream(root, ref.workstreamId); const revision = planRevision(root, ws); const source = computeTreeDigest(root)
  let current = ref.snapshotDigest === snapshot.snapshotDigest && ref.revisionDigest === revision; let reason: string | null = current ? null : "Workflow snapshot or spec revision changed."
  const ledger = loadLedger(root); const turns = ledger.turns.filter(t => t.intent.workstreamId === ref.workstreamId)
  if (current && ref.kind === "spec-revision") { current = ref.recordType === "snapshot" && Boolean(ws.seal && ref.recordIds.includes(ws.seal.snapshotPath) && checkSeal(root, ws.id).ok); reason = current ? null : "Spec revision output must reference the current preserved spec snapshot path." }
  if (current && ref.kind === "spec-review") { const reviews = listAllReviews(root); current = ref.recordType === "review" && ref.recordIds.some(id => reviews.some(r => r.id === id && r.workstreamId === ref.workstreamId && r.target === "spec" && r.verdict === "approve" && r.revisionDigest === revision)) && !unresolvedBlockingReviews(reviews.filter(r => r.workstreamId === ref.workstreamId && r.target === "spec")).length; reason = current ? null : "A current approved spec review without blockers is required." }
  if (current && ref.kind === "implementation-report") { const decisions = turns.flatMap(t => listDecisionsForTurn(root, t.id)) as Array<{id:string;progress?:{revisionDigest:string;sourceDigest:string;criterionIds:string[];implemented:boolean}}>; current = ref.recordType === "decision" && ref.recordIds.some(id => decisions.some(d => d.id === id && d.progress?.implemented && d.progress.revisionDigest === revision && d.progress.sourceDigest === source && ref.criterionIds.every(c => d.progress!.criterionIds.includes(c)))); reason = current ? null : "A current criterion-scoped implementation report is required." }
  if (current && ref.kind === "check-results") {
    const report = verifyLedger(ledger); const mappedByCriterion = ref.criterionIds.map(id => ws.acceptanceClaimIds?.[id] ?? []); const mapped = mappedByCriterion.flat()
    const keySets = mapped.map(claimId => ledger.bindings.filter(binding => binding.claimId === claimId && ["command", "results-row"].includes(binding.locator.type)).map(binding => binding.locator.type === "command" ? `command:${binding.id}` : binding.locator.resultsKey!).filter(Boolean))
    const expectedKeys = keySets.flat()
    current = ref.recordType === "result" && ref.sourceDigest === source && ref.criterionIds.length > 0 && mappedByCriterion.every(ids => ids.length > 0) && keySets.every(keys => keys.length > 0) && expectedKeys.every(key => ref.recordIds.includes(key)) &&
      mapped.every(id => report.claims.some(c => c.claimId === id && c.outcome === "pass")) && ref.recordIds.every(id => ledger.results?.rows.some(row => row.key === id && row.outcome === "pass" && row.sourceDigest === source))
    reason = current ? null : "Current passing behavioral result rows mapped to every scoped criterion are required."
  }
  if (current && ref.kind === "code-review") { const reviews = listAllReviews(root); const scoped = reviews.filter(r => r.target !== "spec" && (r.workstreamId ? r.workstreamId === ws.id : turns.some(t => t.id === r.turnId))); current = ref.recordType === "review" && ref.sourceDigest === source && ref.recordIds.some(id => scoped.some(r => r.id === id && codeBreakSatisfied([r], source))) && unresolvedBlockingReviews(scoped).length === 0; reason = current ? null : "A current approved code review without unresolved blocking findings is required for this workstream." }
  if (current && ref.kind === "attestation") { const decisions = turns.flatMap(t => listDecisionsForTurn(root, t.id)); current = ref.recordType === "decision" && ref.recordIds.some(id => decisions.some(d => d.id === id)); reason = current ? null : "Attestation must reference an existing workstream decision." }
  return { ...ref, current, attested: ref.kind === "attestation", reason }
}

function roleApplicable(role: WorkflowStageRole, ws: Workstream, custom = false): boolean { if (custom) return true; if (role === "spec-review") return ws.policy?.requireSpecBreak !== false; if (role === "code-review") return ws.policy?.requireCodeBreak !== false; return true }

export function projectWorkflow(root: string, workstreamId: string): WorkflowProjection {
  const ws = loadWorkstream(root, workstreamId); const selected = selectedWorkflow(root, workstreamId)
  const generated = resolveWorkflow(root, workstreamId); const snapshot: WorkflowSnapshot = selected ?? { ...generated, snapshotId: "", createdAt: "" }
  const attempts = listWorkflowAttempts(root, workstreamId).filter(a => a.snapshotDigest === snapshot.snapshotDigest)
  const outputs = listWorkflowOutputs(root, workstreamId).filter(o => o.snapshotDigest === snapshot.snapshotDigest).map(o => evaluateRef(root, o, snapshot))
  const reports = listWorkflowReports(root, workstreamId); let priorSatisfied = true
  let stages: WorkflowProjection["stages"] = snapshot.stages.map(stage => {
    const applicable = roleApplicable(stage.role, ws, snapshot.profile.source === "custom"); const stageBlockers: string[] = []
    if (!priorSatisfied && applicable) stageBlockers.push("A previous workflow stage is not satisfied.")
    let priorStepSatisfied = priorSatisfied
    const steps = stage.steps.map(step => {
      const stepAttempts = attempts.filter(a => a.stageId === stage.id && a.stepId === step.id).map(attempt => {
        const report = reports.find(r => r.attemptId === attempt.id); const outputRefs = outputs.filter(o => o.attemptId === attempt.id)
        return { ...attempt, reportedStatus: report?.status ?? "running" as const, ...(report?.reason ? { reason: report.reason } : {}), outputRefs }
      })
      const satisfied = applicable && step.outputs.every(contract => outputs.some(o => o.attemptId && stepAttempts.some(a => a.id === o.attemptId) && o.kind === contract.kind && sameCriteria(o.criterionIds, contract.criterionIds) && o.current))
      const blocked = stepAttempts.some(a => a.reportedStatus === "blocked")
      const status = !applicable ? "not-applicable" as const : satisfied ? "satisfied" as const : blocked || !priorStepSatisfied ? "blocked" as const : stepAttempts.some(a => a.reportedStatus === "running") ? "running" as const : "ready" as const
      priorStepSatisfied = priorStepSatisfied && satisfied
      return { id: step.id, title: step.title, status, skill: step.skill, attempts: stepAttempts }
    })
    const requiredOutputs = stage.steps.flatMap(step => step.outputs.map(contract => {
      const refs = outputs.filter(o => attempts.some(a => a.id === o.attemptId && a.stageId === stage.id && a.stepId === step.id) && o.kind === contract.kind && sameCriteria(o.criterionIds, contract.criterionIds))
      const satisfied = !applicable || refs.some(r => r.current)
      return { stepId: step.id, stepTitle: step.title, kind: contract.kind, criterionIds: contract.criterionIds ?? [], satisfied, current: refs.some(r => r.current), reason: satisfied ? null : refs.at(-1)?.reason ?? `Missing ${contract.kind} for ${step.id}.`, refs }
    }))
    const satisfied = !applicable || steps.every(step => step.status === "satisfied")
    const status = !applicable ? "not-applicable" as const : satisfied ? "satisfied" as const : steps.some(s => s.status === "running") ? "running" as const : steps.some(s => s.status === "ready") ? "ready" as const : "blocked" as const
    if (applicable && !satisfied) stageBlockers.push(...requiredOutputs.filter(o => !o.satisfied).map(o => o.reason!).filter(Boolean))
    priorSatisfied = priorSatisfied && satisfied
    return { id: stage.id, title: stage.title, role: stage.role, status, blockers: [...new Set(stageBlockers)], requiredOutputs, steps }
  })
  if (!selected) stages = inferDefaultStages(root, ws, snapshot, stages)
  const current = stages.find(s => !["satisfied","not-applicable"].includes(s.status)); const blockers = current?.blockers ?? []
  const history = listJson<WorkflowSnapshot>(join(base(root), "snapshots", workstreamId))
  return { profile: { ...snapshot.profile, snapshotId: selected?.snapshotId ?? null, snapshotDigest: snapshot.snapshotDigest, revisionDigest: snapshot.revisionDigest, ...(snapshot.reason ? { reason: snapshot.reason } : {}) },
    status: stages.every(s => ["satisfied","not-applicable"].includes(s.status)) ? "satisfied" : current?.status === "running" ? "running" : current?.status === "ready" ? "ready" : "blocked",
    currentStageId: current?.id ?? null, blockers: [...new Set(blockers)], historicalSnapshots: history.map(s => ({ snapshotId:s.snapshotId,digest:s.snapshotDigest,revisionDigest:s.revisionDigest,...(s.reason?{reason:s.reason}:{}),createdAt:s.createdAt })), stages }
}

function inferDefaultStages(root: string, ws: Workstream, snapshot: WorkflowSnapshot, stages: WorkflowProjection["stages"]): WorkflowProjection["stages"] {
  const revision = planRevision(root, ws); const source = computeTreeDigest(root); const ledger = loadLedger(root)
  const turns = ledger.turns.filter(t => t.intent.workstreamId === ws.id)
  const decisions = turns.flatMap(t => listDecisionsForTurn(root, t.id)) as Array<{id:string;progress?:{revisionDigest:string;sourceDigest:string;criterionIds:string[];implemented:boolean}}>
  const reviews = listAllReviews(root); const report = verifyLedger(ledger)
  const makeRef = (kind: WorkflowOutputKind, recordType: WorkflowOutputReference["recordType"], recordIds: string[], criterionIds: string[], current: boolean, reason: string | null): WorkflowOutputProjection => ({
    schemaVersion: 1, id: `inferred:${kind}`, workstreamId: ws.id, attemptId: "legacy", kind, recordType, recordIds, criterionIds,
    snapshotDigest: snapshot.snapshotDigest, revisionDigest: revision, sourceDigest: source, recordedAt: "", current, attested: false, reason,
  })
  const inferContract = (contract: { kind: WorkflowOutputKind; criterionIds?: string[] }): WorkflowOutputProjection => {
    const criteria = contract.criterionIds ?? []
    if (contract.kind === "spec-revision") return makeRef(contract.kind, "snapshot", ws.seal ? [ws.seal.snapshotPath] : [], criteria, checkSeal(root, ws.id).ok, "The current preserved spec revision is required.")
    if (contract.kind === "spec-review") {
      const scoped = reviews.filter(review => review.workstreamId === ws.id && review.target === "spec")
      const found = scoped.find(review => review.id === ws.specBreakReviewId && review.verdict === "approve" && review.revisionDigest === revision)
      return makeRef(contract.kind, "review", found ? [found.id] : [], criteria, Boolean(found) && !unresolvedBlockingReviews(scoped).length, "The current spec review without blockers is required.")
    }
    if (contract.kind === "implementation-report") {
      const found = decisions.filter(decision => decision.progress?.implemented && decision.progress.revisionDigest === revision && decision.progress.sourceDigest === source && criteria.every(id => decision.progress!.criterionIds.includes(id)))
      return makeRef(contract.kind, "decision", found.map(decision => decision.id), criteria, found.length > 0, "Current implementation reports are required.")
    }
    if (contract.kind === "check-results") {
      const mappedByCriterion = criteria.map(id => ws.acceptanceClaimIds?.[id] ?? []); const mapped = mappedByCriterion.flat()
      const keySets = mapped.map(claimId => ledger.bindings.filter(binding => binding.claimId === claimId && ["command", "results-row"].includes(binding.locator.type)).map(binding => binding.locator.type === "command" ? `command:${binding.id}` : binding.locator.resultsKey!).filter(Boolean))
      const rows = ledger.results?.rows.filter(row => row.sourceDigest === source && row.outcome === "pass") ?? []
      const current = criteria.length > 0 && mappedByCriterion.every(ids => ids.length > 0) && keySets.every(keys => keys.length > 0) && mapped.every(id => report.claims.some(claim => claim.claimId === id && claim.outcome === "pass")) && keySets.flat().every(key => rows.some(row => row.key === key))
      return makeRef(contract.kind, "result", rows.map(row => row.key), criteria, current, "Current passing behavioral evidence is required.")
    }
    if (contract.kind === "code-review") {
      const scoped = reviews.filter(review => review.target !== "spec" && (review.workstreamId ? review.workstreamId === ws.id : turns.some(turn => turn.id === review.turnId)))
      const found = scoped.find(review => codeBreakSatisfied([review], source))
      return makeRef(contract.kind, "review", found ? [found.id] : [], criteria, Boolean(found) && !unresolvedBlockingReviews(scoped).length, "A current code review without blockers is required.")
    }
    return makeRef(contract.kind, "decision", [], criteria, false, "An explicit attestation is required.")
  }
  let prior = true
  return stages.map(stage => {
    const applicable = roleApplicable(stage.role, ws)
    const snapshotStage = snapshot.stages.find(candidate => candidate.id === stage.id)!
    const refsByStep = new Map(snapshotStage.steps.map(step => [step.id, step.outputs.map(inferContract)]))
    const steps = stage.steps.map(step => {
      const refs = refsByStep.get(step.id) ?? []; const satisfied = !applicable || refs.every(ref => ref.current)
      const status = !applicable ? "not-applicable" as const : satisfied ? "satisfied" as const : prior ? "ready" as const : "blocked" as const
      return { ...step, status, attempts: step.attempts }
    })
    const requiredOutputs = snapshotStage.steps.flatMap(step => step.outputs.map((contract, index) => {
      const ref = refsByStep.get(step.id)![index]!
      return { stepId:step.id,stepTitle:step.title,kind:contract.kind,criterionIds:contract.criterionIds??[],satisfied:!applicable||ref.current,current:ref.current,reason:!applicable||ref.current?null:ref.reason,refs:ref.recordIds.length?[ref]:[] }
    }))
    const satisfied = !applicable || requiredOutputs.every(o => o.satisfied); const blockers = !prior && applicable ? ["A previous workflow stage is not satisfied."] : requiredOutputs.filter(o=>!o.satisfied).map(o=>o.reason!).filter(Boolean)
    const status = !applicable ? "not-applicable" as const : satisfied ? "satisfied" as const : blockers.length && !prior ? "blocked" as const : "ready" as const
    prior = prior && satisfied
    return { ...stage, status, blockers, requiredOutputs, steps }
  })
}
