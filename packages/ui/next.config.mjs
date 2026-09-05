import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { realpathSync } from "node:fs"

const uiRoot = dirname(fileURLToPath(import.meta.url))
// @nessalabs/ui is file:../../../nessa_ui/packages/react — outside this repo.
// Turbopack refuses CSS that escapes outputFileTracingRoot, so root must
// cover both spec-ledger and the sibling nessa_ui design-system checkout.
const tracingRoot = join(uiRoot, "../../..")
const nessaUiEntry = realpathSync(
  fileURLToPath(import.meta.resolve("@nessalabs/ui")),
)

const nextConfig = {
  // Keep verification builds away from a concurrently running dev server.
  distDir: process.env.SPEC_LEDGER_NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: tracingRoot,
  experimental: {
    // @nessalabs/ui's public client entry also re-exports agent-stream modules.
    // Next's barrel optimizer cannot transform those `export *` declarations
    // across a client boundary, so let the package's own ESM bundle resolve it.
    optimizePackageImports: ["lucide-react"],
  },
  allowedDevOrigins: ["127.0.0.1"],
  webpack(config) {
    config.module.rules.push({
      include: nessaUiEntry,
      enforce: "pre",
      use: [join(uiRoot, "loaders/nessa-ui-client-entry.cjs")],
    })
    return config
  },
}

export default nextConfig
