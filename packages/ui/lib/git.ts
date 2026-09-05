import { spawnSync } from "node:child_process"
import { ledgerRootDir } from "@/lib/ledger"

export type CommitInfo = {
  sha: string
  short: string
  subject: string
  body: string
}

/** Read commit subject/body for display (presentation only). */
export function readCommit(sha: string | null | undefined): CommitInfo | null {
  if (!sha) return null
  const root = ledgerRootDir()
  const r = spawnSync(
    "git",
    ["log", "-1", "--format=%H%x1f%s%x1f%b", sha],
    { cwd: root, encoding: "utf8" },
  )
  if (r.status !== 0) return null
  const [full, subject, body] = (r.stdout ?? "").split("\x1f")
  if (!full || !subject) return null
  return {
    sha: full.trim(),
    short: full.trim().slice(0, 10),
    subject: subject.trim(),
    body: (body ?? "").trim(),
  }
}

/** A turn closes before its final commit; recorded HEAD is not shipment attribution. */
export function readTurnCommit(turnId: string): CommitInfo | null {
  if (!/^T-[0-9]+$/.test(turnId)) return null
  const r = spawnSync('git', ['log', '-1000', '--format=%H%x1f%(trailers:key=SL-Turn,valueonly)%x1e'], { cwd: ledgerRootDir(), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 })
  if (r.status !== 0) return null
  const match = r.stdout.split('\x1e').find(record => record.split('\x1f')[1]?.trim().split(/\r?\n/).includes(turnId))
  return match ? readCommit(match.split('\x1f')[0]!.trim()) : null
}
