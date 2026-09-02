import { resolve } from "node:path"
import { createSpecLedgerClient } from "@nessa/spec-ledger-client"

/** Monorepo root (nessa-spec-test). Override with SPEC_LEDGER_ROOT. */
export function ledgerRootDir(): string {
  return process.env.SPEC_LEDGER_ROOT ?? resolve(process.cwd(), "../..")
}

export function serverClient() {
  return createSpecLedgerClient({ kind: "inProcess", rootDir: ledgerRootDir() })
}
