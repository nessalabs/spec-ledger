# Design — Spec Ledger

Working product name: **Spec Ledger** (repo: `nessa-spec-test`).
CLI: `spec-ledger`. On-disk root: `.spec-ledger/`.

Adversarial review (Fable 5.1) shaped this document. The goal is a **generic**
claim-adherence gate plus a **replaceable** viewing layer, so any codebase can
enforce quality under agent development, and any product can embed the data
plane without taking our UI.

## Problem

Agents write code faster than humans can review it. Prompting alone does not
hold quality on long runs (see complexity-governor findings). Specs and ADRs
rot unless something machine-checks them. Architecture UIs lie when the graph
is stale or “pass” means “passed once, somewhere.”

## Solution in one sentence

**A verify verdict is a pure function of (ledger files, source tree, ingested
results) and carries digests of those inputs; nothing else may produce `pass`.**

## Two bounded contexts (one package for now)

| Context | Owns | Does not own |
| --- | --- | --- |
| **Claims / Evidence** | Claim IDs, bindings, results ingestion, verify report | UI, module call graphs |
| **Lattice / Graph** | Features, modules, edges, layer policy, blast radius | Whether a claim is true |

They join **only by claim ID** (and optional `featureIds` on nodes). Import
direction: graph may reference claim IDs; claims/evidence must not import
lattice algorithms.

## Truth ownership (critical)

| Role | Truth? |
| --- | --- |
| Git + `.spec-ledger/` + source tree | **Yes** — write path |
| Ingested results files (from vitest/pytest/cargo reporters) | **Yes** — produced by verify run |
| `spec-ledger` CLI | Computes report; does not invent pass |
| HTTP server | **Read-only projection** of ledger + last report |
| Client SDK | Transport to server or in-process core |
| Reference UI | Presentation only |

**v1 absence:** the server has **no write endpoints**. No “mark verified”
button. CI and UI must agree because both read the same files / report digest.

## Binding ≠ result

- **Binding** (committed): `{ id, claimId, kind, locator }` — how we *intend*
  to check a claim.
- **Result** (produced by verify): `{ bindingId, outcome, ranAt, inputsDigest }` —
  what happened this run.

Never put `status: pass` on a binding. Agents will hand-edit it.

Outcomes:

| Outcome | Meaning |
| --- | --- |
| `pass` | Evidence succeeded |
| `fail` | Evidence ran and failed |
| `missing` | No result / skipped test / unbound required claim |
| `attested` | Human/agent attestation — **never collapses to pass**; policy decides if it counts |

## Evidence seam (language-agnostic)

Adapters are **not** a TypeScript plugin API. The contract is a **results file**
schema. Reporters in any ecosystem emit that file; the ledger only ingests.

```
vitest/pytest/cargo/shell  →  results.json  →  spec-ledger verify
```

Shell exit codes alone are too coarse for per-claim truth (a green suite can
hide a `.skip`). Prefer per-claim rows in the results file. Coarse `check`
bindings (one script → one claim) are allowed and honest when the script
guards exactly one rule.

## Package cut

Week-1 reality (Fable): one implementable package, schemas as files.

```
nessa-spec-test/
  DESIGN.md
  schemas/                 # JSON Schema SSOT (not a package)
  packages/
    ledger/                # core + CLI (init, verify, impact)
    client/                # thin typed SDK (in-process | HTTP) — embeddable
    server/                # read-only HTTP over ledger core
    ui/                    # reference Lattice UI — client only, replaceable
  skills/
    verify-before-done/
  .spec-ledger/            # dogfood: this product’s own claims
```

`client` / `server` / `ui` exist so the **Nessa pattern** is visible from day
one: UI never imports core FS; third parties depend on `@nessa/spec-ledger-client`
(or OpenAPI), not the UI package. Server stays thin.

## Consumer layout (any repo)

```
.your-repo/
  .spec-ledger/
    ledger.json            # root config + layer policy path
    claims/*.json
    bindings/*.json
    graph/codebase-graph.json
    policy/layers.json
  # reporters write e.g. .spec-ledger/results/last.json during CI
```

Zero product vocabulary inside the tool. Nessa terms live only in Nessa’s
`.spec-ledger/` data.

## Enforcement loop

1. Author claims + bindings in git.
2. CI / agent runs `spec-ledger verify` → report with digests.
3. Gate fails on: failing evidence, missing required evidence, dangling
   bindings, orphan required claims, graph locators that don’t resolve.
4. UI shows report only if digest matches current tree; else **unknown**.
5. Skills lower friction; **CI + hooks enforce**. Skills alone are prompting.

## Deferred (intentionally)

- AST / automatic graph extraction
- Embedding search
- Multi-tenant SaaS
- Z3 / formal proofs
- Server write APIs
- PR gate requiring a closed turn on every merge (policy later)

## Turns (change history)

Claims answer “is the system still allowed to look like this?”
Turns answer “what did this run change, and why?”

| Field | Who writes | Notes |
| --- | --- | --- |
| `intent` | Human / agent | Prompt, goal, acceptance, decisions, optional flows |
| `facts` | **`spec-ledger turn close` only** | Git file list, touched claims/features, blast radius, verify digests |

```bash
spec-ledger turn open --goal "…" [--prompt "…"] [--id T-001]
# … implement …
spec-ledger turn close [--id T-001]   # computes facts; exits non-zero if verify fails
```

On disk: `.spec-ledger/turns/<id>.json`. Lattice `/turns` is the change log.
Never trust agent-authored digests or blast radius.

## Naming

Avoid bare `@ledger` (npm collision with hardware wallets / accounting).
Packages use `@nessa/spec-ledger*`. On-disk directory is `.spec-ledger/`.
