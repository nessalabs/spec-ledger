import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findRepoRoot, ledgerRoot } from "../fs/load.js"
import type { PostSealAmend, Workstream } from "../types.js"

/** sha256 hex of raw file bytes (UTF-8 path contents as on disk). */
export function sha256FileBytes(absPath: string): string {
  return createHash("sha256").update(readFileSync(absPath)).digest("hex")
}

export function resolveSpecPath(
  repoRoot: string,
  specPath: string | undefined,
): string | null {
  if (!specPath?.trim()) return null
  if (specPath.includes("\0") || specPath.startsWith("/") || specPath.includes("..")) {
    throw new Error(`unsafe specPath: ${specPath}`)
  }
  return join(repoRoot, specPath)
}

/**
 * Last expected doc digest for the active seal revision. Older amendments stay
 * in history but cannot override the bytes approved by a subsequent seal.
 * Undefined when sealed+specPath still needs backfill.
 */
export function lastExpectedDocDigest(ws: Workstream): string | undefined {
  const amends = (ws.postSealAmends ?? []).filter(
    (amend) => amend.sealedRevision === ws.seal?.revision,
  )
  if (amends.length) {
    // Always prefer the latest amend slot — do not fall through on empty/invalid
    // afterDocDigest (that would erase the amend trail and greenwash check-seal).
    return amends[amends.length - 1]?.afterDocDigest
  }
  return ws.seal?.specDocDigest
}

export function readSpecDocDigest(
  repoRootInput: string,
  ws: Workstream,
): { absPath: string; digest: string } | null {
  const repoRoot = findRepoRoot(repoRootInput)
  const abs = resolveSpecPath(repoRoot, ws.specPath)
  if (!abs) return null
  if (!existsSync(abs)) {
    throw new Error(`specPath missing on disk: ${ws.specPath}`)
  }
  return { absPath: abs, digest: sha256FileBytes(abs) }
}

export type DocDigestCheck =
  | { ok: true; expected?: string; actual?: string; status: "ok" | "no-spec-path" }
  | {
      ok: false
      expected?: string
      actual?: string
      status: "missing-expected" | "drift" | "missing-file" | "seal-mismatch"
      message: string
    }

/** Compare live specPath bytes to last expected digest (sealed workstreams). */
export function checkSpecDocDigest(
  repoRootInput: string,
  ws: Workstream,
): DocDigestCheck {
  if (!ws.seal) {
    return { ok: true, status: "no-spec-path" }
  }
  if (!ws.specPath) {
    return { ok: true, status: "no-spec-path" }
  }
  // The live pointer is mutable metadata. The snapshot owns the original
  // digest even when an amendment supplies the currently expected doc bytes.
  try {
    const repoRoot = findRepoRoot(repoRootInput)
    const snapshot = JSON.parse(
      readFileSync(join(ledgerRoot(repoRoot), ws.seal.snapshotPath), "utf8"),
    ) as { specDocDigest?: string }
    if (snapshot.specDocDigest !== ws.seal.specDocDigest) {
      return {
        ok: false,
        status: "seal-mismatch",
        expected: snapshot.specDocDigest,
        actual: ws.seal.specDocDigest,
        message: `document seal digest for ${ws.id} differs from its immutable snapshot`,
      }
    }
  } catch (err) {
    return {
      ok: false,
      status: "seal-mismatch",
      message: `cannot validate document seal snapshot for ${ws.id}: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  const expected = lastExpectedDocDigest(ws)
  if (!expected) {
    return {
      ok: false,
      status: "missing-expected",
      message: `sealed ${ws.id} has specPath but no expected doc digest — run: spec-ledger workstream backfill-doc-digest ${ws.id} --by <who>`,
    }
  }
  try {
    const live = readSpecDocDigest(repoRootInput, ws)
    if (!live) {
      return {
        ok: false,
        expected,
        status: "missing-file",
        message: `specPath missing: ${ws.specPath}`,
      }
    }
    if (live.digest !== expected) {
      return {
        ok: false,
        expected,
        actual: live.digest,
        status: "drift",
        message: `spec doc digest drift for ${ws.id}: expected ${expected.slice(0, 12)}… got ${live.digest.slice(0, 12)}… — record workstream amend after intentional edit`,
      }
    }
    return { ok: true, expected, actual: live.digest, status: "ok" }
  } catch (err) {
    return {
      ok: false,
      expected,
      status: "missing-file",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

export function appendPostSealAmend(
  ws: Workstream,
  amend: PostSealAmend,
): Workstream {
  return {
    ...ws,
    postSealAmends: [...(ws.postSealAmends ?? []), amend],
    updatedAt: amend.at,
  }
}
