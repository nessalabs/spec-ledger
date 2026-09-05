#!/usr/bin/env node
/**
 * Lightweight staged JSON checks for Spec Ledger paths.
 * Full AJV against schemas/*.json can replace this once ajv is a dependency;
 * until then we enforce required keys + types so Spec Ledger UI query FKs stay present.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")
const files = process.argv.slice(2)
if (files.length === 0) process.exit(0)

function fail(file, msg) {
  console.error(`spec-ledger pre-commit: ${file}: ${msg}`)
  return false
}

function checkTurn(file, data) {
  let ok = true
  if (data.schemaVersion !== 1) ok = fail(file, "schemaVersion must be 1") || ok
  if (typeof data.id !== "string" || !/^T-[0-9]{3,}/.test(data.id))
    ok = fail(file, "id must match T-NNN") || ok
  if (data.status !== "open" && data.status !== "closed")
    ok = fail(file, 'status must be "open" or "closed"') || ok
  if (!data.intent || typeof data.intent !== "object")
    ok = fail(file, "intent required") || ok
  else {
    if (typeof data.intent.userPrompt !== "string" || !data.intent.userPrompt.trim())
      ok = fail(file, "intent.userPrompt required") || ok
    if (typeof data.intent.restatedGoal !== "string" || !data.intent.restatedGoal.trim())
      ok = fail(file, "intent.restatedGoal required") || ok
  }
  if (data.status === "closed" && (!data.facts || typeof data.facts !== "object"))
    ok = fail(file, "closed turn requires facts") || ok
  return ok
}

function checkClaim(file, data) {
  let ok = true
  if (typeof data.id !== "string" || !data.id) ok = fail(file, "id required") || ok
  if (typeof data.statement !== "string" || !data.statement.trim())
    ok = fail(file, "statement required") || ok
  return ok
}

function checkBinding(file, data) {
  let ok = true
  if (typeof data.claimId !== "string" || !data.claimId)
    ok = fail(file, "claimId required") || ok
  if (data.status === "pass") ok = fail(file, 'bindings must not set status: "pass"') || ok
  return ok
}

function checkReview(file, data) {
  let ok = true
  if (data.schemaVersion !== 1) ok = fail(file, "schemaVersion must be 1") || ok
  if (typeof data.id !== "string" || !data.id) ok = fail(file, "id required") || ok
  if (typeof data.reviewer !== "string" || !data.reviewer.trim())
    ok = fail(file, "reviewer required") || ok
  if (!["approve", "request-changes", "comment"].includes(data.verdict))
    ok = fail(file, "verdict must be approve|request-changes|comment") || ok
  if (typeof data.summary !== "string" || !data.summary.trim())
    ok = fail(file, "summary required") || ok
  if (typeof data.plainSummary !== "string" || !data.plainSummary.trim())
    ok = fail(file, "plainSummary required (one Spec Ledger UI sentence)") || ok
  else if (data.plainSummary.length > 280)
    ok = fail(file, "plainSummary must be <= 280 characters") || ok
  const findings = Array.isArray(data.findings) ? data.findings : []
  for (const f of findings) {
    const fid = f?.id ?? "?"
    if (typeof f.gap !== "string" || !f.gap.trim())
      ok = fail(file, `finding ${fid}: gap required`) || ok
    if (typeof f.plainImpact !== "string" || !f.plainImpact.trim())
      ok = fail(file, `finding ${fid}: plainImpact required (one Spec Ledger UI sentence)`) || ok
    else if (f.plainImpact.length > 280)
      ok = fail(file, `finding ${fid}: plainImpact must be <= 280 characters`) || ok
    if (data.kind === "adversarial" && data.target === "code" && !f.evidence)
      ok = fail(file, `finding ${fid}: code-adversarial evidence required`) || ok
  }
  if (
    data.kind === "adversarial" &&
    data.target === "code" &&
    data.verdict === "approve" &&
    !(Array.isArray(data.killersCited) && data.killersCited.length)
  )
    ok = fail(file, "code-adversarial approve requires killersCited") || ok
  return ok
}

function checkSchemaFile(file, data) {
  if (typeof data !== "object" || data === null) return fail(file, "must be object")
  if (!data.$schema && !data.$id && data.type === undefined)
    return fail(file, "expected a JSON Schema document")
  return true
}

const rules = [
  [/^\.spec-ledger\/turns\/T-.+\.json$/, checkTurn],
  [/^\.spec-ledger\/reviews\/.+\.json$/, checkReview],
  [/^\.spec-ledger\/claims\/.+\.json$/, checkClaim],
  [/^\.spec-ledger\/bindings\/.+\.json$/, checkBinding],
  [/^schemas\/.+\.json$/, checkSchemaFile],
]

let failed = false
for (const file of files) {
  const rule = rules.find(([re]) => re.test(file))
  if (!rule) continue
  let data
  try {
    data = JSON.parse(readFileSync(join(root, file), "utf8"))
  } catch (e) {
    fail(file, `not valid JSON (${e.message})`)
    failed = true
    continue
  }
  if (!rule[1](file, data)) failed = true
}

process.exit(failed ? 1 : 0)
