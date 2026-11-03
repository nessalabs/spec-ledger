---
id: "sl-experiments"
title: "Record experiments"
kind: "guide"
status: "implemented"
summary: "Optional optimization goals attach repeated experiments to existing authorized work. Ordinary tasks do not need a goal, and concluding a goal does not complete the workstream."
parent: "sl"
sources:
  [
    "packages/ledger/src/optimization/index.ts",
    "packages/ledger/src/optimization/model.ts",
    "packages/ledger/src/optimization/store.ts",
    "packages/ui/app/experiments/page.tsx",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Keep an honest experiment history

Optional optimization goals attach repeated experiments to existing authorized work. Ordinary tasks do not need a goal, and concluding a goal does not complete the workstream.

Choose a fixed metric/direction or a qualitative goal, then record a hypothesis and change for each attempt. A bounded experiment budget limits new attempts. Results keep the reported status, measurement and decision to keep or discard the change. A discarded result can be best observed without being best kept.

Each result belongs to one experiment and is immutable. Conflicting retries refuse; compatible retries can return the prior record. All pending experiments need results before conclusion. A reported target measurement is not a claim-verification pass, and qualitative goals cannot carry an invented numeric measurement.

The UI and read-only API expose goal history and comparisons. No benchmark is automatically launched by reading them. Actual experiment execution and trustworthy measurement remain the caller's responsibility.
