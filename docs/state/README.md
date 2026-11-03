---
id: "sl"
title: "Understand Spec Ledger"
kind: "system"
status: "implemented"
summary: "Spec Ledger records planned work, permission, changes and evidence in a repository. It helps a person distinguish a reported implementation from a check that actually passed against the current files."
parent: null
sources:
  [
    "packages/ledger/src/application/operations.ts",
    "packages/client/src/index.ts",
    "packages/server/src/routes.ts",
    "packages/ui/app/page.tsx",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks:
  {
    "CLI": "sl-interfaces",
    "Core": "sl-inventory",
    "Checks": "sl-checks",
    "Read": "sl-interfaces",
    "Local": "sl-permission",
    "Git": "sl-context",
  }
---

# Understand work and its evidence

Spec Ledger records planned work, permission, changes and evidence in a repository. It helps a person distinguish a reported implementation from a check that actually passed against the current files.

For example, an agent can report that a requirement is implemented while its test result is missing or stale. The work remains incomplete. A green claim report also does not automatically close a turn or complete a workstream: those operations check additional conditions.

```mermaid
flowchart TD
  Human[Person and agent] --> CLI[CLI and local MCP tools]
  CLI --> Core[Shared operations and ledger owners]
  Core --> Git[Repository records and source]
  Core -->|Explicit write operation only| Checks[Explicit saved checks]
  Read[Read-only HTTP service] --> Core
  Client[Typed client] --> Read
  UI[Local reference UI] --> Client
  UI --> Local[Bounded local write adapters]
  Local --> Core
```

| Goal                                    | Start here                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Install and choose an interface         | [Setup](setup.md) and [transport boundaries](interfaces.md)                              |
| Understand whether a requirement passed | [Claims](claims.md) and [run evidence](checks.md)                                        |
| Start authorized work                   | [Permission](permission.md), [plans](plans.md), [turns](turns.md)                        |
| Review, correct and finish work         | [Reviews](reviews.md), [completion](completion.md), [deferred commitments](deferrals.md) |
| Reuse a method                          | [Workflows](workflows.md) and [saved workflow library](library.md)                       |
| Follow an agent or an experiment        | [Execution observations](execution.md), [experiments](experiments.md)                    |
| Find structure or previous decisions    | [Graph](graph.md), [context](context.md), [inventory](inventory.md)                      |
| Reproduce this atlas's checks           | [Verification](verification.md)                                                          |

The generic server only reads. The local UI has separate write adapters for specific actions; saying the entire UI is read-only would be wrong. Activity observations cannot resume an agent or cancel a process. Those boundaries matter when deciding what a displayed status proves.
