# Consumer CLI, npm publish, and sealed plan digests

**Workstream:** `W-005` · **Status:** spec_review (amended after SR-01 / SR-02; doc-digest fold-in)  
**Agent metadata:** [`.spec-ledger/workstreams/W-005.json`](../../.spec-ledger/workstreams/W-005.json)

---

## Problem

Other repos cannot adopt Spec Ledger without cloning this monorepo and wiring
`node packages/ledger/dist/cli/main.js` by hand. `init` only scaffolds a thin
ledger (no workstreams / vision / reviews dirs). Spec Ledger UI (the site that
shows what is going on) and the read path (`client` / `server`) are not
published, so “install the CLI” alone still leaves consumers blind. There is no
GitHub Release → npm publish path for a `0.1.0-alpha` line.

Separately: sealed bets point at Markdown via `specPath`, but seal only hashes
JSON fields. Pitch edits (renames, acceptance tweaks, anything) leave no
machine trail — `postSealAmends` is documented but unused, and audit does not
catch doc drift.

## Objective

Any Node repo can install Spec Ledger from npm, `spec-ledger init` a full
skeleton, verify honestly, and open Spec Ledger UI against that ledger — with a
Release workflow ready for `0.1.0-alpha.0` — and sealed plan Markdown is
digest-stamped so later edits require recorded amends (human Modifications log
+ machine `postSealAmends`).

## Trust & policy

- Deploy: library-consumer · User-facing · Correctness-critical  
- Evidence: unit, integration, e2e  
- `securitySensitive`: false for product code; **publish workflow negatives are
  still acceptance-bound** (NPM_TOKEN / mistaken publish)  
- Require spec-break + code-break · alert high → wait 10m → move  
- Sealed-spec deviation: wait 10m → move  
- Align approve required; slices name `expectedPaths`

## Normative init skeleton (SLC-01 / PC-015)

After `spec-ledger init [--name <name>]` succeeds, exactly these exist under
`.spec-ledger/` (relative to repo root found by `findRepoRoot`, else cwd):

| Path | Kind |
| --- | --- |
| `ledger.json` | file |
| `vision.json` | file (minimal stub: schemaVersion, summary placeholder, nonGoals:[], users:[], updatedAt, updatedBy: "init") |
| `claims/` | empty dir |
| `bindings/` | empty dir |
| `graph/codebase-graph.json` | file (system name from `--name`; empty features/nodes/edges; default layers) |
| `policy/layers.json` | file (default layer allowlist) |
| `results/` | dir with `.gitkeep` only |
| `turns/` | empty dir |
| `workstreams/` | empty dir |
| `proposed-claims/` | empty dir |
| `reviews/` | empty dir |
| `themes/` | empty dir |
| `tenets/` | empty dir |

**Not created by init:** live claims, bindings with outcomes, `status: pass`
anywhere, schemas copy, git hooks, `docs/workstreams/`.

**Negatives:**

- Re-init when `ledger.json` exists → refuse (non-zero); no clobber  
- Partial failure must not leave a successful `ledger.json` without the dirs
  above (create dirs first, write `ledger.json` last)  
- Git: prefer repo root; if no `.git`, init at cwd and print a one-line warning  

**Schemas strategy (this bet):** npm `@nessalabs/spec-ledger` ships `dist` + README
only; consumer verify uses in-package runtime validation already in dist.
Bundling `schemas/` into the npm package is **out of scope** (follow-on).

**Verify oracle after init:** `spec-ledger verify` runs; no claim outcome
`pass` is invented; no binding may contain `status` / pass fields (SL-001,
SL-002). Empty claims → ok or unbound/missing only, never greenwashed pass.

## Spec Ledger UI for consumers (SLC-03) — path B only

`@nessalabs/ui` / design-system is **not** assumed on the public npm registry
for this bet. Therefore:

- **Do not** publish `@nessalabs/spec-ledger-ui` to npm in this bet.  
- **Do** ship a **GitHub Release asset**: a runnable Spec Ledger UI artifact
  (e.g. standalone Next build tarball) plus published
  `@nessalabs/spec-ledger-client` and `@nessalabs/spec-ledger-server`.  
- Acceptance: one documented consumer one-liner (README section) to view a
  local `.spec-ledger/` after installing client/server from npm and downloading
  the Release UI asset. The shipped asset and all npm packages we publish must
  contain **zero** `file:` or `workspace:` dependency protocols.

## Publish set and version

Pinned version string: **`0.1.0-alpha.0`** (all published npm packages).
Publish target: **nessalabs** npm org / registry the maintainers already use
(`@nessalabs/*` package names unless publish Config says otherwise).

| Artifact | Channel |
| --- | --- |
| `@nessalabs/spec-ledger` (bin `spec-ledger`) | npm on GitHub Release |
| `@nessalabs/spec-ledger-client` | npm on GitHub Release |
| `@nessalabs/spec-ledger-server` (bin `spec-ledger-serve`) | npm on GitHub Release |
| Spec Ledger UI runnable | **Release asset only** (not npm) |

Packed `package.json` for npm packages must contain **no** `workspace:` or
`file:` dependency protocols; `files` / `exports` / `bin` include runnable
`dist`.

## Release workflow (SLC-04 / PC-018)

- Workflow file: `.github/workflows/publish.yml`  
- Triggers: `release: types: [published]` only for live publish; optional
  `workflow_dispatch` with `dry_run: true` defaulting to `npm publish --dry-run`  
- **Must not** publish on `push` / `pull_request`  
- Version published must equal the Release tag (strip leading `v` if present);
  mismatch → fail  
- Secret: `NPM_TOKEN` (docs in workflow comment + pitch); least privilege
  publish-only  
- **This bet completes** with workflow + docs + dry-run evidence. Cutting the
  first GitHub Release is an **optional human action** outside acceptance
  unless we explicitly choose to cut `0.1.0-alpha.0`.

## Sealed plan digests + amends (SLC-05 / PC-019)

**Problem today:** `specDigest` hashes workstream JSON only; Markdown at
`specPath` can change silently. `postSealAmends` exists in the work model but
is unused; audit does not enforce it.

**Mechanism (every consumer repo — not dogfood-specific):**

1. **At `workstream seal`:** if `specPath` is set, the file **must** exist;
   stamp `seal.specDocDigest = sha256(utf8 file bytes)` (hex) on the live seal
   **and** the immutable seal snapshot. If `specPath` is absent, omit
   `specDocDigest`. Never rewrite `seal.specDocDigest` after that seal
   revision (amends do not mutate it). Check-seal and audit compare this live
   pointer with the immutable snapshot even when an amendment is active.
2. **Last expected doc digest** (same algorithm everywhere):  
   - If `postSealAmends` exist for the active `seal.revision`, use that revision’s latest `afterDocDigest`; older amendments remain history only.
   - Else if `seal.specDocDigest` is present, use it.  
   - Else: **no expected digest** — incomplete for a sealed workstream that
     has `specPath` (upgrade / pre-feature seals in any repo).
3. **`workstream check-seal`:** always recompute JSON `specDigest` as today.  
   If sealed + `specPath` set + no expected digest → **fail** with remediation
   to run `workstream backfill-doc-digest`.  
   If expected digest exists → recompute file bytes; diverge → **fail**.
4. **`workstream backfill-doc-digest <W-id> --by <who>`** (upgrade path for
   **any** consumer): for a sealed workstream with `specPath` but missing
   `seal.specDocDigest` and no amends, write a **new** seal revision that
   copies the prior snapshot body, stamps `specDocDigest` from current file
   bytes, and points the live seal at it. Does not mutate prior
   `seals/N.json`. Idempotent if digest already present. This is how repos
   that sealed before this feature catch up — not a permanent soft-skip.
5. **`postSealAmends` (machine):** typed entries on the live workstream
   (excluded from `sealPayload` hash). Required:
   `at`, `summary`, `humanConfirmed`, `sealedRevision`, `beforeDocDigest`,
   `afterDocDigest`; optional `turnId`, `decisionId`, `commit`.  
   CLI: `spec-ledger workstream amend <W-id> --summary "…" --by <who>
   [--turn T] [--decision D]`  
   - Refused unless workstream has a seal.  
   - Requires an expected digest already (seal or prior amend); otherwise
     tell the user to `backfill-doc-digest` first.  
   - `beforeDocDigest` = last expected; `afterDocDigest` = hash of current
     file (edit must already be on disk).  
   - No-op refuse if before === after.  
   - Appends only — never edits prior amends or `seal.specDocDigest`.
6. **Audit:**  
   - `spec-doc-digest-missing` (**error**): sealed + `specPath` + no expected
     digest → fail `ledger:audit` (same remediation: backfill).  
   - `spec-doc-digest-drift` (**error**): expected digest exists and live
     file bytes ≠ expected → fail.  
   - `seal-digest-drift` (**error**): live `sealPayload` ≠ seal snapshot body
     without re-seal.
7. **Human surface:** sealed pitches use trailing `## Modifications`. Each
   amend adds one row (date, commit/turn link, one-line summary). Same git
   commit should include Markdown edit + `postSealAmends` (+ related code).
8. **Cosmetic vs obligation:** same amend pipe for doc bytes; sealed JSON
   acceptance changes still need decision + `onSealedSpecDeviation`.

**Out of this slice:** mutating old `seals/N.json` in place; hashing docs
beyond `specPath`; UI editor for amends (CLI + audit first).

## Acceptance (whole bet)

- Init matches the normative table; negatives hold; verify oracle holds  
- Ledger tarball install outside monorepo runs `spec-ledger --help`, `init`,
  `verify`  
- Client + server tarballs install/resolvable against packed ledger; no
  workspace/file protocols  
- Spec Ledger UI Release-asset path documented and buildable with zero
  `file:` / `workspace:` in the artifact  
- `publish.yml` exists with Release-only live publish + dry-run dispatch;
  ci.yml does not publish  
- Seal stamps `specDocDigest` (immutable per revision); check-seal + audit
  **fail** when sealed+`specPath` has no expected digest (remediation:
  `backfill-doc-digest`) or when bytes drift; `workstream amend` records
  `postSealAmends` without mutating seal; Modifications is the human log  
- This dogfood repo’s pre-feature seals are **backfilled** via that same
  consumer upgrade path (new seal revision + `specDocDigest`), not a special
  soft-skip rule  

## Out of scope

- Auto-publish on every `main` push  
- Publishing `@nessalabs/spec-ledger-ui` to npm  
- Publishing or replacing `@nessalabs/ui` design system  
- Installing `sl-*` skills into consumer repos  
- Multi-language CLIs  
- Bundling `schemas/` into the npm tarball  
- Public marketing site beyond Spec Ledger UI  
- Verify inventing green for empty ledgers  
- Cutting the first alpha Release (optional human)  
- In-place mutation of old `seals/N.json` (backfill always writes a new revision)

## Verticals

### SLC-01 — Full consumer init

Normative skeleton + negatives + verify oracle (SL-001, SL-002).

### SLC-02 — Installable CLI (+ client/server pack oracles)

`pnpm pack` ledger → install outside monorepo → bin works. Client/server pack
json has no workspace/file; installs resolve.

### SLC-03 — Spec Ledger UI Release asset

Build/attach runnable UI without monorepo `file:` / `workspace:` links; README
one-liner; depends on published client/server.

### SLC-04 — Release → npm workflow

`publish.yml` as specified; dry-run proves steps; no publish from PR/main;
nessalabs registry/org.

### SLC-05 — Sealed plan digests + amends

`specDocDigest` on seal; `backfill-doc-digest` upgrade CLI; check-seal +
audit fail on missing expected digest or drift; `workstream amend` +
`postSealAmends`; Modifications convention; fixtures for silent edit → fail,
amend → pass.

## Sequence

SLC-01 → SLC-05 → SLC-02 → SLC-04 → SLC-03  
(seal integrity before packing/publishing; UI asset last).

## Proposed claims

- PC-015 — init skeleton + verify honesty  
- PC-016 — installable ledger bin (+ client/server pack cleanliness)  
- PC-017 — Spec Ledger UI Release asset (not npm UI)  
- PC-018 — Release-only npm publish workflow for alpha packages  
- PC-019 — sealed `specDocDigest` + amend trail + audit drift  

## Modifications

| When | Link | Summary |
| --- | --- | --- |
| 2026-09-04 | pre-seal amend (SR-02 follow-on) | Folded sealed plan `specDocDigest` + `postSealAmends` + audit + Modifications; product UI name Lattice → Spec Ledger in this pitch |
| 2026-09-04 | pre-seal amend (SR-03) | Clarified immutable `seal.specDocDigest` + amend negatives + `seal-digest-drift` |
| 2026-09-04 | pre-seal amend (consumer-generic) | Removed dogfood grandfather skip; sealed+specPath with no digest fails until `backfill-doc-digest` (any consumer); retrofit this repo via that path |
| 2026-09-04 | T-022 | Publish scope is `@nessalabs/*` (not `@nessa/*`) for ledger, client, and server packages |
| 2026-09-04 | T-024 | SLC-03 UI Release asset: pack-ui-release vendors @nessalabs/ui+client; README client/server one-liner; publish.yml uploads asset |

| 2026-09-04 | T-025 | PR review fixes: scope amendments to their seal revision, validate immutable document pointers, remove mutating pack hooks, and make CI artifact tests self-contained; prepare the real UI asset before publishing. |
