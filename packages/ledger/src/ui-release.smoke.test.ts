import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:net"
import { setTimeout } from "node:timers/promises"
import { REPO, uiReleaseFixture } from "./ui-release.fixture.js"



function walkPackageJson(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkPackageJson(p, out)
    else if (name === "package.json") out.push(p)
  }
  return out
}

describe("UI release asset (SLC-03)", () => {
  it("built release boots outside the checkout and reads the consumer ledger", async () => {
    const fixture = uiReleaseFixture()
    let extract = ""
    let server: ReturnType<typeof spawn> | undefined
    const out = mkdtempSync(join(tmpdir(), "sl-ui-out-"))
    try {
      const r = spawnSync(
        "node",
        [fixture.pack, "--out", out],
        { encoding: "utf8", cwd: fixture.root, env: fixture.env },
      )
      assert.equal(r.status, 0, r.stderr || r.stdout)
      const tgz = readdirSync(out).find((f) => f.startsWith("spec-ledger-ui-") && f.endsWith(".tgz"))
      assert.ok(tgz, `missing tarball in ${out}: ${r.stdout}`)

      extract = mkdtempSync(join(tmpdir(), "sl-ui-x-"))
      spawnSync("tar", ["-xzf", join(out, tgz), "-C", extract], { encoding: "utf8" })
      const app = join(extract, "spec-ledger-ui")
      assert.ok(existsSync(app))
      for (const pj of walkPackageJson(app)) {
        const txt = readFileSync(pj, "utf8")
        assert.ok(!txt.includes("workspace:"), pj)
        assert.ok(!/"file:/.test(txt), pj)
      }
      const consumer = join(extract, "consumer")
      const init = spawnSync(process.execPath, [join(app, "node_modules/@nessalabs/spec-ledger/dist/cli/main.js"), "init", "--root", consumer], {encoding: "utf8"})
      assert.equal(init.status, 0, init.stderr || init.stdout)
      // Delete the fixture before boot: no dependency can resolve through it.
      fixture.cleanup()
      const reservation = createServer()
      await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve))
      const address = reservation.address()
      assert.ok(address && typeof address === "object")
      const port = address.port
      await new Promise<void>((resolve) => reservation.close(() => resolve()))
      let output = ""
      server = spawn(process.execPath, [join(app, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
        cwd: app, env: {...process.env, SPEC_LEDGER_ROOT: consumer, NEXT_TELEMETRY_DISABLED: "1"}, stdio: ["ignore", "pipe", "pipe"],
      })
      server.stdout?.on("data", (data) => { output += data })
      server.stderr?.on("data", (data) => { output += data })
      let html = ""
      for (let attempt = 0; attempt < 100; attempt++) {
        assert.equal(server.exitCode, null, output)
        try {
          const response = await fetch(`http://127.0.0.1:${port}`, {signal: AbortSignal.timeout(2000)})
          assert.equal(response.status, 200, `${await response.clone().text()}\n${output}`)
          html = await response.text()
          break
        } catch (error) {
          if (error instanceof assert.AssertionError) throw error
          await setTimeout(100)
        }
      }
      assert.match(html, /Consumer ledger schema/, output)
      assert.match(html, /Vendored UI and agent-stream rendered/, output)
    } finally {
      if (server && server.exitCode === null) {
        const exited = new Promise<void>((resolve) => server!.once("exit", () => resolve()))
        server.kill("SIGTERM")
        await exited
      }
      fixture.cleanup()
      if (extract) rmSync(extract, { recursive: true, force: true })
      rmSync(out, { recursive: true, force: true })
    }
  })

  it("README documents consumer one-liner for Release UI asset", () => {
    const readme = readFileSync(join(REPO, "README.md"), "utf8")
    assert.match(readme, /spec-ledger-ui-.*\.tgz/)
    assert.match(readme, /@nessalabs\/spec-ledger-client/)
    assert.match(readme, /SPEC_LEDGER_ROOT/)
    assert.match(readme, /pack-ui-release/)
    assert.match(readme, /@nessalabs\/spec-ledger@/)
  })
})
