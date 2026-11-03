---
id: "sl-setup"
title: "Set up the tools"
kind: "guide"
status: "implemented"
summary: "Use the CLI when an agent or terminal should change repository records. Use the client and read-only service to display them. The reference Next.js UI adds a local browser interface; its installation is separate from the four-package pnpm workspace."
parent: "sl"
sources:
  [
    "package.json",
    "pnpm-workspace.yaml",
    "packages/ui/package.json",
    "packages/ledger/src/cli/init.ts",
    "packages/ledger/src/cli/main.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Set up the tools

Use the CLI when an agent or terminal should change repository records. Use the client and read-only service to display them. The reference Next.js UI adds a local browser interface; its installation is separate from the four-package pnpm workspace.

From this checkout, install with `pnpm install --frozen-lockfile`, then `pnpm -r build`. The workspace builds ledger, client, server and MCP. `pnpm test` runs ledger tests, MCP tests and UI helper tests; it does not build the complete reference UI. The UI package depends on a sibling nessa_ui checkout through a local file path. Follow the repository README's release/setup instructions for that optional application.

For a new consumer repository, `spec-ledger init --name my-project` creates ledger structure. Inspect the generated files before adding claims and bindings. Do not copy this project's live authority or historical turns into a different repository.

`pnpm serve` starts the read-only projection service; `pnpm ui` starts the local reference UI. Their defaults in the README are localhost ports 8787 and 3737. Choose the repository root deliberately through the documented environment/configuration. Publishing packages or starting a deployed service is outside this atlas's checks.

A particularly important command distinction: the CLI names `verify` and `check` both execute configured checks at this checkpoint. The library's `verifyLedger`, the typed client's `verify()` and HTTP verify projection read existing evidence without executing those commands. See [checks](checks.md) before treating a command as a read.
