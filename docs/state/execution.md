---
id: "sl-execution"
title: "Read agent activity"
kind: "guide"
status: "implemented"
summary: "Execution records associate an existing ledger turn with an agent-reported host session. They describe observed activity; they do not establish control over that host."
parent: "sl"
sources:
  [
    "packages/ledger/src/execution/index.ts",
    "packages/ledger/src/execution/emitter.ts",
    "packages/ledger/src/cli/activity-collector.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Interpret agent activity cautiously

Execution records associate an existing ledger turn with an agent-reported host session. They describe observed activity; they do not establish control over that host.

For example, a tool-start event without its finish can appear in flight. Missing, duplicate, out-of-order or dropped signals preserve uncertainty. A session-stop observation does not manufacture missing finish evidence. Activity storage is bounded and ignored by git; it is separate from durable operation receipts.

A requested continuation policy remains ineffective because verified host liveness/resume capabilities are unavailable. Timeout settings can show warnings, but enforcement is unsupported without tool/process ownership. Recording stop changes the association's ledger state; it does not kill a process. Use the actual host for cancellation and inspect its outcome.

The generated continuation prompt is guidance within current permission, not dispatched work. Waiting for a user, revoked permission, explicit stop or uncertain activity stays visible. Never turn silence or an expired display timer into broader authority.
