import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const uiRoot = dirname(fileURLToPath(import.meta.url))
// @nessa-ui/react is file:../../../nessa/packages/react — outside this repo.
// Turbopack refuses CSS that escapes outputFileTracingRoot, so root must
// cover both nessa-spec-test and the sibling nessa design-system checkout.
const tracingRoot = join(uiRoot, "../../..")

const nextConfig = {
  outputFileTracingRoot: tracingRoot,
  transpilePackages: ["@nessa-ui/react"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@nessa-ui/react"],
  },
  allowedDevOrigins: ["127.0.0.1"],
}

export default nextConfig
