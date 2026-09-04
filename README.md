# Spec Ledger

**Repo:** [nessalabs/spec-ledger](https://github.com/nessalabs/spec-ledger)

Generic **claim adherence** with a **Spec Ledger UI** for any codebase. Built so Nessa
(and later any product) can keep agent velocity high without quality rotting.

Episode attachments may reference **image/video** for code-review evidence
(`kind: image|video`); this repo stores metadata + path/URL only — no media CDN.

> **Hard invariant:** a verify verdict is a pure function of (ledger files,
> source tree, ingested results) and carries digests of those inputs. Nothing
> else may produce `pass`.

Design: [DESIGN.md](./DESIGN.md) · Docs: [docs/README.md](./docs/README.md) ·
Work model: [docs/architecture/work-model.md](./docs/architecture/work-model.md)

## Packages

| Package | Role |
| --- | --- |
| [`@nessalabs/spec-ledger`](packages/ledger) | Core + CLI (`init`, `verify`, `context`, `workstream`, `turn`) |
| [`@nessalabs/spec-ledger-client`](packages/client) | **Only** gateway for UIs / embedders |
| [`@nessalabs/spec-ledger-server`](packages/server) | Read-only HTTP API (no writes — SL-003) |
| [`@nessalabs/spec-ledger-ui`](packages/ui) | Spec Ledger UI (Next.js + `@nessalabs/ui`, client-only) |

Schemas live in [`schemas/`](schemas/) (SSOT files, not a package). Evidence
from any language is a [`results.json`](schemas/results.json) file — reporters
emit it; the ledger only ingests.

## Consumer install (0.1.0-alpha)

```bash
npm i -D @nessalabs/spec-ledger@0.1.0-alpha.0
npx spec-ledger init --name my-project
npx spec-ledger verify
```

Publish is on **GitHub Release** only (see `.github/workflows/publish.yml`).
Set repo secret `NPM_TOKEN` for the **nessalabs** npm org.

### Spec Ledger UI from a Release asset

UI is not an npm package in this alpha — download the `spec-ledger-ui-*.tgz`
asset from the GitHub Release. Pair it with published
`@nessalabs/spec-ledger-client` and `@nessalabs/spec-ledger-server` (API) from
npm, then:

```bash
npm i -D @nessalabs/spec-ledger-client@0.1.0-alpha.0 @nessalabs/spec-ledger-server@0.1.0-alpha.0
tar -xzf spec-ledger-ui-0.1.0-alpha.0.tgz
cd spec-ledger-ui && SPEC_LEDGER_ROOT=/path/to/your/repo npx next start --hostname 127.0.0.1 --port 3737
```

The Release tarball vendors `@nessalabs/ui` (not on the public registry for this
bet) into the shipped tree — do not pull that design-system package from npm.
Point `SPEC_LEDGER_ROOT` at any repo with `.spec-ledger/` after `spec-ledger init`.
Build the asset locally with `node scripts/pack-ui-release.mjs` (needs sibling
`nessa_ui`, or `NESSA_UI_ROOT`).

## Quick start

```bash
pnpm install
pnpm -r build
pnpm test
pnpm verify          # dogfoods this repo's .spec-ledger/
pnpm hooks:install   # SL-Turn commit-msg + staged JSON checks
pnpm ui              # http://127.0.0.1:3737
pnpm serve           # http://127.0.0.1:8787 — read-only HTTP API
```

Workstreams + context (P0):

```bash
pnpm exec spec-ledger workstream seal W-001 --by human
pnpm exec spec-ledger workstream check-seal W-001
pnpm exec spec-ledger context --workstream W-001 --slice SLC-01 --json
pnpm exec spec-ledger turn open \
  --workstream W-001 --slice SLC-01 --feature turns \
  --goal "Implement SLC-01 context path" \
  --prompt "Implement sealed context + contextDigest stamp"
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

Spec Ledger UI: **http://127.0.0.1:3737** via `pnpm ui`

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

Depend on **`@nessalabs/spec-ledger-client`** only:

```ts
import { createSpecLedgerClient } from "@nessalabs/spec-ledger-client"

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
