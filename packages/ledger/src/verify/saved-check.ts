import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, realpathSync, lstatSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { join, relative, dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLedger, writeJson } from "../fs/load.js";
import { sourceFingerprint, checkFingerprint, contentHash, localArtifactPath } from "../evidence/fingerprint.js";
import { verifyLedger } from "./verify.js";
import { runMutation } from "../application/receipts.js";
import { operationError } from "../application/errors.js";
import type { ResultsRow } from "../types.js";
const RUN_ID = /^[a-f0-9-]{36}$/;
const OUTPUT_LIMIT = 32 * 1024;
export interface CheckOutput {
    capturedBytes?: number;
    text: string | null;
    truncated: boolean;
    sha256: string;
    status: "intact" | "unavailable";
}
export interface CheckRun {
    runId: string;
    requestId: string;
    previousRunId?: string;
    bindingId: string;
    state: "queued" | "running" | "finished" | "unknown";
    command: string;
    cwd: string;
    sourceDigest: string;
    checkDigest: string;
    startedAt: string;
    finishedAt?: string;
    outcome?: ResultsRow["outcome"];
    exitCode?: number | null;
    signal?: string | null;
    durationMs?: number;
    stdout?: CheckOutput;
    stderr?: CheckOutput;
    reason?: string;
}
interface StoredRun extends Omit<CheckRun, "stdout" | "stderr"> {
    stdout?: {
        path: string;
        capturedBytes?: number;
        sha256: string;
        truncated: boolean;
    };
    stderr?: {
        path: string;
        capturedBytes?: number;
        sha256: string;
        truncated: boolean;
    };
}
function confinedWritePath(root: string, target: string): string {
    const rel = relative(resolve(root), resolve(target));
    if (!rel || rel === ".." || rel.startsWith("../") || isAbsolute(rel)) throw new Error("Check output escapes the checkout");
    let current = realpathSync(root);
    for (const part of rel.split("/")) {
        current = join(current, part);
        try { if (lstatSync(current).isSymbolicLink()) throw new Error("Check output cannot traverse a symlink"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    return target;
}
function paths(root: string) {
    const ledger = loadLedger(root);
    const safe = (target: string) => confinedWritePath(ledger.repoRoot, target);
    const base = safe(join(ledger.rootDir, "evidence/check-runs"));
    safe(join(ledger.rootDir,"operations"));
    const runReceipts = safe(join(ledger.rootDir,"evidence/runs"));
    const results = safe(join(ledger.rootDir,ledger.config.resultsPath ?? "results/last.json"));
    const report = safe(join(ledger.rootDir,ledger.config.reportPath ?? "results/report.json"));
    return { ledger, base, runReceipts, results, report, guard: safe(join(base,".execution-lock")) };
}
export function validateCheckStorage(root: string) { paths(root); }
function prepare(root: string) { const p = paths(root); mkdirSync(p.base, { recursive: true }); return p; }
function readRun(root: string, runId: string): StoredRun {
    if (!RUN_ID.test(runId))
        throw operationError("invalid_input", "Invalid check run ID");
    const p = paths(root);
    const path = localArtifactPath(p.ledger.repoRoot, relative(p.ledger.repoRoot, join(p.base, `${runId}.json`)));
    if (lstatSync(path).size > 128 * 1024)
        throw new Error("Check receipt exceeds limit");
    const run = JSON.parse(readFileSync(path, "utf8")) as StoredRun;
    if (run.runId !== runId || !["queued", "running", "finished", "unknown"].includes(run.state))
        throw new Error("Invalid check receipt");
    return run;
}
function store(root: string, run: StoredRun) {
    const p = prepare(root);
    const path = join(p.base, `${run.runId}.json`);
    if (existsSync(path) && lstatSync(path).isSymbolicLink())
        throw new Error("Check receipt cannot be a symlink");
    const temporary = `${path}.${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(run, null, 2)}\n`, { flag: "wx" });
    renameSync(temporary, path);
}
function output(root: string, data: StoredRun["stdout"]): CheckOutput | undefined {
    if (!data)
        return undefined;
    try {
        const path = localArtifactPath(root, data.path);
        if (lstatSync(path).size > OUTPUT_LIMIT)
            throw new Error("Output exceeds display limit");
        const bytes = readFileSync(path);
        if (contentHash(bytes) !== data.sha256)
            throw new Error("Output changed");
        return { capturedBytes:bytes.byteLength, text: bytes.toString("utf8"), sha256: data.sha256, truncated: data.truncated, status: "intact" };
    }
    catch {
        return { capturedBytes:data.capturedBytes, text: null, sha256: data.sha256, truncated: data.truncated, status: "unavailable" };
    }
}
export function getCheckRun(root: string, runId: string): CheckRun {
    const r = readRun(root, runId);
    // No liveness is inferred from silence and no read restarts work.
    const uncertain = ["queued", "running"].includes(r.state) && Date.now() - Date.parse(r.startedAt) > 135000;
    return { ...r, ...(uncertain ? { state: "unknown" as const, reason: "No completion was confirmed within the execution window. This read does not restart the check." } : {}), stdout: output(root, r.stdout), stderr: output(root, r.stderr) };
}
function acquire(root: string, owner: string) {
    const p = prepare(root);
    try {
        mkdirSync(p.guard);
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
            throw operationError("operation_busy", "Another check owns this checkout. An uncertain run is never restarted or its guard stolen.", true);
        throw error;
    }
    writeFileSync(join(p.guard, "owner"), owner, { flag: "wx" });
}
function release(root: string, owner: string) { const p = paths(root); if (readFileSync(join(p.guard, "owner"), "utf8") === owner)
    rmSync(p.guard, { recursive: true }); }
function definition(root: string, bindingId: string, source: string, check: string) {
    const ledger = loadLedger(root), binding = ledger.bindings.find(b => b.id === bindingId), claim = binding && ledger.claims.find(c => c.id === binding.claimId);
    if (!binding || !claim || binding.locator.type !== "command" || !binding.locator.command || Buffer.byteLength(binding.locator.command)>16*1024)
        throw operationError("invalid_input", "Only an existing saved command check can run");
    if (sourceFingerprint(ledger.repoRoot, ledger.config.generatedArtifactPaths) !== source || checkFingerprint(claim, binding) !== check)
        throw operationError("source_conflict", "The source or saved check changed. Refresh before running it.");
    return { ledger, binding };
}
function workerPath() { return join(dirname(fileURLToPath(import.meta.url)), "../cli/check-worker.js"); }
export function startSavedCheck(root: string, input: {
    requestId: string;
    bindingId: string;
    expectedSourceDigest: string;
    expectedCheckDigest: string;
}): CheckRun {
    const { ledger, binding } = definition(root, input.bindingId, input.expectedSourceDigest, input.expectedCheckDigest);
    const runId = randomUUID();
    acquire(root, runId);
    const prior = getCheckEvidence(root,input.bindingId).runs[0];
    const run: StoredRun = { runId, ...(prior ? {previousRunId:prior.runId}:{}), requestId: input.requestId, bindingId: binding.id, state: "queued", command: binding.locator.command!, cwd: realpathSync(ledger.repoRoot), sourceDigest: input.expectedSourceDigest, checkDigest: input.expectedCheckDigest, startedAt: new Date().toISOString() };
    try {
        store(root, run);
        const child = spawn(process.execPath, [workerPath(), ledger.repoRoot, runId], { detached: true, stdio: "ignore" });
        child.on("error", () => { store(root, { ...run, state: "unknown", reason: "Worker could not start; this request will not be repeated." }); });
        child.unref();
        return { runId: run.runId, ...(run.previousRunId?{previousRunId:run.previousRunId}:{}), requestId: run.requestId, bindingId: run.bindingId, state: run.state, command: run.command, cwd: run.cwd, sourceDigest: run.sourceDigest, checkDigest: run.checkDigest, startedAt: run.startedAt };
    }
    catch (error) {
        store(root, { ...run, state: "unknown", reason: "Worker launch could not be confirmed; this request will not be repeated." });
        throw error;
    }
}
/** One worker owns the check guard through command termination and result publication. */
export async function executeSavedRun(root: string, runId: string, operationLockHeld = false): Promise<void> {
    let run = readRun(root, runId);
    let invocationStarted = false;
    if (run.state !== "queued" || readFileSync(join(paths(root).guard, "owner"), "utf8") !== runId)
        throw new Error("Check worker does not own this queued run");
    try {
        const saved = definition(root, run.bindingId, run.sourceDigest, run.checkDigest);
        run = { ...run, state: "running", command: saved.binding.locator.command!, cwd: realpathSync(saved.ledger.repoRoot) };
        store(root, run);
        const started = Date.now();
        invocationStarted = true;
        const result = await new Promise<{
            code: number | null;
            signal: string | null;
            stdout: Buffer;
            stderr: Buffer;
            outTruncated: boolean;
            errTruncated: boolean;
            reason?: string;
        }>(resolve => {
            const buffers = [[] as Buffer[], [] as Buffer[]], sizes = [0, 0], truncated = [false, false];
            const child = spawn(run.command, { cwd: run.cwd, shell: true, detached: process.platform !== "win32", env: process.env, stdio: ["ignore", "pipe", "pipe"] });
            let reason: string | undefined;
            const collect = (index: number, data: Buffer) => { const room = Math.max(0, OUTPUT_LIMIT - sizes[index]); if (data.length > room)
                truncated[index] = true; if (room) {
                const part = data.subarray(0, room);
                buffers[index].push(part);
                sizes[index] += part.length;
            } };
            child.stdout.on("data", (b: Buffer) => collect(0, b));
            child.stderr.on("data", (b: Buffer) => collect(1, b));
            const timeout = setTimeout(() => { reason = "Check exceeded the 120 second limit"; try {
                if (process.platform !== "win32" && child.pid)
                    process.kill(-child.pid, "SIGKILL");
                else
                    child.kill("SIGKILL");
            }
            catch { } }, 120000);
            child.on("error", () => { reason = "Command could not start"; });
            child.on("close", (code, signal) => { clearTimeout(timeout); if (process.platform !== "win32" && child.pid) {
                try {
                    process.kill(-child.pid, "SIGKILL");
                }
                catch { }
            } resolve({ code, signal, stdout: Buffer.concat(buffers[0]), stderr: Buffer.concat(buffers[1]), outTruncated: truncated[0], errTruncated: truncated[1], reason }); });
        });
        const p = paths(root);
        const artifact = (name: string, bytes: Buffer, truncated: boolean) => { const path = join(p.base, `${runId}-${name}.txt`); writeFileSync(path, bytes, { flag: "wx" }); return { path: relative(p.ledger.repoRoot, path), capturedBytes:bytes.byteLength, sha256: contentHash(bytes), truncated }; };
        const stdout = artifact("stdout", result.stdout, result.outTruncated), stderr = artifact("stderr", result.stderr, result.errTruncated);
        const current = loadLedger(root), binding = current.bindings.find(b => b.id === run.bindingId), claim = binding && current.claims.find(c => c.id === binding.claimId);
        const matches = sourceFingerprint(current.repoRoot, current.config.generatedArtifactPaths) === run.sourceDigest && binding && claim && checkFingerprint(claim, binding) === run.checkDigest;
        const outcome: ResultsRow["outcome"] = matches ? (result.code === 0 && !result.reason ? "pass" : "fail") : "missing";
        const completed: StoredRun = { ...run, state: "finished", finishedAt: new Date().toISOString(), outcome, exitCode: result.code, signal: result.signal, durationMs: Date.now() - started, stdout, stderr, reason: matches ? (result.reason ?? `exit ${result.code}`) : "Inputs changed during execution; rerun against current source" };
        const finalize = () => {
            const ledger = loadLedger(root);
            const row: ResultsRow = { key: `command:${run.bindingId}`, runId, sourceDigest: run.sourceDigest, checkDigest: run.checkDigest, outcome, detail: completed.reason, durationMs: completed.durationMs, artifacts: [{ path: stdout.path, sha256: stdout.sha256, required: true }, { path: stderr.path, sha256: stderr.sha256, required: true }] };
            const receipt = { schemaVersion: 1 as const, producedAt: completed.finishedAt!, producer: { name: "spec-ledger check", version: "0.1.0" }, rows: [row] };
            const destinations = paths(root);
            writeJson(confinedWritePath(ledger.repoRoot,join(destinations.runReceipts, `${runId}.json`)), receipt);
            writeJson(destinations.results, { ...receipt, rows: [...(ledger.results?.rows ?? []).filter(r => r.key !== row.key), row] });
            store(root, completed);
            writeJson(paths(root).report, verifyLedger(loadLedger(root)));
        };
        if (operationLockHeld)
            finalize();
        else {
            // Brief contention with other metadata writes does not drop a completed check.
            for (let attempt = 0;; attempt++) {
                try {
                    runMutation({ root, requestId: `check-finalize-${runId}`, operation: "finish_saved_check", input: { runId }, effect: finalize });
                    break;
                }
                catch (error) {
                    if (attempt < 100 && (error as {
                        code?: string;
                    }).code === "operation_busy") {
                        await new Promise(r => setTimeout(r, 50));
                        continue;
                    }
                    throw error;
                }
            }
        }
        release(root, runId);
    }
    catch (error) {
        if (!invocationStarted) {
            store(root, {...run, state:"finished", outcome:"missing", finishedAt:new Date().toISOString(), reason:"Check did not start: " + (error instanceof Error ? error.message : "inputs unavailable")});
            release(root,runId);
            return;
        }
        store(root, { ...run, state: "unknown", reason: error instanceof Error ? error.message : "Check execution could not be confirmed" });
        throw error;
    }
}
/** Synchronous CLI compatibility; the same worker/guard/output path performs each command. */
export function runAllSavedChecks(root: string, operationLockHeld = false) {
    validateCheckStorage(root);
    const execute = () => {
        const ledger = loadLedger(root);
        for (const binding of ledger.bindings.filter(b => b.locator.type === "command" && b.locator.command)) {
            const current = loadLedger(root), claim = current.claims.find(c => c.id === binding.claimId), source = sourceFingerprint(current.repoRoot, current.config.generatedArtifactPaths);
            if (!claim || !source)
                throw new Error("Cannot observe check inputs");
            const runId = randomUUID();
            acquire(root, runId);
            store(root, { runId, requestId: `batch-${runId}`, bindingId: binding.id, state: "queued", command: binding.locator.command!, cwd: realpathSync(current.repoRoot), sourceDigest: source, checkDigest: checkFingerprint(claim, binding), startedAt: new Date().toISOString() });
            const result = spawnSync(process.execPath, [workerPath(), current.repoRoot, runId, "operation-lock-held"], { encoding: "utf8", timeout: 135000, maxBuffer: 64 * 1024 });
            if (result.status !== 0)
                throw new Error("Check worker stopped without confirmed completion; inspect its run before retrying");
        }
        const current = loadLedger(root), report = verifyLedger(current);
        writeJson(paths(root).report, report);
        return report;
    };
    return operationLockHeld ? execute() : runMutation({ root, requestId: `check-batch-${randomUUID()}`, operation: "check_batch", input: {}, effect: execute });
}
export function getCheckEvidence(root: string, bindingId: string) {
    const ledger = loadLedger(root), binding = ledger.bindings.find(b => b.id === bindingId), claim = binding && ledger.claims.find(c => c.id === binding.claimId);
    if (!binding || !claim)
        throw new Error("Check not found");
    const beforeSource=sourceFingerprint(ledger.repoRoot,ledger.config.generatedArtifactPaths);
    let source: {
        status: "available" | "unavailable" | "not-recorded";
        text: string | null;
        path: string | null;
        sha256: string | null;
        reason?: string;
    } = { status: "not-recorded", text: null, path: null, sha256: null };
    if (binding.test?.source) {
        source = { status: "unavailable", text: null, path: binding.test.source.path, sha256: null, reason: "Source is missing, outside this checkout or exceeds 64 KiB" };
        try {
            const path = localArtifactPath(ledger.repoRoot, binding.test.source.path);
            if (lstatSync(path).size > 64 * 1024)
                throw new Error("large");
            const bytes = readFileSync(path);
            source = { status: "available", text: bytes.toString("utf8"), path: binding.test.source.path, sha256: contentHash(bytes) };
        }
        catch { }
    }
    const p = paths(root), runs: CheckRun[] = [];
    const candidates = existsSync(p.base) ? readdirSync(p.base).filter(n => RUN_ID.test(n.replace(/\.json$/, "")) && n.endsWith(".json")).map(name => { try { return {name,time:statSync(join(p.base,name)).mtimeMs}; } catch { return {name,time:0}; } }).sort((a, b) => b.time - a.time) : [];
    for (const { name } of candidates.slice(0, 100)) {
        try {
            const run = readRun(root, name.slice(0, -5));
            if (run.bindingId === bindingId)
                runs.push({ ...run, stdout: undefined, stderr: undefined });
        }
        catch { }
    }
    runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const verdict = verifyLedger(ledger).claims.find(c => c.claimId === claim.id)?.checks?.find(c => c.bindingId === bindingId);
    const afterSource=sourceFingerprint(ledger.repoRoot,ledger.config.generatedArtifactPaths);
    if (beforeSource!==afterSource) source={...source,status:"unavailable",text:null,reason:"Source changed while reading; refresh this check"};
    return { bindingId, claimId: claim.id, kind: binding.kind, test: binding.test, command: binding.locator.type === "command" ? binding.locator.command ?? null : null, cwd: realpathSync(ledger.repoRoot), sourceDigest: beforeSource===afterSource?afterSource:null, checkDigest: checkFingerprint(claim, binding), currentOutcome: verdict?.outcome ?? "missing", source, runs: runs.slice(0, 10).map(r => getCheckRun(root, r.runId)) };
}
export type CheckEvidence = ReturnType<typeof getCheckEvidence>;
