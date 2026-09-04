#!/usr/bin/env node
/**
 * Rewrite workspace: / file: dependency protocols to concrete versions
 * so `npm pack` (not only `pnpm pack`) ships installable package.json.
 * Restores the original package.json after packing via a sibling .bak.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const pkgDir = process.cwd()
const pkgPath = join(pkgDir, "package.json")
const bakPath = join(pkgDir, "package.json.prepack-bak")
const mode = process.argv[2] ?? "apply"

if (mode === "restore") {
  if (existsSync(bakPath)) {
    copyFileSync(bakPath, pkgPath)
    // best-effort cleanup
    try {
      const { unlinkSync } = await import("node:fs")
      unlinkSync(bakPath)
    } catch {
      /* ignore */
    }
  }
  process.exit(0)
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
copyFileSync(pkgPath, bakPath)

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const workspacePkgs = {
  "@nessalabs/spec-ledger": join(root, "packages/ledger/package.json"),
  "@nessalabs/spec-ledger-client": join(root, "packages/client/package.json"),
  "@nessalabs/spec-ledger-server": join(root, "packages/server/package.json"),
}

function rewrite(deps) {
  if (!deps) return
  for (const [name, ver] of Object.entries(deps)) {
    if (!String(ver).startsWith("workspace:") && !String(ver).startsWith("file:")) {
      continue
    }
    const loc = workspacePkgs[name]
    if (!loc || !existsSync(loc)) {
      throw new Error(`cannot resolve ${name} for pack rewrite (${ver})`)
    }
    const v = JSON.parse(readFileSync(loc, "utf8")).version
    if (!v) throw new Error(`missing version for ${name}`)
    deps[name] = v
  }
}

rewrite(pkg.dependencies)
rewrite(pkg.optionalDependencies)
rewrite(pkg.peerDependencies)
rewrite(pkg.devDependencies)

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
console.log(`rewrote workspace/file deps in ${pkg.name} for pack`)
