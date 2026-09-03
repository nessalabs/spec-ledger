# Spec Ledger — Episode architecture (implementation contract)

**Status:** Ready to implement (HLD + LLD) — **read with**
[`work-model.md`](./work-model.md) (hierarchy + agents).  
**Date:** 2026-09-02  
**Repo:** `nessa-spec-test`  
**Audience:** humans approving the model; agents implementing it end-to-end  

This document is the **episode** contract (turn spine + side collections).  
The **work hierarchy** (theme → feature → workstream → turn) and agents live in
the work-model doc. Both are in scope to build.

Companions:

- [`work-model.md`](./work-model.md) — hierarchy + agents (**start here**)
- [`../research/project-anatomy.md`](../research/project-anatomy.md)
- [`../research/high-velocity-decisions.md`](../research/high-velocity-decisions.md)
- [`../../DESIGN.md`](../../DESIGN.md)
- Index: [`../README.md`](../README.md)

---

## 0. One-sentence contract

**A turn is a thin episode aimed at a product feature (`restatedGoal` + scope FKs) with
a tool-owned open basis; all judgment and narrative live in typed side-collections
keyed by `turnId`; verify stays blind to episodes; audit is hygiene; facts are
recomputable — never nest the universe into the turn, never use an untyped
metadata bag.**

---

## 1. Problem

Spec Ledger already answers: **“Is the system still allowed to look like this?”**
(claims + verify + digests).

It must also answer:

1. **What part of the product is this work for?** (feature; bet-level why on workstream)
2. **What did this episode change?** (tool facts)
3. **What judgments did we make, and what cues forced them?** (decisions + sources)
4. **What experiments, reviews, diagrams, and large artifacts belong to the episode?**
   (probes, reviews, flows, attachments)

…without agent-authored digests, turn mega-JSON, or inventing `pass` outside verify.

---

## 2. Hard invariants

1. **Verify** is a pure function of the **adherence plane** only (see §3.1).
   Nothing else may produce `pass`.
2. **Binding ≠ result.** Bindings have no status.
3. **`attested` ≠ `pass`.**
4. **Server is read-only (GET only).** Git is the write path for all ledger files.
5. **Turn `opened` and `facts` are tool-only.** Agents must not author digests,
   file lists, blast radius, or open basis.
6. **Episode records never mint verify outcomes** (no decision/review/probe field
   means “verified” or “pass”).
7. **No untyped `metadata` bag.** Every association is a typed collection + schema.
8. **UI imports only `@nessa/spec-ledger-client`**, never core FS APIs.

---

## 3. HLD

### 3.1 Three planes

| Plane | Contents | May affect `verify.ok`? |
| --- | --- | --- |
| **Adherence** | `ledger.json`, claims, bindings, graph, policy, ingested results, source tree | **Yes** |
| **Compass** | vision, tenets, learnings | **No** |
| **History / episodes** | turns, decisions, sources, attachments, probes, reviews, flows, automation events, audit | **No** |

`ledgerDigest` / verify input digests **exclude** compass + history (avoids
close → digest cycle). A separate `historyDigest` may exist for Lattice cache only.
Agents load joins via `getVerticalContext` (work-model §9.1).

### 3.2 Product anatomy (standing) vs episode (temporary)

From project-anatomy research: durable **parts** precede temporary **pulses**.

```
STANDING (product)
├── vision + tenets + learnings   ← compass (not verify)
├── themes (optional)
├── features              ← primary “part of the project”
├── nodes + edges + layers
├── claims                ← standing obligations
└── bindings → results → verify

PLAN (shaped bet — history plane)
└── workstreams/          ← grill/shape output; suggested slices (not tasks/)

EPISODE (temporary effort *for* a workstream/feature)
├── turn                  ← thin spine only (= one task when executing)
├── decisions/            ← judgments (turnId)
├── sources/              ← cues (turnId, optional decisionId)
├── attachments/          ← large blobs (turnId, optional parent refs)
├── probes/               ← intentional experiments (turnId)
├── reviews/              ← human/agent review of a turn (turnId)
└── flows/                ← before/after narrative diagrams (turnId)
```

### 3.3 Thin turn spine

The turn file holds **only**: identity, status, tool `opened`, authored `intent`
(`restatedGoal` + feature scope), tool `facts` when closed/abandoned.

**Nothing else nests into the turn.**

### 3.4 Join graph

```
Feature *──* Workstream *──* Turn
Feature *──* Turn
Turn 1──* Decision 1──* Source
Turn 1──* Source                 (unlinked cue inbox)
Turn 1──* Attachment
Turn 1──* Probe ──?──► Source / Decision
Turn 1──* Review
Turn 1──* Flow
Claim *──* Decision
Claim *──* Turn                  (expected vs touched)
Attachment *──?── Decision|Source|Probe|Review|Flow
```

All list/query APIs are **derived joins** over files. Never store a mega-bundle on disk.

### 3.5 Extensibility rule (for implementers)

After this contract ships, a *new* association kind requires:

1. `schemas/<kind>.json`
2. `.spec-ledger/<kindDir>/` + `ledger.json` path field
3. Required `turnId` (path encoding per §5)
4. `LoadedEpisodes` + client + HTTP GET + Lattice bundle updates
5. **No** new fields on `Turn` except true spine needs

**In this contract the episode kinds are complete:**  
decision · source · attachment · probe · review · flow  
(+ audit as the hygiene report, not an association on the turn).

---

## 4. On-disk layout

```
.spec-ledger/
  ledger.json
  claims/
  bindings/
  graph/codebase-graph.json
  policy/layers.json
  policy/audit.json                 # severities for history hygiene
  results/last.json                 # ingested evidence (adherence)
  results/report.json               # verify report (adherence)
  results/audit.json                # episode hygiene (history; never merged into report.ok)

  turns/T-002.json
  turns/T-002.prompt.md             # optional; when userPrompt is huge (same hygiene)

  decisions/T-002/D-01.json         # id "T-002/D-01"
  sources/T-002.json                # one file per turn; items[]
  attachments/T-002/A-01.json       # metadata; body file beside it when large
  attachments/T-002/A-01.md
  probes/T-002/P-01.json
  reviews/turns/T-002/R-01.json
  reviews/workstreams/W-001/SR-01.json   # spec adversarial (target: spec)
  flows/T-002/F-01.json
  automation-events/AE-001.json
```

`ledger.json` paths:

```json
{
  "schemaVersion": 1,
  "name": "…",
  "claimsDir": "claims",
  "bindingsDir": "bindings",
  "turnsDir": "turns",
  "decisionsDir": "decisions",
  "sourcesDir": "sources",
  "attachmentsDir": "attachments",
  "probesDir": "probes",
  "reviewsDir": "reviews",
  "flowsDir": "flows",
  "graphPath": "graph/codebase-graph.json",
  "policyPath": "policy/layers.json",
  "auditPolicyPath": "policy/audit.json",
  "resultsPath": "results/last.json",
  "reportPath": "results/report.json",
  "auditReportPath": "results/audit.json"
}
```

Update `schemas/ledger-root.json` so these fields are allowed and documented.

---

## 5. ID rules

| Kind | Id pattern | Path |
| --- | --- | --- |
| Turn | `T-[0-9]{3,}([.][0-9]+)?` | `turns/{id}.json` |
| Decision | `{turnId}/D-[0-9]{2,}` | `decisions/{turnId}/D-NN.json` |
| Source item | `{turnId}/S-[0-9]{2,}` | inside `sources/{turnId}.json` |
| Attachment | `{turnId}/A-[0-9]{2,}` | `attachments/{turnId}/A-NN.json` (+ optional body) |
| Probe | `{turnId}/P-[0-9]{2,}` | `probes/{turnId}/P-NN.json` |
| Review | `{turnId}/R-[0-9]{2,}` | `reviews/turns/{turnId}/R-NN.json` |
| Spec review | `{workstreamId}/SR-[0-9]{2,}` | `reviews/workstreams/{workstreamId}/SR-NN.json` |
| Flow | `{turnId}/F-[0-9]{2,}` | `flows/{turnId}/F-NN.json` |
| Automation event | `AE-[0-9]{3,}` | `automation-events/AE-….json` |

- Never reuse ids. Gaps OK.
- Record embeds `turnId`; path must match; audit flags mismatch.
- Turn-scoped numbering avoids cross-worktree collisions on side collections.
- Allocate with exclusive create + collision retry. No global `nextId()` counter file.

---

## 6. Schemas (LLD)

### 6.1 Turn — `schemas/turn.json`

Still **pre-alpha**: keep `schemaVersion: 1` and evolve the shape in place.
Do not mint a parallel v2 / dual-read layer until something outside this repo
depends on the old turn JSON.

```ts
Turn {
  schemaVersion: 1
  id: TurnId
  status: "open" | "closed" | "abandoned"
  openedAt: datetime
  closedAt?: datetime              // set on close or abandon
  opened: {                        // TOOL ONLY at `turn open`
    producedBy: string
    baseCommit: string | null
    treeDigest?: string
    dirtyAtOpen: string[]          // empty unless --allow-dirty
    // Context provenance — required when intent.workstreamId set (unless --no-context)
    contextDigest?: string         // from getVerticalContext; JCS+sha256
    contextWorkstreamId?: string
    contextSliceId?: string
    contextSealRevision?: number
    contextGeneratedAt?: datetime
    noContextReason?: string       // only with --no-context
  }
  intent: {
    userPrompt: string             // sanitized ask — see § Intent.userPrompt hygiene
    userPromptRef?: string         // e.g. "turns/T-002.prompt.md" (same hygiene)
    restatedGoal: string           // what this episode will do (one line; not a second “why”)
    workstreamId?: string          // required when builder works from a workstream
    featureIds: string[]           // graph features this turn is FOR
    primaryFeatureId?: string
    expectedClaimIds?: string[]
    sliceId?: string               // workstream suggestedSlices id when applicable
    acceptanceCriteria?: string[]
    outOfScope?: string[]
    changeType?: "feature"|"refactor"|"fix"|"migration"|"chore"|"docs"
    riskLevel?: "low"|"moderate"|"elevated"|"high"
    summaryForSearch?: string
    keywords?: string[]
  }
  facts?: TurnFacts                // TOOL ONLY at close/abandon
}
```

### Intent.userPrompt hygiene

`userPrompt` is the **ledger-facing** record of what the human asked — not a raw
chat dump. Chat is ephemeral and messy; the turn file is durable and often
shared. Before `turn open` (or writing `userPromptRef`), the opener **must**
normalize the ask:

| Do | Do not |
| --- | --- |
| Fix spelling / grammar so it reads cleanly | Change meaning, scope, or constraints |
| Make it one cohesive ask (light cleanup of fragments) | Invent goals the human did not state |
| Redact secrets, tokens, passwords, private keys, auth headers, pasted `.env` / credentials | Store raw secrets “for fidelity” |
| Redact or generalize obvious PII / customer-identifying dumps when not needed for the work | Paste large private datasets into the turn |
| Strip abusive / harassing language; keep the technical ask | Soften away a real requirement (“never X”) |
| Prefer a short stub + `userPromptRef` when the cleaned ask is still huge | Dump megabytes of chat into `userPrompt` |

`restatedGoal` is the builder’s one-line plan for the episode — not a substitute
for a cleaned `userPrompt`, and not a second “why” field. Bet-level **why**
lives on the workstream (`problem` / `objective`); themes hold standing business
labels. If something sensitive was needed transiently, keep it out of git; do
not put it in `attachments/` either unless the human explicitly wants it
ledgered after redaction.

**TurnFacts (tool-only, recomputable):**

```ts
TurnFacts {
  producedBy: string
  producedAt: datetime
  baseCommit: string | null
  headCommit: string | null
  worktreeDirty: boolean
  files: TurnFileChange[]
  touchedNodeIds: string[]
  touchedFeatureIds: string[]
  touchedClaimIds: string[]
  blastRadius: { direct: string[]; transitive: string[] }
  schemaSurfaceChanged: boolean
  verify: {
    ok: boolean
    ledgerDigest: string           // adherence plane only
    resultsDigest: string
    treeDigest: string
    inputDigest: string
    producedAt: datetime
  }
  decisionIds: string[]
  decisionsDigest: string
  sourcesDigest: string
  attachmentsDigest: string
  probesDigest: string
  reviewsDigest: string
  flowsDigest: string
  intentDigest: string
  refs: {
    unresolvedClaimIds: string[]
    unresolvedFeatureIds: string[]
    unresolvedDocRefs: string[]
    unresolvedFollowUps: string[]
  }
}
```

Rules:

- `turn open` refuses dirty tree unless `--allow-dirty`.
- Exactly one `open` turn per checkout; never silently close.
- When `--workstream` is set: tool runs `getVerticalContext` (resume timeouts
  first), stamps `opened.contextDigest` + seal revision. `--no-context` requires
  `--no-context-reason`. Audit `builder-without-context` if workstream turn lacks
  digest.
- `turn close` / `turn abandon` both write facts; abandon sets `status: abandoned`.
- After close/abandon: **no new side-records**. Prefer a **new turn** (there is
  no `turn reopen`).
- **Code-adversarial reviews and tests land while the turn is still `open`**
  (break → fix → close). Do not write code-break reviews after close.
- Spec reviews (`target: "spec"`) live under `reviews/workstreams/` and are not
  turn-scoped.
- **`turn close` refuses** when `requireCodeBreak` and no code-adversarial review
  exists for this turn (unless typed waiver), or when any **unresolved blocking**
  review findings / `blocked` automation events remain for this turn. This is
  history/audit policy — it does not invent `verify.ok`.

### Provenance chain — docs ↔ turns ↔ commits

Humans often navigate by reading a **doc or feature**, then the **changes that
came from it**, then the **next doc/code** that superseded it. Spec Ledger must
make that chain joinable without hand-maintaining commit SHAs inside documents.

#### Stable vs brittle identifiers

| Identifier | Stable across rebase/amend? | Role |
| --- | --- | --- |
| **Turn id** (`T-002`) | Yes | **Primary join key** everywhere |
| Workstream / slice / feature / claim ids | Yes | Scope of the episode |
| **Paths** touched (`facts.files[].path`) | Yes (as names) | Doc ↔ code adjacency |
| `treeDigest` / file content digests | Yes for same bytes | “Same tree/content, new SHA” |
| **Commit SHA** (`facts.headCommit` / `commit`) | **No** — rebase/amend/squash rewrite it | Best-effort pointer at close time; Lattice may show **stale/unknown** if missing |

Do **not** paste commit SHAs into docs as the source of truth — they rot. Prefer
turn ids (and feature ids) if a doc needs an explicit cross-link.

#### How the chain forms (no extra WBS)

```
feature / claim
    │  claimedFeatureIds / touchedFeatureIds / graph.featureId
    ▼
turn (T-00N)          ← durable hub
    │  facts.files[]  (includes docs/** and code)
    │  opened.baseCommit … facts.headCommit  (range, best-effort SHAs)
    ▼
git commits in that episode
    │  message trailers (below)
    ▼
next turn that touches the same path or feature  →  evolution chain
```

**Doc evolution for a path** (e.g. `docs/architecture/work-model.md`):

1. List closed turns whose `facts.files` include that path, ordered by `closedAt` / id.
2. Each step is “the episode that changed this doc (and usually the code it describes).”
3. Feature history is the same join filtered by `touchedFeatureIds` / `featureIds`.

Lattice should expose these joins (`turnsTouchingPath`, feature history, turn
bundle) — not require authors to maintain a changelog of SHAs in Markdown.

Optional later: `facts.refs.unresolvedDocRefs` / graph locators when a turn cites
a doc path that no longer exists (rename/delete) so the chain can flag a break.

#### Commit messages (every commit in the episode)

Commits should be readable by a human **and** recoverable by tooling. Subject
line stays normal prose. Body (or trailers) carries Spec Ledger ids so
`git log` / PR review / blame can jump back to the ledger:

```
Close Lattice turn-detail gaps

SL-Turn: T-002
SL-Workstream: W-001
SL-Slice: SLC-03
SL-Features: turns,lattice
SL-Claims: SL-005
```

Rules:

- **Required on the closing commit** of a turn (the one `turn close` records as
  `headCommit`): at least `SL-Turn: T-00N`.
- **Recommended on every commit** while the turn is open (same turn id).
- Do not invent claim/feature ids that the turn did not touch.
- Trailers are **hints for navigation**, not verify inputs (history plane).
- If history is rewritten, trailers should be **replayed onto the new commits**
  (rebase/reword keeps the turn id even when the SHA changes).

`turn close` should prefer recording **`baseCommit` (at open) + `headCommit` (at
close)** and the file list — not a single orphan SHA. A later `turn check` may
report “commit missing locally” without failing `verify.ok`.

#### Commit-message gate (git hooks)

Trailers are useless if optional in practice. Gate them with **git hooks**
(repo-local, not Cursor agent hooks):

| Hook | Job |
| --- | --- |
| `commit-msg` | If an **open** turn exists under `.spec-ledger/turns/`, require `SL-Turn: <that-id>` in the message (exact id). Refuse otherwise. If no open turn, allow (chore/docs outside an episode). |
| optional `pre-commit` | Validate staged `.spec-ledger/**/*.json` and `schemas/*.json` against the published JSON Schemas (fail closed on schema miss). |

Install: `git config core.hooksPath scripts/git-hooks` (see
[`scripts/git-hooks/README.md`](../../scripts/git-hooks/README.md)) or
`pnpm hooks:install`.

CI may re-check the same trailer rule on commits that touch `.spec-ledger/` or
product paths while a turn file is `status: open` in that commit — defense in
depth; local hook is the fast path.

#### Doc → commit and commit → doc

| Direction | How |
| --- | --- |
| Doc → episodes that changed it | Turns whose `facts.files` include the path |
| Doc → “current” code | Graph locators / feature nodes cited by that doc’s feature |
| Commit → turn | Parse `SL-Turn` trailer; fallback: turn whose commit range contains the SHA (best-effort) |
| Turn → commits | `opened.baseCommit`…`facts.headCommit` + trailers on those commits |
| Feature → doc + code history | Feature history = turns (+ files) for that `featureId` |

#### Out of scope (for now)

- Embedding full patch text in the ledger (git already stores it).
- Treating commit trailers as adherence evidence.
- Auto-rewriting SHAs inside Markdown after every rebase.

### 6.2 Decision — `schemas/decision.json`

```ts
Decision {
  schemaVersion: 1
  id: string                       // "T-002/D-01"
  turnId: TurnId
  kind: "conform"|"clarify"|"deviate"|"add"|"defer"|"reject"
  title: string                    // ≤120 chars
  rationale: string
  claimIds?: ClaimId[]             // ≥1 for claim-grounded kinds unless basis set
    // When citing sealed acceptance (required shape for sealed-spec deviate):
    //   workstreamId + sealedRevision + acceptanceIndex
    // acceptanceIndex indexes slice.acceptance when sliceId set, else
    // workstream.acceptanceCriteria (from the seal snapshot).
    basis?: {
      workstreamId?: string
      sealedRevision?: number
      sliceId?: string
      acceptanceIndex?: number
      tenetIds?: string[]           // for timeout weigh / residualRisk — not alone for deviate
      learningIds?: string[]
    }
    docRefs?: { path: string; anchor?: string }[]
    actual?: string                  // required for deviate
    alternativesRejected?: string[]
    consequences?: string[]
    residualRisk?: string            // required when acting on agent-inferred tenets alone
    followUpClaimId?: ClaimId
    addressesFindingIds?: string[]   // "T-002/R-01#F-01" — review catch → this judgment
}
```

| Kind | Meaning | Required |
| --- | --- | --- |
| `conform` | Consistent with cited claims or sealed criterion | `claimIds≥1` **or** sealed `basis` |
| `clarify` | Ambiguity resolved; obligation unchanged | `claimIds≥1` **or** sealed `basis` |
| `deviate` | Intentionally different from claim **or** sealed acceptance | (`claimIds≥1` **or** sealed `basis` with workstreamId+sealedRevision+acceptanceIndex), `actual` |
| `add` | New behavior/obligation | `followUpClaimId` (or add claim same change) |
| `defer` | Recognized, postponed | `followUpClaimId` or backlog docRef |
| `reject` | Declined change in favor of a claim | `claimIds≥1` **or** sealed `basis` |

Encode conditionals in JSON Schema `allOf/if/then`. Tenet-only `basis` is for
weigh/timeout documentation + `residualRisk`, not for `deviate` alone.

Encode conditionals in JSON Schema `allOf/if/then`.  
**Not in schema:** `mode`, `situation`, `specified`, agent timestamps.  
Sources point at decisions — not the reverse.

### 6.3 Sources — `schemas/sources-file.json` (one file per turn)

```ts
SourcesFile {
  schemaVersion: 1
  turnId: TurnId
  items: SourceItem[]              // max 64
}

SourceItem {
  id: string                       // "T-002/S-01"
  decisionId?: string
  kind: "user"|"claim"|"doc"|"runtime"|"observation"|"prior-turn"|"external"|"probe"|"tenet"|"learning"|"review"
  ref?: string
  quote?: string                   // ≤500
  note?: string                    // ≤300
  attachmentId?: string
  probeId?: string
}
```

| Kind | `ref` shape |
| --- | --- |
| `claim` | claim id |
| `tenet` | `TN-…` |
| `learning` | `LN-…` |
| `doc` | `path[#anchor]` |
| `prior-turn` | earlier turn id |
| `review` | `T-002/R-01` or `T-002/R-01#F-01` |
| `external` | URL |
| `probe` | probe id or command |
| `runtime` / `observation` / `user` | optional |

Source = **cue occurrence** this turn. Same cue for two decisions ⇒ two items (or one item, one decision).

### 6.4 Attachment — `schemas/attachment.json`

```ts
Attachment {
  schemaVersion: 1
  id: string                       // "T-002/A-01"
  turnId: TurnId
  kind: "prompt"|"rationale"|"log-excerpt"|"diff-note"
      |"image"|"video"|"image-ref"|"other"
  title?: string
  mediaType?: string               // IANA, e.g. image/png, video/mp4
  path: string                     // under attachments/{turnId}/ OR external ref URL
  byteLength?: number              // tool on add
  contentDigest?: string           // tool on add (of local file bytes when present)
  decisionId?: string
  sourceId?: string
  probeId?: string
  reviewId?: string                // CR finding / review this media supports
  flowId?: string
}
```

**Code-review media:** `kind: "image"|"video"` (and `image-ref`) are first-class so
reviews can point at screenshots or short clips. Spec Ledger stores **metadata +
path/URL only** — it does not host or stream binary media. Prefer linking a
checkout path or an external URL; do not commit large binaries to this repo
unless the product explicitly needs them dogfooded.

Default text size cap 256 KiB for text bodies; warn on secret heuristics; never
store credentials.

### 6.5 Probe — `schemas/probe.json`

```ts
Probe {
  schemaVersion: 1
  id: string                       // "T-002/P-01"
  turnId: TurnId
  hypothesis: string
  method: string
  command?: string
  resultSummary: string
  outcome: "supports"|"rejects"|"inconclusive"
  decisionId?: string
  attachmentIds?: string[]
}
```

Not executed by verify. Optional `source` with `kind: probe` + `probeId` for the cue trail.

### 6.6 Review — `schemas/review.json`

```ts
Review {
  schemaVersion: 1
  id: string                       // "T-002/R-01" or "W-001/SR-01"
  turnId?: TurnId
  workstreamId?: string
  kind?: "human"|"adversarial"|"discussion"
  target?: "spec"|"code"
  reviewer: string
  verdict: "approve"|"request-changes"|"comment"
  summary: string
  blocking?: boolean               // set at authoring; do not clear by mutating
  // Required when verdict === "approve" && target === "code" && kind === "adversarial"
  killersCited?: string[]          // non-empty — citedTest ids or command labels run
  alertOnSeverity?: "low"|"moderate"|"high"|"critical"
  interrupt?: {
    mode: "move"|"block"|"wait"
    eventId?: string
  }
  checklist?: { id: string; ok: boolean; note?: string }[]
  findings?: {
    id: string                     // "F-01" — stable for resolution refs
    severity: "low"|"moderate"|"high"|"critical"
    claimId?: ClaimId
    gap: string                    // what was wrong / missing
    fixProposal?: string           // what they asked for
    // Code-adversarial: evidence REQUIRED (schema if/then). No bare path-only.
    evidence?: ReviewEvidence
    // Deprecated for code-adversarial — do not use as sole proof
    evidencePath?: string
    messages?: ReviewMessage[]
  }[]
  messages?: ReviewMessage[]
  resolvesReviewId?: string
  supersedesReviewId?: string
  resolvesFindingIds?: string[]
  resolution?: {
    at: datetime
    by: string
    note?: string
  }
  residualRisks?: string[]
  attachmentIds?: string[]
  externalRef?: string
}

ReviewEvidence =
  | {
      kind: "command"
      command: string
      observedOutput: string         // hygiened excerpt
      exitCode?: number
    }
  | {
      kind: "test"
      citedTest: string              // file::name or stable id
      ran: true                      // const — omit/false unrepresentable
      command?: string
      observedOutput?: string
    }

ReviewMessage {
  id: string
  at: datetime
  by: string
  role: "reviewer"|"author"|"agent"|"human"
  body: string
  inReplyTo?: string
  findingId?: string
}
```

**JSON Schema conditionals (encode-lessons-in-structure):**

- `kind === "adversarial" && target === "code"` → every `findings[]` entry
  **requires** `evidence`; `evidencePath` alone is insufficient.
- `kind === "adversarial" && target === "code" && verdict === "approve"` →
  `killersCited` minItems 1.
- `verdict === "comment"` does **not** clear `requireCodeBreak` at close.

**Unresolved blocking:** a review with `blocking: true` and no later review that
`resolvesReviewId` / `resolvesFindingIds` it (or typed waiver AutomationEvent).
`turn close` refuses while any such remain for the turn when
`requireCodeBreak` applies. Close also refuses code-break satisfied only by
`comment` or by `approve` without `killersCited`.

Merge policy may read reviews via **audit**, never via verify.  
Alert/interrupt when `finding.severity >= workstream.policy.alertOnSeverity`,
then apply `onAlert` and **persist** an `AutomationEvent`. Same for
`onSealedSpecDeviation`.

#### Discussion → decision → change chain (Lattice “why X vs Y”)

Code review is how teams remember **why**. Capture threads as typed records so
Lattice can answer without archaeology:

```
finding (reviewer caught X)
    │  messages[]
    ▼
decision (chose Y / deviate / defer)
    │  addressesFindingIds, alternativesRejected, rationale
    ▼
same-turn close or follow-up turn
    │  facts.files + SL-Turn trailers
    ▼
UI: “Flagged X → chose Y → landed in T-00N / these paths”
```

| From | Field | To |
| --- | --- | --- |
| Decision | `addressesFindingIds?: string[]` (`T-002/R-01#F-01`) | Finding |
| Decision | `alternativesRejected` + `rationale` | Why Y not X |
| Source | `kind: "review"` + `ref` | Cue trail |
| Review | `resolvesReviewId` / `resolvesFindingIds` | Clearance |
| Later turn | `prior-turn` source / `followUpClaimId` | Follow-up |

Additive on Decision: `addressesFindingIds?: string[]`.  
Additive source kind: `review`.

**Hygiene:** `messages[].body` and imported PR comments follow `userPrompt`
rules. Do not ingest whole PR dumps — keep design-changing messages; raw export
→ attachment + pointer.

```ts
getFindingTrail(findingRef) → {
  finding, review, messages,
  decisions: Decision[],
  followUpTurns: Turn[],
  files: TurnFileChange[]
}
```

### 6.7 Flow — `schemas/flow.json`

```ts
Flow {
  schemaVersion: 1
  id: string                       // "T-002/F-01"
  turnId: TurnId
  title: string
  kind: "flowchart"|"sequence"|"er"|"state"
  narrative?: string
  before?: string                  // mermaid
  after: string
  decisionId?: string
  featureIds?: string[]
}
```

### 6.8 Audit policy — `schemas/audit-policy.json`

```ts
AuditPolicy {
  schemaVersion: 1
  failCiOn: AuditFindingKind[]
  warnOn: AuditFindingKind[]
}
```

Finding kinds → `results/audit.json`:

- `orphan-record`, `path-turnId-mismatch`
- `post-hoc-mutation`
- `unreproducible-facts`
- `unresolved-ref`
- `deviation-open`
- `surface-change-uncited`
- `unlinked-high-signal-source`
- `touched-not-scoped`, `scoped-not-touched`
- `missing-feature-scope`
- `open-turn-stale`, `abandoned-turn`
- `probe-without-outcome`, `review-blocking-unresolved`
- `attachment-too-large`, `attachment-secret-heuristic`
- `seal-digest-drift`, `post-seal-amend-unconfirmed`, `follow-up-stale`
- `automation-event-wait-unresolved`, `builder-without-context`

---

## 7. Runtime boundaries

### 7.1 Load types

```ts
LoadedLedger {     // VERIFY DOMAIN ONLY
  rootDir, repoRoot, config
  claims, bindings, graph, policy, results
}

LoadedEpisodes {   // HISTORY DOMAIN
  turns, decisions, sourcesFiles
  attachments, probes, reviews, flows
}
```

### 7.2 Collect vs evaluate vs write

```
collect/run checks  →  results file
evaluate(ledger)    →  VerifyReport value (no write)
verify --write      →  optional persist report.json
server GET          →  evaluate in memory OR read last report; never collect; never write
```

### 7.3 Turn close / check

- Diff `opened.baseCommit`..HEAD ∪ worktree
- Evaluate; stamp adherence digests
- Snapshot all history digests + `decisionIds` into facts
- Resolve refs into `facts.refs`
- `turn check <id>` recomputes on clean tree

### 7.4 Query module (`episodes/query.ts`)

Schemas and on-disk layout **are** the query model for Lattice. Design for
cheap joins — not full-repo greps.

#### Layout as index

| Need | How (O(turn) or better) |
| --- | --- |
| All decisions for a turn | `decisions/{turnId}/*.json` directory list |
| All reviews for a turn | `reviews/turns/{turnId}/*.json` |
| Turn by id | `turns/{turnId}.json` |
| Feature → turns | Scan turns’ `intent.featureIds` / `facts.touchedFeatureIds` (build map once per Lattice load / server request) |
| Claim → decisions | `decisionsCiting(claimId)` over decision `claimIds` |
| Finding → decisions | Filter decisions by `addressesFindingIds` |
| Path → turns | Filter `facts.files[].path` (build inverted index in memory) |
| Commit → turn | Trailer parse, else commit-range contains SHA |

**Rules for every new episode schema:**

1. **FK on the child** — `turnId` required (except workstream-scoped spec reviews).
2. **Stable string ids** with sortable prefixes (`T-002`, `T-002/D-01`, `F-01`).
3. **No untyped bags** — Lattice fields must be schema keys so clients can project columns.
4. **Denormalize onto `facts` at close** what UI lists need without opening every side file when possible (`decisionIds`, digests, touched*).
5. **Arrays of ids over embedded blobs** for large text (rationale files / attachments).
6. **Sort** list APIs by `id` ascending (deterministic).
7. Prefer **one file per entity** (or one sources file per turn) — never a single mega-JSON that forces full parse for one finding.

```ts
decisionsFor / sourcesFor / attachmentsFor / probesFor / reviewsFor / flowsFor
decisionsCiting(claimId)
decisionsAddressingFinding(findingRef)
turnsForFeature / turnsTouchingFeature / turnsTouchingPath
getTurnBundle(turnId) → {
  turn,
  decisions: { decision, sources, attachments }[],
  unassignedSources,
  attachments, probes, reviews, flows,
  audit: AuditFinding[]
}
getFindingTrail(findingRef)   // review thread → decisions → follow-ups → files
getFeatureHistory / getClaimHistory
getVerticalContext(workstreamId, sliceId)
audit(repo) → AuditReport
```

Sort: `id` ascending. Server GET handlers should reuse these — no ad-hoc FS walks
in the UI.

---

## 8. CLI

```bash
spec-ledger context --workstream W-001 --slice SLC-01 [--json]
spec-ledger impact --feature verify [--json]

spec-ledger turn open --goal "…" --feature verify[,turns] \
  --workstream W-001 [--slice SLC-01] \
  [--prompt "…"|--prompt-file f] [--change-type feature] \
  [--allow-dirty] [--no-context --no-context-reason "…"] [--json]
# --goal → intent.restatedGoal; --prompt → hygiened intent.userPrompt
# --workstream implies context load + opened.contextDigest stamp
spec-ledger turn close [--id T-002] [--json]
spec-ledger turn abandon [--id T-002] [--json]
spec-ledger turn check <id> [--json]
spec-ledger turn show <id> [--json]

spec-ledger source add --turn T-002 --kind runtime --quote "…" [--ref …] [--decision …] [--json]
spec-ledger source link <S-id> --decision <D-id>
spec-ledger source unlink <S-id>
spec-ledger decision add --turn T-002 --kind deviate --title "…" --rationale-file r.md \
  --claim SL-003 --actual "…" [--source S-…] [--follow-up SL-0xx] [--json]

spec-ledger probe add --turn T-002 --hypothesis "…" --method "…" --result "…" \
  --outcome supports|rejects|inconclusive [--json]
spec-ledger flow add --turn T-002 --title "…" --after-file after.mmd [--before-file …] [--json]
spec-ledger attachment add --turn T-002 --path path-or-url \
  [--kind log-excerpt|image|video|…] [--title "…"] [--media-type image/png] \
  [--review T-002/R-01] [--json]
spec-ledger review add --turn T-002 --reviewer "…" --verdict approve|request-changes|comment \
  --summary "…" [--blocking] [--json]

spec-ledger verify [--write-report] [--root .]
spec-ledger audit [--root .] [--json]
```

---

## 9. Client / HTTP / Lattice

**Client:** `getVerticalContext`, `getTurnBundle`, typed getters, `getFeatureHistory`,
`getClaimHistory`, `audit()`, adherence APIs unchanged.

**HTTP (GET only):** `/v1/context?workstream=&slice=`, `/v1/turns/:id/bundle`,
nested collection routes, `/v1/claims/:id/history`, `/v1/features/:id/history`,
`/v1/audit`, `/v1/automation-events`, plus existing adherence routes. Writes → 405.

**Lattice:**

| Route | Shows |
| --- | --- |
| `/` | Live verify + latest turn freshness + feature pulse |
| `/turns`, `/turns/[id]` | Full bundle; stale digests → **unknown** |
| `/features/[id]` | Anatomy + scoped vs touched history |
| `/claims/[id]` | Verdict + citing decisions + expected/touched turns |
| `/nodes/[id]` | Blast radius + touching turns |
| `/verify` | Adherence only |
| `/audit` | History hygiene |

Freshness `current` only if ledger + results (+ tree when present) digests match.

---

## 10. Agent loop

SSOT: work-model §3.3 / §3.7 (context → open → build → break-while-open → close).
Do not maintain a second loop here. Skills: [`skills/README.md`](../../skills/README.md).

---

## 11. Dogfood rewrite (T-001 / T-002)

Pre-alpha: **no dual-read, no schemaVersion bump.** When episode side collections
land, rewrite the two turns in the same change:

1. Add `featureIds` / tool `opened` when needed (re-close or hand-fill only what
   tools would have written — never invent digests).
2. Move nested `intent.decisions` → `decisions/`; flows → `flows/`.
3. Seed `sources/{id}.json` with one `user` item from the hygiened prompt.
4. Do **not** invent decision kinds beyond what the written text already says.
5. Keep `schemaVersion: 1` until a real external consumer forces a breaking bump.

---

## 12. Absences (tests)

1. Verify domain cannot see episodes (type + import tests).
2. Verify digests identical with/without history dirs.
3. No episode module mints `pass`.
4. `turn check` golden recomputes facts.
5. No global side-collection id counter.
6. Server all-GET.
7. Claims have no stored turn/decision id arrays.
8. No agent trust timestamps on decisions/sources.
9. Audit does not change verify report digest.
10. No untyped metadata schema.

---

## 13. Implementation order

**P0 — trust the gate**

1. `LoadedLedger` vs `LoadedEpisodes`
2. Pure evaluate + optional write-report; server read-only for real
3. `treeDigest` + multi-digest freshness
4. Open basis + close from basis + `turn check` + `abandon`

**P1 — full episode model**

5. Side collections + rewrite dogfood turns (still `schemaVersion: 1`)
6. Decisions + sources
7. Attachments + probes + reviews + flows
8. Audit + policy
9. Client/HTTP/Lattice bundle + histories
10. Skill + DESIGN/AGENTS updates

**P2 — CI policy**

11. `verify` + `audit` in CI per `policy/audit.json`
12. Commit-range coverage for claim/binding path changes

---

## 14. Settled episode decisions

| Decision | Why |
| --- | --- |
| Adherence vs compass vs history planes | Episodes/compass must not greenwash `verify.ok` |
| Thin turn + typed side collections | No untyped metadata bag |
| Facts only from `turn close` / tool | Agents must not invent digests |
| Turn id is the durable join; commit SHAs are best-effort | Rebase/amend rewrite SHAs; trailers + path history still navigate |
| Commit message trailers carry Spec Ledger ids | Humans reading `git log` / blame land back on the turn |
| Doc evolution = ordered turns that touched the path | No hand-maintained commit lists inside docs |
| Open basis + recomputable facts (`turn check`) | Close stays honest if tree moves |
| Turn-scoped IDs; sources one file per turn | Stable joins, simple audit |
| `audit` ≠ `verify` | Hygiene vs adherence |
| Decisions can cite sealed acceptance / tenets via `basis` | Timeout + sealed deviation must be auditable |
| Code-break before close | Side-records stay legal on an open turn |
| Breaker ≠ builder write sets | Killers stay honest; builder cannot negotiate the oracle |
| Code-adversarial evidence requires a run | Bare path strings unrepresentable; approve needs killersCited |
| Immutable review resolution + close gates | Blocking findings cannot be greenwashed |
| Finding → decision → turn trail + review messages | “Why X vs Y” without archaeology |
| Schema layout + FKs are the Lattice query model | Efficient joins without untyped bags |
| `commit-msg` hook requires SL-Turn when a turn is open | Trailers stay real, not honor-system |
| `opened.contextDigest` tool-stamped | Context use is auditable |
| VerticalContext as step 0 | Agents must not start from a blank chat |
| No `turn reopen` | New turn only after close |
| Seal snapshots via JCS under `*.seals/N.json` | Reproducible, revisioned |

---

## 15. Glossary

| Term | Meaning |
| --- | --- |
| Feature | Durable product capability (anatomy part) |
| Turn | Temporary episode aimed at feature(s) |
| Decision | Typed judgment in an episode |
| Source | Cue occurrence that informed a judgment |
| Attachment | Large artifact for the episode |
| Probe | Structured experiment/spike |
| Review | Human/agent review of an episode |
| Flow | Narrative before/after diagram |
| Facts | Tool-computed impact + digests at close |
| Verify | Adherence gate |
| Audit | History hygiene report |
