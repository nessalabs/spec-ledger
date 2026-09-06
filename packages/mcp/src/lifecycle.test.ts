import { Client } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import {
  checkFingerprint,
  initLedger,
  loadLedger,
  loadWorkstream,
  planRevision,
  sourceFingerprint,
} from "@nessalabs/spec-ledger"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const cliBin = join(here, "../../ledger/dist/cli/main.js")
const mcpBin = join(here, "main.js")

function git(root: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
}

function fixture(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `sl-mcp-${label}-`))
  git(root, "init", "-q")
  git(root, "config", "user.email", "fixture@example.test")
  git(root, "config", "user.name", "Fixture")
  initLedger(root, label)
  writeFileSync(join(root, "source.ts"), "export const behavior = true\n")
  writeFileSync(join(root, ".spec-ledger/claims/5e852279-c620-5042-b952-b015a4c32e20.json"), JSON.stringify({ id: "5e852279-c620-5042-b952-b015a4c32e20", statement: "Behavior works", required: true }))
  writeFileSync(join(root, ".spec-ledger/claims/48cc88b5-b35b-5236-9e5b-b845d2319792.json"), JSON.stringify({ id: "48cc88b5-b35b-5236-9e5b-b845d2319792", statement: "Command check runs", required: true }))
  writeFileSync(join(root, ".spec-ledger/bindings/fbb2b406-1c10-4c9c-a42e-f069d61d5ba3.json"), JSON.stringify({ id: "fbb2b406-1c10-4c9c-a42e-f069d61d5ba3", claimId: "5e852279-c620-5042-b952-b015a4c32e20", kind: "check", locator: { type: "results-row", resultsKey: "behavior" } }))
  writeFileSync(join(root, ".spec-ledger/bindings/769dad0a-f802-4c16-9f8a-d0f4f087384a.json"), JSON.stringify({ id: "769dad0a-f802-4c16-9f8a-d0f4f087384a", claimId: "48cc88b5-b35b-5236-9e5b-b845d2319792", kind: "check", locator: { type: "command", command: `${process.execPath} -e \"process.exit(0)\"` } }))
  writeFileSync(join(root, ".spec-ledger/workstreams/6fbba68d-7164-55a6-80f9-18dea06c91ce.json"), JSON.stringify({
    schemaVersion: 1, id: "6fbba68d-7164-55a6-80f9-18dea06c91ce", status: "shaped", title: "Shared work", objective: "Finish through either adapter",
    featureIds: ["alpha"], acceptanceCriteria: ["Behavior works"], acceptanceClaimIds: { "AC-1": ["5e852279-c620-5042-b952-b015a4c32e20"] },
    policy: { requireSpecBreak: true, requireCodeBreak: true, requireAlignApprove: true }, trust: {},
    suggestedSlices: [{ id: "0d0038da-bb13-561e-ac49-570f6ed0f334", title: "Build", kind: "vertical", acceptance: ["Behavior works"], expectedPaths: ["**"] }],
  }))
  git(root, "add", ".")
  git(root, "commit", "-qm", "fixture")
  return root
}

type Caller = (name: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>

function cliCaller(root: string): Caller {
  let sequence = 0
  return async (name, input) => {
    const path = join(tmpdir(), `sl-cli-input-${process.pid}-${sequence += 1}.json`)
    writeFileSync(path, JSON.stringify(input))
    const run = spawnSync(process.execPath, [cliBin, "operation", name, "--file", path, "--root", root], { encoding: "utf8" })
    rmSync(path)
    const envelope = JSON.parse(run.stdout) as Record<string, unknown>
    assert.equal(run.status, envelope.ok === true ? 0 : 1, run.stderr)
    return envelope
  }
}

async function mcpCaller(root: string): Promise<{ call: Caller; close: () => Promise<void> }> {
  const client = new Client({ name: "spec-ledger-test", version: "1" })
  const transport = new StdioClientTransport({ command: process.execPath, args: [mcpBin, "--root", root], stderr: "pipe" })
  await client.connect(transport)
  return {
    call: async (name, input) => {
      const result = await client.callTool({ name, arguments: input })
      return result.structuredContent as Record<string, unknown>
    },
    close: async () => { await client.close() },
  }
}

function request(label: string, n: number): string {
  return `${label}-request-${String(n).padStart(4, "0")}`
}

function domainSnapshot(root: string): Record<string, string> {
  const snapshot: Record<string, string> = {}
  const visit = (directory: string, relative = "") => {
    for (const name of readdirSync(directory).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name
      if (childRelative === ".git" || childRelative.startsWith(".git/") ||
          childRelative === ".spec-ledger/operations" || childRelative.startsWith(".spec-ledger/operations/")) continue
      const path = join(directory, name)
      if (statSync(path).isDirectory()) visit(path, childRelative)
      else snapshot[childRelative] = readFileSync(path, "utf8")
    }
  }
  visit(root)
  return snapshot
}

async function lifecycle(root: string, call: Caller, label: string) {
  let n = 0
  const invoke = async (name: string, input: Record<string, unknown>) => {
    const envelope = await call(name, input)
    assert.equal(envelope.ok, true, JSON.stringify(envelope))
    return envelope.result as Record<string, unknown>
  }
  const revision = planRevision(root, loadWorkstream(root, "6fbba68d-7164-55a6-80f9-18dea06c91ce"))
  await invoke("plan_work", { workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce" })
  await invoke("record_permission", {
    requestId: request(label, n += 1),
    authority: { action: "grant", mode: "request", workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", featureIds: ["alpha"], source: { kind: "agent-reported", reference: "fixture authorization" } },
  })
  await invoke("record_review", {
    requestId: request(label, n += 1), target: "spec", workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", expectedRevisionDigest: revision,
    review: { kind: "adversarial", reviewer: "fixture-spec-reviewer", verdict: "approve", summary: "The executable plan has bounded acceptance.", plainSummary: "The plan is clear enough to build safely." },
  })
  const opened = await invoke("begin_work", { requestId: request(label, n += 1), workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", sliceId: "0d0038da-bb13-561e-ac49-570f6ed0f334", goal: "Finish shared work", allowDirty: true, expectedRevisionDigest: revision })
  await invoke("get_context", { workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", sliceId: "0d0038da-bb13-561e-ac49-570f6ed0f334" })
  let source = sourceFingerprint(root)!
  const currentRevision = planRevision(root, loadWorkstream(root, "6fbba68d-7164-55a6-80f9-18dea06c91ce"))
  await invoke("record_progress", { requestId: request(label, n += 1), turnId: opened.id, summary: "Behavior implemented", criterionIds: ["AC-1"], implemented: true, expectedRevisionDigest: currentRevision, expectedSourceDigest: source })
  source = sourceFingerprint(root)!
  await invoke("record_decision", { requestId: request(label, n += 1), turnId: opened.id, decision: "Keep the adapter thin", rationale: "Both transports must share application behavior.", expectedRevisionDigest: currentRevision, expectedSourceDigest: source })
  source = sourceFingerprint(root)!
  const ledger = loadLedger(root)
  await invoke("record_evidence", { requestId: request(label, n += 1), evidence: { bindingId: "fbb2b406-1c10-4c9c-a42e-f069d61d5ba3", outcome: "pass", sourceDigest: source, checkDigest: checkFingerprint(ledger.claims.find((claim) => claim.id === "5e852279-c620-5042-b952-b015a4c32e20")!, ledger.bindings.find((binding) => binding.id === "fbb2b406-1c10-4c9c-a42e-f069d61d5ba3")!), producer: { name: "fixture", version: "1" }, runId: `${label}-evidence` } })
  source = sourceFingerprint(root)!
  await invoke("run_checks", { requestId: request(label, n += 1), expectedSourceDigest: source })
  source = sourceFingerprint(root)!
  await invoke("record_review", { requestId: request(label, n += 1), target: "code", turnId: opened.id, expectedSourceDigest: source, review: { kind: "adversarial", reviewer: "fixture-code-reviewer", verdict: "approve", summary: "The lifecycle passed its independent integration review.", plainSummary: "The shared lifecycle is ready to close.", killersCited: ["actual-executable-lifecycle"] } })
  source = sourceFingerprint(root)!
  await invoke("approve_alignment", { requestId: request(label, n += 1), turnId: opened.id, expectedSourceDigest: source, reviewer: "agent:align:fixture", summary: "All changed product paths are covered by the plan.", plainSummary: "The changed product files are covered by the plan." })
  source = sourceFingerprint(root)!
  await invoke("finish_turn", { requestId: request(label, n += 1), turnId: opened.id, action: "close", expectedSourceDigest: source })
  source = sourceFingerprint(root)!
  await invoke("complete_work", { requestId: request(label, n += 1), workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", expectedRevisionDigest: currentRevision, expectedSourceDigest: source })
  return invoke("get_session", { workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce" })
}

describe("actual CLI and MCP lifecycle parity", () => {
  it("completes the same verified lifecycle through both executables", async () => {
    const cliRoot = fixture("cli")
    const mcpRoot = fixture("mcp")
    const mcp = await mcpCaller(mcpRoot)
    try {
      const cliSession = await lifecycle(cliRoot, cliCaller(cliRoot), "cli")
      const mcpSession = await lifecycle(mcpRoot, mcp.call, "mcp")
      for (const projection of [cliSession, mcpSession]) {
        const session = projection.session as Record<string, unknown>
        assert.equal(session.status, "done")
        assert.deepEqual(session.openTurnIds, [])
        assert.equal((session.completion as Record<string, unknown>).eligible, true)
        assert.equal((session.criteria as Array<Record<string, unknown>>)[0].evidence, "pass")
      }
    } finally {
      await mcp.close()
      rmSync(cliRoot, { recursive: true, force: true })
      rmSync(mcpRoot, { recursive: true, force: true })
    }
  })

  it("returns the same structured denial and leaves domain state unchanged", async () => {
    const cliRoot = fixture("cli-denied")
    const mcpRoot = fixture("mcp-denied")
    const mcp = await mcpCaller(mcpRoot)
    try {
      const inputs = (root: string, label: string) => ({ requestId: request(label, 1), workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", sliceId: "0d0038da-bb13-561e-ac49-570f6ed0f334", goal: "Must remain denied", allowDirty: true, expectedRevisionDigest: planRevision(root, loadWorkstream(root, "6fbba68d-7164-55a6-80f9-18dea06c91ce")) })
      const cli = await cliCaller(cliRoot)("begin_work", inputs(cliRoot, "cli-denied"))
      const remote = await mcp.call("begin_work", inputs(mcpRoot, "mcp-denied"))
      assert.equal(cli.ok, false)
      assert.equal(remote.ok, false)
      assert.equal((cli.error as Record<string, unknown>).code, "permission_denied")
      assert.equal((remote.error as Record<string, unknown>).code, "permission_denied")
      for (const root of [cliRoot, mcpRoot]) {
        assert.equal(loadWorkstream(root, "6fbba68d-7164-55a6-80f9-18dea06c91ce").seal, undefined)
        assert.equal(loadLedger(root).turns.length, 0)
      }
    } finally {
      await mcp.close()
      rmSync(cliRoot, { recursive: true, force: true })
      rmSync(mcpRoot, { recursive: true, force: true })
    }
  })

  it("rejects retries, stale inputs, malformed inputs, and missing evidence with the same contracts", async () => {
    const cliRoot = fixture("cli-negative")
    const mcpRoot = fixture("mcp-negative")
    const mcp = await mcpCaller(mcpRoot)
    try {
      for (const [root, call, label] of [
        [cliRoot, cliCaller(cliRoot), "cli-negative"],
        [mcpRoot, mcp.call, "mcp-negative"],
      ] as const) {
        const permissionInput = {
          requestId: request(label, 1),
          authority: { action: "grant", mode: "request", workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", featureIds: ["alpha"], source: { kind: "agent-reported", reference: "fixture authorization" } },
        }
        assert.equal((await call("record_permission", permissionInput)).ok, true)
        const afterPermission = domainSnapshot(root)
        assert.equal((await call("record_permission", permissionInput)).ok, true)
        assert.deepEqual(domainSnapshot(root), afterPermission)
        const conflict = await call("record_permission", {
          ...permissionInput,
          authority: { ...permissionInput.authority, source: { kind: "agent-reported", reference: "changed authorization" } },
        })
        assert.equal(conflict.ok, false)
        assert.equal((conflict.error as Record<string, unknown>).code, "idempotency_conflict")
        assert.deepEqual(domainSnapshot(root), afterPermission)

        const revision = planRevision(root, loadWorkstream(root, "6fbba68d-7164-55a6-80f9-18dea06c91ce"))
        assert.equal((await call("record_review", {
          requestId: request(label, 2), target: "spec", workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", expectedRevisionDigest: revision,
          review: { kind: "adversarial", reviewer: "fixture-spec-reviewer", verdict: "approve", summary: "The plan is bounded.", plainSummary: "The plan is ready for implementation." },
        })).ok, true)
        const openedEnvelope = await call("begin_work", { requestId: request(label, 3), workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce", sliceId: "0d0038da-bb13-561e-ac49-570f6ed0f334", goal: "Exercise negative contracts", allowDirty: true, expectedRevisionDigest: revision })
        assert.equal(openedEnvelope.ok,true)
        const opened = openedEnvelope.result as {id:string}
        const currentRevision = planRevision(root, loadWorkstream(root, "6fbba68d-7164-55a6-80f9-18dea06c91ce"))
        const currentSource = sourceFingerprint(root)!
        const beforeRejected = domainSnapshot(root)
        const staleRevision = await call("record_decision", { requestId: request(label, 4), turnId: opened.id, decision: "Must reject", rationale: "The revision is stale.", expectedRevisionDigest: "0".repeat(64), expectedSourceDigest: currentSource })
        assert.equal((staleRevision.error as Record<string, unknown>).code, "revision_conflict")
        const staleSource = await call("record_progress", { requestId: request(label, 5), turnId: opened.id, summary: "Must reject", criterionIds: ["AC-1"], implemented: true, expectedRevisionDigest: currentRevision, expectedSourceDigest: "0".repeat(64) })
        assert.equal((staleSource.error as Record<string, unknown>).code, "source_conflict")
        const malformed = await call("record_progress", { requestId: request(label, 6), turnId: opened.id, summary: "Missing source digest", criterionIds: ["AC-1"], implemented: true, expectedRevisionDigest: currentRevision })
        assert.equal((malformed.error as Record<string, unknown>).code, "invalid_input")
        assert.deepEqual(domainSnapshot(root), beforeRejected)

        const beforeRead = readdirSync(join(root, ".spec-ledger/operations")).sort()
        const sessionEnvelope = await call("get_session", { workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce" })
        const session = (sessionEnvelope.result as Record<string, unknown>).session as Record<string, unknown>
        assert.equal((session.completion as Record<string, unknown>).eligible, false)
        assert.equal((session.criteria as Array<Record<string, unknown>>)[0].evidence, "missing")
        assert.deepEqual(readdirSync(join(root, ".spec-ledger/operations")).sort(), beforeRead)
      }
    } finally {
      await mcp.close()
      rmSync(cliRoot, { recursive: true, force: true })
      rmSync(mcpRoot, { recursive: true, force: true })
    }
  })
})

describe("MCP package", () => {
  it("installs and invokes the packed executable", async () => {
    const packageRoot = join(here, "..")
    const ledgerRoot = join(packageRoot, "../ledger")
    const packs = mkdtempSync(join(tmpdir(), "sl-mcp-packs-"))
    const install = mkdtempSync(join(tmpdir(), "sl-mcp-install-"))
    const root = fixture("packed")
    const pack = (cwd: string) => {
      const result = spawnSync("npm", ["pack", "--pack-destination", packs, "--json", "--ignore-scripts"], { cwd, encoding: "utf8" })
      assert.equal(result.status, 0, result.stderr)
      return JSON.parse(result.stdout)[0] as { filename: string; files: Array<{ path: string }> }
    }
    const ledger = pack(ledgerRoot)
    const mcp = pack(packageRoot)
    const files = mcp.files.map((entry) => entry.path)
    assert.ok(files.includes("dist/main.js"))
    assert.ok(files.includes("dist/index.d.ts"))
    assert.match(readFileSync(join(packageRoot, "dist/main.js"), "utf8"), /^#!\/usr\/bin\/env node/)
    const installed = spawnSync("npm", ["install", "--prefix", install, "--ignore-scripts", join(packs, ledger.filename), join(packs, mcp.filename)], { encoding: "utf8" })
    assert.equal(installed.status, 0, installed.stderr)
    const client = new Client({ name: "packed-bin-test", version: "1" })
    const transport = new StdioClientTransport({ command: join(install, "node_modules/.bin/spec-ledger-mcp"), args: ["--root", root], stderr: "pipe" })
    try {
      await client.connect(transport)
      const result = await client.callTool({ name: "get_session", arguments: { workstreamId: "6fbba68d-7164-55a6-80f9-18dea06c91ce" } })
      assert.equal((result.structuredContent as Record<string, unknown>).ok, true)
    } finally {
      await client.close()
      rmSync(packs, { recursive: true, force: true })
      rmSync(install, { recursive: true, force: true })
      rmSync(root, { recursive: true, force: true })
    }
  })
})
