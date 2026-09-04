#!/usr/bin/env node
/**
 * Build a Spec Ledger UI Release asset (tarball) with zero file:/workspace:
 * dependency protocols in the shipped tree.
 *
 * Packs local @nessalabs/spec-ledger{,-client}, sibling @nessalabs/ui +
 * @nessalabs/agent-stream, stages packages/ui against those tarballs (not the
 * registry), rewrites protocols to versions, optionally runs next build.
 *
 * Usage:
 *   node scripts/pack-ui-release.mjs [--out dist-ui-release] [--skip-build]
 *
 * Env:
 *   NESSA_UI_ROOT — override path to nessa_ui monorepo (default: ../nessa_ui)
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const skipBuild = args.includes("--skip-build")
const outIdx = args.indexOf("--out")
const outDir = resolve(
  root,
  outIdx >= 0 ? args[outIdx + 1] : "dist-ui-release",
)
const nessaUiRoot = resolve(
  process.env.NESSA_UI_ROOT ?? join(root, "..", "nessa_ui"),
)

function run(cmd, argv, cwd) {
  const r = spawnSync(cmd, argv, { cwd, encoding: "utf8", env: process.env })
  if (r.status !== 0) {
    throw new Error(
      `${cmd} ${argv.join(" ")} failed in ${cwd}:\n${r.stderr || r.stdout}`,
    )
  }
  return r.stdout
}

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    if (name === ".git") continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, visit)
    else visit(p)
  }
}

function npmPack(pkgDir, destDir, { ignoreScripts = false } = {}) {
  mkdirSync(destDir, { recursive: true })
  const argv = ["pack", "--pack-destination", destDir]
  if (ignoreScripts) argv.push("--ignore-scripts")
  const out = run("npm", argv, pkgDir)
  const lines = out
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const name = lines[lines.length - 1]
  const tgz = join(destDir, name)
  if (!existsSync(tgz)) {
    throw new Error(`npm pack did not produce ${tgz}\n${out}`)
  }
  return tgz
}

function rewriteProtocols(appRoot) {
  const bad = []
  walk(appRoot, (p) => {
    if (!p.endsWith("package.json")) return
    const raw = readFileSync(p, "utf8")
    if (!raw.includes("workspace:") && !/"file:/.test(raw)) return
    let pkg
    try {
      pkg = JSON.parse(raw)
    } catch {
      return
    }
    let changed = false
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      const deps = pkg[field]
      if (!deps) continue
      for (const [name, ver] of Object.entries(deps)) {
        if (
          !String(ver).startsWith("workspace:") &&
          !String(ver).startsWith("file:")
        ) {
          continue
        }
        const candidates = [
          join(dirname(p), "node_modules", ...name.split("/"), "package.json"),
          join(appRoot, "node_modules", ...name.split("/"), "package.json"),
        ]
        let resolved = null
        for (const c of candidates) {
          if (existsSync(c)) {
            resolved = JSON.parse(readFileSync(c, "utf8")).version
            break
          }
        }
        if (!resolved) {
          bad.push(`${p}: ${name}=${ver}`)
          continue
        }
        deps[name] = resolved
        changed = true
      }
    }
    if (changed) writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n")
  })
  if (bad.length) {
    throw new Error(`could not rewrite deps:\n${bad.join("\n")}`)
  }
}

function assertNoFileOrWorkspace(dir) {
  const bad = []
  walk(dir, (p) => {
    if (!p.endsWith("package.json")) return
    const txt = readFileSync(p, "utf8")
    if (txt.includes("workspace:") || /"file:/.test(txt)) bad.push(p)
  })
  if (bad.length) {
    throw new Error(
      `file:/workspace: protocols found in:\n${bad.slice(0, 20).join("\n")}`,
    )
  }
}

const uiKit = join(nessaUiRoot, "packages/react")
const agentStream = join(nessaUiRoot, "packages/agent-stream")
for (const [label, p] of [
  ["@nessalabs/ui", uiKit],
  ["@nessalabs/agent-stream", agentStream],
]) {
  if (!existsSync(join(p, "package.json"))) {
    throw new Error(
      `missing ${label} at ${p} (set NESSA_UI_ROOT to the nessa_ui monorepo)`,
    )
  }
}

const stage = mkdtempSync(join(tmpdir(), "sl-ui-release-"))
const packs = join(stage, "packs")
const app = join(stage, "spec-ledger-ui")
mkdirSync(packs, { recursive: true })

console.log("packing @nessalabs/spec-ledger…")
const ledgerTgz = npmPack(join(root, "packages/ledger"), join(packs, "ledger"))
console.log("packing @nessalabs/spec-ledger-client…")
const clientTgz = npmPack(join(root, "packages/client"), join(packs, "client"))
// Sibling UI packages: require existing dist/; skip prepack (pnpm) so npm pack works.
for (const [label, dir] of [
  ["@nessalabs/agent-stream", agentStream],
  ["@nessalabs/ui", uiKit],
]) {
  if (!existsSync(join(dir, "dist"))) {
    throw new Error(
      `${label} has no dist/ at ${dir} — build nessa_ui packages first`,
    )
  }
}
console.log("packing @nessalabs/agent-stream…")
const agentTgz = npmPack(agentStream, join(packs, "agent-stream"), {
  ignoreScripts: true,
})
console.log("packing @nessalabs/ui…")
const uiTgz = npmPack(uiKit, join(packs, "ui-kit"), { ignoreScripts: true })

console.log("staging UI source…")
cpSync(join(root, "packages/ui"), app, {
  recursive: true,
  filter: (src) => {
    const base = src.split("/").pop()
    return base !== "node_modules" && base !== ".next" && base !== ".git"
  },
})

const ledgerVer = JSON.parse(
  readFileSync(join(root, "packages/ledger/package.json"), "utf8"),
).version
const pkgPath = join(app, "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
pkg.private = false
pkg.version = ledgerVer
pkg.dependencies = {
  ...pkg.dependencies,
  "@nessalabs/spec-ledger-client": `file:${clientTgz}`,
  "@nessalabs/ui": `file:${uiTgz}`,
}
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

let nextCfg = readFileSync(join(app, "next.config.mjs"), "utf8")
if (
  !nextCfg.includes('output: "standalone"') &&
  !nextCfg.includes("output: 'standalone'")
) {
  nextCfg = nextCfg.replace(
    "const nextConfig = {",
    'const nextConfig = {\n  output: "standalone",',
  )
  writeFileSync(join(app, "next.config.mjs"), nextCfg)
}

console.log("npm install local tarballs…")
run(
  "npm",
  [
    "install",
    ledgerTgz,
    clientTgz,
    agentTgz,
    uiTgz,
    "--no-package-lock",
    "--no-fund",
    "--no-audit",
  ],
  app,
)

console.log("rewriting file:/workspace: protocols to versions…")
rewriteProtocols(app)
assertNoFileOrWorkspace(app)

if (!skipBuild) {
  console.log("next build…")
  run("npx", ["next", "build"], app)
  assertNoFileOrWorkspace(app)
}

mkdirSync(outDir, { recursive: true })
const tarball = join(outDir, `spec-ledger-ui-${ledgerVer}.tgz`)
run("tar", ["-czf", tarball, "-C", stage, "spec-ledger-ui"], root)

const verify = mkdtempSync(join(tmpdir(), "sl-ui-verify-"))
run("tar", ["-xzf", tarball, "-C", verify], root)
assertNoFileOrWorkspace(join(verify, "spec-ledger-ui"))

console.log(`wrote ${tarball}`)
rmSync(stage, { recursive: true, force: true })
rmSync(verify, { recursive: true, force: true })
