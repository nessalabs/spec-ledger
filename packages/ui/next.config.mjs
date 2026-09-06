import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { realpathSync } from "node:fs"

const uiRoot = dirname(fileURLToPath(import.meta.url))
// @nessalabs/ui is file:../../../nessa_ui/packages/react — outside this repo,
// so the tracing root must cover both spec-ledger and the sibling design-system
// checkout or Next refuses CSS that escapes it.
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
  // Routes that were folded into another page. Kept so existing links survive.
  redirects: async () => [
    { source: "/timeline", destination: "/turns", permanent: false },
    { source: "/verify", destination: "/claims", permanent: false },
    { source: "/workflows", destination: "/workstreams", permanent: false },
  ],
  // `dev` and `build` both run webpack on purpose: this loader is the only
  // thing that makes @nessalabs/ui importable, and Turbopack would skip it.
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
