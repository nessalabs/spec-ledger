import { assertEntityId, createEntityId } from "../identity/index.js"
import { existsSync, mkdirSync, realpathSync, writeFileSync, linkSync, unlinkSync } from "node:fs"
import { dirname, isAbsolute, join, relative } from "node:path"
import { randomUUID } from "node:crypto"
import { loadLedger } from "../fs/load.js"
import { listAttachmentsForTurn } from "../episodes/load.js"
import { loadWorkstream, checkSeal } from "../workstream/load.js"
import { planRevision } from "../permission/authority.js"
import { computeTreeDigest } from "../git/tree.js"
import { contentHash } from "./fingerprint.js"
import { readBounded } from "./artifact.js"
import { supportedRaster } from "./image-preview.js"
import type { EpisodeAttachment, Workstream } from "../types.js"

/** Plan-owned coverage; no repository-specific UI paths or heuristics in core. */
export function visualRequirements(ws: Workstream): { sliceId: string; surface: string }[] {
  const raw = ws.trust?.visualEvidence
  const map = raw === undefined ? {} : raw
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error("Declare visualEvidence as a map of slice IDs to required UI surfaces.")
  const slices = ws.suggestedSlices ?? []
  const required: { sliceId: string; surface: string }[] = []
  for (const [sliceId, surfaces] of Object.entries(map)) {
    if (!slices.some(s => s.id === sliceId) || !Array.isArray(surfaces) || !surfaces.length || surfaces.length > 30 ||
        surfaces.some(s => typeof s !== "string" || !s.trim() || s !== s.trim() || s.length > 200) || new Set(surfaces).size !== surfaces.length) {
      throw new Error(`Invalid visual evidence declaration for ${sliceId}; list distinct relevant UI surfaces for a known slice.`)
    }
    for (const surface of surfaces) required.push({ sliceId, surface })
  }
  for (const slice of slices) if (slice.evidence?.includes("screenshot") && !required.some(r => r.sliceId === slice.id)) {
    throw new Error(`Visual slice ${slice.id} requires screenshots: declare all relevant UI surfaces in trust.visualEvidence.`)
  }
  if (ws.trust?.requiredEvidence && Array.isArray(ws.trust.requiredEvidence) && ws.trust.requiredEvidence.includes("screenshot") && !required.length) {
    throw new Error("Screenshot evidence is required: declare all relevant UI surfaces in trust.visualEvidence.")
  }
  return required
}

function validScreenshot(root: string, a: EpisodeAttachment): boolean {
  try {
    if (a.kind !== "image" || !a.contentDigest || !a.visualEvidence || !["image/png", "image/jpeg"].includes(a.mediaType ?? "")) return false
    const bytes = readBounded(root, a.path, 512 * 1024)
    return contentHash(bytes) === a.contentDigest && supportedRaster(bytes, a.mediaType!)
  } catch { return false }
}

/** This workflow evidence never supplies a behavioral verifier pass. */
export function checkVisualEvidence(root: string, workstreamId: string, turnId?: string) {
  const ws = loadWorkstream(root, workstreamId)
  const ledger = loadLedger(root)
  const selectedTurn = turnId ? ledger.turns.find(t => t.id === turnId && t.intent.workstreamId === workstreamId) : undefined
  const sourceDigest = computeTreeDigest(root)
  const revisionDigest = planRevision(root, ws)
  let requirements: ReturnType<typeof visualRequirements>
  try {
    if (turnId && !selectedTurn) throw new Error("Visual evidence check requires a turn belonging to this workstream.")
    requirements = visualRequirements(ws)
    if (turnId && requirements.length && !selectedTurn!.intent.sliceId) throw new Error("Select a declared slice before closing visual work and attach screenshots of all relevant UI.")
    if (turnId) requirements = requirements.filter(r => r.sliceId === selectedTurn!.intent.sliceId)
  } catch (error) {
    return { ok: false, required: true, surfaces: [], reasons: [error instanceof Error ? error.message : "Invalid visual evidence requirements."] }
  }
  const turns = ledger.turns.filter(t => t.intent.workstreamId === workstreamId && t.status !== "abandoned" && (!turnId || t.id === turnId))
  const attachments = turns.flatMap(t => listAttachmentsForTurn(root, t.id).filter(a => a.turnId === t.id))
  const sealCurrent = checkSeal(root, workstreamId).ok
  const candidates = requirements.map(r => attachments.filter(a =>
    a.visualEvidence?.sliceId === r.sliceId && a.visualEvidence.surface === r.surface && sealCurrent &&
    a.visualEvidence.sourceDigest === sourceDigest && a.visualEvidence.revisionDigest === revisionDigest && validScreenshot(root, a)))
  // Bipartite matching allows an earlier surface to choose another image when a
  // later surface has only one option. Greedy assignment can invent missing coverage.
  const owners = new Map<string, number>()
  const chosen = new Map<number, EpisodeAttachment>()
  function assign(index: number, visited: Set<string>): boolean {
    for (const candidate of candidates[index]) {
      const digest = candidate.contentDigest!
      if (visited.has(digest)) continue
      visited.add(digest)
      const owner = owners.get(digest)
      if (owner === undefined || assign(owner, visited)) {
        owners.set(digest, index)
        chosen.set(index, candidate)
        return true
      }
    }
    return false
  }
  requirements.forEach((_, index) => assign(index, new Set()))
  const surfaces = requirements.map((r, index) => ({ ...r, satisfied: chosen.has(index), attachmentId: chosen.get(index)?.id ?? null }))
  const missing = surfaces.filter(s => !s.satisfied)
  const reasons = missing.length ? [`Attach screenshots of all relevant UI before finishing. Missing current screenshot coverage: ${missing.map(s => `${s.sliceId}: ${s.surface}`).join("; ")}. Capture PNG/JPEG files under .spec-ledger/evidence/screenshots/ and record each with spec-ledger evidence screenshot --turn <open-turn> --slice <slice> --surface <surface> --path <repo-relative-file>. Changed, stale or historical attachments do not satisfy this requirement.`] : []
  return { ok: !missing.length, required: requirements.length > 0, surfaces, reasons }
}

/** Called only inside the guarded application mutation. Identity is retry stable. */
export function recordScreenshot(root: string, input: { requestId: string; turnId: string; sliceId?: string; surface: string; path: string; title?: string; expectedSourceDigest: string; expectedRevisionDigest: string }) {
  const ledger = loadLedger(root)
  const turn = ledger.turns.find(t => t.id === input.turnId)
  if (!turn || turn.status !== "open" || !turn.intent.workstreamId) throw new Error("Record screenshots on an open workstream turn.")
  assertEntityId(turn.id, "screenshot turn id")
  const ws = loadWorkstream(root, turn.intent.workstreamId)
  const sliceId = input.sliceId ?? turn.intent.sliceId
  if (!visualRequirements(ws).some(r => r.sliceId === sliceId && r.surface === input.surface)) throw new Error("Screenshot surface must match a declared visual requirement in this workstream.")
  if (!checkSeal(root, ws.id).ok) throw new Error("Screenshot requires the current preserved plan snapshot.")
  const bytes = readBounded(root, input.path, 512 * 1024)
  const mediaType = bytes[0] === 137 ? "image/png" : "image/jpeg"
  if (!supportedRaster(bytes, mediaType)) throw new Error("Attach a valid PNG/JPEG screenshot of the relevant UI (at most 512 KiB and 16 million pixels).")
  const attachment: EpisodeAttachment = { schemaVersion: 1, id: createEntityId(), turnId: turn.id,
    kind: "image", title: input.title ?? input.surface, path: input.path, mediaType, byteLength: bytes.length, contentDigest: contentHash(bytes),
    visualEvidence: { sliceId: sliceId!, surface: input.surface, sourceDigest: input.expectedSourceDigest, revisionDigest: input.expectedRevisionDigest, recordedAt: new Date().toISOString() },
    note: "Recorded visual coverage; image adequacy is assessed in review." }
  const directory = join(ledger.rootDir, ledger.config.attachmentsDir ?? "attachments", turn.id)
  // Check the closest existing parent before creating directories, then use its canonical path.
  let ancestor = directory
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  const base = realpathSync(root)
  const confined = (path: string) => { const rel = relative(base, realpathSync(path)); return rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../") }
  if (!confined(ancestor) && realpathSync(ancestor) !== base) throw new Error("Screenshot attachment directory escapes the checkout.")
  mkdirSync(directory, { recursive: true })
  if (!confined(directory)) throw new Error("Screenshot attachment directory escapes the checkout.")
  const target = join(realpathSync(directory), `${attachment.id}.json`)
  const temporary = `${target}.${randomUUID()}.tmp`
  writeFileSync(temporary, JSON.stringify(attachment, null, 2) + "\n", { flag: "wx" })
  try { linkSync(temporary, target) } finally { unlinkSync(temporary) }
  return attachment
}
