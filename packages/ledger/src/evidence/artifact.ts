import { closeSync, fstatSync, openSync, readSync } from "node:fs"
import { localArtifactPath } from "./fingerprint.js"

/** Bounded reads of regular files after realpath confinement; never follows a remote URL. */
export function readBounded(root: string, path: string, limit: number): Buffer {
  const fd = openSync(localArtifactPath(root, path), "r")
  try {
    if (fstatSync(fd).size > limit) throw new Error("Artifact exceeds display limit")
    const bytes = Buffer.alloc(limit + 1)
    let size = 0
    while (size <= limit) {
      const n = readSync(fd, bytes, size, bytes.length - size, null)
      if (!n) return bytes.subarray(0, size)
      size += n
    }
    throw new Error("Artifact exceeds display limit")
  } finally { closeSync(fd) }
}

