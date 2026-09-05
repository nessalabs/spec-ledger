import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { initLedger, getCheckEvidence, type CheckRun } from "@nessalabs/spec-ledger";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
const here = dirname(fileURLToPath(import.meta.url));
for (const surface of ["CLI", "MCP"]) {
    test(`${surface} starts and observes the same saved command with actual output`, async () => {
        const root = mkdtempSync(join(tmpdir(), "sl-check-surface-")), inputs = mkdtempSync(join(tmpdir(), "sl-check-input-"));
        let client: Client | undefined;
        try {
            initLedger(root, "check surface");
            writeFileSync(join(root, "test.cjs"), "console.log('expected greeting');console.error('stderr captured')");
            writeFileSync(join(root, ".spec-ledger/claims/C.json"), JSON.stringify({ id: "C", statement: "Greeting", required: true }));
            writeFileSync(join(root, ".spec-ledger/bindings/B.json"), JSON.stringify({ id: "B", claimId: "C", kind: "test", locator: { type: "command", command: "node test.cjs" } }));
            if (surface === "MCP") {
                client = new Client({ name: "check test", version: "1" });
                await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(here, "main.js"), "--root", root] }));
            }
            const call = async (name: string, input: unknown) => {
                if (client) {
                    const r = await client.callTool({ name, arguments: input as Record<string, unknown> });
                    const envelope = r.structuredContent as {
                        ok: boolean;
                        result: CheckRun;
                    };
                    assert.equal(envelope.ok, true, JSON.stringify(r));
                    return envelope.result;
                }
                const path = join(inputs, "input.json");
                writeFileSync(path, JSON.stringify(input));
                const r = spawnSync(process.execPath, [join(here, "../../ledger/dist/cli/main.js"), "operation", name, "--file", path, "--root", root], { encoding: "utf8" });
                assert.equal(r.status, 0, r.stdout + r.stderr);
                return JSON.parse(r.stdout).result as CheckRun;
            };
            const e = getCheckEvidence(root, "B"), args = { requestId: "surface-saved-check-request", bindingId: "B", expectedSourceDigest: e.sourceDigest, expectedCheckDigest: e.checkDigest };
            const run = await call("run_saved_check", args);
            assert.equal((await call("run_saved_check", args)).runId, run.runId);
            let final = run;
            for (let i = 0; i < 100; i++) {
                final = await call("get_check_run", { runId: run.runId });
                if (final.state === "finished" || final.state === "unknown")
                    break;
                await new Promise(r => setTimeout(r, 50));
            }
            assert.equal(final.state, "finished", final.reason);
            assert.equal(final.outcome, "pass");
            assert.match(final.stdout!.text!, /expected greeting/);
            assert.match(final.stderr!.text!, /stderr captured/);
            assert.equal(getCheckEvidence(root, "B").runs.length, 1);
        }
        finally {
            await client?.close();
            rmSync(root, { recursive: true, force: true });
            rmSync(inputs, { recursive: true, force: true });
        }
    });
}
