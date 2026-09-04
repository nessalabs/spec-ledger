import { closeSync, fstatSync, openSync, readSync } from "node:fs"
import { join, relative } from "node:path"
import { sha256Stable } from "../fs/load.js"
import { contentHash, localArtifactPath } from "../evidence/fingerprint.js"
import type { LoadedLedger, VerifyReport, ResultsRow, EpisodeAttachment } from "../types.js"

/** Bounded reads of regular files after realpath confinement; never follows a remote URL. */
function readBounded(root: string, path: string, limit: number): Buffer {
  const fd = openSync(localArtifactPath(root, path), "r")
  try {
    if (fstatSync(fd).size > limit) throw new Error("Artifact exceeds display limit")
    const bytes = Buffer.alloc(limit + 1)
    let size = 0
    while (size <= limit) {
      const n = readSync(fd, bytes, size, bytes.length - size, null)
      if (!n) return bytes.subarray(0, size)
      size += n
    }
    throw new Error("Artifact exceeds display limit")
  } finally { closeSync(fd) }
}

export function attachmentEvidence(root: string, attachment: EpisodeAttachment) {
  const base = { id: attachment.id, turnId: attachment.turnId, title: attachment.title ?? attachment.path,
    path: attachment.path, note: attachment.note, mediaType: attachment.mediaType, contentDigest: attachment.contentDigest }
  if (!attachment.contentDigest) return { ...base, status: "unverified", text: null, reason: "No recorded integrity digest; content is not displayed." }
  if (!attachment.mediaType?.startsWith("text/") && attachment.mediaType !== "application/json") {
    return { ...base, status: "unsupported", text: null, reason: "Inline preview supports text artifacts only." }
  }
  try {
    const bytes = readBounded(root, attachment.path, 64 * 1024)
    if (contentHash(bytes) !== attachment.contentDigest) return { ...base, status: "changed", text: null, reason: "Artifact no longer matches its recorded digest." }
    return { ...base, status: "verified", text: bytes.toString("utf8"), reason: "Content matches the recorded artifact. This does not establish current behavioral correctness." }
  } catch { return { ...base, status: "unavailable", text: null, reason: "Artifact is missing, outside the checkout, or exceeds the 64 KiB preview limit." } }
}

function receiptMetadata(ledger: LoadedLedger, row: ResultsRow) {
  if (!row.runId || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.runId)) return null
  try {
    const path = join(ledger.rootDir, "evidence/runs", `${row.runId}.json`)
    // The ledger directory can be configured; confinement still uses the checkout root.
    const receiptPath = relative(ledger.repoRoot, path)
    const receipt = JSON.parse(readBounded(ledger.repoRoot, receiptPath, 1024 * 1024).toString("utf8"))
    if (!Array.isArray(receipt.rows) || !receipt.rows.some((r: ResultsRow) => sha256Stable(r) === sha256Stable(row))) return null
    return { producedAt: typeof receipt.producedAt === "string" ? receipt.producedAt : null,
      producer: typeof receipt.producer?.name === "string" ? receipt.producer.name : null }
  } catch { return null }
}

/** Current verdicts come only from the verifier; raw observations are explicitly historical. */
export function claimEvidence(ledger: LoadedLedger, report: VerifyReport, claimIds: string[]) {
  return claimIds.map(id => {
    const claim = ledger.claims.find(c => c.id === id)
    const verdict = report.claims.find(c => c.claimId === id)
    return { id, statement: claim?.statement ?? "Claim not found", outcome: verdict?.outcome ?? "missing", reason: verdict?.detail,
      checks: ledger.bindings.filter(b => b.claimId === id).map(binding => {
        const key = binding.locator.type === "command" ? `command:${binding.id}` : binding.locator.type === "results-row" ? binding.locator.resultsKey ?? id : null
        const current = verdict?.checks?.find(c => c.bindingId === binding.id)
        return { id: binding.id, kind: binding.kind, definition: binding.locator,
          outcome: current?.outcome ?? "missing", reason: current?.detail,
          recorded: key ? (ledger.results?.rows ?? []).filter(row => row.key === key).map(row => ({ ...row, receipt: receiptMetadata(ledger, row) })) : [] }
      }) }
  })
}
