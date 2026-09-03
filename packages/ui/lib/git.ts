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
