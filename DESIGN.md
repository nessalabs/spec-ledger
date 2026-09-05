# Design — Spec Ledger

Working product name: **Spec Ledger** (repo: `nessa-spec-test`).
CLI: `spec-ledger`. On-disk root: `.spec-ledger/`.

| Doc | Role |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Docs index |
| [`docs/architecture/work-model.md`](docs/architecture/work-model.md) | How work is shaped, sealed, built, broken |
| [`docs/architecture/episodes.md`](docs/architecture/episodes.md) | Turn spine + side collections |
| This file | Verify invariant, packages, truth ownership |

## Problem

Agents write code faster than humans can review it. Prompting alone does not
hold quality on long runs. Specs and ADRs rot unless something machine-checks
them. Architecture UIs lie when the graph is stale or “pass” means “passed once,
somewhere.”

## Solution in one sentence

**A verify verdict is a pure function of (ledger files, source tree, ingested
results) and carries digests of those inputs; nothing else may produce `pass`.**

## Design decisions (ours)

| Decision | Why |
| --- | --- |
| Verify is pure + digest-bearing | UI/CI/agents cannot invent `pass` |
| Binding ≠ result | Agents must not hand-edit “status: pass” onto bindings |
| `attested` never collapses to `pass` | Honest when evidence is human judgment |
| Results-file evidence seam | Any language can prove claims without a TS plugin API |
| Server is GET-only | Git is the write path; no “mark verified” button |
| Client is the only UI/embed gateway | Spec Ledger UI stays replaceable; no FS imports from UI |
| Core in `@nessalabs/spec-ledger`; thin client/server/ui | One implementable core; satellites stay small |
| CLI and MCP share application operations | Transport differences cannot change permission, evidence or completion semantics; [agent tools](docs/architecture/agent-tools.md) |
| Schemas as files under `schemas/` | SSOT without a schema package |
| Name `@nessalabs/spec-ledger*` / `.spec-ledger/` | Avoid npm/`@ledger` collisions |
| Workstreams + verticals, not `tasks/` | Shape Up: no fake WBS; one turn = one e2e-checkable slice |
| `opened.contextDigest` stamped at turn open | Context use is auditable, not honor-system |
| Automation event state machine + resume | Wait/timeout survives process death |
| Immutable review resolution + close gates | Blocking findings cannot be greenwashed |
| Revisioned seal snapshots (JCS) | Seal history is reproducible |
| Spec break → permission + snapshot → build → code break | Revision approval or scoped delegation; falsify after |
| Breaker owns killers; builder owns prod | Adversarial review is not oracle negotiation |
| Code-break evidence is a run (schema) | No test run → no representable finding / pass |
| `sl-*` stay in-repo; nessalabs engineering optional | Cheap-to-change gems shared via skills/references |
| Spec break is ledger-grounded via `related` pack | Tool finds neighborhood; agent doesn’t DIY worktrees |
| Sibling worktree scan is caution-only inside `related` | Authority is this checkout; parallel edits aren’t merged |
| Default alert: high / wait 10m / then move | Interrupt on serious gaps; don’t hang forever |
| Episodes + compass never affect `verify.ok` | Only claims/bindings/results/graph gate adherence |
| Turn id joins docs ↔ commits; SHAs are best-effort | Rebases rewrite SHAs; trailers + path history stay navigable |
| Finding → decision trail (+ review messages) | Spec Ledger UI can answer why X vs Y |
| Schema paths + child FKs are the query model | Efficient Spec Ledger UI joins without untyped bags |
| `commit-msg` hook when a turn is open | SL-Turn trailer is enforced, not optional |

## Two bounded contexts

| Context | Owns | Does not own |
| --- | --- | --- |
| **Claims / Evidence** | Claim IDs, bindings, results ingestion, verify report | UI, module call graphs |
| **Spec Ledger UI / Graph** | Features, modules, edges, layer policy, blast radius | Whether a claim is true |

They join **only by claim ID** (and optional `featureIds` on nodes). Graph may
reference claim IDs; claims/evidence must not import graph algorithms.

## Truth ownership

| Role | Truth? |
| --- | --- |
| Git + `.spec-ledger/` + source tree | **Yes** — write path |
| Ingested results files | **Yes** — produced by verify run |
| `spec-ledger` CLI | Computes report; does not invent pass |
| Local MCP adapter | Calls the same explicit operations as CLI; does not own gates or invoke agents |
| HTTP server | **Read-only** projection |
| Client SDK | Transport (in-process \| HTTP) |
| Reference UI (`packages/ui`) | Presentation only |

## Binding ≠ result

- **Binding** (committed): how we *intend* to check a claim — no `status: pass`.
- **Result** (from verify): what happened this run (`pass` \| `fail` \| `missing` \| `attested`).

## Evidence seam

```
vitest/pytest/cargo/shell  →  results.json  →  spec-ledger verify
```

## Repo layout

```
nessa-spec-test/
  DESIGN.md
  docs/architecture|research/
  schemas/
  packages/{ledger,client,server,ui}
  skills/   # sl-plan-* | sl-dev-* | sl-learn — see skills/README.md
  .spec-ledger/          # dogfood claims, turns, graph, …
```

## Consumer layout (any repo)

```
.your-repo/
  .spec-ledger/
    ledger.json
    claims/ bindings/ graph/ policy/ turns/
    # planned: vision.json tenets/ learnings/ themes/ workstreams/ …
```

## Enforcement

1. Claims + bindings in git.
2. `spec-ledger verify` → digests.
3. Fail on bad/missing evidence, dangling bindings, broken graph locators.
4. UI: matching digest or **unknown**.
5. Skills lower friction; **CI enforces**.

Pipeline: **sl-plan-vision → sl-plan-shape → sl-plan-break-spec → seal →
context → sl-dev-build → sl-dev-break (open turn) → close/verify**  
(+ `sl-learn` on corrections)

## Deferred

- AST / automatic graph extraction
- Embedding search / multi-tenant SaaS / Z3
- Server write APIs
- PR gate requiring a closed turn on every merge

## Naming

`@nessalabs/spec-ledger*`. On-disk `.spec-ledger/`. Avoid bare `@ledger`.

Permission and correction runtime: [permission.md](docs/architecture/permission.md). Explicit check execution and read-only evidence evaluation: [evidence.md](docs/architecture/evidence.md).
