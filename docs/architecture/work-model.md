# Spec Ledger — Work model (implementation contract)

The execution and evidence portions below describe the original human-seal
workflow. Current implementations use [permission](permission.md),
[evidence](evidence.md), [deferrals](deferrals.md), and [session](session.md) as the
contracts for those concerns. In particular, applicable user delegation can
authorize an agent-created executable snapshot, reads never run checks, and
completion uses the shared gate. Historical human-seal-only and direct-status
instructions below do not override these contracts or the user's explicit scope.

**Status:** Ready for human review
**Date:** 2026-09-02
**Repo:** `nessa-spec-test`
**Audience:** you (approve / amend); then agents implement

This is the **single SSOT** for how work is shaped, stored, and executed under Spec
Ledger. Episode file-level detail remains in
[`episodes.md`](./episodes.md);
this document owns the **hierarchy**, **agent roles**, and how they compose.

Index: [`../README.md`](../README.md).
Companions: [`../research/project-anatomy.md`](../research/project-anatomy.md),
[`../research/high-velocity-decisions.md`](../research/high-velocity-decisions.md),
[`../../DESIGN.md`](../../DESIGN.md).

Settled from grilling (2026-09-02): hierarchy is both standing + temporary;
tasks are turns; shape proposes ledger structure but does not open turns or mint
claims; builder executes verticals; spec then code breakers; post-seal amends
documented. **Default interrupt policy** (below) is product default unless the
human overrides at shape time. **Vision + tenets + learnings** are the standing
compass for deciding when the user is absent or after wait timeouts.

---

## 0. One-sentence contract

**Standing anatomy is features (under optional themes) and claims; standing
judgment guidance is vision + tenets (+ learnings); a workstream is a shaped bet
under a feature; a turn is one executable vertical; agents weigh confused choices
against confirmed tenets when the user does not answer; verify gates adherence
only — never episode theater or compass prose.**

---

## 1. The hierarchy humans actually use

```
Vision + tenets (+ learnings)   ← standing compass (how to decide)
Business objective / theme      (why the product cares)
    └── Feature                 (durable capability)
            └── Workstream      (shaped bet)
                    └── Turn    (one vertical)
                            ├── decisions cite tenets/learnings when weighed
                            └── facts (tool)
```

| Layer | Human language | Spec Ledger | Clock |
| --- | --- | --- | --- |
| Vision | “What we’re building toward” | `vision.json` (+ optional `vision.md`) | Standing compass |
| Tenet | “When unsure, prefer X over Y” | `tenets/TN-…` | Standing compass |
| Learning | “We wrongly assumed users wanted X” | `learnings/LN-…` | Standing compass |
| Theme / business objective | “Make agent work reviewable” | Optional `themes/` | Standing (light) |
| Feature | “Turns change log”, “Verify” | `graph.features` | Standing |
| Workstream / sub-feature | “Add decisions+sources separation” | `workstreams/W-…` | Temporary plan |
| Task | “Implement decision schema” | **One `turn`** | Episode |
| Judgment mid-task | “Deviate from nested decisions” | `decision` + `source` | Episode |
| Standing obligation | “Server is GET-only” | `claim` | Standing |
| Gate | “CI green” | `verify` | Adherence |

**Explicit non-goals**

- No `tasks/*.json` WBS. Tasks = turns (1:1 when work starts).
- No inventing 40 tasks at shape time. Shape Up: scopes/tasks are discovered by
  doing work; the workstream holds **acceptance + suggested slices**, not a fake
  complete task tree.
- Workstreams do **not** affect `verify.ok`.

---

## 2. Three planes

| Plane | Contents | Affects `verify.ok`? |
| --- | --- | --- |
| **Adherence** | claims, bindings, results, graph, layer policy, tree | **Yes** |
| **Compass** | vision, tenets, learnings | **No** — guides agents; not a gate |
| **History** | themes, workstreams, turns + side collections, proposed-claims, automation events, audit | **No** |

**Long-horizon non-breakage** is enforced by **claims + bindings + graph +
`impact`**, not by workstreams or decisions. Decisions explain *why*; only a
claim with evidence stops silent breakage.

---

## 3. Agent roles

Specialized agents are **skills + allowed write sets**, not separate products.

### 3.0 Vision (project start)

**When:** Repo has no `vision` yet, or human says “set vision / tenets.”

**Job:** Capture product vision and initial tenets **with the human**. Prefer few
sharp tenets over many soft ones. Do not invent a fake constitution.

Skill: [`skills/sl-plan-vision`](../../skills/sl-plan-vision/SKILL.md).

### 3.1 Shape agent (`/grill-me` / `spec-ledger shape`)

**Job:** Interview the human until the bet is clear enough to build. Organize
metadata. Do **not** implement code.

**Writes (git):**

| Allowed | Forbidden |
| --- | --- |
| `workstreams/W-*.json` | `turns/*/facts`, `opened` |
| workstream attachments (pitch.md, notes) | Opening turns |
| `proposed-claims/` stubs | Promoting `claims/*.json` without human/builder confirm |
| Optional draft narrative flows on the workstream | Running verify as “pass theater” |
| Update `graph.features` **only** if human confirms a new standing feature | Agent-authored digests |
| Propose **learnings** / **tenet drafts** from the bet (confirm before `agent-confirmed`) | Quietly minting `origin: user` tenets |

If vision is missing, run **vision** first (or include a short vision pass
in the first shape of a greenfield repo).

**Interview frontier (minimum the skill must settle):**

1. What business outcome / theme is this for?
2. Which standing **feature(s)**? (create feature in graph if net-new — with confirm)
3. Problem statement + restated goal
4. Appetite (time box / changeType / risk)
5. Acceptance criteria + out of scope / no-gos
6. **Trust / deployment criticality** (ask the human — do not invent):
   - Shipping to prod / user-facing?
   - Performance-critical? (latency, throughput, memory — with targets if yes)
   - Security / privacy sensitive?
   - Correctness-critical (money, auth, data loss)?
   - Required evidence kinds: unit, property/fuzz, e2e, load (only if justified)
7. Expected claims touched; gaps → **proposed** claims (not live claims)
8. **Verticals** (suggested slices) — each = one turn of e2e-checkable outcome,
   not a bare title and not a horizontal layer chore
9. Rabbit holes / probes needed before building

**Exit artifact:** a `workstream` in status `shaped` — **not** buildable until
spec adversarial review + human seal (unless human skipped).

Ask during shape — present these **defaults**, override only if the human asks:

| Field | Default |
| --- | --- |
| `alertOnSeverity` | `high` |
| `onAlert` | `wait` |
| `alertWaitMinutes` | `10` |
| `onAlertTimeout` | `move` |
| `onSealedSpecDeviation` | `block` if `trust.deployTarget === "prod"`, else `wait` (10m, timeout `move`) |
| `requireSpecBreak` / `requireCodeBreak` | `true` |

### 3.2 Spec breaker (devil’s advocate on the spec)

**When:** After the workstream / pitch / proposed claims / verticals exist
(`shaped`), **before** any implementing turn. Never before there is a written
spec to attack.

**Job:** Make sure we are about to build the **right** thing — not invent gaps
from vibes alone. Ground the attack in Spec Ledger + the repo:

| Read | Why |
| --- | --- |
| This workstream (acceptance, out-of-scope, trust, verticals, proposed claims, attachments) | The bet under review |
| **`spec-ledger related --workstream W [--worktrees]`** pack | Tool-built neighborhood: related features, claims, prior turns/docs, blast paths, optional sibling-worktree cautions — **do not DIY the scan** |
| Pack-cited live claims, graph paths, docs, prior decisions | Contradictions / dep misses with standing truth |

Find: contradictions with existing claims or sibling specs; untestable acceptance;
hidden horizontals; trust-profile holes; **missed dependencies** (this package
assumes another feature’s contract that is unclaimed or conflicting); tech-debt
shaped as “just one more vertical.” Do **not** write product code.

**Writes:** adversarial review on the workstream (`target: "spec"`); optional
edits to workstream / proposed-claims **only after human confirms** each gap
fix. Surface findings at or above `alertOnSeverity`.

**Exit:** human confirms fixes → workstream **`sealed`** (specDigest stamped).
Until sealed, builder must not start (unless human explicitly bypasses).

Skill: [`skills/sl-plan-break-spec`](../../skills/sl-plan-break-spec/SKILL.md).

#### Concurrent worktrees / parallel edits (limit)

Spec Ledger’s write path is **this checkout’s** `.spec-ledger/` + tree. It does
**not** merge five worktrees’ in-flight specs into one world view.

**Do not ask the agent to DIY `git worktree list`.** The CLI/client computes a
**related-spec pack** and hands the agent paths + summaries:

```bash
spec-ledger related --workstream W-001 [--worktrees] [--json]
# or: spec-ledger related --feature verify [--claim SL-001] [--json]
```

| Tool includes (this checkout) | Optional `--worktrees` (same machine) | Cannot promise |
| --- | --- | --- |
| Related **features** (graph + claim cites) | Sibling worktrees from `git worktree list` | Other machines / unlisted clones |
| Live claims/bindings on that neighborhood | Other open/recently edited workstreams sharing featureIds/paths | Treating foreign dirty ledgers as sealed |
| Prior turns/decisions + **docs/files those episodes touched** | mtime-ordered “also changed over there” paths | Auto-reconcile or refuse seal on foreign dirt |
| Predicted blast-radius nodes/paths | Caution entries only (`kind: worktree-caution`) | Completeness if scan skipped |

Agent job: **read the pack**, cite it in findings. If the tool reports
`worktreesSkipped: true`, copy that into `residualRisks` — do not pretend a
full parallel-branch check happened.

Maintaining **claim ↔ feature ↔ turn ↔ doc** links is what makes `related`
cheap; without those joins the pack degrades to path heuristics and must say so.

### 3.3 Builder agent (developer)

**Job:** Execute one **vertical** at a time against a **sealed** workstream
(or human bypass).

**Writes:**

| Allowed | Forbidden |
| --- | --- |
| `turn open/close/abandon` with `workstreamId` + `featureIds` | Editing another agent’s open turn facts |
| decisions, sources, probes, flows, attachments on **that** turn | Untyped metadata bags |
| Real `claims/` + bindings when implementing a proposal | Claiming done without `turn close` + verify |
| Production code **and** the tests that back every claim | Silent post-seal spec rewrites |

**Loop (one vertical):**

1. `spec-ledger context --workstream W --slice SLC` (required — §8)
2. `turn open` with workstreamId / featureIds / sliceId
3. Implement + tests (honor context + requiredEvidence)
4. User correction? → `sl-learn` (≤1 ask)
5. Sealed-spec drift? → decision with `basis` + postSealAmends + interrupt mode
6. **`sl-dev-break` while turn still `open`** (breaker owns killers + run evidence;
   builder must not edit those tests)
7. Fix **prod** gaps (still open) → `turn close` → verify digests
8. Next vertical

When confused or after interrupt **wait timeout** with no human reply: weigh
options against vision + tenets (§4.0), record a `decision` citing
`basis.tenetIds` and/or `source` `tenet:`/`learning:`, persist an
`automation-events` resolution, then continue per timeout policy.

If implementation needs a change to the **sealed** spec:

1. `decision` kind `deviate|clarify|add` with `basis.workstream` (sealed revision +
   criterion) — claimIds optional when basis present.
2. Append `postSealAmends[]` and surface.
3. Apply `policy.onSealedSpecDeviation` (§5.2); never quietly reseal.

Flow diagrams are optional narrative; they are not proof.

### 3.4 Code breaker (adversarial trust on the implementation)

**When:** After implementation, **before** `turn close` (turn must still be
`open`). Prefer over vibe review.

**Job:** Falsify claims/acceptance with **run** killers (property, fuzz, edge,
load only if trust flags say so). Skill:
[`skills/sl-dev-break`](../../skills/sl-dev-break/SKILL.md).

**Breaker ≠ builder (hard rule):**

| Role | Write set |
| --- | --- |
| Breaker | Adversarial **failing** tests + `reviews/` (`kind: "adversarial"`, `target: "code"`) with structural **run evidence**. Does not edit prod to go green. Does not invent digests. |
| Builder | Production code so killers fail for the intended reason then pass. Does **not** edit breaker killers (that would negotiate the oracle). |

Same agent wearing both hats still must **split writes** in time. Prefer a
separate breaker agent. If policy cannot split: require ≥1 killer on a path /
scenario **absent** from turn `intent` (acceptance / outOfScope / goal text),
capped per skill hunt budget.

**Review shape (encode in schema, not only SKILL prose):**

- Finding `evidence` is `command+observedOutput` **or** `citedTest` with
  `ran: true` — bare path strings are invalid.
- `verdict: "approve"` requires non-empty `killersCited`.
- `comment` does not satisfy `requireCodeBreak`.

Alert when finding severity ≥ `policy.alertOnSeverity`, then apply
`policy.onAlert` (§5.2). Below threshold: record only, do not interrupt.

### 3.5 Learn from correction (lightweight, every turn)

**When:** The human corrects the agent mid-turn or rejects a direction (not
typos / one-off taste).

**Job:** Detect **high-signal** corrections — wrong assumption about what users
value, recurring priority, “never do X,” bug in our judgment of importance —
and optionally capture a **learning**; promote to a **tenet** only with confirm.

**Without overdoing it:**

- At most **one** tenet/learning confirm ask per turn unless the human invites more.
- Skip if the correction is local, already covered by an existing tenet, or low signal.
- Prefer writing a `learning` first; promote to tenet when it should weigh future
  automated decisions.

Skill: [`skills/sl-learn`](../../skills/sl-learn/SKILL.md).

### 3.6 Reviewer agent (optional, human)

Human judgment on closed turns or sealed specs. Distinct from breakers —
breakers **falsify**; reviewers **judge**.

### 3.7 Pipeline (default automation)

```
Project start (once)
    │
    ▼
Vision skill ──► vision + initial tenets (user / agent-confirmed)
    │
    ▼
Shape / grill ──► workstream (shaped) + trust + verticals + policy
    │
    ▼
Spec breaker ──► gaps → human confirm/fix → SEAL (specDigest)
    │
    ▼
For each vertical:
    context ──► load vision/tenets/seal/claims/history/impact
    Builder ──► turn open → code + tests → (sl-learn?)
         │         wait timeout / no user? → weigh tenets → decision + event
         ├─ sealed-spec deviation? → basis + postSealAmends + interrupt mode
         ▼
    Code breaker (turn still open) ──► falsify → adversarial review → onAlert
         ▼
    fix → turn close → verify
    │
    ▼
verify + audit · Spec Ledger UI: compass + workstreams + turns + automation events
```

---

## 4. Standing primitives

### 4.0 Compass — vision, tenets, learnings

Standing **judgment guidance**. Agents read these when shaping, when stuck, and
especially when wait timeouts / automated cycles proceed without the user.
**Never** part of `verify.ok`.

#### Vision — `schemas/vision.json`

Path: `.spec-ledger/vision.json`
Optional narrative twin: `.spec-ledger/vision.md` (human-readable; JSON wins for
fields agents must parse).

```ts
Vision {
  schemaVersion: 1
  summary: string                  // one sentence north star
  northStar?: string               // longer “what good looks like”
  nonGoals?: string[]              // product-level no-gos
  users?: string[]                 // who we optimize for
  updatedAt: datetime
  updatedBy: string                // human or "agent:…+human"
}
```

Establish at project start; amend rarely and with human confirm.

#### Tenet — `schemas/tenet.json`

Path: `.spec-ledger/tenets/TN-001.json`

A tenet is a **durable weighing rule** (“when X conflicts with Y, prefer X”).

```ts
Tenet {
  schemaVersion: 1
  id: string                       // "TN-001"
  statement: string                // imperative, testable in judgment
  rationale?: string
  scope: "product" | "feature"
  featureIds?: string[]            // required if scope === "feature"
  status: "active" | "deprecated"
  // Provenance — required; never fake "user"
  origin: "user" | "agent-confirmed" | "agent-inferred"
  proposedBy?: string              // "agent:sl-learn" | human handle
  confirmedAt?: datetime           // required for user | agent-confirmed
  confirmedBy?: string
  sourceLearningId?: string        // if promoted from a learning
  sourceTurnId?: string
  weight?: "must" | "should" | "prefer"   // default should
  deprecatedReason?: string
  supersededBy?: string            // tenet id when deprecated
  createdAt: datetime
  updatedAt?: datetime
}
```

| `origin` | Meaning | May weigh alone on timeout? |
| --- | --- | --- |
| `user` | Human authored or dictated | **Yes** (strongest) |
| `agent-confirmed` | Agent proposed; human said yes | **Yes** |
| `agent-inferred` | Agent wrote; **not** yet confirmed | Soft only — prefer ask; if must act, cite and mark residual risk |

**Weight order when deciding without the user:**

1. Live **claims** (adherence — non-negotiable)
2. Sealed workstream acceptance / out-of-scope
3. Tenets `origin: user` then `agent-confirmed` (`must` > `should` > `prefer`)
4. Active **learnings** (product then feature-scoped)
5. Vision north star / non-goals
6. `agent-inferred` tenets (last; never override 1–3)

#### Learning — `schemas/learning.json`

Path: `.spec-ledger/learnings/LN-001.json`

A learning is a **captured miss**: user correction, wrong assumption about what
matters, judgment bug after shipping. Some stay learnings; some promote to tenets.

```ts
Learning {
  schemaVersion: 1
  id: string                       // "LN-001"
  statement: string
  kind: "correction" | "wrong-assumption" | "priority" | "judgment-bug"
  scope: "product" | "feature"
  featureIds?: string[]
  status: "active" | "superseded" | "promoted"
  origin: "user" | "agent-confirmed" | "agent-inferred"
  turnId?: string
  workstreamId?: string
  promotedTenetId?: string
  evidence?: string                // short quote / what we got wrong
  createdAt: datetime
  confirmedAt?: datetime
  confirmedBy?: string
}
```

**Promotion:** learning → tenet when it should weigh *future* automated choices.
Keep the learning `status: promoted` + `promotedTenetId` for Spec Ledger UI history.

#### Compass absences

- Not a substitute for claims (safety/ correctness obligations stay claims).
- Not review-agent transcripts.
- Do not spam a new tenet every nit; high-signal only.
- Do not label agent prose as `origin: user`.

### 4.1 Theme (optional) — `schemas/theme.json`

```ts
Theme {
  schemaVersion: 1
  id: string                       // "TH-001" or slug
  title: string
  summary: string
  featureIds?: string[]
}
```

Path: `.spec-ledger/themes/{id}.json`

### 4.2 Feature — `graph.features[]`

Extend feature meta:

```ts
FeatureMeta {
  id, name, summary
  themeId?: string
  parentFeatureId?: string         // rare; prefer workstreams for sub-slices
  claimIds?, entryPoints?, keywords?, flow?
}
```

**Rule:** Sub-feature *delivery* prefers a **workstream under a feature**, not an
infinite feature tree. Split a standing child feature only when the capability is
durable and independently talkaboutable forever in Spec Ledger UI.

### 4.3 Claim / binding / verify

Unchanged. Shape may only **propose** claims.

Path: `.spec-ledger/proposed-claims/{id}.json` — claim shape + `status: "proposed"`.
Promote by moving into `claims/` and adding bindings in the implementing turn.

---

## 5. Workstream — `schemas/workstream.json`

```ts
Workstream {
  schemaVersion: 1
  id: string                       // "W-001"
  status: "draft"|"shaped"|"spec_review"|"sealed"|"active"|"done"|"cancelled"
  createdAt: datetime
  updatedAt?: datetime
  themeId?: string
  featureIds: string[]             // ≥1
  primaryFeatureId?: string
  title: string
  problem: string
  objective: string
  appetite?: string
  changeType?: "feature"|"refactor"|"fix"|"migration"|"chore"|"docs"
  riskLevel?: "low"|"moderate"|"elevated"|"high"

  // Trust profile — shaped with the human; breakers honor these
  trust?: {
    deployTarget: "local"|"staging"|"prod"|"library-consumer"
    userFacing: boolean
    performanceCritical: boolean
    performanceNotes?: string      // budgets: p99, RPS, memory, …
    securitySensitive: boolean
    correctnessCritical: boolean
    requiredEvidence: Array<
      "unit"|"integration"|"e2e"|"property"|"fuzz"|"load"|"attestation"
    >
  }

  // Defaults unless human overrides at shape (see §5.2)
  policy?: {
    alertOnSeverity: "low"|"moderate"|"high"|"critical"  // default "high"

    onAlert: "move"|"block"|"wait"           // default "wait"
    alertWaitMinutes?: number                // default 10 when wait
    onAlertTimeout?: "move"|"block"          // default "move"

    onSealedSpecDeviation: "move"|"block"|"wait"  // default block if prod else wait
    sealedDeviationWaitMinutes?: number      // default 10 when wait
    onSealedDeviationTimeout?: "move"|"block"  // default "move"

    requireSpecBreak: boolean                // default true
    requireCodeBreak: boolean                // default true

    // Seal gate: human must seal before build. Optional wait for unattended labs only.
    onAwaitingSeal?: "block"|"wait"          // default "block" (no auto-seal)
    sealWaitMinutes?: number                 // only if onAwaitingSeal === "wait"
    onSealTimeout?: "block"|"cancel"         // default "block" — never auto-seal
  }

  // Immutable seal snapshot — never rewrite; amendments are postSealAmends + new seal if re-shaped
  seal?: {
    sealedAt: datetime
    sealedBy: string               // human (required unless policy explicitly allows agent+human)
    specDigest: string             // canonical hash — see §5.3
    snapshotPath: string           // "workstreams/W-001.seals/{revision}.json"
    attachmentDigests?: { id: string; digest: string }[]
    proposedClaimDigests?: { id: string; digest: string }[]
    specBreakReviewId?: string
    revision: number               // 1 on first seal; increment only on explicit re-seal
  }

  postSealAmends?: {
    at: datetime
    turnId?: string
    decisionId?: string
    summary: string
    humanConfirmed: boolean
    sealedRevision: number         // which seal revision this amends
  }[]

  acceptanceCriteria: string[]
  outOfScope?: string[]
  rabbitHoles?: string[]
  expectedClaimIds?: string[]
  proposedClaimIds?: string[]

  suggestedSlices?: {
    id: string                     // "SLC-01"
    title: string
    kind: "vertical"
    acceptance: string[]
    expectedClaimIds?: string[]
    evidence?: Array<"unit"|"integration"|"e2e"|"property"|"fuzz"|"load">
    notes?: string
    doneTurnId?: string
    specBreakReviewId?: string
    codeBreakReviewId?: string
  }[]

  shapedBy?: string
  attachmentIds?: string[]
}
```

Path: `.spec-ledger/workstreams/W-001.json`

```
draft → shaped → spec_review → sealed → active → done
                              ↘ cancelled
```

| Status | Meaning |
| --- | --- |
| `shaped` | Grill done; spec exists to attack |
| `spec_review` | Spec breaker running / awaiting human on gaps |
| `sealed` | Human accepted spec; `seal.specDigest` set; build allowed |
| `active` | ≥1 implementing turn opened |
| `done` | Acceptance met; blocking reviews clear (or waived) |

**Severity order:** `low` < `moderate` < `high` < `critical`.
Alert when `finding.severity >= policy.alertOnSeverity`.

**Theme ↔ feature ownership:** `feature.themeId` is canonical. Optional
`theme.featureIds` is a denormalized Spec Ledger UI cache — audit may warn on drift;
do not author conflicting pairs.

### 5.1 Vertical rule

A suggested slice is a **vertical** when a single turn can leave behind an
isolated, stress-testable piece of behavior with evidence. Prefer thin
end-to-end paths over horizontal layer chores. No `tasks/` WBS.

**Cut by independently fail-able product moments**, not package layers. After
each closed turn, something product-true should hold (typed API, CLI path,
Spec Ledger UI join)—not “schemas landed.” For IO libraries: fixture→typed first,
then the **same typed contract** over storage; skip a raw-bytes-only middle
slice unless the storage client is itself a standing feature. For platform
bets: prove the asked loop (e.g. context → open/break/close → visible episode)
before catalog polish (compass UI, automation resume, full decision taxonomy).

Method skill: [`skills/sl-plan-decompose`](../../skills/sl-plan-decompose/SKILL.md).

### 5.2 Interrupt modes + automation state machine

Used by `onAlert`, `onSealedSpecDeviation`, and `onAwaitingSeal`:

| Mode | Behavior |
| --- | --- |
| `move` | Alert/surface, persist event as terminal `moved`, **continue** |
| `block` | Alert/surface, persist event `state: blocked`, **halt** until human resolves |
| `wait` | Alert/surface, persist event `state: waiting` with `waitUntil`; see resume below |

`wait` without minutes is invalid — apply default `10` or pick `move`/`block`.

#### AutomationEvent (authoritative)

Path: `.spec-ledger/automation-events/AE-….json`

```ts
AutomationEvent {
  schemaVersion: 1
  id: string
  kind: "alert"|"sealed-deviation"|"awaiting-seal"
  workstreamId?: string
  turnId?: string
  reviewId?: string
  findingIds?: string[]            // review finding ids when applicable
  mode: "move"|"block"|"wait"
  severity?: "low"|"moderate"|"high"|"critical"
  policySnapshot: {                // frozen at alert time
    alertOnSeverity?: string
    onAlert?: string
    onAlertTimeout?: string
    onSealedSpecDeviation?: string
    onSealedDeviationTimeout?: string
  }
  state: "pending"|"waiting"|"blocked"|"resolved"
  alertedAt: datetime
  waitUntil?: datetime             // required when mode === "wait"
  // Terminal resolution (only when state === "resolved")
  trigger?: "human"|"timeout"|"system"
  resolution?: "move"|"block"|"waive"|"revert"|"cancel"
  resolvedAt?: datetime
  resolvedBy?: string
  decisionId?: string
  note?: string
}
```

**Transitions (idempotent):**

```
pending → waiting | blocked | resolved(move)     // on create, by mode
waiting → resolved                               // human reply OR timeout applied
blocked → resolved                               // human reply only
```

**Resume rule (required):** On every `spec-ledger context` and `turn open`, before
continuing work:

1. Load unresolved events for the workstream/turn (`state` in `waiting|blocked`).
2. If `waiting` and `waitUntil < now`: set `trigger: timeout`, apply
   `on*Timeout` → `resolution: move|block`, `state: resolved` (or transition to
   `blocked` if timeout says block). Write the event **before** returning context.
3. Surface remaining `blocked` / freshly resolved events in
   `VerticalContext.prior.openAutomationEvents` (include just-resolved in
   `prior.recentAutomationEvents`).
4. Duplicate timeout application is a no-op if already `resolved`.

Agents do **not** sleep for 10 minutes; the next invocation applies the timeout.

### 5.3 Seal digest + revisioned snapshots

**Canonicalization:** [RFC 8785 JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785).
`specDigest = sha256(JCS(sealPayload))` hex-encoded.

`sealPayload` contains:

1. Workstream fields excluding `status`, `updatedAt`, `seal`, `postSealAmends`,
   and `suggestedSlices[].doneTurnId|codeBreakReviewId|specBreakReviewId`
2. Ordered attachment manifest `{ id, contentDigest }[]`
3. Ordered proposed-claim manifest `{ id, contentDigest }[]`

**Paths (never overwrite):**

```
workstreams/W-001.json                 # live metadata (points at current seal)
workstreams/W-001.seals/1.json         # immutable snapshot revision 1
workstreams/W-001.seals/2.json         # revision 2 after explicit re-seal
```

`seal.snapshotPath` = `workstreams/W-001.seals/{revision}.json`.
`seal.revision` increments only on explicit `workstream seal`. Prior revision
files are retained forever (git history + on-disk). Live `W-001.json` may update
`seal` pointer; never mutate a seals/N.json file.

`workstream check-seal` recomputes digest from the pointed snapshot.
Audit `seal-digest-drift` if live shaped fields diverge from current snapshot
without a `postSealAmends` entry.

### 5.4 Product defaults (settled)

```json
{
  "alertOnSeverity": "high",
  "onAlert": "wait",
  "alertWaitMinutes": 10,
  "onAlertTimeout": "move",
  "onSealedSpecDeviation": "block",
  "onAwaitingSeal": "block",
  "requireSpecBreak": true,
  "requireCodeBreak": true
}
```

For non-prod deploy targets, default `onSealedSpecDeviation` to `wait` (10m) with
`onSealedDeviationTimeout: "move"` instead of `block`. Shape surfaces once;
humans may override. **Never auto-seal** (`onSealTimeout` is `block` or `cancel` only).

---

## 6. Turn linkage

Every builder turn carries:

```ts
intent.workstreamId?: string       // required when working from a workstream
intent.featureIds: string[]        // ⊆ workstream.featureIds when workstream set
intent.restatedGoal: string        // what this episode does (workstream owns bet-level why)
```

On close, optional `--slice SLC-01` sets `suggestedSlices[].doneTurnId`.

Episode schemas (decisions, sources, attachments, probes, reviews, flows, facts,
audit): see [`episodes.md`](./episodes.md).

---

## 7. On-disk additions

```
.spec-ledger/
  vision.json
  tenets/TN-001.json
  learnings/LN-001.json
  themes/TH-001.json
  workstreams/W-001.json
  workstreams/W-001.seals/1.json       # immutable seal revision 1
  proposed-claims/PC-001.json
  automation-events/AE-….json
  attachments/workstreams/W-001/…
```

`ledger.json`: `visionPath`, `tenetsDir`, `learningsDir`, `themesDir`,
`workstreamsDir`, `proposedClaimsDir`, `automationEventsDir`.
Verify **ignores** compass + workstreams + proposed-claims + themes + events.

---

## 8. CLI

```bash
# Compass
spec-ledger vision init --summary "…" [--north-star-file vision.md]
spec-ledger tenet add --statement "…" --origin user|agent-confirmed [--scope product|feature]
spec-ledger tenet confirm TN-001
spec-ledger learning add --statement "…" --kind correction [--turn T-00N] [--json]
spec-ledger learning promote LN-001 --to-tenet TN-00N

# Agent context (required before implement)
spec-ledger context --workstream W-001 --slice SLC-01 [--json]
# optional: --feature verify  (defaults from workstream)
# returns VerticalContext — see §9

# Workstream
spec-ledger workstream init --feature verify --title "…" [--theme …] [--json]
spec-ledger workstream set <W-id> …
spec-ledger workstream propose-claim <W-id> --id PC-001 --statement "…" [--json]
spec-ledger workstream add-slice <W-id> --id SLC-01 --title "…" [--json]
spec-ledger workstream status <W-id> shaped|spec_review|sealed|active|done|cancelled
spec-ledger workstream seal <W-id> --by <human> [--json]
spec-ledger workstream check-seal <W-id> [--json]
spec-ledger workstream unseal <W-id> --by <human> --reason "…"   # rare; audit

# Turns
spec-ledger turn open --workstream W-001 --feature verify \
  --goal "…" [--prompt "…"] [--slice SLC-01] [--json]
spec-ledger turn close [--id T-00N] [--slice SLC-01]
spec-ledger impact --feature verify [--claim SL-001] [--json]   # predicted blast radius
spec-ledger related --workstream W-001 [--worktrees] [--json]   # spec-break / shape pack
# related --feature verify [--claim SL-001]  — same neighborhood without a workstream

spec-ledger claim promote PC-001 --to SL-006
```

Shape skill writes via workstream commands; it does **not** call `turn open`.
`turn open --workstream` **invokes `context` internally** and stamps
`opened.contextDigest` (unless `--no-context` with typed reason). Skills must
not skip this.

---

## 9. Client / Spec Ledger UI / VerticalContext

### 9.1 `getVerticalContext(workstreamId, sliceId)` / CLI `context`

One request agents use as step 0 of implementation. Response (bounded; include
`truncation` + `contextDigest`):

```ts
VerticalContext {
  vision: Vision | null
  tenets: Tenet[]                  // active; product + feature-scoped; §4.0 order
  learnings: Learning[]            // active; same scope filter
  workstream: Workstream           // live metadata
  seal: Workstream["seal"] & { snapshot: object }  // immutable sealed body
  slice: Workstream["suggestedSlices"][number]
  claims: {
    live: Claim[]
    proposed: ProposedClaim[]
    bindings: Binding[]
    verdicts?: { claimId: string; outcome: string }[]
  }
  prior: {
    turns: Turn[]
    decisions: Decision[]
    sources: unknown[]
    openFollowUps: string[]
    postSealAmends: Workstream["postSealAmends"]
    openAutomationEvents: AutomationEvent[]   // waiting | blocked
    recentAutomationEvents: AutomationEvent[] // just resolved this call
  }
  graph: {
    nodes: Node[]
    predictedBlastRadius: { direct: string[]; transitive: string[] }
    missingLocators?: string[]
  }
  policy: Workstream["policy"]
  trust: Workstream["trust"]
  // Deterministic: sha256(JCS({ sealRevision, sliceId, visionDigest, tenetIds,
  //   learningIds, claimIds, truncation, predictedBlastRadius }))
  contextDigest: string
  generatedAt: datetime
  truncation?: { decisions: number; turns: number; note: string }
}
```

**`contextDigest`:** `sha256(JCS(…))` over the stable subset above (exclude
volatile `generatedAt` / live workstream `updatedAt`). Same inputs ⇒ same digest
across CLI and HTTP.

Ranking: §4.0 weight order for compass; decisions by id desc; default N=20
decisions / 10 turns (overridable). Always include seal snapshot + slice
acceptance even when truncating history.

**Before returning:** apply automation resume rule (§5.2) so timeouts are
resolved and open events are accurate.

### 9.2 `getRelatedSpecPack` / CLI `related`

Tool-built neighborhood for **spec break** (and optional shape). Agents consume
the JSON; they do not re-implement graph joins or `git worktree list`.

```ts
RelatedSpecPack {
  schemaVersion: 1
  anchor: {
    workstreamId?: string
    featureIds: string[]
    claimIds: string[]
  }
  relatedFeatures: { id: string; why: "same-theme"|"edge"|"claim-cite"|"workstream" }[]
  claims: { live: Claim[]; proposed: ProposedClaim[]; bindings: Binding[] }
  graph: {
    nodes: Node[]
    predictedBlastRadius: { direct: string[]; transitive: string[] }
    pathsOfInterest: string[]      // locators + docs/code paths derived from nodes/turns
  }
  prior: {
    turns: { id: string; restatedGoal: string; closedAt?: string }[]
    decisions: { id: string; title: string; turnId: string; claimIds?: string[] }[]
    docsTouched: { path: string; turnIds: string[]; mtime?: string }[]
  }
  // Optional sibling worktrees (only if --worktrees)
  worktrees?: {
    scanned: boolean
    skippedReason?: string         // e.g. "git worktree unavailable"
    entries: {
      path: string
      branch?: string
      kind: "worktree-caution"
      openWorkstreamIds?: string[]
      recentPaths: { path: string; mtime: string }[]  // related featureIds/paths only
      note: string
    }[]
  }
  truncation?: { note: string }
  generatedAt: datetime
}
```

`impact` stays the low-level blast-radius primitive. `related` composes impact +
episode/doc joins (+ optional worktree cautions) for reviewers.

### 9.3 Other APIs

- `getVision`, `getTenets`, `getLearnings`, `getWorkstreams`, `getWorkstreamBundle`
- `getFeatureHistory`, `getClaimHistory`, `getTurnBundle`
- `getAutomationEvents({ workstreamId?, turnId? })`
- Routes: `/compass`, `/workstreams`, `/workstreams/[id]`, `/timeline` (joins
  workstream → turns → decisions; shows automation events), feature/claim history,
  `GET /v1/related?workstream=` / `?feature=`

```
Vision/Tenets/Learnings → Theme → Feature → Workstreams → Turns → Decisions
                                              └─ automation events
```

---

## 10. Skills

| Skill | Role |
| --- | --- |
| `skills/sl-plan-vision` | Project start: vision + initial tenets |
| `skills/sl-plan-shape` | Grill → workstream + trust + verticals + policy |
| `skills/sl-plan-break-spec` | Spec adversary → human → **seal** |
| `skills/sl-dev-build` | Builder; weigh tenets on timeout |
| `skills/sl-learn` | High-signal corrections → learning / tenet confirm |
| `skills/sl-dev-break` | Code adversary after implement |
| `skills/sl-dev-verify` | End gate: `turn close` + digests |

`AGENTS.md`: `sl-plan-vision` (if missing) → `sl-plan-shape` →
`sl-plan-break-spec` → seal → `sl-dev-build` (context stamped on open;
`sl-dev-break` while open; `sl-learn` on corrections) → `sl-dev-verify`.
Honor interrupt resume on context/open. Naming: [`skills/README.md`](../../skills/README.md).

---

## 11. Audit additions

- `tenet-origin-user-unconfirmed`
- `agent-inferred-tenet-stale` (inferred >N days, never confirmed)
- `learning-unscoped`
- `seal-digest-drift`
- `post-seal-amend-unconfirmed`
- `follow-up-stale`
- `automation-event-wait-unresolved`
- `theme-feature-link-drift`
- `workstream-shaped-without-feature`
- `turn-without-workstream` (warn unless chore/docs + explicit skip)
- `slice-without-turn` when workstream `done`
- `proposed-claim-stale`
- `builder-opened-unshaped-workstream`
- `builder-without-context` (no contextDigest on turn / missing step 0)

---

## 12. Absences

1. No `tasks/` collection — verticals become turns when work starts.
2. Shape cannot write facts / open turns / promote claims alone.
3. Workstreams, proposed-claims, vision/tenets/learnings never enter verify digests.
4. Suggested slices are verticals with acceptance, not bare titles and not
   pre-created turn files.
5. No untyped planning metadata bag.
6. Flow diagrams are narrative, not proof.
7. Breakers must not weaken assertions to greenwash; attestation ≠ pass.
8. No load/perf campaigns unless trust says so.
9. No build before seal (unless explicit bypass); no silent post-seal spec rewrite.
10. Findings below `alertOnSeverity` are recorded but do not interrupt; at/above threshold honor `onAlert` (`move`|`block`|`wait`).
11. No fake `origin: user` on tenets/learnings; no tenet spam from every nit.
12. Compass does not replace claims for safety/correctness obligations.

---

## 13. Implementation order

**P0** — Episode trust + **VerticalContext** CLI/client + seal digest + automation
events + breaker-before-close
**P1** — Work model runtime: themes, workstreams, compass, proposed-claims,
turn.workstreamId, skills, Spec Ledger UI timeline
**P2** — Episode side collections + decision `basis`
**P3** — Audit policy + CI
**P4** — Dogfood (blocked on `context` + `turn open --workstream` existing)

**P4 — Dogfood this repo** (after P0–P1 runtime; docs layout already started):

Claims SL-001…005 + a couple turns exist; themes/workstreams/seal not dogfooded
yet. Packages are cut well.

Docs layout (done): `docs/architecture|research` + [`../README.md`](../README.md).

Still to do once P1 ships (or human says go):

1. Dogfood **vision + tenets** for this product.
2. Standing features for surfaces we actually have (`client`, `server`, `skills`, …).
3. Theme(s) + workstreams for remaining build (P0…P3).
4. Every subsequent change opens a turn under a workstream; corrections → learnings.

---

## 14. Review checklist (for you)

- [ ] `opened.contextDigest` stamped by `turn open --workstream` (JCS+sha256)
- [ ] Automation events: state machine + resume on context/open
- [ ] Review resolution immutable; close gates on blocking/unresolved
- [ ] Seal files revisioned under `workstreams/W-*.seals/N.json` (JCS)
- [ ] Hierarchy + three planes; break before close; decision sealed `basis`

---

## 15. Glossary

| Term | Meaning |
| --- | --- |
| Vision | Product north star + non-goals (compass) |
| Tenet | Durable weighing rule; provenance required |
| Learning | Captured miss/correction; may promote to tenet |
| Compass | Vision + tenets + learnings (not verify) |
| Theme | Standing business objective label |
| Feature | Standing product capability |
| Workstream | Shaped temporary bet under feature(s) |
| Vertical | Suggested slice = one e2e-checkable turn |
| Trust profile | Prod/perf/security/correctness + evidence kinds |
| Policy | Severity threshold + interrupt modes (`move`/`block`/`wait`) |
| Interrupt mode | Alert-and-move, alert-and-block, or alert-wait-then-timeout |
| Seal | Human-accepted spec + `specDigest`; build gate |
| Post-seal amend | Documented drift after seal; may halt automation |
| Spec breaker | Devil’s advocate on the written bet |
| Code breaker | Falsifies implementation after a vertical |
| Alert severity | Min finding severity that triggers `onAlert` |
| Verify | Adherence gate |
| Audit | History hygiene (+ blocking reviews / seal drift) |
