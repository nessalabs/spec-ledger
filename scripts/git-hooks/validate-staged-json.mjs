#!/usr/bin/env node
/**
 * Lightweight staged JSON checks for Spec Ledger paths.
 * Full AJV against schemas/*.json can replace this once ajv is a dependency;
 * until then we enforce required keys + types so Lattice query FKs stay present.
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

function checkSchemaFile(file, data) {
  if (typeof data !== "object" || data === null) return fail(file, "must be object")
  if (!data.$schema && !data.$id && data.type === undefined)
    return fail(file, "expected a JSON Schema document")
  return true
}

const rules = [
  [/^\.spec-ledger\/turns\/T-.+\.json$/, checkTurn],
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
