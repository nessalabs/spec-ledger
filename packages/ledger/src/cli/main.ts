#!/usr/bin/env node
import { resolve } from "node:path"
import { initLedger } from "./init.js"
import { getVerticalContext } from "../context/vertical.js"
import { loadLedger } from "../fs/load.js"
import { blastRadius, layerViolations } from "../graph/impact.js"
import { openTurn, closeTurn, listTurns } from "../turns/close.js"
import { verifyLedger } from "../verify/verify.js"
import {
  checkSeal,
  listWorkstreams,
  loadWorkstream,
  sealWorkstream,
} from "../workstream/load.js"
import {
  listReviewsForTurn,
  nextReviewId,
  writeReview,
} from "../reviews/load.js"
import type { Review, TurnIntent } from "../types.js"

function usage(): never {
  console.log(`spec-ledger — claim adherence ledger

Usage:
  spec-ledger init [--name <name>] [--root <dir>]
  spec-ledger verify [--root <dir>]
  spec-ledger impact <nodeId> [--root <dir>]
  spec-ledger layers [--root <dir>]
  spec-ledger context --workstream W-001 --slice SLC-01 [--json] [--root <dir>]
  spec-ledger workstream list [--root <dir>]
  spec-ledger workstream show <W-id> [--root <dir>]
  spec-ledger workstream seal <W-id> --by <human> [--root <dir>]
  spec-ledger workstream check-seal <W-id> [--root <dir>]
  spec-ledger turn open --goal <text> [--prompt <text>] [--id T-001]
      [--workstream W-001 --slice SLC-01 --feature <id>]
      [--no-context --no-context-reason <text>] [--root <dir>]
  spec-ledger turn close [--id T-001] [--root <dir>]
  spec-ledger turn list [--root <dir>]
  spec-ledger review add --turn T-001 --verdict approve|request-changes|comment
      --reviewer <who> --summary <text> [--killers id1,id2] [--blocking] [--root <dir>]
  spec-ledger review list --turn T-001 [--root <dir>]

Truth lives in .spec-ledger/ + source tree + ingested results.
Turn facts are written only by \`turn close\` (git + verify digests).
Workstreams/vision never enter verify digests. See DESIGN.md.
`)
  process.exit(2)
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  if (i === -1) return undefined
  return args[i + 1]
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag)
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
    console.log(
      `  claims: ${pass} pass, ${fail} fail, ${missing} missing/unbound, ${attested} attested`,
    )
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
    console.log(JSON.stringify(blastRadius(ledger.graph, nodeId), null, 2))
    return
  }

  if (cmd === "layers") {
    const ledger = loadLedger(root)
    if (!ledger.graph || !ledger.policy) {
      console.error("graph or policy missing")
      process.exit(1)
    }
    console.log(
      JSON.stringify(layerViolations(ledger.graph, ledger.policy.allow), null, 2),
    )
    return
  }

  if (cmd === "context") {
    const ws = argValue(argv, "--workstream")
    const slice = argValue(argv, "--slice")
    if (!ws || !slice) {
      console.error("usage: spec-ledger context --workstream W-001 --slice SLC-01 [--json]")
      process.exit(2)
    }
    const ctx = getVerticalContext(root, ws, slice)
    if (hasFlag(argv, "--json")) {
      console.log(JSON.stringify(ctx, null, 2))
    } else {
      console.log(`context ${ws}/${slice}`)
      console.log(`  contextDigest: ${ctx.contextDigest}`)
      console.log(`  seal: rev ${ctx.seal.revision} ${ctx.seal.specDigest.slice(0, 12)}…`)
      console.log(`  claims: ${ctx.claims.live.map((c) => c.id).join(", ") || "(none)"}`)
      console.log(
        `  blast: ${ctx.graph.predictedBlastRadius.direct.length} direct / ${ctx.graph.predictedBlastRadius.transitive.length} transitive`,
      )
    }
    return
  }

  if (cmd === "workstream") {
    const sub = argv[1]
    if (sub === "list") {
      console.log(
        JSON.stringify(
          listWorkstreams(root).map((w) => ({
            id: w.id,
            status: w.status,
            title: w.title,
            featureIds: w.featureIds,
            sealed: Boolean(w.seal),
          })),
          null,
          2,
        ),
      )
      return
    }
    if (sub === "show") {
      const id = argv[2]
      if (!id) {
        console.error("usage: spec-ledger workstream show <W-id>")
        process.exit(2)
      }
      console.log(JSON.stringify(loadWorkstream(root, id), null, 2))
      return
    }
    if (sub === "seal") {
      const id = argv[2]
      const by = argValue(argv, "--by")
      if (!id || !by) {
        console.error("usage: spec-ledger workstream seal <W-id> --by <human>")
        process.exit(2)
      }
      const ws = sealWorkstream(root, id, by)
      console.log(`sealed ${ws.id} rev ${ws.seal?.revision} digest ${ws.seal?.specDigest.slice(0, 12)}…`)
      return
    }
    if (sub === "check-seal") {
      const id = argv[2]
      if (!id) {
        console.error("usage: spec-ledger workstream check-seal <W-id>")
        process.exit(2)
      }
      const r = checkSeal(root, id)
      console.log(JSON.stringify(r, null, 2))
      process.exit(r.ok ? 0 : 1)
    }
    usage()
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
            workstreamId: t.intent.workstreamId ?? null,
            contextDigest: t.opened?.contextDigest?.slice(0, 12) ?? null,
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
        console.error(
          "usage: spec-ledger turn open --goal <text> [--workstream W --slice SLC --feature id]",
        )
        process.exit(2)
      }
      const prompt = argValue(argv, "--prompt") ?? goal
      const id = argValue(argv, "--id")
      const workstreamId = argValue(argv, "--workstream")
      const sliceId = argValue(argv, "--slice")
      const feature = argValue(argv, "--feature")
      const featureIds = feature ? feature.split(",").map((s) => s.trim()) : undefined
      const intent: TurnIntent = {
        userPrompt: prompt,
        restatedGoal: goal,
        changeType: "feature",
        riskLevel: "moderate",
        workstreamId,
        sliceId,
        featureIds,
      }
      const turn = openTurn(root, intent, {
        idHint: id,
        workstreamId,
        sliceId,
        featureIds,
        noContext: hasFlag(argv, "--no-context"),
        noContextReason: argValue(argv, "--no-context-reason"),
      })
      console.log(`opened ${turn.id}`)
      if (turn.opened?.contextDigest) {
        console.log(`  contextDigest: ${turn.opened.contextDigest.slice(0, 12)}…`)
      }
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

  if (cmd === "review") {
    const sub = argv[1]
    if (sub === "list") {
      const turnId = argValue(argv, "--turn")
      if (!turnId) {
        console.error("usage: spec-ledger review list --turn T-001")
        process.exit(2)
      }
      console.log(JSON.stringify(listReviewsForTurn(root, turnId), null, 2))
      return
    }
    if (sub === "add") {
      const turnId = argValue(argv, "--turn")
      const verdict = argValue(argv, "--verdict") as Review["verdict"] | undefined
      const reviewer = argValue(argv, "--reviewer")
      const summary = argValue(argv, "--summary")
      if (!turnId || !verdict || !reviewer || !summary) {
        console.error(
          "usage: spec-ledger review add --turn T --verdict approve|request-changes|comment --reviewer <who> --summary <text> [--killers a,b] [--blocking]",
        )
        process.exit(2)
      }
      if (!["approve", "request-changes", "comment"].includes(verdict)) {
        console.error("verdict must be approve|request-changes|comment")
        process.exit(2)
      }
      const killersRaw = argValue(argv, "--killers")
      const killersCited = killersRaw
        ? killersRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined
      if (verdict === "approve" && (!killersCited || !killersCited.length)) {
        console.error("approve requires --killers <id1,id2>")
        process.exit(2)
      }
      const id = nextReviewId(root, turnId)
      const review: Review = {
        schemaVersion: 1,
        id,
        turnId,
        kind: "adversarial",
        target: "code",
        reviewer,
        verdict,
        summary,
        ...(killersCited ? { killersCited } : {}),
        ...(hasFlag(argv, "--blocking") ? { blocking: true } : {}),
      }
      writeReview(root, review)
      console.log(`wrote ${id}`)
      return
    }
    usage()
  }

  usage()
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
