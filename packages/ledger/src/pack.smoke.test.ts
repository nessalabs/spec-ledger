import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  existsSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const REPO = join(import.meta.dirname, "../../..")

function packPackage(pkgDir: string, outDir: string): string {
  mkdirSync(outDir, { recursive: true })
  const r = spawnSync("pnpm", ["pack", "--pack-destination", outDir], {
    cwd: pkgDir,
    encoding: "utf8",
  })
  if (r.status !== 0) {
    throw new Error(`pnpm pack failed in ${pkgDir}: ${r.stderr || r.stdout}`)
  }
  const tgz = readdirSync(outDir).find((f) => f.endsWith(".tgz"))
  if (!tgz) throw new Error(`no tgz in ${outDir}: ${r.stdout}`)
  return join(outDir, tgz)
}

function packageJsonFromTgz(tgz: string, extractDir: string): Record<string, unknown> {
  mkdirSync(extractDir, { recursive: true })
  const r = spawnSync("tar", ["-xzf", tgz, "-C", extractDir], { encoding: "utf8" })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(
    readFileSync(join(extractDir, "package", "package.json"), "utf8"),
  ) as Record<string, unknown>
}

function assertNoWorkspaceOrFile(deps: Record<string, string> | undefined, label: string) {
  if (!deps) return
  for (const [name, ver] of Object.entries(deps)) {
    assert.ok(
      !ver.startsWith("workspace:") && !ver.startsWith("file:"),
      `${label} dep ${name}=${ver} must not use workspace: or file:`,
    )
  }
}

describe("pack installable packages (SLC-02)", () => {
  it("packs ledger/client/server without workspace: or file: and bin runs outside monorepo", () => {
    const root = mkdtempSync(join(tmpdir(), "sl-pack-"))
    try {
      const ledgerTgz = packPackage(
        join(REPO, "packages/ledger"),
        join(root, "ledger-out"),
      )
      const clientTgz = packPackage(
        join(REPO, "packages/client"),
        join(root, "client-out"),
      )
      const serverTgz = packPackage(
        join(REPO, "packages/server"),
        join(root, "server-out"),
      )

      const ledgerPkg = packageJsonFromTgz(ledgerTgz, join(root, "ledger-x"))
      const clientPkg = packageJsonFromTgz(clientTgz, join(root, "client-x"))
      const serverPkg = packageJsonFromTgz(serverTgz, join(root, "server-x"))

      assert.equal(ledgerPkg.version, "0.1.0-alpha.0")
      assert.equal(clientPkg.version, "0.1.0-alpha.0")
      assert.equal(serverPkg.version, "0.1.0-alpha.0")
      assert.ok((ledgerPkg.bin as Record<string, string>)?.["spec-ledger"])
      assert.ok((serverPkg.bin as Record<string, string>)?.["spec-ledger-serve"])

      assertNoWorkspaceOrFile(
        clientPkg.dependencies as Record<string, string>,
        "client",
      )
      assertNoWorkspaceOrFile(
        serverPkg.dependencies as Record<string, string>,
        "server",
      )

      // Install ledger tarball in a fresh project and run the bin
      const app = join(root, "app")
      mkdirSync(app)
      writeFileSync(
        join(app, "package.json"),
        JSON.stringify({ name: "pack-app", private: true, type: "module" }),
      )
      spawnSync("git", ["init", "-q"], { cwd: app })
      const inst = spawnSync("npm", ["install", ledgerTgz], {
        cwd: app,
        encoding: "utf8",
      })
      assert.equal(inst.status, 0, inst.stderr || inst.stdout)

      const help = spawnSync(
        "npx",
        ["spec-ledger", "--help"],
        { cwd: app, encoding: "utf8" },
      )
      assert.equal(help.status, 2) // usage exits 2
      assert.match(help.stdout + help.stderr, /spec-ledger/)

      const init = spawnSync(
        "npx",
        ["spec-ledger", "init", "--name", "pack-app"],
        { cwd: app, encoding: "utf8" },
      )
      assert.equal(init.status, 0, init.stderr || init.stdout)
      assert.match(init.stdout, /initialized/)

      const verify = spawnSync("npx", ["spec-ledger", "verify"], {
        cwd: app,
        encoding: "utf8",
      })
      assert.equal(verify.status, 0, verify.stderr || verify.stdout)

      // Client+server install against packed ledger version
      const stack = join(root, "stack")
      mkdirSync(stack)
      writeFileSync(
        join(stack, "package.json"),
        JSON.stringify({ name: "stack", private: true, type: "module" }),
      )
      const stackInst = spawnSync(
        "npm",
        ["install", ledgerTgz, clientTgz, serverTgz],
        { cwd: stack, encoding: "utf8" },
      )
      assert.equal(stackInst.status, 0, stackInst.stderr || stackInst.stdout)
      const require = createRequire(join(stack, "package.json"))
      assert.ok(existsSync(require.resolve("@nessalabs/spec-ledger/package.json")))
      assert.ok(existsSync(require.resolve("@nessalabs/spec-ledger-client/package.json")))
      assert.ok(existsSync(require.resolve("@nessalabs/spec-ledger-server/package.json")))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
