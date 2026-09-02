#!/usr/bin/env node
import { resolve } from "node:path"
import { initLedger } from "./init.js"
import { loadLedger } from "../fs/load.js"
import { verifyLedger } from "../verify/verify.js"
import { blastRadius, layerViolations } from "../graph/impact.js"
import { openTurn, closeTurn, listTurns } from "../turns/close.js"
import type { TurnIntent } from "../types.js"

function usage(): never {
  console.log(`spec-ledger — claim adherence ledger

Usage:
  spec-ledger init [--name <name>] [--root <dir>]
  spec-ledger verify [--root <dir>]
  spec-ledger impact <nodeId> [--root <dir>]
  spec-ledger layers [--root <dir>]
  spec-ledger turn open --goal <text> [--prompt <text>] [--id T-001] [--root <dir>]
  spec-ledger turn close [--id T-001] [--root <dir>]
  spec-ledger turn list [--root <dir>]

Truth lives in .spec-ledger/ + source tree + ingested results.
Turn facts are written only by \`turn close\` (git + verify digests).
The CLI never invents pass. See DESIGN.md.
`)
  process.exit(2)
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  if (i === -1) return undefined
  return args[i + 1]
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  if (!cmd || cmd === "-h" || cmd === "--help") usage()

  const root = resolve(argValue(argv, "--root") ?? process.cwd())

  if (cmd === "init") {
    const name = argValue(argv, "--name") ?? "project"
    const path = initLedger(root, name)
    console.log(`initialized ${path}`)
    return
  }

  if (cmd === "verify") {
    const ledger = loadLedger(root)
    const report = verifyLedger(ledger)
    const pass = report.claims.filter((c) => c.outcome === "pass").length
    const fail = report.claims.filter((c) => c.outcome === "fail").length
    const missing = report.claims.filter(
      (c) => c.outcome === "missing" || c.outcome === "unbound",
    ).length
    const attested = report.claims.filter((c) => c.outcome === "attested").length

    console.log(`spec-ledger verify ${report.ok ? "OK" : "FAIL"}`)
    console.log(`  claims: ${pass} pass, ${fail} fail, ${missing} missing/unbound, ${attested} attested`)
    console.log(`  ledgerDigest:  ${report.provenance.ledgerDigest.slice(0, 12)}…`)
    console.log(`  resultsDigest: ${report.provenance.resultsDigest.slice(0, 12)}…`)
    console.log(`  commit: ${report.provenance.commit ?? "(none)"}`)
    if (report.problems.length) {
      console.log("problems:")
      for (const p of report.problems) console.log(`  - ${p}`)
    }
    process.exit(report.ok ? 0 : 1)
  }

  if (cmd === "impact") {
    const nodeId = argv[1]
    if (!nodeId || nodeId.startsWith("-")) {
      console.error("usage: spec-ledger impact <nodeId>")
      process.exit(2)
    }
    const ledger = loadLedger(root)
    if (!ledger.graph) {
      console.error("no graph loaded")
      process.exit(1)
    }
    const r = blastRadius(ledger.graph, nodeId)
    console.log(JSON.stringify({ nodeId, ...r }, null, 2))
    return
  }

  if (cmd === "layers") {
    const ledger = loadLedger(root)
    if (!ledger.graph || !ledger.policy) {
      console.error("graph and policy required")
      process.exit(1)
    }
    const v = layerViolations(ledger.graph, ledger.policy.allow)
    console.log(JSON.stringify(v, null, 2))
    process.exit(v.length ? 1 : 0)
  }

  if (cmd === "turn") {
    const sub = argv[1]
    if (sub === "list") {
      const turns = listTurns(loadLedger(root))
      console.log(
        JSON.stringify(
          turns.map((t) => ({
            id: t.id,
            status: t.status,
            goal: t.intent.restatedGoal,
            verifyOk: t.facts?.verify.ok ?? null,
            files: t.facts?.files.length ?? 0,
          })),
          null,
          2,
        ),
      )
      return
    }

    if (sub === "open") {
      const goal = argValue(argv, "--goal")
      if (!goal) {
        console.error("usage: spec-ledger turn open --goal <text> [--prompt <text>] [--id T-001]")
        process.exit(2)
      }
      const prompt = argValue(argv, "--prompt") ?? goal
      const id = argValue(argv, "--id")
      const intent: TurnIntent = {
        userPrompt: prompt,
        restatedGoal: goal,
        changeType: "feature",
        riskLevel: "moderate",
      }
      const turn = openTurn(root, intent, id)
      console.log(`opened ${turn.id}`)
      return
    }

    if (sub === "close") {
      const id = argValue(argv, "--id")
      const turn = closeTurn(root, id)
      console.log(`closed ${turn.id}`)
      console.log(`  files: ${turn.facts?.files.length ?? 0}`)
      console.log(`  verify: ${turn.facts?.verify.ok ? "OK" : "FAIL"}`)
      console.log(`  ledgerDigest: ${turn.facts?.verify.ledgerDigest.slice(0, 12)}…`)
      console.log(`  commit: ${turn.facts?.commit ?? "(none)"}`)
      process.exit(turn.facts?.verify.ok ? 0 : 1)
    }

    usage()
  }

  usage()
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
