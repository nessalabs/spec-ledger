#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { backlog, evaluateDeferrals, recordDeferredDecision, recordDeferralResolution } from "../deferrals/index.js"
import { permissionStatus, planRevision, type Authority } from "../permission/authority.js"
import { listLearnings, recordLearning, type Learning } from "../compass/learnings.js"
import { resolve } from "node:path"
import { initLedgerDetailed } from "./init.js"
import { loadLedger } from "../fs/load.js"
import { blastRadius, layerViolations } from "../graph/impact.js"
import { openTurn, checkTurn, listTurns } from "../turns/close.js"
import { sourceFingerprint, checkFingerprint } from "../evidence/fingerprint.js"
import type { EvidenceInput } from "../evidence/record.js"
import {
  checkSeal,
  listWorkstreams,
  loadWorkstream,
  sealWorkstream,
  backfillDocDigest,
  amendWorkstream,
} from "../workstream/load.js"
import { listReviewsForTurn } from "../reviews/load.js"
import { getRelatedPack } from "../related/pack.js"
import { listAutomationEvents } from "../automation/load.js"
import { auditLedger } from "../audit/audit.js"
import { listProposedClaims, listThemes } from "../proposed/load.js"
import {
  assertOpenTurn,
  writeAttachment,
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
import { alignPolicy } from "../align/approve.js"
import {
  listAlignWaivers,
  writeAlignWaiver,
} from "../align/waiver.js"
import { computeTreeDigest } from "../git/tree.js"
import type { EpisodeAttachment, Review, TurnIntent } from "../types.js"
import {
  OPERATION_NAMES,
  executeOperation,
  newRequestId,
  normalizeOperationError,
  planWork,
  getContext,
  observeSession,
  submitPermission,
  beginWork,
  submitProgress,
  submitDecision,
  submitEvidence,
  submitReview,
  approveAlignment,
  runChecks,
  finishTurn,
  completeWork,
  type OperationName,
} from "../application/index.js"

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
  spec-ledger plan --workstream W-…
  spec-ledger work --workstream W-… --slice SLC-… --goal "…"
  spec-ledger check | fingerprint | evidence record --file <json>
  spec-ledger permission status|approve|deny|delegate|revoke|record …
  spec-ledger learning list|record --file <json>
  spec-ledger review add|list …
  spec-ledger session | complete --workstream W-…
  spec-ledger progress --file <json>
  spec-ledger backlog [--workstream W-…] | obligations --workstream W-…
  spec-ledger defer | resolve-deferral --file <json>
  spec-ledger align check|approve|waiver …
  spec-ledger automation list [--root <dir>]
  spec-ledger themes list | proposed-claims list [--root <dir>]
  spec-ledger decision|source|attachment|probe|flow add|list --turn T-…
  spec-ledger operation <name> --file <json> [--root <dir>]

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

/** Spec Ledger UI headline — required on every review JSON (`schemas/review.json`). */
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
  if (argv[0] === "work") argv.splice(0,1,"turn","open")
  const cmd = argv[0]
  if (!cmd || cmd === "-h" || cmd === "--help") usage()

  const root = resolve(argValue(argv, "--root") ?? process.cwd())

  if (cmd === "operation") {
    const operation = argv[1] as OperationName | undefined
    const file = argValue(argv, "--file")
    if (!operation || !OPERATION_NAMES.includes(operation) || !file) {
      throw new Error("operation requires a known name and --file <json>")
    }
    const input = JSON.parse(readFileSync(resolve(file), "utf8"))
    try {
      console.log(JSON.stringify({ ok: true, operation, result: executeOperation(root, operation, input) }, null, 2))
      return
    } catch (error) {
      const normalized = normalizeOperationError(error)
      console.log(JSON.stringify({ ok: false, operation, error: normalized.toJSON() }, null, 2))
      process.exit(1)
    }
  }

  if (cmd === "init") {
    const name = argValue(argv, "--name") ?? "project"
    const { path, warnings } = initLedgerDetailed(root, name)
    for (const w of warnings) console.warn(`warning: ${w}`)
    console.log(`initialized ${path}`)
    return
  }

  if (cmd === "review" && argv[1] === "spec") {
    const file=argValue(argv,"--file")
    if (!file) throw new Error("review spec requires --file")
    const review = JSON.parse(readFileSync(resolve(file),"utf8")) as Review
    if (!review.workstreamId) throw new Error("spec review requires workstreamId")
    console.log(JSON.stringify(submitReview(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),target:"spec",workstreamId:review.workstreamId,
      expectedRevisionDigest:planRevision(root,loadWorkstream(root,review.workstreamId)),review}),null,2));return
  }
  if (cmd === "plan") {
    const id=argValue(argv,"--workstream")
    if (!id) throw new Error("plan requires --workstream")
    console.log(JSON.stringify(planWork(root,{workstreamId:id}),null,2))
    return
  }
  if (cmd === "session") {
    console.log(JSON.stringify(observeSession(root, {workstreamId:argValue(argv, "--workstream")}), null, 2)); return
  }
  if (cmd === "complete") {
    const id = argValue(argv, "--workstream")
    if (!id) throw new Error("complete requires --workstream")
    const session=observeSession(root,{workstreamId:id}).session!
    console.log(JSON.stringify(completeWork(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),workstreamId:id,
      expectedRevisionDigest:session.revisionDigest,expectedSourceDigest:session.sourceDigest}), null, 2)); return
  }
  if (cmd === "backlog") {
    const id = argValue(argv, "--workstream")
    console.log(JSON.stringify(id ? backlog(root, id) : backlog(root), null, 2)); return
  }
  if (cmd === "obligations") {
    const id = argValue(argv, "--workstream")
    if (!id) throw new Error("obligations requires --workstream")
    console.log(JSON.stringify(evaluateDeferrals(root, id), null, 2)); return
  }
  if (cmd === "defer" || cmd === "resolve-deferral") {
    const file = argValue(argv, "--file")
    if (!file) throw new Error(`${cmd} requires --file JSON decision`)
    const input = JSON.parse(readFileSync(resolve(file), "utf8"))
    console.log(JSON.stringify(cmd === "defer" ? recordDeferredDecision(root, input) : recordDeferralResolution(root, input), null, 2)); return
  }
  if (cmd === "progress") {
    const file = argValue(argv, "--file")
    if (!file) throw new Error("progress requires --file JSON with turnId, summary, criterionIds, implemented, and optional preview")
    const input=JSON.parse(readFileSync(resolve(file), "utf8"))
    const turn=loadLedger(root).turns.find(t=>t.id===input.turnId)
    if (!turn?.intent.workstreamId) throw new Error("progress requires a workstream turn")
    const session=observeSession(root,{workstreamId:turn.intent.workstreamId}).session!
    console.log(JSON.stringify(submitProgress(root,{...input,requestId:input.requestId ?? argValue(argv,"--request-id") ?? newRequestId(),
      expectedRevisionDigest:input.expectedRevisionDigest ?? session.revisionDigest,expectedSourceDigest:input.expectedSourceDigest ?? session.sourceDigest}), null, 2)); return
  }
  if (cmd === "permission") {
    const id=argValue(argv,"--workstream")
    if (argv[1] === "status") {
      if (!id) throw new Error("permission status requires --workstream")
      console.log(JSON.stringify(permissionStatus(root,id),null,2)); return
    }
    if (argv[1] === "record") {
      const file=argValue(argv,"--file")
      if (!file) throw new Error("permission record requires --file")
      console.log(JSON.stringify(submitPermission(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),authority:JSON.parse(readFileSync(resolve(file),"utf8")) as Authority}),null,2)); return
    }
    const reference=argValue(argv,"--source")
    if (!reference) throw new Error("permission action requires --source with the authorizing instruction")
    const source={kind:"agent-reported" as const,reference}
    const action=argv[1]
    if (action === "revoke") {
      console.log(JSON.stringify(submitPermission(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),authority:{action:"revoke",targetId:argValue(argv,"--id"),source}}),null,2)); return
    }
    const ws=id ? loadWorkstream(root,id) : undefined
    if (action === "approve" || action === "deny") {
      if (!ws || !id) throw new Error("approval/denial requires --workstream")
      const revisionDigest=argValue(argv,"--revision")
      if (revisionDigest !== planRevision(root,ws)) throw new Error("use the exact revision from permission status")
      const targetId=action === "deny" ? permissionStatus(root,id).authorityId : undefined
      console.log(JSON.stringify(submitPermission(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),authority:{action:action==="deny" ? "deny" : "grant",mode:action==="approve" ? "revision" : undefined,
        workstreamId:id,revisionDigest,featureIds:ws.featureIds,targetId,source,
        supersedes:argValue(argv,"--supersedes")?.split(",")}}),null,2)); return
    }
    if (action === "delegate") {
      const featureIds=argValue(argv,"--features")?.split(",") ?? ws?.featureIds
      console.log(JSON.stringify(submitPermission(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),authority:{action:"grant",mode:id ? "request" : "standing",workstreamId:id,featureIds,
        excludeFeatureIds:argValue(argv,"--exclude-features")?.split(","),source}}),null,2)); return
    }
    throw new Error("unknown permission action")
  }
  if (cmd === "learning") {
    if (argv[1] === "list") { console.log(JSON.stringify(listLearnings(root),null,2));return }
    const file=argValue(argv,"--file")
    if (argv[1] !== "record" || !file) throw new Error("learning record requires --file")
    console.log(JSON.stringify(recordLearning(root,JSON.parse(readFileSync(resolve(file),"utf8")) as Learning),null,2)); return
  }

  if (cmd === "fingerprint") {
    const ledger = loadLedger(root)
    console.log(JSON.stringify({sourceDigest:sourceFingerprint(ledger.repoRoot,ledger.config.generatedArtifactPaths),
      checks:ledger.bindings.map(binding=>({bindingId:binding.id,checkDigest:ledger.claims.find(c=>c.id===binding.claimId) ? checkFingerprint(ledger.claims.find(c=>c.id===binding.claimId)!,binding) : null}))},null,2))
    return
  }
  if (cmd === "evidence" && argv[1] === "record") {
    const file = argValue(argv,"--file")
    if (!file) throw new Error("usage: spec-ledger evidence record --file <runner-evidence.json>")
    const evidence=JSON.parse(readFileSync(resolve(file),"utf8")) as EvidenceInput
    console.log(JSON.stringify(submitEvidence(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),evidence}),null,2))
    return
  }

  if (cmd === "verify" || cmd === "check") {
    const report = runChecks(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),expectedSourceDigest:sourceFingerprint(loadLedger(root).repoRoot,loadLedger(root).config.generatedArtifactPaths)})
    const pass = report.claims.filter((c) => c.outcome === "pass").length
    const fail = report.claims.filter((c) => c.outcome === "fail").length
    const missing = report.claims.filter(
      (c) => c.outcome === "missing" || c.outcome === "unbound",
    ).length
    const attested = report.claims.filter((c) => c.outcome === "attested").length

    console.log(`spec-ledger verify ${report.ok ? "OK" : "FAIL"}`)
    if (report.claims.length === 0) console.log("  No requirements checked")
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
    const ctx = getContext(root, {workstreamId:ws,sliceId:slice})
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
      const turn = workstreamId
        ? beginWork(root, {
            requestId: argValue(argv,"--request-id") ?? newRequestId(),
            workstreamId,
            sliceId,
            goal,
            prompt,
            turnId:id,
            featureIds,
            changeType:intent.changeType,
            riskLevel:intent.riskLevel,
            noContext:hasFlag(argv,"--no-context"),
            noContextReason:argValue(argv,"--no-context-reason"),
            allowDirty:hasFlag(argv,"--allow-dirty"),
            expectedRevisionDigest:planRevision(root,loadWorkstream(root,workstreamId)),
          })
        : openTurn(root, intent, {
            idHint: id,
            featureIds,
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
      const target=id ?? loadLedger(root).turns.find(t=>t.status==="open")?.id
      if (!target) throw new Error("no open turn to abandon")
      const turn = finishTurn(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),turnId:target,action:"abandon",
        expectedSourceDigest:sourceFingerprint(loadLedger(root).repoRoot,loadLedger(root).config.generatedArtifactPaths)})
      console.log(`abandoned ${turn.id}`)
      console.log(`  files: ${turn.facts?.files.length ?? 0}`)
      return
    }

    if (sub === "close") {
      const id = argValue(argv, "--id")
      const target=id ?? loadLedger(root).turns.find(t=>t.status==="open")?.id ?? loadLedger(root).turns.at(-1)?.id
      if (!target) throw new Error("no turn to close")
      const turn = finishTurn(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),turnId:target,action:"close",
        expectedSourceDigest:sourceFingerprint(loadLedger(root).repoRoot,loadLedger(root).config.generatedArtifactPaths)})
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
      const review: Omit<Review,"id"> & {id?:string} = {
        schemaVersion: 1,
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
      const written=submitReview(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),target:"code",turnId,
        expectedSourceDigest:sourceFingerprint(loadLedger(root).repoRoot,loadLedger(root).config.generatedArtifactPaths),review})
      console.log(`wrote ${written.id}`)
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
      const waiverIdsRaw = argValue(argv, "--waiver-ids")
      const waiverIds = waiverIdsRaw
        ? waiverIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined
      const review=approveAlignment(root,{requestId:argValue(argv,"--request-id") ?? newRequestId(),turnId,reviewer,summary,plainSummary,waiverIds,
        expectedSourceDigest:sourceFingerprint(loadLedger(root).repoRoot,loadLedger(root).config.generatedArtifactPaths)})
      console.log(`wrote align approve ${review.id}`)
      console.log(`  treeDigest: ${review.treeDigest?.slice(0, 12)}…`)
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
      const workstreamId=loadLedger(root).turns.find(t=>t.id===turnId)?.intent.workstreamId
      if (!workstreamId) throw new Error("decision requires a workstream turn")
      const d = submitDecision(root, {requestId:argValue(argv,"--request-id") ?? newRequestId(),turnId,decision,rationale,
        expectedRevisionDigest:planRevision(root,loadWorkstream(root,workstreamId)),
        expectedSourceDigest:sourceFingerprint(loadLedger(root).repoRoot,loadLedger(root).config.generatedArtifactPaths)})
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
