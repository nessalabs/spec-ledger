import { supportedRaster } from "../evidence/image-preview.js"
import { readBounded } from "../evidence/artifact.js"
import { join, relative } from "node:path"
import { sha256Stable } from "../fs/load.js"
import { contentHash } from "../evidence/fingerprint.js"
import type { LoadedLedger, VerifyReport, ResultsRow, EpisodeAttachment } from "../types.js"

export function attachmentEvidence(root: string, attachment: EpisodeAttachment, budget = { remaining: 2 * 1024 * 1024 }) {
  const base = { id: attachment.id, turnId: attachment.turnId, title: attachment.title ?? attachment.path,
    recordedAt: attachment.visualEvidence?.recordedAt ?? null, imageDataUrl: null as string | null, path: attachment.path, note: attachment.note, mediaType: attachment.mediaType, contentDigest: attachment.contentDigest }
  if (!attachment.contentDigest) return { ...base, status: "unverified", text: null, reason: "No recorded integrity digest; content is not displayed." }
  const image = attachment.mediaType === "image/png" || attachment.mediaType === "image/jpeg"
  if (!image && !attachment.mediaType?.startsWith("text/") && attachment.mediaType !== "application/json") {
    return { ...base, status: "unsupported", text: null, reason: "Preview supports text, PNG and JPEG artifacts only." }
  }
  try {
    const limit = image ? Math.min(512 * 1024, budget.remaining) : 64 * 1024
    const bytes = readBounded(root, attachment.path, limit)
    if (image) budget.remaining -= bytes.length
    if (contentHash(bytes) !== attachment.contentDigest) return { ...base, status: "changed", text: null, reason: "Artifact no longer matches its recorded digest." }
    if (image) {
      if (!supportedRaster(bytes, attachment.mediaType!)) return { ...base, status: "unsupported", text: null, reason: "File has invalid or unsupported image structure or dimensions." }
      return { ...base, status: "verified", text: null, imageDataUrl: `data:${attachment.mediaType};base64,${bytes.toString("base64")}`, reason: "Saved visual observation; bytes match the recorded digest. This is not a current passing test." }
    }
    return { ...base, status: "verified", text: bytes.toString("utf8"), reason: "Content matches the recorded artifact. This does not establish current behavioral correctness." }
  } catch { return { ...base, status: "unavailable", text: null, reason: "Artifact is missing, outside the checkout, or exceeds preview limits (64 KiB text, 512 KiB image, 2 MiB images per observation)." } }
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
