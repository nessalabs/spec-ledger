# Spec Ledger (`nessa-spec-test`)

Generic **claim adherence** + **lattice viewing** for any codebase. Built so Nessa
(and later any product) can keep agent velocity high without quality rotting.

> **Hard invariant:** a verify verdict is a pure function of (ledger files,
> source tree, ingested results) and carries digests of those inputs. Nothing
> else may produce `pass`.

Design rationale (incl. Fable 5.1 review): [DESIGN.md](./DESIGN.md)

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
| `/` | Verify status, digests, schema badges |
| `/claims` | SL-* claims + bindings + outcomes |
| `/contracts` | HTTP route table, embed snippet, JSON Schema browser |
| `/graph` | Mermaid layer map, features, policy |
| `/turns` | Change log — intent + `turn close` facts |
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

## Agent skill

[`skills/verify-before-done`](skills/verify-before-done/SKILL.md) — run verify,
paste digests. Enforcement is CI + this CLI, not prompting alone.

## Nessa next

Seed `nessa-app/.spec-ledger/` from ADR ids (`KER-001`, …) and wire existing
`check-*.mjs` scripts as `command` bindings; add vitest/cargo reporters that
emit `results.json` keyed by claim id.
