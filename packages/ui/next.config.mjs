import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const uiRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  // Prefer this package over parent lockfiles when tracing.
  outputFileTracingRoot: join(uiRoot, "../.."),
  transpilePackages: ["@nessa-ui/react", "@nessa/spec-ledger-client", "@nessa/spec-ledger"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@nessa-ui/react"],
  },
}

export default nextConfig
