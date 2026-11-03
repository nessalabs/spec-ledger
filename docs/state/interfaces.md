---
id: "sl-interfaces"
title: "Read and write interfaces"
kind: "guide"
status: "implemented"
summary: "The core owns behavior. CLI and local MCP tools call shared application operations; the generic HTTP service exposes read-only projections. The typed client is the dependency boundary for UIs and embedders."
parent: "sl"
sources:
  [
    "packages/client/src/index.ts",
    "packages/server/src/routes.ts",
    "packages/mcp/src/index.ts",
    "packages/ui/app/api/approval/route.ts",
    "packages/ui/app/api/checks/route.ts",
    "packages/ui/app/api/workflows/route.ts",
    "packages/ui/app/api/repo-file/route.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Choose the right read or write interface

The core owns behavior. CLI and local MCP tools call shared application operations; the generic HTTP service exposes read-only projections. The typed client is the dependency boundary for UIs and embedders.

MCP advertises the shared operation schemas, returns typed success/error envelopes and does not itself invoke agents. Operations include planning, permission, turns, evidence, reviews, workflows and optional experiments. Mutation request IDs and expected fingerprints carry the same meaning through CLI and MCP.

The Next.js reference UI is a local host. Its approval, saved-check and workflow routes can write through bounded local adapters; its session/progress/goal routes project data. Loopback/origin/token and input-size checks restrict those browser adapters. They are not a general authenticated remote service, and the generic server does not acquire their write capability.

Use the HTTP client for that server's read contract or the in-process client in a trusted local host. An HTTP error is not an empty successful dataset. Inspect returned failure instead of inventing a current result. File preview/attachment routes have their own path and integrity checks; a displayed link is not proof an external artifact remains accessible.
