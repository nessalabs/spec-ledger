---
id: "sl-operations"
title: "Recover a lost reply"
kind: "statechart"
status: "implemented"
summary: "CLI and MCP mutations use a shared operation request identity. Keep
  that identity and the original input when a reply is lost; a new ID is a new
  operation and can repeat effects."
parent: "sl"
sources:
  [
    "packages/ledger/src/application/receipts.ts",
    "packages/ledger/src/application/operations.ts",
    "packages/mcp/src/index.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
model: { "spec": "tla/MutationRetry.tla", "config": "tla/MutationRetry.cfg" }
diagramDetails:
  [
    {
      "diagram": 0,
      "node": "Unknown",
      "section": "Unknown does not mean unchanged",
    },
  ]
modelCheck:
  sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
  checker: tlc-1.7.4
  date: 2026-11-03T09:25:41.788Z
  config: tla/MutationRetry.cfg
  modelDigest: c89bcb993c8a7da8ebb62e43a8a504fa87137f77aca2a07dab86f7e4786cc50d
  states: 7
  held:
    - NoRepeatedEffect
    - MatchingReplay
  broke: []
  unchecked: []
---

# Recover a lost mutation reply

CLI and MCP mutations use a shared operation request identity. Keep that identity and the original input when a reply is lost; a new ID is a new operation and can repeat effects.

```mermaid
stateDiagram-v2
  [*] --> New
  New --> Started: Publish started receipt under lock
  Started --> Finished: Effect and outcome receipt recorded
  Started --> Unknown: Reply or completion receipt unavailable
  Finished --> Replayed: Same request and same input
  Unknown --> Unknown: Same request refuses repeat
  Finished --> Conflict: Request ID reused with different input
```

## Unknown does not mean unchanged

The owner publishes the started receipt before invoking the effect. A matching finished receipt replays success or failure. A started receipt without a finished receipt returns execution_unknown instead of executing again. Inspect the intended record and operation evidence; do not change the request ID just to get past uncertainty.

Cooperative mutations take one cross-process lock and recheck the receipt after acquiring it. Busy means another owner holds the lock. Crash recovery is conservative: abandoned locks/unfinished records are not evidence that prior effects are absent. Direct edits or APIs outside that boundary are not serialized by it.

Receipts are immutable publications through temporary files and no-replace hard links. They are not a transaction rolling back arbitrary effect writes. An error after an effect may still leave that effect present. No generic automatic repair command is promised here.

The bounded MutationRetry model explores one request, effect execution and completion-receipt loss. It checks that matching retries do not execute again and changed input is not accepted as the original request. It abstracts lock/filesystem integrity and serialization; it does not prove every operation's effect is atomic.

These models check finite safety only; completed states allow stuttering and terminal deadlock checks are disabled. No eventual progress is claimed.
