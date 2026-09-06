import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer } from "node:net"
import { createLedgerServer } from "../../server/dist/index.js"
import { createSpecLedgerClient } from "../../client/dist/index.js"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Client } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import type { GoalProjection } from "@nessalabs/spec-ledger"
import { optimizationFixture } from "../../ledger/dist/optimization/optimization.fixture.js"

test("MCP records iterative work and both client transports inspect the same read-only history", async () => {
  const f = optimizationFixture()
  const mcp = new Client({ name: "optimization-test", version: "1" })
  const reservation = createServer()
  await new Promise<void>(resolve => reservation.listen(0, "127.0.0.1", resolve))
  const port = (reservation.address() as { port: number }).port
  await new Promise<void>(resolve => reservation.close(() => resolve()))
  const server = createLedgerServer(f.root, port)
  let listening = false
  try {
    await mcp.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("./main.js", import.meta.url).pathname, "--root", f.root] }))
    const tools = await mcp.listTools()
    for (const name of ["list_goals", "get_goal", "create_goal", "start_experiment", "record_experiment_result", "conclude_goal"]) assert.ok(tools.tools.some(tool => tool.name === name))
    const call = async (name: string, payload: Record<string, unknown>, read = false) => {
      const response = await mcp.callTool({ name, arguments: read ? payload : { requestId: randomUUID(), ...f.guards(), ...payload } })
      const envelope = response.structuredContent as { ok: boolean; result: unknown }
      assert.equal(envelope.ok, true, JSON.stringify(response))
      return envelope.result
    }
    await call("create_goal", { goal: { id: "G-mcp", workstreamId: "W-001", turnId: "T-001", title: "Learn through MCP", objective: "Test the real adapter", stopWhen: "One useful finding", maxExperiments: 1 } })
    await call("start_experiment", { experiment: { id: "X-mcp", goalId: "G-mcp", turnId: "T-001", hypothesis: "A smaller change is clearer", change: "Remove redundant wording" } })
    await call("record_experiment_result", { result: { goalId: "G-mcp", experimentId: "X-mcp", turnId: "T-001", status: "completed", decision: "kept", findings: "The instruction is easier to follow" } })
    await call("conclude_goal", { conclusion: { goalId: "G-mcp", turnId: "T-001", reason: "satisfied", summary: "Kept the clearer wording" } })
    const expected = await call("get_goal", { goalId: "G-mcp" }, true) as GoalProjection
    assert.equal(expected.status, "concluded"); assert.equal(expected.bestObserved, null)
    await server.listen(); listening = true
    const baseUrl = `http://127.0.0.1:${port}`
    const direct = createSpecLedgerClient({ kind: "inProcess", rootDir: f.root })
    const http = createSpecLedgerClient({ kind: "http", baseUrl })
    assert.deepEqual(await direct.getGoal("G-mcp"), expected)
    assert.deepEqual(await http.getGoal("G-mcp"), expected)
    assert.deepEqual(await http.listGoals({ turnId: "T-001" }), [expected])
    assert.deepEqual(await http.listGoals({ workstreamId: "W-999" }), [])
    const rejected = await fetch(`${baseUrl}/v1/goals/G-mcp`, { method: "POST", body: "{}" })
    assert.ok([404,405].includes(rejected.status))
    assert.equal((await fetch(`${baseUrl}/v1/goals/G-missing`)).status, 404)
    assert.deepEqual(await direct.getGoal("G-mcp"), expected)
    const goalPath = join(f.root, ".spec-ledger/optimization/G-mcp/goal.json")
    const original = readFileSync(goalPath, "utf8")
    writeFileSync(goalPath, "{invalid")
    assert.equal((await fetch(`${baseUrl}/v1/goals`)).status, 500)
    assert.equal((await fetch(`${baseUrl}/v1/health`)).status, 200)
    writeFileSync(goalPath, original)
    assert.deepEqual(await http.getGoal("G-mcp"), expected)
  } finally { await mcp.close(); if (listening) await server.close(); f.cleanup() }
})
