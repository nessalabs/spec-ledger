#!/usr/bin/env node
import { resolve } from "node:path"
import { initLedgerDetailed } from "./init.js"
import { getVerticalContext } from "../context/vertical.js"
import { loadLedger } from "../fs/load.js"
import { blastRadius, layerViolations } from "../graph/impact.js"
import { openTurn, closeTurn, checkTurn, abandonTurn, listTurns } from "../turns/close.js"
import { verifyLedger } from "../verify/verify.js"
import {
  checkSeal,
  listWorkstreams,
  loadWorkstream,
  sealWorkstream,
  backfillDocDigest,
  amendWorkstream,
} from "../workstream/load.js"
import {
  listReviewsForTurn,
  nextReviewId,
  writeReview,
} from "../reviews/load.js"
import { getRelatedPack } from "../related/pack.js"
import { listAutomationEvents } from "../automation/load.js"
import { auditLedger } from "../audit/audit.js"
import { listProposedClaims, listThemes } from "../proposed/load.js"
import {
  assertOpenTurn,
  writeAttachment,
  writeDecision,
  writeFlow,
  writeProbe,
  writeSource,
} from "../episodes/write.js"
import {
  listAttachmentsForTurn,
  listDecisionsForTurn,
  listFlowsForTurn,
  listProbesForTurn,
  listSourcesForTurn,
} from "../episodes/load.js"
import { alignCheck } from "../align/check.js"
import {
  assertAlignApproveValid,
  alignPolicy,
} from "../align/approve.js"
import {
  listAlignWaivers,
  listAlignWaiversForTurn,
  writeAlignWaiver,
} from "../align/waiver.js"
import { computeTreeDigest } from "../git/tree.js"
import type { EpisodeAttachment, Review, TurnIntent } from "../types.js"

function usage(): never {
  console.log(`spec-ledger — claim adherence ledger

Usage:
  spec-ledger init [--name <name>] [--root <dir>]
  spec-ledger verify [--root <dir>]
  spec-ledger audit [--root <dir>]
  spec-ledger impact <nodeId> [--root <dir>]
  spec-ledger layers [--root <dir>]
  spec-ledger context --workstream W-001 --slice SLC-01 [--json] [--root <dir>]
  spec-ledger related --workstream W-001 [--worktrees] [--json] [--root <dir>]
  spec-ledger workstream list|show|seal|check-seal|amend|backfill-doc-digest …
  spec-ledger turn open|close|check|abandon|list …
  spec-ledger review add|list …
  spec-ledger align check|approve|waiver …
  spec-ledger automation list [--root <dir>]
  spec-ledger themes list | proposed-claims list [--root <dir>]
  spec-ledger decision|source|attachment|probe|flow add|list --turn T-…

Truth lives in .spec-ledger/ + source tree + ingested results.
Turn facts are written only by \`turn close\` / \`turn abandon\` (git + verify).
Workstreams/vision never enter verify digests. Seal digests use RFC 8785 JCS.
Align is separate from verify — \`align check\` / \`pnpm ledger:align\` do not affect verify.ok.
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

/** Lattice headline — required on every review JSON (`schemas/review.json`). */
function requirePlainSummary(argv: string[]): string {
  const plainSummary = argValue(argv, "--plain-summary")
  if (!plainSummary?.trim()) {
    console.error(
      "required: --plain-summary <one sentence of end behavior, <=280 chars>",
    )
    process.exit(2)
  }
  if (plainSummary.length > 280) {
    console.error("plain-summary must be <= 280 characters")
    process.exit(2)
  }
  return plainSummary
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  if (!cmd || cmd === "-h" || cmd === "--help") usage()

  const root = resolve(argValue(argv, "--root") ?? process.cwd())

  if (cmd === "init") {
    const name = argValue(argv, "--name") ?? "project"
    const { path, warnings } = initLedgerDetailed(root, name)
    for (const w of warnings) console.warn(`warning: ${w}`)
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

  if (cmd === "audit") {
    const report = auditLedger(root)
    console.log(`spec-ledger audit ${report.ok ? "OK" : "FAIL"}`)
    console.log(`  findings: ${report.findings.length}`)
    for (const f of report.findings) {
      console.log(`  - [${f.severity}] ${f.rule}: ${f.message}`)
    }
    process.exit(report.ok ? 0 : 1)
  }

  if (cmd === "related") {
    const ws = argValue(argv, "--workstream")
    if (!ws) {
      console.error("usage: spec-ledger related --workstream W-001 [--worktrees] [--json]")
      process.exit(2)
    }
    const pack = getRelatedPack(root, ws, { worktrees: hasFlag(argv, "--worktrees") })
    if (hasFlag(argv, "--json")) {
      console.log(JSON.stringify(pack, null, 2))
      return
    }
    console.log(`related ${ws}`)
    console.log(`  features: ${pack.features.length}`)
    console.log(`  claims: ${pack.claims.map((c) => c.id).join(", ") || "(none)"}`)
    console.log(`  proposed: ${pack.proposedClaims.map((c) => c.id).join(", ") || "(none)"}`)
    console.log(`  turns: ${pack.turns.map((t) => t.id).join(", ") || "(none)"}`)
    console.log(`  docs: ${pack.docs.length}`)
    if (pack.worktreeCautions?.length) {
      for (const c of pack.worktreeCautions) console.log(`  caution: ${c}`)
    }
    return
  }

  if (cmd === "automation") {
    if (argv[1] !== "list") usage()
    console.log(JSON.stringify(listAutomationEvents(root), null, 2))
    return
  }

  if (cmd === "themes") {
    if (argv[1] !== "list") usage()
    console.log(JSON.stringify(listThemes(root), null, 2))
    return
  }

  if (cmd === "proposed-claims") {
    if (argv[1] !== "list") usage()
    console.log(JSON.stringify(listProposedClaims(root), null, 2))
    return
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
    if (sub === "backfill-doc-digest") {
      const id = argv[2]
      const by = argValue(argv, "--by")
      if (!id || !by) {
        console.error(
          "usage: spec-ledger workstream backfill-doc-digest <W-id> --by <who>",
        )
        process.exit(2)
      }
      const ws = backfillDocDigest(root, id, by)
      console.log(
        `backfilled ${ws.id} rev ${ws.seal?.revision} specDocDigest ${ws.seal?.specDocDigest?.slice(0, 12)}…`,
      )
      return
    }
    if (sub === "amend") {
      const id = argv[2]
      const by = argValue(argv, "--by")
      const summary = argValue(argv, "--summary")
      if (!id || !by || !summary) {
        console.error(
          "usage: spec-ledger workstream amend <W-id> --by <who> --summary <text> [--turn T] [--decision D] [--commit sha]",
        )
        process.exit(2)
      }
      const { amend } = amendWorkstream(root, id, {
        by,
        summary,
        turnId: argValue(argv, "--turn"),
        decisionId: argValue(argv, "--decision"),
        commit: argValue(argv, "--commit"),
      })
      console.log(
        `amended ${id} ${amend.beforeDocDigest.slice(0, 12)}… → ${amend.afterDocDigest.slice(0, 12)}…`,
      )
      return
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
        allowDirty: hasFlag(argv, "--allow-dirty"),
      })
      console.log(`opened ${turn.id}`)
      if (turn.opened?.contextDigest) {
        console.log(`  contextDigest: ${turn.opened.contextDigest.slice(0, 12)}…`)
      }
      if (turn.opened?.treeDigest) {
        console.log(`  treeDigest: ${turn.opened.treeDigest.slice(0, 12)}…`)
      }
      return
    }

    if (sub === "check") {
      const id = argValue(argv, "--id")
      const { turn, facts, treeDigestDrift } = checkTurn(root, id)
      console.log(`check ${turn.id} (${turn.status})`)
      console.log(`  files: ${facts.files.length}`)
      console.log(`  verify: ${facts.verify.ok ? "OK" : "FAIL"}`)
      console.log(`  treeDigestDrift: ${treeDigestDrift}`)
      console.log(`  ledgerDigest: ${facts.verify.ledgerDigest.slice(0, 12)}…`)
      return
    }

    if (sub === "abandon") {
      const id = argValue(argv, "--id")
      const turn = abandonTurn(root, id)
      console.log(`abandoned ${turn.id}`)
      console.log(`  files: ${turn.facts?.files.length ?? 0}`)
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
          "usage: spec-ledger review add --turn T --verdict approve|request-changes|comment --reviewer <who> --summary <text> --plain-summary <one sentence> [--killers a,b] [--blocking]",
        )
        process.exit(2)
      }
      const plainSummary = requirePlainSummary(argv)
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
        plainSummary,
        ...(killersCited ? { killersCited } : {}),
        ...(hasFlag(argv, "--blocking") ? { blocking: true } : {}),
      }
      writeReview(root, review)
      console.log(`wrote ${id}`)
      return
    }
    usage()
  }

  if (cmd === "align") {
    const sub = argv[1]
    if (sub === "check") {
      const report = alignCheck(root, {
        turnId: argValue(argv, "--turn"),
        workstreamId: argValue(argv, "--workstream"),
      })
      if (hasFlag(argv, "--json")) {
        console.log(JSON.stringify(report, null, 2))
      } else {
        console.log(`spec-ledger align check ${report.ok ? "OK" : "FAIL"}`)
        console.log(`  ${report.message}`)
        console.log(`  treeDigest: ${report.treeDigest.slice(0, 12)}…`)
        if (report.turnId) console.log(`  turn: ${report.turnId}`)
        if (report.workstreamId) console.log(`  workstream: ${report.workstreamId}`)
        console.log(`  covered: ${report.coverage.coveredPaths.length}`)
        console.log(`  uncovered: ${report.coverage.uncoveredPaths.length}`)
        for (const p of report.coverage.uncoveredPaths) {
          console.log(`    - ${p}`)
        }
      }
      process.exit(report.ok ? 0 : 1)
    }

    if (sub === "waiver") {
      if (argv[2] === "list") {
        console.log(JSON.stringify(listAlignWaivers(root), null, 2))
        return
      }
      const reason = argValue(argv, "--reason")
      const actor = argValue(argv, "--actor")
      const turnId = argValue(argv, "--turn")
      if (!reason || !actor) {
        console.error(
          "usage: spec-ledger align waiver --reason <text>=40chars --actor <who> --turn T [--workstream W]",
        )
        process.exit(2)
      }
      const ledger = loadLedger(root)
      const turn = turnId
        ? ledger.turns.find((t) => t.id === turnId)
        : ledger.turns.find((t) => t.status === "open")
      if (!turn) {
        console.error("align waiver refused: turn not found (open turn required)")
        process.exit(1)
      }
      if (turn.status !== "open") {
        console.error(
          `align waiver refused: turn ${turn.id} is ${turn.status} — open turn required`,
        )
        process.exit(1)
      }
      const workstreamId =
        argValue(argv, "--workstream") ?? turn.intent.workstreamId
      let minReason = 40
      let maxPerTurn = 1
      if (workstreamId) {
        const ws = loadWorkstream(root, workstreamId)
        const p = alignPolicy(ws)
        minReason = p.alignWaiverMinReasonChars ?? 40
        maxPerTurn = p.alignSkipMaxPerTurn ?? 1
      }
      const currentDigest = computeTreeDigest(root)
      const requested = argValue(argv, "--tree-digest")
      if (requested && requested !== currentDigest) {
        console.error(
          "align waiver refused: --tree-digest must match current treeDigest (arbitrary digests are not skip)",
        )
        process.exit(1)
      }
      const w = writeAlignWaiver(
        root,
        {
          reason,
          actor,
          treeDigest: currentDigest,
          turnId: turn.id,
          workstreamId,
        },
        { minReasonChars: minReason, maxPerTurn },
      )
      console.log(`wrote waiver ${w.id}`)
      return
    }

    if (sub === "approve") {
      const turnId = argValue(argv, "--turn")
      const reviewer = argValue(argv, "--reviewer") ?? "agent:align"
      const summary = argValue(argv, "--summary") ?? "align: path coverage OK"
      const plainSummary = requirePlainSummary(argv)
      if (!turnId) {
        console.error(
          "usage: spec-ledger align approve --turn T --plain-summary <one sentence> [--reviewer agent:align] [--summary text]",
        )
        process.exit(2)
      }
      const ledger = loadLedger(root)
      const turn = ledger.turns.find((t) => t.id === turnId)
      if (!turn) {
        console.error(`turn not found: ${turnId}`)
        process.exit(1)
      }
      const report = alignCheck(root, { turnId })
      const workstreamId = turn.intent.workstreamId
      const policy = workstreamId
        ? alignPolicy(loadWorkstream(root, workstreamId))
        : { alignReviewerPrefix: "agent:align" }
      const waiverIdsRaw = argValue(argv, "--waiver-ids")
      const waiverIds = waiverIdsRaw
        ? waiverIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined
      const id = nextReviewId(root, turnId)
      const review: Review = {
        schemaVersion: 1,
        id,
        turnId,
        ...(workstreamId ? { workstreamId } : {}),
        kind: "human",
        target: "code",
        reviewer,
        verdict: "approve",
        summary,
        plainSummary,
        treeDigest: report.treeDigest,
        uncoveredPaths: report.coverage.uncoveredPaths,
        coverageSource: report.coverage.coverageSource,
        ...(waiverIds?.length ? { waiverIds } : {}),
      }
      assertAlignApproveValid({
        review,
        turn,
        policy,
        waivers: listAlignWaiversForTurn(root, turnId),
      })
      writeReview(root, review)
      console.log(`wrote align approve ${id}`)
      console.log(`  treeDigest: ${report.treeDigest.slice(0, 12)}…`)
      console.log(`  coverageSource: ${review.coverageSource}`)
      console.log(`  uncovered: ${review.uncoveredPaths?.length ?? 0}`)
      return
    }

    usage()
  }

  if (cmd === "decision" || cmd === "source" || cmd === "attachment" || cmd === "probe" || cmd === "flow") {
    const sub = argv[1]
    const turnId = argValue(argv, "--turn")
    if (!turnId) {
      console.error(`usage: spec-ledger ${cmd} add|list --turn T-001 …`)
      process.exit(2)
    }
    if (sub === "list") {
      const list =
        cmd === "decision"
          ? listDecisionsForTurn(root, turnId)
          : cmd === "source"
            ? listSourcesForTurn(root, turnId)
            : cmd === "attachment"
              ? listAttachmentsForTurn(root, turnId)
              : cmd === "probe"
                ? listProbesForTurn(root, turnId)
                : listFlowsForTurn(root, turnId)
      console.log(JSON.stringify(list, null, 2))
      return
    }
    if (sub !== "add") usage()
    assertOpenTurn(root, turnId)
    if (cmd === "decision") {
      const decision = argValue(argv, "--decision")
      const rationale = argValue(argv, "--rationale")
      if (!decision || !rationale) {
        console.error(
          "usage: spec-ledger decision add --turn T --decision <text> --rationale <text>",
        )
        process.exit(2)
      }
      const d = writeDecision(root, {
        turnId,
        decision,
        rationale,
        basis: {
          at: new Date().toISOString(),
          contextDigest: undefined,
          sealRevision: undefined,
        },
      })
      console.log(`wrote ${d.id}`)
      return
    }
    if (cmd === "source") {
      const kind = argValue(argv, "--kind")
      const ref = argValue(argv, "--ref")
      if (!kind || !ref) {
        console.error("usage: spec-ledger source add --turn T --kind <k> --ref <ref>")
        process.exit(2)
      }
      const s = writeSource(root, { turnId, kind, ref, note: argValue(argv, "--note") })
      console.log(`wrote ${s.id}`)
      return
    }
    if (cmd === "attachment") {
      const path = argValue(argv, "--path")
      if (!path) {
        console.error(
          "usage: spec-ledger attachment add --turn T --path <path|url> [--kind image|video|…] [--title t] [--media-type mt] [--review R-id]",
        )
        process.exit(2)
      }
      const kind = argValue(argv, "--kind") as
        | EpisodeAttachment["kind"]
        | undefined
      const a = writeAttachment(root, {
        turnId,
        path,
        kind,
        title: argValue(argv, "--title"),
        mediaType: argValue(argv, "--media-type"),
        reviewId: argValue(argv, "--review"),
        note: argValue(argv, "--note"),
      })
      console.log(`wrote ${a.id}`)
      return
    }
    if (cmd === "probe") {
      const question = argValue(argv, "--question")
      if (!question) {
        console.error(
          "usage: spec-ledger probe add --turn T --question <q> [--outcome <o>]",
        )
        process.exit(2)
      }
      const p = writeProbe(root, {
        turnId,
        question,
        outcome: argValue(argv, "--outcome"),
        evidence: argValue(argv, "--evidence"),
      })
      console.log(`wrote ${p.id}`)
      return
    }
    const title = argValue(argv, "--title")
    const after = argValue(argv, "--after")
    if (!title || !after) {
      console.error(
        "usage: spec-ledger flow add --turn T --title <t> --after <mermaid> [--before <m>]",
      )
      process.exit(2)
    }
    const f = writeFlow(root, {
      turnId,
      title,
      after,
      before: argValue(argv, "--before"),
      narrative: argValue(argv, "--narrative"),
    })
    console.log(`wrote ${f.id}`)
    return
  }

  usage()
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
