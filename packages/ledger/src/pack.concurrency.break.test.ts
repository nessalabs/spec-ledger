import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const REPO = join(import.meta.dirname, "../../..")

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sl-pack-concurrency-"))
  // Exercise the real manifests/hooks, but never let pack mutate this checkout.
  for (const name of ["ledger", "client", "server"]) {
    const dest = join(root, "packages", name)
    mkdirSync(dest, { recursive: true })
    cpSync(join(REPO, "packages", name, "package.json"), join(dest, "package.json"))
    cpSync(join(REPO, "packages", name, "dist"), join(dest, "dist"), { recursive: true })
  }
  cpSync(join(REPO, "scripts"), join(root, "scripts"), { recursive: true })
  return root
}

function command(cmd: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false" },
    })
    let output = ""
    child.stdout.on("data", (data) => { output += data })
    child.stderr.on("data", (data) => { output += data })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, output }))
  })
}

function sync(cmd: string, args: string[], cwd: string): string {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", env: process.env })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout
}

describe("pack concurrency and failure isolation", () => {
  it("overlapping npm packs preserve manifests and produce installable tarballs", async () => {
    const root = fixture()
    try {
      // Hold both builds until both prepack hooks have executed. This makes
      // backup clobbering deterministic instead of relying on machine speed.
      writeFileSync(join(root, "barrier.mjs"), `
        import {mkdirSync,writeFileSync,readdirSync} from 'node:fs';
        mkdirSync('barrier',{recursive:true});
        writeFileSync('barrier/'+process.pid,'ready');
        const deadline=Date.now()+15000;
        while(readdirSync('barrier').length<2) {
          if(Date.now()>deadline) throw new Error('second pack never reached build');
          await new Promise(r=>setTimeout(r,20));
        }
        await new Promise(r=>setTimeout(r,100));
      `)
      const tarballs: string[] = []
      const ledgerOut = join(root, "ledger-out")
      mkdirSync(ledgerOut)
      sync("npm", ["pack", "--ignore-scripts", "--pack-destination", ledgerOut], join(root, "packages/ledger"))
      tarballs.push(join(ledgerOut, readdirSync(ledgerOut).find((p) => p.endsWith(".tgz"))!))

      // The consumer install is deliberately offline. Supply the exact Zod
      // package already installed for this checkout rather than depending on
      // npm's ambient cache to contain the ledger's runtime dependency.
      const dependencyOut = join(root, "dependency-out")
      mkdirSync(dependencyOut)
      const repoRequire = createRequire(join(REPO, "packages/ledger/package.json"))
      const zodDir = dirname(repoRequire.resolve("zod/package.json"))
      sync("npm", ["pack", "--ignore-scripts", "--pack-destination", dependencyOut], zodDir)
      tarballs.push(join(dependencyOut, readdirSync(dependencyOut).find((p) => p.endsWith(".tgz"))!))

      for (const name of ["client", "server"]) {
        const dir = join(root, "packages", name)
        const path = join(dir, "package.json")
        const manifest = JSON.parse(readFileSync(path, "utf8"))
        manifest.scripts.build = "node ../../barrier.mjs"
        writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n")
        const before = readFileSync(path, "utf8")
        const outputs = [join(root, `${name}-a`), join(root, `${name}-b`)]
        outputs.forEach((out) => mkdirSync(out))
        const results = await Promise.all(outputs.map((out) => command("npm", ["pack", "--pack-destination", out], dir)))
        for (const result of results) assert.equal(result.code, 0, result.output)
        assert.equal(readFileSync(path, "utf8"), before, `${name}: overlapping packs changed the source manifest`)
        assert.equal(existsSync(join(dir, "package.json.prepack-bak")), false, "pack left a backup behind")
        for (const out of outputs) {
          const tarball = join(out, readdirSync(out).find((p) => p.endsWith(".tgz"))!)
          const packed = JSON.parse(sync("tar", ["-xOf", tarball, "package/package.json"], root))
          for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
            for (const version of Object.values(packed[field] ?? {})) {
              assert.doesNotMatch(String(version), /^(workspace|file|link|portal):/)
            }
          }
        }
        tarballs.push(join(outputs[0], readdirSync(outputs[0]).find((p) => p.endsWith(".tgz"))!))
      }
      const app = join(root, "consumer")
      mkdirSync(app)
      writeFileSync(join(app, "package.json"), '{"name":"consumer","private":true,"type":"module"}')
      sync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs], app)
      sync(process.execPath, ["--input-type=module", "-e", "import {createSpecLedgerClient} from '@nessalabs/spec-ledger-client'; import {createLedgerServer} from '@nessalabs/spec-ledger-server'; if(typeof createSpecLedgerClient!=='function'||typeof createLedgerServer!=='function')process.exit(1)"], app)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("a failed prepack build does not rewrite the source manifest", () => {
    const root = fixture()
    try {
      for (const name of ["client", "server"]) {
        const dir = join(root, "packages", name)
        const path = join(dir, "package.json")
        const manifest = JSON.parse(readFileSync(path, "utf8"))
        manifest.scripts.build = "node -e 'process.exit(23)'"
        writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n")
        const before = readFileSync(path, "utf8")
        const result = spawnSync("npm", ["pack"], { cwd: dir, encoding: "utf8", env: process.env })
        assert.notEqual(result.status, 0, "injected build failure unexpectedly succeeded")
        assert.match(result.stderr + result.stdout, /23/)
        assert.equal(readFileSync(path, "utf8"), before, `${name}: failed pack changed the source manifest`)
        assert.equal(existsSync(join(dir, "package.json.prepack-bak")), false, "failed pack left a backup behind")
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("client and server resolve this checkout's ledger during development", () => {
    for (const name of ["client", "server"]) {
      const require = createRequire(join(REPO, "packages", name, "package.json"))
      assert.equal(realpathSync(require.resolve("@nessalabs/spec-ledger/package.json")), realpathSync(join(REPO, "packages/ledger/package.json")))
    }
  })
})
