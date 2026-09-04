/** Release-pack fixtures exercise the real packer without a sibling checkout.
 * Core package lifecycle hooks are covered by the package tests separately.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const REPO = join(import.meta.dirname, "../../..")

export function uiReleaseFixture() {
  const root = mkdtempSync(join(tmpdir(), "sl-ui-fixture-"))
  const write = (path: string, value: string | object) => {
    const target = join(root, path)
    mkdirSync(join(target, ".."), { recursive: true })
    writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value))
  }
  mkdirSync(join(root, "scripts"), { recursive: true })
  cpSync(join(REPO, "scripts/pack-ui-release.mjs"), join(root, "scripts/pack-ui-release.mjs"))
  for (const name of ["ledger", "client"]) {
    const pkg = JSON.parse(readFileSync(join(REPO, `packages/${name}/package.json`), "utf8"))
    pkg.scripts = { prepack: "node -e \"\"" }
    write(`packages/${name}/package.json`, pkg)
    cpSync(join(REPO, `packages/${name}/dist`), join(root, `packages/${name}/dist`), { recursive: true })
  }
  const uiPkg = JSON.parse(readFileSync(join(REPO, "packages/ui/package.json"), "utf8"))
  write("packages/ui/package.json", {
    name: uiPkg.name, version: uiPkg.version, private: true, type: "module",
    dependencies: { next: uiPkg.dependencies.next, react: uiPkg.dependencies.react, "react-dom": uiPkg.dependencies["react-dom"] },
  })
  write("packages/ui/next.config.mjs", 'const nextConfig = { experimental: { cpus: 1 } }; export default nextConfig\n')
  write("packages/ui/app/layout.jsx", 'export default function Layout({children}) { return <html><body>{children}</body></html> }\n')
  write("packages/ui/app/page.jsx", `import { createSpecLedgerClient } from '@nessalabs/spec-ledger-client';
import { Proof } from '@nessalabs/ui';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const config = await createSpecLedgerClient({kind: 'inProcess', rootDir: process.env.SPEC_LEDGER_ROOT}).getConfig();
  return <main><h1>Consumer ledger schema {config.schemaVersion}</h1><Proof /></main>;
}\n`)
  write("nessa_ui/packages/agent-stream/package.json", {
    name: "@nessalabs/agent-stream", version: "0.1.0", type: "module", exports: "./dist/index.js", files: ["dist"],
  })
  write("nessa_ui/packages/agent-stream/dist/index.js", 'export const proofMarker = "Vendored UI and agent-stream rendered";\n')
  write("nessa_ui/packages/react/package.json", {
    name: "@nessalabs/ui", version: "0.1.0", type: "module", exports: "./dist/index.js", files: ["dist"],
    dependencies: { "@nessalabs/agent-stream": "0.1.0" }, peerDependencies: { react: ">=19" },
  })
  write("nessa_ui/packages/react/dist/index.js", `"use client";
import {createElement} from 'react';
import {proofMarker} from '@nessalabs/agent-stream';
export function Proof() { return createElement('p', null, proofMarker); }\n`)
  return {
    root,
    pack: join(root, "scripts/pack-ui-release.mjs"),
    env: { ...process.env, NESSA_UI_ROOT: join(root, "nessa_ui"), NEXT_TELEMETRY_DISABLED: "1" },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}
