import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import type { ActivityEvent } from "./types.js"

/** One collector per host session. A dropped observation must never crash the host. */
export function createActivityEmitter(options: { root: string; maxBufferedBytes?: number }) {
  const limit = options.maxBufferedBytes ?? 64 * 1024
  if (!Number.isSafeInteger(limit) || limit < 1024 || limit > 64 * 1024) {
    throw new Error("activity buffer limit must be between 1024 and 65536 bytes")
  }
  const collector = fileURLToPath(new URL("../cli/activity-collector.js", import.meta.url))
  const child = spawn(process.execPath, [collector, "--root", options.root], { stdio: ["pipe", "ignore", "ignore"] })
  let closed = false
  const stopSending = () => { closed = true }
  child.on("error", stopSending)
  child.on("exit", stopSending)
  child.stdin.on("error", stopSending)
  return {
    pid: child.pid,
    emit(registrationId: string, event: ActivityEvent): boolean {
      if (closed || !child.stdin.writable || child.stdin.writableNeedDrain) return false
      try {
        const line = Buffer.from(`${JSON.stringify({ registrationId, event })}\n`)
        if (line.byteLength > 16 * 1024 || child.stdin.writableLength + line.byteLength > limit) return false
        child.stdin.write(line)
        return true
      } catch {
        return false
      }
    },
    close(): void {
      if (closed) return
      closed = true
      child.stdin.end()
    },
  }
}
