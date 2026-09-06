import { randomUUID, createHash } from "node:crypto"
import { mkdirSync, writeFileSync, linkSync, unlinkSync } from "node:fs"
import { dirname } from "node:path"

/** Entity IDs are opaque UUIDs. Titles are display copy; neither ordering nor ownership is encoded here. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export function isEntityId(value: unknown): value is string { return typeof value === "string" && UUID_PATTERN.test(value) }
export function assertEntityId(value: unknown, label = "entity id"): asserts value is string {
  if (!isEntityId(value)) throw new Error(`Invalid ${label}: expected a UUID. Create the record using Spec Ledger and use its returned id.`)
}
export function createEntityId(): string { return randomUUID() }
/** Creation never replaces another entity, including an improbable UUID collision. */
export function publishEntity(path: string, value: { id: string }): void {
  assertEntityId(value.id)
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
  try { linkSync(temporary, path) } finally { unlinkSync(temporary) }
}

/** Stable identity for a tool-owned template or idempotent local bridge; callers supply correlation, not entity IDs. */
export function derivedEntityId(namespace: string, key: string): string {
  const bytes = createHash("sha256").update(namespace).update("\0").update(key).digest().subarray(0,16)
  bytes[6] = (bytes[6]! & 15) | 0x80
  bytes[8] = (bytes[8]! & 63) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
