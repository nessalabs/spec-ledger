import * as z from "zod/v4"

export const goalIdSchema = z.string().uuid()
export const experimentIdSchema = z.string().uuid()
const text = z.string().trim().min(1).max(4000)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const turnId = z.string().uuid()
const workstreamId = z.string().uuid()
const metric = z.object({
  name: z.string().trim().min(1).max(100), unit: z.string().trim().max(40),
  direction: z.enum(["minimize", "maximize"]), protocol: text,
  baseline: z.number().finite().optional(), target: z.number().finite().optional(),
}).strict()

export const goalInputSchema = z.object({
  workstreamId, turnId, title: z.string().trim().min(1).max(200),
  objective: text, stopWhen: text, maxExperiments: z.number().int().min(1).max(10000).optional(),
  metric: metric.optional(),
}).strict()
export const experimentInputSchema = z.object({
  goalId: goalIdSchema, turnId,
  hypothesis: text, change: text, parentExperimentId: experimentIdSchema.optional(),
}).strict()
export const resultInputSchema = z.object({
  goalId: goalIdSchema, experimentId: experimentIdSchema, turnId,
  status: z.enum(["completed", "failed"]), decision: z.enum(["kept", "discarded", "inconclusive"]),
  measurement: z.number().finite().optional(), findings: text,
  evidenceRefs: z.array(z.string().trim().min(1).max(1000)).max(30).optional(),
}).strict().refine(v => v.status !== "failed" || (v.measurement === undefined && v.decision === "inconclusive"), {
  message: "failed experiments must be inconclusive and have no measurement",
})
export const conclusionInputSchema = z.object({
  goalId: goalIdSchema, turnId, reason: z.enum(["satisfied", "budget", "stopped"]), summary: text,
}).strict()
const stamp = { schemaVersion: z.literal(1), createdAt: z.string().datetime(), sourceDigest: digest, revisionDigest: digest }
export const goalSchema = goalInputSchema.extend({ ...stamp, id: goalIdSchema })
export const experimentSchema = experimentInputSchema.extend({ ...stamp, id: experimentIdSchema, sequence: z.number().int().positive() })
export const resultSchema = resultInputSchema.safeExtend(stamp)
export const conclusionSchema = conclusionInputSchema.extend(stamp)
export type OptimizationGoal = z.infer<typeof goalSchema>
export type Experiment = z.infer<typeof experimentSchema>
export type ExperimentResult = z.infer<typeof resultSchema>
export type GoalConclusion = z.infer<typeof conclusionSchema>
export type GoalInput = z.infer<typeof goalInputSchema>
export type ExperimentInput = z.infer<typeof experimentInputSchema>
export type ResultInput = z.infer<typeof resultInputSchema>
export type ConclusionInput = z.infer<typeof conclusionInputSchema>
export interface Observation { value: number; experimentId: string | null; decision: "baseline" | ExperimentResult["decision"] }
export interface GoalProjection {
  goal: OptimizationGoal
  conclusion: GoalConclusion | null
  status: "active" | "budget-reached" | "concluded"
  experiments: Array<{ experiment: Experiment; result: ExperimentResult | null }>
  latest: Observation | null
  bestObserved: Observation | null
  bestKept: Observation | null
  targetObserved: boolean | null
  remainingExperiments: number | null
  lastRecordedAt: string
}
