import { spawn } from "node:child_process"
import assert from "node:assert/strict"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { initLedger } from "../cli/init.js"
import { OperationError } from "./errors.js"
import { runMutation } from "./receipts.js"

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sl-operation-receipts-break-"))
  initLedger(root, "operation receipts breaker")
  return root
}

function operationErrorCode(fn: () => unknown): OperationError {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof OperationError, String(error))
    return error
  }
  assert.fail("operation unexpectedly succeeded")
}

type ChildResult =
  | { ok: true; result: { requestId: string } }
  | { ok: false; code: string; retryable: boolean }

function childMutation(args: {
  root: string
  marker: string
  requestId: string
  value: string
  hold?: { entered: string; release: string }
}): Promise<ChildResult> {
  const moduleUrl = new URL("./receipts.js", import.meta.url).href
  const script = `
    import { appendFileSync, existsSync, writeFileSync } from "node:fs";
    import { runMutation } from ${JSON.stringify(moduleUrl)};
    const [root, marker, requestId, value, entered, release] = process.argv.slice(1);
    try {
      const result = runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value },
        effect: () => {
          if (entered) {
            writeFileSync(entered, "effect owns lock");
            const deadline = Date.now() + 10000;
            while (!existsSync(release)) {
              if (Date.now() > deadline) throw new Error("parent never released holder");
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
            }
          }
          appendFileSync(marker, requestId + ":" + value + "\\n");
          return { requestId };
        },
      });
      console.log(JSON.stringify({ ok: true, result }));
    } catch (error) {
      console.log(JSON.stringify({ ok: false, code: error.code ?? "unknown", retryable: error.retryable ?? false }));
    }
  `
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script,
      args.root, args.marker, args.requestId, args.value,
      args.hold?.entered ?? "", args.hold?.release ?? ""], {
      cwd: args.root,
      env: process.env,
    })
    let output = ""
    child.stdout.on("data", (data) => { output += data })
    child.stderr.on("data", (data) => { output += data })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(output || `child exited ${code}`))
      const line = output.trim().split("\n").at(-1)
      if (!line) return reject(new Error("child produced no result"))
      resolve(JSON.parse(line) as ChildResult)
    })
  })
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10000
  while (!existsSync(path)) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe("operation receipt adversarial cases", () => {
  it("runs one effect for concurrent identical requests and replays its result", async () => {
    const root = fixture()
    try {
      const marker = join(root, "effects.log")
      const entered = join(root, "holder-entered")
      const release = join(root, "release-holder")
      const requestId = "same-request-0001"
      const holder = childMutation({ root, marker, requestId, value: "same", hold: { entered, release } })
      await waitForFile(entered)
      const contender = await childMutation({ root, marker, requestId, value: "same" })
      assert.deepEqual(contender, { ok: false, code: "execution_unknown", retryable: false })
      writeFileSync(release, "release")
      assert.deepEqual(await holder, { ok: true, result: { requestId } })
      assert.equal(readFileSync(marker, "utf8"), `${requestId}:same\n`)

      const replay = runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "same" },
        effect: () => {
          appendFileSync(marker, "repeated\n")
          return { requestId: "wrong" }
        },
      })
      assert.deepEqual(replay, { requestId })
      assert.equal(readFileSync(marker, "utf8"), `${requestId}:same\n`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("serializes different request IDs and rejects reuse with changed input", async () => {
    const root = fixture()
    try {
      const marker = join(root, "effects.log")
      const entered = join(root, "holder-entered")
      const release = join(root, "release-holder")
      const firstId = "different-request-0001"
      const secondId = "different-request-0002"
      const holder = childMutation({ root, marker, requestId: firstId, value: "first", hold: { entered, release } })
      await waitForFile(entered)
      assert.deepEqual(await childMutation({ root, marker, requestId: secondId, value: "second" }),
        { ok: false, code: "operation_busy", retryable: true })
      assert.equal(existsSync(marker), false)
      writeFileSync(release, "release")
      assert.deepEqual(await holder, { ok: true, result: { requestId: firstId } })

      runMutation({
        root,
        requestId: secondId,
        operation: "record_progress",
        input: { requestId: secondId, value: "second" },
        effect: () => {
          appendFileSync(marker, `${secondId}:second\n`)
          return { requestId: secondId }
        },
      })
      assert.equal(readFileSync(marker, "utf8").trim().split("\n").sort().join("\n"),
        [`${firstId}:first`, `${secondId}:second`].sort().join("\n"))

      const conflict = operationErrorCode(() => runMutation({
        root,
        requestId: firstId,
        operation: "record_progress",
        input: { requestId: firstId, value: "changed" },
        effect: () => ({ requestId: firstId }),
      }))
      assert.equal(conflict.code, "idempotency_conflict")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("never treats a corrupt finished receipt as a successful replay", () => {
    const root = fixture()
    try {
      const requestId = "corrupt-receipt-0001"
      let effects = 0
      runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "original" },
        effect: () => { effects += 1; return { saved: true } },
      })
      writeFileSync(join(root, ".spec-ledger/operations", `${requestId}.finished.json`), "{}\n")
      const error = operationErrorCode(() => runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "original" },
        effect: () => { effects += 1; return { saved: false } },
      }))
      assert.equal(error.code, "execution_unknown")
      assert.equal(effects, 1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("does not repeat an effect when only its started receipt remains", () => {
    const root = fixture()
    try {
      const requestId = "started-only-req-0001"
      const marker = join(root, "effects.log")
      runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "once" },
        effect: () => { appendFileSync(marker, "effect\n"); return { saved: true } },
      })
      unlinkSync(join(root, ".spec-ledger/operations", `${requestId}.finished.json`))
      const error = operationErrorCode(() => runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "once" },
        effect: () => { appendFileSync(marker, "repeated\n"); return { saved: false } },
      }))
      assert.equal(error.code, "execution_unknown")
      assert.equal(readFileSync(marker, "utf8"), "effect\n")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("reports unknown when completion publication fails after the effect and never reruns it", () => {
    const root = fixture()
    try {
      const requestId = "finish-publish-fail-0001"
      const operations = join(root, ".spec-ledger/operations")
      const finished = join(operations, `${requestId}.finished.json`)
      let effects = 0
      const first = operationErrorCode(() => runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "effect-completed" },
        effect: () => {
          effects += 1
          writeFileSync(finished, "{}\n")
          return { saved: true }
        },
      }))
      assert.equal(first.code, "execution_unknown")
      assert.equal(effects, 1)

      const retry = operationErrorCode(() => runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "effect-completed" },
        effect: () => { effects += 1; return { saved: false } },
      }))
      assert.equal(retry.code, "execution_unknown")
      assert.equal(effects, 1)
      assert.equal(readFileSync(finished, "utf8"), "{}\n")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("reports an unknown lock as busy without stealing it or running effects", () => {
    const root = fixture()
    try {
      const operations = join(root, ".spec-ledger/operations")
      const lock = join(operations, ".lock")
      const marker = join(root, "effects.log")
      mkdirSync(lock, { recursive: true })
      writeFileSync(join(lock, "unknown-owner"), "untrusted")
      const requestId = "unknown-lock-req-0001"
      const error = operationErrorCode(() => runMutation({
        root,
        requestId,
        operation: "record_progress",
        input: { requestId, value: "blocked" },
        effect: () => { appendFileSync(marker, "effect\n"); return { saved: true } },
      }))
      assert.equal(error.code, "operation_busy")
      assert.equal(error.retryable, true)
      assert.equal(existsSync(lock), true)
      assert.equal(readdirSync(lock).includes("unknown-owner"), true)
      assert.equal(existsSync(marker), false)
      assert.equal(existsSync(join(operations, `${requestId}.started.json`)), false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
