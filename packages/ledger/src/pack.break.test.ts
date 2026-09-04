// sl-dev-break killers (T-022 / W-005 SLC-02) — falsify pack/install vs SL-012.
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
import { pathToFileURL } from "node:url"

const REPO = join(import.meta.dirname, "../../..")

function packWith(
  tool: "pnpm" | "npm",
  pkgDir: string,
  outDir: string,
): string {
  mkdirSync(outDir, { recursive: true })
  const r = spawnSync(tool, ["pack", "--pack-destination", outDir], {
    cwd: pkgDir,
    encoding: "utf8",
  })
  if (r.status !== 0) {
    throw new Error(
      `${tool} pack failed in ${pkgDir}: ${r.stderr || r.stdout}`,
    )
  }
  const tgz = readdirSync(outDir).find((f) => f.endsWith(".tgz"))
  if (!tgz) throw new Error(`no tgz in ${outDir}: ${r.stdout}`)
  return join(outDir, tgz)
}

function packageJsonFromTgz(
  tgz: string,
  extractDir: string,
): Record<string, unknown> {
  mkdirSync(extractDir, { recursive: true })
  const r = spawnSync("tar", ["-xzf", tgz, "-C", extractDir], {
    encoding: "utf8",
  })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(
    readFileSync(join(extractDir, "package", "package.json"), "utf8"),
  ) as Record<string, unknown>
}

function depProtocols(
  pkg: Record<string, unknown>,
): Array<{ field: string; name: string; ver: string }> {
  const fields = [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "devDependencies",
  ] as const
  const out: Array<{ field: string; name: string; ver: string }> = []
  for (const field of fields) {
    const deps = pkg[field] as Record<string, string> | undefined
    if (!deps) continue
    for (const [name, ver] of Object.entries(deps)) {
      if (
        ver.startsWith("workspace:") ||
        ver.startsWith("file:") ||
        ver.startsWith("link:") ||
        ver.startsWith("portal:")
      ) {
        out.push({ field, name, ver })
      }
    }
  }
  return out
}

describe("pack break (T-022 SLC-02)", () => {
  it("npm pack client/server must not ship workspace: or file: deps (SL-012)", () => {
    const root = mkdtempSync(join(tmpdir(), "sl-pack-break-npm-"))
    try {
      const clientTgz = packWith(
        "npm",
        join(REPO, "packages/client"),
        join(root, "client-out"),
      )
      const serverTgz = packWith(
        "npm",
        join(REPO, "packages/server"),
        join(root, "server-out"),
      )
      const clientPkg = packageJsonFromTgz(clientTgz, join(root, "client-x"))
      const serverPkg = packageJsonFromTgz(serverTgz, join(root, "server-x"))
      const bad = [
        ...depProtocols(clientPkg).map((d) => `client ${d.field} ${d.name}=${d.ver}`),
        ...depProtocols(serverPkg).map((d) => `server ${d.field} ${d.name}=${d.ver}`),
      ]
      assert.equal(
        bad.length,
        0,
        `npm pack must rewrite workspace:/file: (publish path); got: ${bad.join("; ")}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("after pnpm pack install, client and server modules import and run (not package.json-only)", () => {
    const root = mkdtempSync(join(tmpdir(), "sl-pack-break-import-"))
    try {
      const ledgerTgz = packWith(
        "pnpm",
        join(REPO, "packages/ledger"),
        join(root, "ledger-out"),
      )
      const clientTgz = packWith(
        "pnpm",
        join(REPO, "packages/client"),
        join(root, "client-out"),
      )
      const serverTgz = packWith(
        "pnpm",
        join(REPO, "packages/server"),
        join(root, "server-out"),
      )

      const stack = join(root, "stack")
      mkdirSync(stack)
      writeFileSync(
        join(stack, "package.json"),
        JSON.stringify({ name: "stack", private: true, type: "module" }),
      )
      const inst = spawnSync(
        "npm",
        ["install", ledgerTgz, clientTgz, serverTgz],
        { cwd: stack, encoding: "utf8" },
      )
      assert.equal(inst.status, 0, inst.stderr || inst.stdout)

      // Builder smoke only resolve()'d package.json — import the real entrypoints.
      const clientMod = awaitImport(
        join(stack, "node_modules/@nessalabs/spec-ledger-client/dist/index.js"),
      )
      assert.equal(typeof clientMod.createSpecLedgerClient, "function")

      const serverMod = awaitImport(
        join(stack, "node_modules/@nessalabs/spec-ledger-server/dist/index.js"),
      )
      assert.equal(typeof serverMod.createLedgerServer, "function")

      // Server bin must work outside the monorepo (SLC-02 acceptance covers bins).
      spawnSync("git", ["init", "-q"], { cwd: stack })
      const init = spawnSync("npx", ["spec-ledger", "init", "--name", "stack"], {
        cwd: stack,
        encoding: "utf8",
      })
      assert.equal(init.status, 0, init.stderr || init.stdout)

      const serve = spawnSync(
        "npx",
        ["spec-ledger-serve", stack],
        {
          cwd: stack,
          encoding: "utf8",
          env: { ...process.env, PORT: "8799" },
          timeout: 2500,
          killSignal: "SIGTERM",
        },
      )
      // Process is killed by timeout after listen — treat start log as success.
      const out = (serve.stdout || "") + (serve.stderr || "")
      assert.match(
        out,
        /spec-ledger-serve \(read-only\) on http:\/\/127\.0\.0\.1:8799/,
        `server bin did not start outside monorepo: ${out}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("pnpm-packed package.json: all dep fields free of workspace:/file:/link:/portal:", () => {
    const root = mkdtempSync(join(tmpdir(), "sl-pack-break-fields-"))
    try {
      for (const pkg of ["client", "server"] as const) {
        const tgz = packWith(
          "pnpm",
          join(REPO, `packages/${pkg}`),
          join(root, `${pkg}-out`),
        )
        const pj = packageJsonFromTgz(tgz, join(root, `${pkg}-x`))
        const bad = depProtocols(pj)
        assert.equal(
          bad.length,
          0,
          `${pkg} packed deps still use monorepo protocols: ${JSON.stringify(bad)}`,
        )
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("out-of-intent: packed ledger bin shebang survives and is directly executable via node path", () => {
    const root = mkdtempSync(join(tmpdir(), "sl-pack-break-shebang-"))
    try {
      const ledgerTgz = packWith(
        "pnpm",
        join(REPO, "packages/ledger"),
        join(root, "ledger-out"),
      )
      const extract = join(root, "x")
      mkdirSync(extract)
      spawnSync("tar", ["-xzf", ledgerTgz, "-C", extract], { encoding: "utf8" })
      const binPath = join(extract, "package/dist/cli/main.js")
      assert.ok(existsSync(binPath), "packed bin missing")
      const head = readFileSync(binPath, "utf8").slice(0, 32)
      assert.match(
        head,
        /^#!\/usr\/bin\/env node\n/,
        `packed CLI lost shebang (npx may hide this): ${JSON.stringify(head)}`,
      )

      const app = join(root, "app")
      mkdirSync(app)
      writeFileSync(
        join(app, "package.json"),
        JSON.stringify({ name: "shebang-app", private: true, type: "module" }),
      )
      spawnSync("git", ["init", "-q"], { cwd: app })
      const inst = spawnSync("npm", ["install", ledgerTgz], {
        cwd: app,
        encoding: "utf8",
      })
      assert.equal(inst.status, 0, inst.stderr || inst.stdout)
      const require = createRequire(join(app, "package.json"))
      const installedBin = require.resolve("@nessalabs/spec-ledger/package.json")
      const mainJs = join(
        installedBin.replace(/package\.json$/, ""),
        "dist/cli/main.js",
      )
      const help = spawnSync(process.execPath, [mainJs, "--help"], {
        cwd: app,
        encoding: "utf8",
      })
      assert.equal(help.status, 2, help.stderr || help.stdout)
      assert.match(help.stdout + help.stderr, /spec-ledger/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

/** Sync-ish dynamic import via spawn so node:test stays sync-friendly. */
function awaitImport(absPath: string): Record<string, unknown> {
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(pathToFileURL(absPath).href)}).then(m=>{console.log(JSON.stringify({keys:Object.keys(m),hasClient:typeof m.createSpecLedgerClient,hasServer:typeof m.createLedgerServer}))}).catch(e=>{console.error(String(e)); process.exit(1)})`,
    ],
    { encoding: "utf8" },
  )
  assert.equal(r.status, 0, r.stderr || r.stdout)
  const parsed = JSON.parse(r.stdout.trim()) as {
    keys: string[]
    hasClient: string
    hasServer: string
  }
  return {
    createSpecLedgerClient:
      parsed.hasClient === "function" ? () => undefined : undefined,
    createLedgerServer:
      parsed.hasServer === "function" ? () => undefined : undefined,
    keys: parsed.keys,
  }
}
