import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { initLedger } from "../cli/init.js"
import { loadLedger, writeJson } from "../fs/load.js"
import { verifyLedger } from "./verify.js"
import { checkLedger } from "./execute.js"
import { sourceFingerprint, checkFingerprint } from "../evidence/fingerprint.js"
import type { EvidenceBinding, ResultsFile } from "../types.js"

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sl-aggregate-break-"))
  initLedger(root, "aggregation breaker")
  writeJson(join(root, ".spec-ledger/claims/SL-001.json"), {
    id: "SL-001", statement: "All checks hold", required: true,
  })
  return root
}
function permutations<T>(xs: T[]): T[][] {
  return xs.length < 2 ? [xs] : xs.flatMap((x, i) =>
    permutations(xs.filter((_, j) => i !== j)).map(rest => [x, ...rest]))
}
const binding = (id: string, locator: EvidenceBinding["locator"]): EvidenceBinding =>
  ({ id, claimId: "SL-001", kind: "check", locator })
const rows = (values: ResultsFile["rows"]): ResultsFile => ({
  schemaVersion: 1, producedAt: "2026-09-04T00:00:00Z",
  producer: { name: "breaker", version: "1" }, rows: values,
})

describe("all-check aggregation adversarial", () => {
  it("is invariant under every ordering of mixed evidence kinds", () => {
    const root = fixture()
    try {
      const ledger = loadLedger(root)
      ledger.results = rows([{ key: "passing", outcome: "pass" }])
      const checks = [
        binding("result", { type: "results-row", resultsKey: "passing" }),
        binding("exists", { type: "path", path: ".spec-ledger/ledger.json" }),
        binding("human", { type: "attestation", note: "reviewed" }),
        binding("missing", { type: "results-row", resultsKey: "absent" }),
        binding("failed", { type: "path", path: "never-created" }),
      ]
      for (const [count, expected] of [[5, "fail"], [4, "missing"], [3, "attested"], [2, "pass"]] as const) {
        for (const order of permutations(checks.slice(0, count))) {
          ledger.bindings = order
          ledger.results.rows[0].sourceDigest = sourceFingerprint(root)!
          ledger.results.rows[0].checkDigest = checkFingerprint(ledger.claims[0], checks[0])
          const report = verifyLedger(ledger)
          assert.equal(report.claims[0].outcome, expected, order.map(b => b.id).join(","))
          assert.equal(report.ok, expected === "pass")
          assert.equal(report.claims[0].bindingIds.length, count)
        }
      }
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  it("rejects agreeing duplicates and unused duplicates without silently choosing a row", () => {
    const root = fixture()
    try {
      const ledger = loadLedger(root)
      ledger.bindings = [binding("row", { type: "results-row", resultsKey: "key" })]
      for (const values of [["pass", "fail"], ["fail", "pass"], ["pass", "pass"]] as const) {
        ledger.results = rows(values.map(outcome => ({ key: "key", outcome })))
        const report = verifyLedger(ledger)
        assert.equal(report.ok, false)
        assert.equal(report.claims[0].outcome, "fail")
        assert.match(report.problems.join(" "), /duplicate.*key/i)
      }
      ledger.bindings = [binding("path", { type: "path", path: ".spec-ledger/ledger.json" })]
      assert.equal(verifyLedger(ledger).ok, false, "unused duplicate keys are still ambiguous input")
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  it("cannot hide a malformed locator or invalid result outcome behind a passing check", () => {
    const root = fixture()
    try {
      const ledger = loadLedger(root)
      const passing = binding("pass", { type: "path", path: ".spec-ledger/ledger.json" })
      for (const locator of [{ type: "command" }, { type: "path" }] as const) {
        for (const order of permutations([passing, binding("malformed", locator)])) {
          ledger.bindings = order
          assert.equal(verifyLedger(ledger).claims[0].outcome, "missing")
        }
      }
      ledger.bindings = [passing, binding("invalid", { type: "results-row", resultsKey: "bad" })]
      ledger.results = rows([{ key: "bad", outcome: "green" as "pass" }])
      assert.equal(verifyLedger(ledger).claims[0].outcome, "missing")
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  it("delivers failed reports and snapshots through actual HTTP and in-process clients", async () => {
    const root = fixture()
    const clientUrl = new URL("../../../client/dist/index.js", import.meta.url).href
    const serverUrl = new URL("../../../server/dist/routes.js", import.meta.url).href
    const { createSpecLedgerClient } = await import(clientUrl)
    const { buildRoutes } = await import(serverUrl)
    const routes = buildRoutes(root)
    const server = createServer(async (req, res) => {
      const route = routes.find((r: { pattern: RegExp }) => r.pattern.test(req.url ?? ""))
      if (!route) { res.writeHead(404).end(); return }
      await route.handler(req, res, {})
    })
    try {
      await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      for (const transport of [{ kind: "inProcess", rootDir: root }, { kind: "http", baseUrl }]) {
        const client = createSpecLedgerClient(transport)
        checkLedger(root)
        assert.equal((await client.verify()).ok, false)
        assert.equal((await client.getReport()).claims[0].outcome, "unbound")
        assert.equal((await client.getSnapshot()).report.ok, false)
      }
      for (const path of ["v1/verify", "v1/report", "v1/snapshot"]) {
        const response = await fetch(`${baseUrl}/${path}`)
        assert.equal(response.status, 200, "failed verification is data, not an unreadable transport error")
      }
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
      rmSync(root, { recursive: true, force: true })
    }
  })
})
