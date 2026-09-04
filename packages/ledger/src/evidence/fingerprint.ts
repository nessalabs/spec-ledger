import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"
import { sha256Stable } from "../fs/load.js"
import type { Claim, EvidenceBinding } from "../types.js"

export function contentHash(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex")
}

/** Artifact references are repository-relative and may never escape via a symlink. */
export function localArtifactPath(root: string, path: string): string {
  if (!path || isAbsolute(path) || path.split(/[\\/]/).includes("..")) throw new Error("artifact path must stay in the checkout")
  const base = realpathSync(root)
  const target = realpathSync(resolve(base, path))
  const rel = relative(base, target)
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) throw new Error("artifact escapes checkout")
  if (!lstatSync(target).isFile()) throw new Error("artifact must be a file")
  return target
}

export function validateGeneratedArtifacts(paths: string[]): void {
  for (const path of paths) {
    if (!/^docs\/workstreams\/[^/]+\/evidence\/[^/]+\/[^\\]+$/.test(path) || path.split("/").includes("..") || /\.(?:[cm]?[jt]sx?|py|rs|go|sh|css|html)$/i.test(path)) {
      throw new Error(`generated artifact must name a non-source file in a workstream evidence run: ${path}`)
    }
  }
}

/** Hash file contents, not HEAD or git status. Null means observation was unavailable. */
export function sourceFingerprint(root: string, generatedArtifacts: string[] = []): string | null {
  try {
    validateGeneratedArtifacts(generatedArtifacts)
    const excluded = new Set(generatedArtifacts)
    const files = new Set<string>()
    const git = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024})
    if (git.status === 0) {
      for (const path of git.stdout.split("\0").filter(Boolean)) files.add(path)
    } else {
      const walk = (dir: string) => {
        for (const entry of readdirSync(join(root, dir), {withFileTypes:true})) {
          if ([".git", ".spec-ledger", "node_modules"].includes(entry.name)) continue
          const path = dir ? `${dir}/${entry.name}` : entry.name
          if (entry.isDirectory()) walk(path)
          else files.add(path)
        }
      }
      walk("")
    }
    const rows = [...files].filter(p => p !== ".spec-ledger" && !p.startsWith(".spec-ledger/") && !excluded.has(p)).sort().map(path => {
      try {
        const stat = lstatSync(join(root,path))
        if (stat.isSymbolicLink()) {
          const target = localArtifactPath(root,path)
          return {path, link:readlinkSync(join(root,path)), hash:contentHash(readFileSync(target))}
        }
        if (!stat.isFile()) throw new Error(`unsupported source entry ${path}`)
        return {path, executable: Boolean(stat.mode & 0o111), hash:contentHash(readFileSync(join(root,path)))}
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    })
    return sha256Stable({version:1, generatedArtifacts:[...excluded].sort(), files:rows.filter(row=>row !== null)})
  } catch { return null }
}

export function checkFingerprint(claim: Claim, binding: EvidenceBinding): string {
  return sha256Stable({claim, binding})
}
