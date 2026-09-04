import { cache } from "react"
import { resolve } from "node:path"
import { createSpecLedgerClient } from "@nessalabs/spec-ledger-client"

/** Monorepo root (nessa-spec-test). Override with SPEC_LEDGER_ROOT. */
export function ledgerRootDir(): string {
  return process.env.SPEC_LEDGER_ROOT ?? resolve(process.cwd(), "../..")
}

/** One in-process client per RSC request. */
export const serverClient = cache(() =>
  createSpecLedgerClient({ kind: "inProcess", rootDir: ledgerRootDir() }),
)

/** Deduplicate verify within a single render (pages often need it + turns). */
export const liveReport = cache(async () => serverClient().verify())

export const ledgerSnapshot = cache(async () => serverClient().getSnapshot())
