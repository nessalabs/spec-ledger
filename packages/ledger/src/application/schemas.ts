import * as z from "zod/v4"

const id = z.string().min(1).max(160)
const requestId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{15,79}$/)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const stringList = z.array(z.string().min(1).max(500)).max(200)
const record = z.record(z.string(), z.unknown())

export const OPERATION_SCHEMAS = {
  plan_work: z.object({ workstreamId: id }).strict(),
  get_context: z.object({ workstreamId: id, sliceId: id }).strict(),
  get_session: z.object({ workstreamId: id.optional() }).strict(),
  record_permission: z.object({ requestId, authority: record }).strict(),
  begin_work: z.object({
    requestId, workstreamId: id, sliceId: id.optional(), goal: z.string().min(1).max(1000),
    prompt: z.string().min(1).max(4000).optional(), featureIds: stringList.optional(),
    turnId: id.optional(), changeType: z.enum(["feature", "refactor", "fix", "migration", "chore", "docs"]).optional(),
    riskLevel: z.enum(["low", "moderate", "elevated", "high"]).optional(),
    noContext: z.boolean().optional(), noContextReason: z.string().min(1).max(1000).optional(),
    allowDirty: z.boolean().optional(), expectedRevisionDigest: digest,
  }).strict(),
  record_progress: z.object({
    requestId, turnId: id, summary: z.string().min(1).max(4000), criterionIds: stringList,
    implemented: z.boolean(), preview: z.object({ url: z.string().url().max(2048), label: z.string().min(1).max(200) }).strict().optional(),
    expectedRevisionDigest: digest, expectedSourceDigest: digest,
  }).strict(),
  record_decision: z.object({
    requestId, turnId: id, decision: z.string().min(1).max(4000), rationale: z.string().min(1).max(8000),
    alternativesRejected: stringList.optional(), addressesFindingIds: stringList.optional(),
    discovery: z.object({
      kind: z.enum(["code-defect", "spec-gap", "spec-conflict", "verification-gap", "workflow-gap"]),
      reportedVia: z.enum(["user", "test", "review", "runtime"]),
      observation: z.string().min(1).max(4000), cause: z.string().max(4000).optional(),
      specRef: z.string().max(1000).optional(), regression: z.string().max(4000).optional(),
    }).strict().optional(),
    expectedRevisionDigest: digest, expectedSourceDigest: digest,
  }).strict(),
  record_evidence: z.object({ requestId, evidence: record }).strict(),
  record_review: z.object({
    requestId, target: z.enum(["spec", "code"]), workstreamId: id.optional(), turnId: id.optional(),
    expectedRevisionDigest: digest.optional(), expectedSourceDigest: digest.optional(), review: record,
  }).strict(),
  approve_alignment: z.object({
    requestId, turnId: id, expectedSourceDigest: digest, plainSummary: z.string().min(1).max(280),
    reviewer: z.string().min(1).max(200).optional(), summary: z.string().min(1).max(4000).optional(),
    waiverIds: stringList.optional(),
  }).strict(),
  run_checks: z.object({ requestId, expectedSourceDigest: digest }).strict(),
  finish_turn: z.object({ requestId, turnId: id, action: z.enum(["close", "abandon"]), expectedSourceDigest: digest }).strict(),
  complete_work: z.object({ requestId, workstreamId: id, expectedRevisionDigest: digest, expectedSourceDigest: digest }).strict(),
} as const

export type OperationName = keyof typeof OPERATION_SCHEMAS

export function validateOperationInput(name: OperationName, input: unknown): Record<string, unknown> {
  const result = OPERATION_SCHEMAS[name].safeParse(input)
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ")
    throw new Error(`invalid operation input: ${message}`)
  }
  return result.data as Record<string, unknown>
}

