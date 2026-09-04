import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const uiRoot = dirname(fileURLToPath(import.meta.url))
// @nessalabs/ui is file:../../../nessa_ui/packages/react — outside this repo.
// Turbopack refuses CSS that escapes outputFileTracingRoot, so root must
// cover both spec-ledger and the sibling nessa_ui design-system checkout.
const tracingRoot = join(uiRoot, "../../..")

const nextConfig = {
  outputFileTracingRoot: tracingRoot,
  transpilePackages: ["@nessalabs/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@nessalabs/ui"],
  },
  allowedDevOrigins: ["127.0.0.1"],
}

export default nextConfig
