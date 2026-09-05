#!/usr/bin/env node
import { resolve } from "node:path"
import { serveStdio } from "@modelcontextprotocol/server/stdio"
import { findRepoRoot, loadLedger } from "@nessalabs/spec-ledger"
import { createSpecLedgerMcpServer } from "./index.js"

function configuredRoot(args: string[]): string {
  const allowed = new Set(["--root"])
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!allowed.has(arg)) throw new Error(`unknown argument: ${arg}`)
    if (arg === "--root") {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) throw new Error("--root requires a checkout path")
      index += 1
    }
  }
  const at = args.indexOf("--root")
  return findRepoRoot(resolve(at === -1 ? process.cwd() : args[at + 1]))
}

try {
  const root = configuredRoot(process.argv.slice(2))
  loadLedger(root)
  serveStdio(() => createSpecLedgerMcpServer(root), {
    onerror: (error) => console.error(error.message),
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

