import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { Client } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import { visualFixture } from "../../ledger/dist/evidence/visual.fixture.js"

test("MCP exposes missing screenshot guidance and records the same guarded visual coverage", async () => {
  const f = visualFixture(["Desktop"]), client = new Client({ name: "visual-evidence-test", version: "1" })
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("./main.js", import.meta.url).pathname, "--root", f.root] }))
    const tools = await client.listTools()
    assert.ok(tools.tools.some(t => t.name === "record_screenshot"))
    const call = async (name: string, args: Record<string, unknown>) => {
      const response = await client.callTool({ name, arguments: args })
      const envelope = JSON.parse((response.content as { text: string }[])[0].text)
      assert.equal(envelope.ok, true, JSON.stringify(response)); return envelope.result
    }
    const missing = await call("check_visual_evidence", { workstreamId: f.workstreamId, turnId: f.turnId })
    assert.equal(missing.ok, false); assert.match(missing.reasons[0], /Attach screenshots of all relevant UI/)
    const args = { requestId: randomUUID(), ...f.guards(), turnId: f.turnId, surface: "Desktop", path: f.capture("desktop") }
    const a = await call("record_screenshot", args)
    assert.deepEqual(await call("record_screenshot", args), a)
    assert.equal((await call("check_visual_evidence", { workstreamId: f.workstreamId })).ok, true)
    const session = await call("get_session", { workstreamId: f.workstreamId })
    assert.equal(session.session.visualEvidence.ok, true)
    assert.match(session.session.artifacts[0].imageDataUrl, /^data:image\/png/)
  } finally { await client.close(); f.cleanup() }
})
