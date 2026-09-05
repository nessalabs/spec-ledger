import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initLedger } from "../cli/init.js";
import { loadLedger, writeJson } from "../fs/load.js";
import { executeOperation } from "../application/operations.js";
import { getCheckEvidence, getCheckRun, type CheckRun } from "./saved-check.js";
import { createLocalCheckBridge } from "./local-check.js";
import { checkLedger } from "./execute.js";
function fixture(command = "node check.cjs") {
    const root = mkdtempSync(join(tmpdir(), "sl-saved-check-"));
    initLedger(root, "saved check");
    writeFileSync(join(root, "check.cjs"), "console.log('actual: hello'); console.error('diagnostic');\n");
    writeJson(join(root, ".spec-ledger/claims/C-1.json"), { id: "C-1", statement: "Greeting works", required: true });
    writeJson(join(root, ".spec-ledger/bindings/B-1.json"), { id: "B-1", claimId: "C-1", kind: "test", test: { level: "unit", source: { path: "check.cjs" }, inputs: "No arguments", expected: "prints actual: hello" }, locator: { type: "command", command } });
    return root;
}
function request(root: string, id = "saved-check-request-0001") { const e = getCheckEvidence(root, "B-1"); return { requestId: id, bindingId: "B-1", expectedSourceDigest: e.sourceDigest!, expectedCheckDigest: e.checkDigest }; }
async function finish(root: string, id: string) { for (let i = 0; i < 150; i++) {
    const r = getCheckRun(root, id);
    if (r.state === "finished" || r.state === "unknown")
        return r;
    await new Promise(r => setTimeout(r, 40));
} throw new Error("Check did not finish"); }
test("saved command returns promptly, preserves actual output, and retries do not execute again", async () => {
    const root = fixture();
    try {
        const input = request(root), run = executeOperation(root, "run_saved_check", input) as CheckRun;
        assert.equal(run.state, "queued");
        assert.deepEqual(executeOperation(root, "run_saved_check", input), run);
        const completed = await finish(root, run.runId);
        assert.equal(completed.state, "finished", completed.reason);
        assert.equal(completed.outcome, "pass");
        assert.match(completed.stdout!.text!, /actual: hello/);
        assert.equal(completed.stdout!.capturedBytes, Buffer.byteLength(completed.stdout!.text!));
        assert.match(completed.stderr!.text!, /diagnostic/);
        assert.equal(completed.cwd, realpathSync(root));
        assert.ok(completed.durationMs! >= 0);
        const evidence = getCheckEvidence(root, "B-1");
        assert.equal(evidence.currentOutcome, "pass");
        assert.match(evidence.source.text!, /console.log/);
        assert.equal(evidence.runs.length, 1);
        assert.throws(() => executeOperation(root, "run_saved_check", { ...input, expectedCheckDigest: "0".repeat(64) }), /requestId/);
        writeFileSync(join(root, ".spec-ledger/evidence/check-runs", `${run.runId}-stdout.txt`), "tampered");
        assert.equal(getCheckRun(root, run.runId).stdout?.status, "unavailable");
        assert.notEqual(getCheckEvidence(root, "B-1").currentOutcome, "pass");
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test("batch CLI runner records the same bounded logs and preserves unrelated rows", () => {
    const root = fixture();
    try {
        writeJson(join(root, ".spec-ledger/results/last.json"), { schemaVersion: 1, producedAt: new Date().toISOString(), producer: { name: "fixture", version: "1" }, rows: [{ key: "external", outcome: "attested" }] });
        assert.equal(checkLedger(root).claims[0].outcome, "pass");
        assert.equal(loadLedger(root).results!.rows.find(r => r.key === "external")?.outcome, "attested");
        assert.match(getCheckEvidence(root, "B-1").runs[0].stdout!.text!, /actual: hello/);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
test("local bridge only runs the displayed saved definition and reads are passive", async () => {
    const root = fixture();
    try {
        const bridge = createLocalCheckBridge(root), url = "http://127.0.0.1:3737/api/checks";
        const token = (await (await bridge(new Request(url))).json()).token;
        const input = request(root);
        assert.equal((await bridge(new Request(url, { method: "POST", headers: { origin: "http://evil.example", "x-spec-ledger-token": token, "content-type": "application/json" }, body: JSON.stringify(input) }))).status, 403);
        const headers = { origin: "http://127.0.0.1:3737", "x-spec-ledger-token": token, "content-type": "application/json" };
        assert.equal((await bridge(new Request(url, { method: "POST", headers, body: JSON.stringify({ ...input, command: "echo injected" }) }))).status, 409);
        assert.equal(getCheckEvidence(root, "B-1").runs.length, 0);
        const response = await bridge(new Request(url, { method: "POST", headers, body: JSON.stringify(input) }));
        assert.equal(response.status, 202);
        const run = await response.json() as CheckRun;
        assert.equal((await finish(root, run.runId)).outcome, "pass");
        assert.equal((await bridge(new Request(`${url}?bindingId=B-1`))).status, 200);
        assert.equal((await bridge(new Request(`${url}?runId=${run.runId}`))).status, 200);
        assert.equal(getCheckEvidence(root, "B-1").runs.length, 1);
        assert.ok(readFileSync(join(root, ".spec-ledger/results/last.json"), "utf8").includes(run.runId));
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
