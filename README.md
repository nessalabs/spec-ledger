# Spec Ledger (`nessa-spec-test`)

Generic **claim adherence** + **lattice viewing** for any codebase. Built so Nessa
(and later any product) can keep agent velocity high without quality rotting.

> **Hard invariant:** a verify verdict is a pure function of (ledger files,
> source tree, ingested results) and carries digests of those inputs. Nothing
> else may produce `pass`.

Design: [DESIGN.md](./DESIGN.md) · Docs: [docs/README.md](./docs/README.md) ·
Work model: [docs/architecture/work-model.md](./docs/architecture/work-model.md)

## Packages

| Package | Role |
| --- | --- |
| [`@nessa/spec-ledger`](packages/ledger) | Core + CLI (`init`, `verify`, `impact`, `layers`, `turn`) |
| [`@nessa/spec-ledger-client`](packages/client) | **Only** gateway for UIs / embedders |
| [`@nessa/spec-ledger-server`](packages/server) | Read-only HTTP API (no writes — SL-003) |
| [`@nessa/spec-ledger-ui`](packages/ui) | Reference Lattice (Next.js + `@nessa-ui/react`, client-only) |

Schemas live in [`schemas/`](schemas/) (SSOT files, not a package). Evidence
from any language is a [`results.json`](schemas/results.json) file — reporters
emit it; the ledger only ingests.

## Quick start

```bash
pnpm install
pnpm -r build
pnpm test
pnpm verify          # dogfoods this repo's .spec-ledger/
pnpm lattice         # http://127.0.0.1:3737 — Overview / Claims / Contracts / Graph / Turns / Verify
pnpm serve           # http://127.0.0.1:8787 — read-only HTTP API
```

Turns (intent + tool facts):

```bash
pnpm exec spec-ledger turn open --goal "Describe the change"
# … work …
pnpm exec spec-ledger turn close
```

In another repo:

```bash
pnpm exec spec-ledger init --name my-app
# add claims + bindings under .spec-ledger/
pnpm exec spec-ledger verify --root .
```

Serve read-only API:

```bash
pnpm serve
# GET http://127.0.0.1:8787/v1/contract
# GET http://127.0.0.1:8787/v1/snapshot
# GET http://127.0.0.1:8787/v1/schemas
```

Lattice web UI (nessa-ui): **http://127.0.0.1:3737** via `pnpm lattice`

| Route | Shows |
| --- | --- |
| `/` | Live verify, digests, latest turn freshness |
| `/claims` · `/claims/[id]` | Claims + bindings; claim turn history |
| `/features` · `/features/[id]` | Features + modules + turn history |
| `/nodes/[id]` | Module edges, blast radius, turn history |
| `/contracts` | HTTP route table, embed snippet, JSON Schema browser |
| `/graph` | Mermaid layer map, features, policy |
| `/turns` · `/turns/[id]` | Change log — intent + `turn close` facts |
| `/verify` | Full provenance-bearing report |

## Embed in your product

Depend on **`@nessa/spec-ledger-client`** only:

```ts
import { createSpecLedgerClient } from "@nessa/spec-ledger-client"

const client = createSpecLedgerClient({ kind: "http", baseUrl: "http://127.0.0.1:8787/" })
// or { kind: "inProcess", rootDir: process.cwd() }

const report = await client.verify()
const graph = await client.getGraph()
```

Build any UI you want. The reference UI is optional.

## Agent skills

Prefix **`sl-`** = Spec Ledger. Lanes: `sl-plan-*` (before code), `sl-dev-*`
(implement), `sl-learn`. See [`skills/README.md`](skills/README.md).

Pipeline: `sl-plan-vision` → `sl-plan-shape` → `sl-plan-break-spec` → seal →
`sl-dev-build` → (`sl-learn`) → `sl-dev-break` → `sl-dev-verify`.

| Skill | Role |
| --- | --- |
| [`sl-plan-vision`](skills/sl-plan-vision/SKILL.md) | Vision + tenets at project start |
| [`sl-plan-shape`](skills/sl-plan-shape/SKILL.md) | Grill → workstream + trust + policy |
| [`sl-plan-break-spec`](skills/sl-plan-break-spec/SKILL.md) | Spec adversary → human seal |
| [`sl-dev-build`](skills/sl-dev-build/SKILL.md) | One vertical at a time |
| [`sl-learn`](skills/sl-learn/SKILL.md) | High-signal corrections → learning/tenet |
| [`sl-dev-break`](skills/sl-dev-break/SKILL.md) | Code adversary |
| [`sl-dev-verify`](skills/sl-dev-verify/SKILL.md) | Close turn + digests |

Enforcement is CI + CLI, not prompting alone.

## Nessa next

Seed `nessa-app/.spec-ledger/` from ADR ids (`KER-001`, …) and wire existing
`check-*.mjs` scripts as `command` bindings; add vitest/cargo reporters that
emit `results.json` keyed by claim id.
