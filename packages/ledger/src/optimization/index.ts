import { loadLedger } from "../fs/load.js"
import { permissionStatus, planRevision } from "../permission/authority.js"
import { loadWorkstream, checkSeal } from "../workstream/load.js"
import {
  goalInputSchema, experimentInputSchema, resultInputSchema, conclusionInputSchema,
  goalSchema, experimentSchema, resultSchema, conclusionSchema,
  type GoalProjection, type Observation, type OptimizationGoal,
} from "./model.js"
import { recordPath, readRecord, goalIds, recordIds, publishRecord, assertSameInput } from "./store.js"
export * from "./model.js"
export { optimizationDir } from "./store.js"

export interface OptimizationStamp { sourceDigest: string; revisionDigest: string }
function stamp(input: OptimizationStamp) { return { ...input, schemaVersion: 1 as const, createdAt: new Date().toISOString() } }

export function getOptimizationGoal(root: string, id: string): GoalProjection {
  const goal = readRecord(recordPath(root, id, "goal"), goalSchema)
  if (!goal || goal.id !== id) throw new Error(`goal not found or mismatched: ${id}`)
  const experiments = recordIds(root, id, "experiments").map(expId => {
    const experiment = readRecord(recordPath(root, id, "experiments", expId), experimentSchema)!
    const result = readRecord(recordPath(root, id, "results", expId), resultSchema)
    if (experiment.id !== expId || experiment.goalId !== id || (result && (result.goalId !== id || result.experimentId !== expId))) throw new Error("mismatched experiment history")
    if (result?.measurement !== undefined && !goal.metric) throw new Error("qualitative goal cannot have a measurement")
    return { experiment, result }
  }).sort((a,b) => a.experiment.sequence - b.experiment.sequence)
  if (new Set(experiments.map(e => e.experiment.sequence)).size !== experiments.length) throw new Error("duplicate experiment sequence")
  const experimentIds = new Set(experiments.map(e => e.experiment.id))
  if (recordIds(root, id, "results").some(expId => !experimentIds.has(expId))) throw new Error("orphan experiment result")
  for (const { experiment } of experiments) {
    if (experiment.parentExperimentId && !experiments.some(e => e.experiment.id === experiment.parentExperimentId && e.result && e.experiment.sequence < experiment.sequence)) throw new Error("invalid experiment parent")
  }
  const conclusion = readRecord(recordPath(root, id, "conclusion"), conclusionSchema)
  if (conclusion && (conclusion.goalId !== id || experiments.some(e => !e.result))) throw new Error("invalid goal conclusion")
  const baseline: Observation | null = goal.metric?.baseline === undefined ? null : { value: goal.metric.baseline, experimentId: null, decision: "baseline" }
  let latest: Observation | null = null, bestObserved = baseline, bestKept = baseline
  const better = (a: Observation, b: Observation | null) => !b || (goal.metric?.direction === "minimize" ? a.value < b.value : a.value > b.value)
  for (const { experiment, result } of experiments) {
    if (!result || result.status !== "completed" || result.measurement === undefined) continue
    latest = { value: result.measurement, experimentId: experiment.id, decision: result.decision }
    if (better(latest, bestObserved)) bestObserved = latest
    if (result.decision === "kept" && better(latest, bestKept)) bestKept = latest
  }
  const remainingExperiments = goal.maxExperiments === undefined ? null : Math.max(0, goal.maxExperiments - experiments.length)
  const target = goal.metric?.target
  return {
    goal, conclusion, experiments, latest, bestObserved, bestKept,
    status: conclusion ? "concluded" : remainingExperiments === 0 ? "budget-reached" : "active",
    remainingExperiments,
    targetObserved: target === undefined || !bestObserved ? null : goal.metric!.direction === "minimize" ? bestObserved.value <= target : bestObserved.value >= target,
    lastRecordedAt: [goal.createdAt, ...experiments.flatMap(e => [e.experiment.createdAt, ...(e.result ? [e.result.createdAt] : [])]), ...(conclusion ? [conclusion.createdAt] : [])].sort().at(-1)!,
  }
}
export function listOptimizationGoals(root: string, filter: { workstreamId?: string; turnId?: string } = {}): GoalProjection[] {
  return goalIds(root).map(id => getOptimizationGoal(root, id)).filter(g =>
    (!filter.workstreamId || g.goal.workstreamId === filter.workstreamId) &&
    (!filter.turnId || g.goal.turnId === filter.turnId || g.conclusion?.turnId === filter.turnId || g.experiments.some(e => e.experiment.turnId === filter.turnId || e.result?.turnId === filter.turnId)),
  ).sort((a,b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt) || a.goal.id.localeCompare(b.goal.id))
}

/** History permission follows current authorized work; observations never authorize execution. */
function assertCurrentTurn(root: string, workstreamId: string, turnId: string, expected: OptimizationStamp) {
  const turn = loadLedger(root).turns.find(t => t.id === turnId)
  if (!turn || turn.status !== "open" || turn.intent.workstreamId !== workstreamId) throw new Error("optimization write requires an open turn in the goal workstream")
  const ws = loadWorkstream(root, workstreamId)
  if (ws.status === "done" || ws.status === "cancelled") throw new Error("goal workstream is no longer active")
  if (!permissionStatus(root, workstreamId).allowed) throw new Error("goal work is not authorized")
  if (planRevision(root, ws) !== expected.revisionDigest || !checkSeal(root, workstreamId).ok) throw new Error("goal write requires the current executable plan")
  if (turn.opened?.contextSealRevision !== ws.seal?.revision) throw new Error("turn belongs to a stale plan")
}
function assertActive(goal: GoalProjection) { if (goal.conclusion) throw new Error("goal is concluded") }

/** Application-only writers: call under runMutation and after source fingerprint validation. */
export function createOptimizationGoal(root: string, raw: unknown, expected: OptimizationStamp): OptimizationGoal {
  const input = goalInputSchema.parse(raw)
  const path = recordPath(root, input.id, "goal")
  const prior = assertSameInput(readRecord(path, goalSchema), input)
  if (prior) return prior
  assertCurrentTurn(root, input.workstreamId, input.turnId, expected)
  return publishRecord(path, goalSchema.parse({ ...input, ...stamp(expected) }))
}
export function startOptimizationExperiment(root: string, raw: unknown, expected: OptimizationStamp) {
  const input = experimentInputSchema.parse(raw)
  const path = recordPath(root, input.goalId, "experiments", input.id)
  const prior = assertSameInput(readRecord(path, experimentSchema), input)
  if (prior) return prior
  const goal = getOptimizationGoal(root, input.goalId)
  assertCurrentTurn(root, goal.goal.workstreamId, input.turnId, expected); assertActive(goal)
  if (goal.remainingExperiments === 0) throw new Error("experiment budget reached")
  if (input.parentExperimentId && !goal.experiments.some(e => e.experiment.id === input.parentExperimentId && e.result)) throw new Error("parent must be a finished experiment in this goal")
  const sequence = Math.max(0, ...goal.experiments.map(e => e.experiment.sequence)) + 1
  return publishRecord(path, experimentSchema.parse({ ...input, ...stamp(expected), sequence }))
}
export function recordOptimizationResult(root: string, raw: unknown, expected: OptimizationStamp) {
  const input = resultInputSchema.parse(raw)
  const path = recordPath(root, input.goalId, "results", input.experimentId)
  const prior = assertSameInput(readRecord(path, resultSchema), input)
  if (prior) return prior
  const goal = getOptimizationGoal(root, input.goalId)
  assertCurrentTurn(root, goal.goal.workstreamId, input.turnId, expected); assertActive(goal)
  if (!goal.experiments.some(e => e.experiment.id === input.experimentId)) throw new Error("experiment not found in goal")
  if (!goal.goal.metric && input.measurement !== undefined) throw new Error("qualitative goal cannot have a measurement")
  return publishRecord(path, resultSchema.parse({ ...input, ...stamp(expected) }))
}
export function concludeOptimizationGoal(root: string, raw: unknown, expected: OptimizationStamp) {
  const input = conclusionInputSchema.parse(raw)
  const path = recordPath(root, input.goalId, "conclusion")
  const prior = assertSameInput(readRecord(path, conclusionSchema), input)
  if (prior) return prior
  const goal = getOptimizationGoal(root, input.goalId)
  assertCurrentTurn(root, goal.goal.workstreamId, input.turnId, expected); assertActive(goal)
  if (goal.experiments.some(e => !e.result)) throw new Error("finish pending experiments before concluding the goal")
  return publishRecord(path, conclusionSchema.parse({ ...input, ...stamp(expected) }))
}
