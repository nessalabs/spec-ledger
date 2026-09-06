import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"
import * as z from "zod/v4"
import { findRepoRoot, sha256Stable } from "../fs/load.js"
import { goalIdSchema } from "./model.js"

/** Fixed history namespace; refuse symlinks before either readers or writers follow them. */
export function optimizationDir(root: string): string {
  const ledger = join(findRepoRoot(root), ".spec-ledger")
  assertRegularPath(ledger, "directory")
  const dir = join(ledger, "optimization")
  assertRegularPath(dir, "directory")
  return dir
}
function assertRegularPath(path: string, kind: "directory" | "file") {
  try {
    const info = lstatSync(path)
    if (info.isSymbolicLink() || (kind === "directory" ? !info.isDirectory() : !info.isFile())) throw new Error(`unsafe optimization storage: ${path}`)
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
}
export function recordPath(root: string, goalId: string, collection: "goal" | "experiments" | "results" | "conclusion", id?: string): string {
  goalIdSchema.parse(goalId)
  const dir = join(optimizationDir(root), goalId)
  assertRegularPath(dir, "directory")
  if (collection === "goal" || collection === "conclusion") {
    const path = join(dir, `${collection}.json`); assertRegularPath(path, "file"); return path
  }
  if (!id || !/^X-[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)) throw new Error("invalid experiment id")
  const subdir = join(dir, collection); assertRegularPath(subdir, "directory")
  const path = join(subdir, `${id}.json`); assertRegularPath(path, "file"); return path
}
export function readRecord<T>(path: string, schema: z.ZodType<T>): T | null {
  assertRegularPath(path, "file")
  return existsSync(path) ? schema.parse(JSON.parse(readFileSync(path, "utf8"))) : null
}
export function goalIds(root: string): string[] {
  const dir = optimizationDir(root)
  return existsSync(dir) ? readdirSync(dir).filter(id => goalIdSchema.safeParse(id).success)
    .filter(id => existsSync(recordPath(root, id, "goal"))).sort() : []
}
export function recordIds(root: string, goalId: string, collection: "experiments" | "results"): string[] {
  const dir = dirname(recordPath(root, goalId, collection, "X-probe"))
  return existsSync(dir) ? readdirSync(dir).filter(n => /^X-[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.json$/.test(n)).map(n => n.slice(0, -5)).sort() : []
}

/** The application mutation lock serializes validation + publication. Readers see complete bytes. */
export function publishRecord<T>(path: string, value: T): T {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  const fd = openSync(temporary, "wx")
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fsyncSync(fd) }
  finally { closeSync(fd) }
  try { linkSync(temporary, path) }
  finally { unlinkSync(temporary) }
  return value
}
export function assertSameInput<T extends object>(existing: T | null, input: object): T | null {
  if (!existing) return null
  const { schemaVersion: _v, createdAt: _at, sourceDigest: _source, revisionDigest: _revision, sequence: _sequence, ...payload } = existing as Record<string, unknown>
  if (sha256Stable(payload) !== sha256Stable(input)) throw new Error("record id already has different content")
  return existing
}

/** New optimization operations must not follow a redirected shared receipt path. */
export function assertOptimizationReceiptStorage(root: string, requestId: string): void {
  optimizationDir(root)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{15,79}$/.test(requestId)) throw new Error("invalid request id")
  const dir = join(findRepoRoot(root), ".spec-ledger", "operations")
  assertRegularPath(dir, "directory")
  assertRegularPath(join(dir, `${requestId}.started.json`), "file")
  assertRegularPath(join(dir, `${requestId}.finished.json`), "file")
}
