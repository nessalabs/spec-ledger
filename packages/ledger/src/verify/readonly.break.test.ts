import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { initLedger } from "../cli/init.js"
import { writeJson } from "../fs/load.js"
import { sealWorkstream } from "../workstream/load.js"

const cli = fileURLToPath(new URL("../cli/main.js", import.meta.url))
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sl-readonly-break-"))
  initLedger(root, "readonly breaker")
  writeJson(join(root, ".spec-ledger/claims/02f2ae36-9568-53f9-bc0c-a25f0a7e3af4.json"), { id: "02f2ae36-9568-53f9-bc0c-a25f0a7e3af4", statement: "Command succeeds", required: true })
  const script = "require('node:fs').appendFileSync('.spec-ledger/executed.txt','executed\\n')"
  const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'"
  writeJson(join(root, ".spec-ledger/bindings/62efa5fb-3815-50a5-9af4-ea868115ea15.json"), {
    id: "62efa5fb-3815-50a5-9af4-ea868115ea15", claimId: "02f2ae36-9568-53f9-bc0c-a25f0a7e3af4", kind: "check", locator: { type: "command", command: `${quote(process.execPath)} -e ${quote(script)}` },
  })
  writeJson(join(root, ".spec-ledger/workstreams/2b74bc14-227a-5c05-b2ed-1c32d9703cad.json"), {
    schemaVersion: 1, id: "2b74bc14-227a-5c05-b2ed-1c32d9703cad", status: "shaped", title: "Read without effects", featureIds: [],
    createdAt: "2026-01-01T00:00:00Z", policy: {}, trust: {},
    suggestedSlices: [{ id: "886b091f-57f9-5f69-9e74-f0b50275d693", title: "Read", kind: "vertical", acceptance: ["No writes"] }],
  })
  sealWorkstream(root, "2b74bc14-227a-5c05-b2ed-1c32d9703cad", "fixture")
  writeJson(join(root, ".spec-ledger/automation-events/2f8186b0-45f4-563d-ac09-47fe12180c37.json"), {
    schemaVersion: 1, id: "2f8186b0-45f4-563d-ac09-47fe12180c37", kind: "alert", workstreamId: "2b74bc14-227a-5c05-b2ed-1c32d9703cad", mode: "wait", state: "waiting",
    alertedAt: "2000-01-01T00:00:00Z", waitUntil: "2000-01-01T00:01:00Z", policySnapshot: { onAlertTimeout: "move" },
  })
  return root
}
function contents(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  function walk(dir: string, prefix = "") {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name), key = `${prefix}${name}`
      if (statSync(path).isDirectory()) walk(path, key + "/")
      else files[key] = readFileSync(path).toString("base64")
    }
  }
  walk(root)
  return files
}

describe("read-only projection adversarial", () => {
  it("HTTP and in-process reads never execute checks, persist reports, or resolve expired waits", async () => {
    const root = fixture()
    const { createSpecLedgerClient } = await import(new URL("../../../client/dist/index.js", import.meta.url).href)
    const { buildRoutes } = await import(new URL("../../../server/dist/routes.js", import.meta.url).href)
    const routes = buildRoutes(root)
    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, "http://localhost")
      const route = routes.find((r: { pattern: RegExp }) => r.pattern.test(url.pathname))
      if (!route) { res.writeHead(404).end(); return }
      await route.handler(req, res, {})
    })
    try {
      await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      const before = contents(root)
      for (const transport of [{ kind: "inProcess", rootDir: root }, { kind: "http", baseUrl }]) {
        const client = createSpecLedgerClient(transport)
        assert.equal((await client.verify()).claims[0].outcome, "missing")
        await client.getReport()
        await client.getSnapshot()
        const ctx = await client.getVerticalContext("2b74bc14-227a-5c05-b2ed-1c32d9703cad", "886b091f-57f9-5f69-9e74-f0b50275d693")
        assert.equal(ctx.prior.openAutomationEvents[0].state, "waiting")
        assert.deepEqual(contents(root), before, `read changed files through ${transport.kind}`)
      }
      const run = spawnSync(process.execPath, [cli, "context", "--root", root, "--workstream", "2b74bc14-227a-5c05-b2ed-1c32d9703cad", "--slice", "886b091f-57f9-5f69-9e74-f0b50275d693", "--json"], { encoding: "utf8" })
      assert.equal(run.status, 0, run.stderr)
      assert.deepEqual(contents(root), before, "CLI context must also be read-only")
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
      rmSync(root, { recursive: true, force: true })
    }
  })
  it("explicit CLI checks run commands, persist verdicts, and expose the recorded result to reads", async () => {
    const root = fixture()
    try {
      const { createSpecLedgerClient } = await import(new URL("../../../client/dist/index.js", import.meta.url).href)
      const client = createSpecLedgerClient({ kind: "inProcess", rootDir: root })
      assert.equal(existsSync(join(root, ".spec-ledger/executed.txt")), false)
      for (const cmd of ["check", "verify"]) {
        const run = spawnSync(process.execPath, [cli, cmd, "--root", root], { encoding: "utf8" })
        assert.equal(run.status, 0, run.stderr + run.stdout)
        assert.equal(JSON.parse(readFileSync(join(root, ".spec-ledger/results/report.json"), "utf8")).ok, true)
      }
      assert.equal(readFileSync(join(root, ".spec-ledger/executed.txt"), "utf8"), "executed\nexecuted\n")
      const before = contents(root)
      assert.equal((await client.verify()).claims[0].outcome, "pass")
      assert.deepEqual(contents(root), before, "reading recorded command evidence must not rerun it")
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
