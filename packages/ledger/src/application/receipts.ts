import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { ledgerRoot, findRepoRoot, sha256Stable } from "../fs/load.js"
import {
  normalizeOperationError,
  OperationError,
  operationError,
  type OperationErrorShape,
} from "./errors.js"

export const OPERATION_REQUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{15,79}$/

export interface OperationStartedReceipt {
  schemaVersion: 1
  requestId: string
  operation: string
  inputDigest: string
  startedAt: string
}

export interface OperationFinishedReceipt {
  schemaVersion: 1
  requestId: string
  operation: string
  inputDigest: string
  finishedAt: string
  outcome: "succeeded" | "failed"
  result?: unknown
  error?: OperationErrorShape
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function writeImmutable(path: string, value: unknown): void {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  const descriptor = openSync(temporary, "wx")
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8")
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  try {
    // A same-directory hard link publishes complete bytes without replacing an
    // immutable receipt that another process may have created.
    linkSync(temporary, path)
  } finally {
    unlinkSync(temporary)
  }
}

function validateStarted(value: unknown): OperationStartedReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw operationError("execution_unknown", "started operation receipt is malformed")
  }
  const receipt = value as Partial<OperationStartedReceipt>
  if (receipt.schemaVersion !== 1 || typeof receipt.requestId !== "string" ||
      typeof receipt.operation !== "string" || !/^[a-f0-9]{64}$/.test(receipt.inputDigest ?? "") ||
      typeof receipt.startedAt !== "string") {
    throw operationError("execution_unknown", "started operation receipt is malformed")
  }
  return receipt as OperationStartedReceipt
}

function validateFinished(value: unknown): OperationFinishedReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw operationError("execution_unknown", "finished operation receipt is malformed")
  }
  const receipt = value as Partial<OperationFinishedReceipt>
  const validOutcome = receipt.outcome === "succeeded" || receipt.outcome === "failed"
  const validPayload = receipt.outcome === "succeeded"
    ? Object.prototype.hasOwnProperty.call(receipt, "result")
    : Boolean(receipt.error && typeof receipt.error.code === "string" && typeof receipt.error.message === "string" && typeof receipt.error.retryable === "boolean")
  if (receipt.schemaVersion !== 1 || typeof receipt.requestId !== "string" ||
      typeof receipt.operation !== "string" || !/^[a-f0-9]{64}$/.test(receipt.inputDigest ?? "") ||
      typeof receipt.finishedAt !== "string" || !validOutcome || !validPayload) {
    throw operationError("execution_unknown", "finished operation receipt is malformed")
  }
  return receipt as OperationFinishedReceipt
}

function assertRequest(requestId: string, operation: string, input: unknown): string {
  if (!OPERATION_REQUEST_ID.test(requestId)) {
    throw operationError(
      "invalid_input",
      "requestId must be 16-80 letters, numbers, underscores, or hyphens",
    )
  }
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(operation)) {
    throw operationError("invalid_input", "invalid operation name")
  }
  const bytes = Buffer.byteLength(JSON.stringify(input), "utf8")
  if (bytes > 64 * 1024) {
    throw operationError("invalid_input", "operation input exceeds 64 KiB")
  }
  return sha256Stable({ operation, input })
}

function replayFinished<T>(receipt: OperationFinishedReceipt): T {
  if (receipt.outcome === "failed" && receipt.error) {
    throw new OperationError(receipt.error)
  }
  return receipt.result as T
}

/**
 * Serialize cooperative CLI/MCP mutations and make their retry identity durable.
 * An unfinished request is never repeated because its effect may already exist.
 */
export function runMutation<T>(args: {
  root: string
  requestId: string
  operation: string
  input: unknown
  effect: () => T
}): T {
  const inputDigest = assertRequest(args.requestId, args.operation, args.input)
  const root = findRepoRoot(args.root)
  const operationsDir = join(ledgerRoot(root), "operations")
  const startedPath = join(operationsDir, `${args.requestId}.started.json`)
  const finishedPath = join(operationsDir, `${args.requestId}.finished.json`)
  mkdirSync(operationsDir, { recursive: true })

  if (existsSync(startedPath)) {
    const started = validateStarted(readJson<unknown>(startedPath))
    if (started.operation !== args.operation || started.inputDigest !== inputDigest) {
      throw operationError(
        "idempotency_conflict",
        "requestId already belongs to a different operation input",
      )
    }
    if (existsSync(finishedPath)) {
      return replayFinished<T>(validateFinished(readJson<unknown>(finishedPath)))
    }
    throw operationError(
      "execution_unknown",
      "request started without a completion receipt; its effect will not be repeated",
      false,
      { requestId: args.requestId, operation: args.operation },
    )
  }

  const lockDir = join(operationsDir, ".lock")
  try {
    mkdirSync(lockDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw operationError(
        "operation_busy",
        "another ledger mutation owns the operation lock",
        true,
      )
    }
    throw error
  }

  try {
    // Recheck after acquiring the cross-process lock.
    if (existsSync(startedPath)) {
      const started = validateStarted(readJson<unknown>(startedPath))
      if (started.operation !== args.operation || started.inputDigest !== inputDigest) {
        throw operationError(
          "idempotency_conflict",
          "requestId already belongs to a different operation input",
        )
      }
      if (existsSync(finishedPath)) {
        return replayFinished<T>(validateFinished(readJson<unknown>(finishedPath)))
      }
      throw operationError(
        "execution_unknown",
        "request started without a completion receipt; its effect will not be repeated",
      )
    }

    const started: OperationStartedReceipt = {
      schemaVersion: 1,
      requestId: args.requestId,
      operation: args.operation,
      inputDigest,
      startedAt: new Date().toISOString(),
    }
    writeImmutable(startedPath, started)

    let result: T
    try {
      result = args.effect()
    } catch (error) {
      const normalized = normalizeOperationError(error)
      const finished: OperationFinishedReceipt = {
        schemaVersion: 1,
        requestId: args.requestId,
        operation: args.operation,
        inputDigest,
        finishedAt: new Date().toISOString(),
        outcome: "failed",
        error: normalized.toJSON(),
      }
      try {
        writeImmutable(finishedPath, finished)
      } catch {
        throw operationError(
          "execution_unknown",
          "operation failed but its completion receipt could not be persisted",
          false,
          { requestId: args.requestId, operation: args.operation },
        )
      }
      throw normalized
    }

    try {
      const finished: OperationFinishedReceipt = {
        schemaVersion: 1,
        requestId: args.requestId,
        operation: args.operation,
        inputDigest,
        finishedAt: new Date().toISOString(),
        outcome: "succeeded",
        result,
      }
      writeImmutable(finishedPath, finished)
      return result
    } catch {
      throw operationError(
        "execution_unknown",
        "operation effect completed but its completion receipt could not be persisted",
        false,
        { requestId: args.requestId, operation: args.operation },
      )
    }
  } finally {
    rmSync(lockDir, { recursive: true, force: true })
  }
}
