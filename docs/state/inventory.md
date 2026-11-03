---
id: "sl-inventory"
title: "Find a feature owner"
kind: "guide"
status: "implemented"
summary: "Map product families to their current source owners and reading paths."
parent: "sl"
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
sources:
  [
    "packages/ledger/src/index.ts",
    "packages/ledger/src/application/operations.ts",
    "packages/mcp/src/index.ts",
    "packages/server/src/routes.ts",
    "packages/ui/app/page.tsx",
  ]
diagramLinks: {}
---

# Find a feature’s owner

The inventory follows the exported core, shared operation vocabulary, server routes and reference-UI routes at the checkpoint. It maps feature families rather than presenting every helper as a separate app feature.

| Family                                                                                                | Reader page                                      | Source owner and existing evidence family                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Initialization, IDs, generated records and identity migration                                         | [Setup](setup.md), [plans](plans.md)             | cli/init, identity/{creation,migrate}; init/identity tests                                  |
| Claims, bindings, evidence ingestion, freshness and graph validity                                    | [Claims](claims.md)                              | verify/verify, evidence/{record,fingerprint}; verify/evidence break tests                   |
| Saved command execution, output capture, run history, local check adapter                             | [Checks](checks.md)                              | verify/{saved-check,local-check,execute}; saved-check and MCP tests                         |
| Screenshot coverage, attachment integrity and file preview                                            | [Checks](checks.md), [interfaces](interfaces.md) | evidence/{visual,artifact,image-preview}, session/evidence; visual/evidence/UI helper tests |
| Revision/request/standing authority, revocation, denial and browser approval                          | [Permission](permission.md)                      | permission/{authority,local-ui}; authority/local-ui break tests                             |
| Workstream drafts, spec documents, snapshots and executable work entry                                | [Plans](plans.md)                                | workstream, application/operations, context; workstream/permission tests                    |
| Turn open/close/abandon, computed facts and episode records                                           | [Turns](turns.md)                                | turns, episodes, git/tree; turn/episode tests                                               |
| Adversarial review, immutable resolutions, alignment and audit                                        | [Reviews](reviews.md)                            | reviews, align, audit; immutable/coverage/approval tests                                    |
| Cooperative mutation retry and lost replies                                                           | [Operations](operations.md)                      | application/{receipts,operations,schemas,errors}; lifecycle/MCP boundary tests              |
| Method stages, attempts, outputs and current satisfaction                                             | [Workflows](workflows.md)                        | workflows/index; workflow lifecycle/break tests                                             |
| Saved workflow library, default and local editor                                                      | [Library](library.md)                            | workflows/{index,options,local-ui}; library tests                                           |
| Requirement progress, session projection and complete gate                                            | [Completion](completion.md)                      | session/{project,evidence}; session/evidence break tests                                    |
| Deferred commitments and backlog                                                                      | [Deferrals](deferrals.md)                        | deferrals/index; deferral tests                                                             |
| Host-session association, bounded activity, warnings and unsupported controls                         | [Execution](execution.md)                        | execution, cli/activity-collector; execution lifecycle tests                                |
| Optional goals, immutable experiment results and observed/kept comparisons                            | [Experiments](experiments.md)                    | optimization; optimization lifecycle/break tests                                            |
| Feature/module map, impact and layer policy                                                           | [Graph](graph.md)                                | graph/impact, client/graph-shape; graph tests                                               |
| Vision, tenets, attributed corrections, related work and wait events                                  | [Context](context.md)                            | compass, related, automation, context; context/compass tests                                |
| CLI and MCP write adapters, client, GET-only service, bounded local UI routes                         | [Interfaces](interfaces.md)                      | cli/main, mcp/index, client/index, server/routes, ui/app/api; transport/UI helper tests     |
| Current/claims/features/nodes/contracts/turns/workstreams/compass/graph/workflows/experiments screens | [Root task map](README.md)                       | packages/ui/app and lib; UI helper tests, optional separate Next build                      |
| Agent authoring/review procedures                                                                     | [Plans](plans.md), [reviews](reviews.md)         | skills/sl-*; written procedures, not evidence an agent followed them                        |

Migration remaps legacy identities through an explicit staged CLI operation; it is not automatic on reads and was not executed on this repository's history for the atlas. Publishing workflows and release packaging are build/distribution boundaries. Files in research, historical workstreams and old design examples do not by themselves establish current reachable behavior.

All source families are mapped. Only the three named rule models are model-checked; this is not a promise that every feature has a finite model or that every branch received a new implementation test. The [evidence page](verification.md) states what actually ran.
