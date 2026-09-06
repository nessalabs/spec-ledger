import * as z from "zod/v4"
import { join } from "node:path"
import { loadLedger } from "../fs/load.js"
import { loadWorkstream } from "../workstream/load.js"
import { permissionStatus } from "../permission/authority.js"
import { createEntityId, publishEntity } from "./index.js"

const text = z.string().trim().min(1).max(4000)
const title = z.string().trim().min(1).max(200)
const uuid = z.string().uuid()
const names = z.array(z.string().trim().min(1).max(160)).max(200)
const slice = z.object({ title, kind: z.literal("vertical"), acceptance: z.array(text).min(1), evidence: names.optional(), expectedPaths: names.optional(), expectedClaimIds: z.array(uuid).optional() }).strict()
export const workstreamInput = z.object({
  title, problem: text, objective: text, featureIds: names.min(1), specPath: text.optional(),
  changeType: z.enum(["feature", "refactor", "fix", "migration", "chore", "docs"]).optional(),
  riskLevel: z.enum(["low", "moderate", "elevated", "high"]).optional(),
  trust: z.record(z.string(), z.unknown()).optional(), policy: z.record(z.string(), z.unknown()).optional(),
  suggestedSlices: z.array(slice).max(100).optional(),
}).strict()
export const claimInput = z.object({ kind: z.enum(["spec","adr","invariant","protocol","absence"]), statement: text, required: z.boolean(), area: text.optional(), links: z.object({ dependsOn: z.array(uuid).optional(), related: z.array(uuid).optional(), docs: names.optional() }).strict().optional() }).strict()
export const bindingInput = z.object({ claimId: uuid, kind: z.enum(["test","check","contract","proof","attestation"]), locator: z.record(z.string(),z.unknown()), test: z.record(z.string(),z.unknown()).optional() }).strict()

/** Called under the shared mutation boundary. Draft planning does not grant implementation authority. */
export function createWorkstream(root: string, raw: unknown) {
  const input = workstreamInput.parse(raw), ledger = loadLedger(root)
  if (input.featureIds.some(id => !ledger.graph?.features?.some(f => f.id === id))) throw new Error("Every feature must already exist in the graph")
  const record = { ...input, schemaVersion: 1 as const, id: createEntityId(), status: "draft" as const, createdAt: new Date().toISOString(), suggestedSlices: input.suggestedSlices?.map(s => ({ ...s, id: createEntityId() })) ?? [] }
  publishEntity(join(ledger.rootDir, ledger.config.workstreamsDir ?? "workstreams", `${record.id}.json`),record)
  return record
}
export function createClaim(root: string, raw: unknown, turnId: string) {
  assertBuilder(root,turnId)
  const input=claimInput.parse(raw), ledger=loadLedger(root)
  if ([...(input.links?.dependsOn ?? []),...(input.links?.related ?? [])].some(id=>!ledger.claims.some(c=>c.id===id))) throw new Error("Referenced claim does not exist")
  const record={...input,id:createEntityId()}
  publishEntity(join(ledger.rootDir,ledger.config.claimsDir ?? "claims",`${record.id}.json`),record);return record
}
export function createProposedClaim(root:string, raw:unknown, workstreamId:string) {
  loadWorkstream(root,workstreamId)
  const record={...claimInput.parse(raw),schemaVersion:1,id:createEntityId(),status:"proposed",workstreamId}
  const ledger=loadLedger(root);publishEntity(join(ledger.rootDir,ledger.config.proposedClaimsDir ?? "proposed-claims",`${record.id}.json`),record);return record
}
export function createBinding(root:string,raw:unknown,turnId:string) {
  assertBuilder(root,turnId)
  const input=bindingInput.parse(raw),ledger=loadLedger(root)
  if(!ledger.claims.some(c=>c.id===input.claimId))throw new Error("Binding requires an existing claim")
  const record={...input,id:createEntityId()};publishEntity(join(ledger.rootDir,ledger.config.bindingsDir ?? "bindings",`${record.id}.json`),record);return record
}
function assertBuilder(root:string,turnId:string) {
  const turn=loadLedger(root).turns.find(t=>t.id===turnId)
  if(!turn||turn.status!=="open"||!turn.intent.workstreamId||!permissionStatus(root,turn.intent.workstreamId).allowed)throw new Error("Creating live claims or bindings requires an authorized open workstream turn")
}

export const tenetInput = z.object({ statement: text, scope: text.optional(), origin: z.enum(["user","agent-confirmed","agent-inferred"]), weight: z.enum(["must","should","may"]).optional(), confirmedAt: text.optional(), confirmedBy: text.optional() }).strict()
export const themeInput = z.object({ title, summary: text }).strict()
export const learningInput = z.object({ statement:text, workstreamId:uuid.optional(), featureIds:names.optional(), source:z.object({kind:z.enum(["user-reported","agent-inferred"]),reference:text}).strict(), supersedes:z.array(uuid).optional(), supersedesTenetIds:z.array(uuid).optional() }).strict()
export function createCompassRecord(root:string, kind:"tenet"|"theme", raw:unknown) {
  const input=(kind==="tenet" ? tenetInput : themeInput).parse(raw), ledger=loadLedger(root)
  const record={...input,schemaVersion:1,id:createEntityId(),status:"active",createdAt:new Date().toISOString()}
  const dir=kind==="tenet" ? ledger.config.tenetsDir ?? "tenets" : ledger.config.themesDir ?? "themes"
  publishEntity(join(ledger.rootDir,dir,`${record.id}.json`),record);return record
}
