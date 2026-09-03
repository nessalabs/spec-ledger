# Research — Anatomy of a project → Spec Ledger primitives

> **Status:** research input (frozen). **Contract SSOT:**
> [`../architecture/work-model.md`](../architecture/work-model.md).  
> Superseded here: “defer scopes / pitch outside ledger” — we now have
> **workstreams + verticals + seal** (not a `tasks/` WBS). Feature remains the
> standing anatomy FK; turns remain episodes.

Date: 2026-09-02  
Question: What constitutues *any* project, and which of those parts should Spec Ledger treat as first-class primitives?

## Sources

| Source | What it owns |
| --- | --- |
| [ISO 21500](https://www.iso.org/standard/75704.html) (project management guidance) | Formal definition of *project* |
| PMI / PMBOK scope baseline (scope statement + WBS + WBS dictionary) | Decomposition of *what* will be delivered |
| [Shape Up](https://basecamp.com/shapeup/) (Basecamp) — Pitch, Appetite, Scopes, Cycle | High-velocity product-work anatomy |
| [Evans / Fowler — Bounded Context](https://martinfowler.com/bliki/BoundedContext.html) | How large systems carve meaning |
| Nygard ADR (already in prior research) | Standing design decisions |
| Typical SDLC artifact matrices (charter → SRS → design → code → evidence) | Software-specific deliverable layers |

Companion: [`high-velocity-decisions.md`](./high-velocity-decisions.md),
[`../architecture/episodes.md`](../architecture/episodes.md),
[`../architecture/work-model.md`](../architecture/work-model.md).

---

## 1. Universal anatomy (ISO / PMBOK)

ISO 21500 (paraphrase of the standard definition):

> A **project** is a unique set of coordinated, controlled activities with a start and end, performed to achieve **objectives** by producing **deliverables** that meet requirements — under **constraints** (time, cost, resources, quality, risk, …).

Unpack that into layers every project has, software or not:

| Layer | Meaning | Examples outside software |
| --- | --- | --- |
| **Purpose / objective** | Why this temporary effort exists | “Open the new café by Q3” |
| **Outcome / benefit** | Value after delivery (may lag the project) | “Neighborhood foot traffic ↑” |
| **Scope / deliverables** | What “done” produces | Menu, fit-out, permits |
| **Decomposition** | Parts that can be finished / estimated (WBS / scopes) | Kitchen, front-of-house, licensing |
| **Constraints** | Fixed budgets that shape the solution | Time, money, headcount |
| **Requirements / acceptance** | How we know a deliverable is good enough | Health inspection pass |
| **Work episodes** | Time-boxed bursts that advance a part | This week’s plumbing install |
| **Judgments / changes** | Decisions when reality hits the plan | Use gas not induction |
| **Evidence / verification** | Proof requirements held | Inspection report |
| **Structure / organization** | Who owns which part; how parts relate | Vendors, floor plan |

PMBOK’s **scope baseline** is specifically: scope statement + WBS + WBS dictionary — the approved answer to “what are we delivering?” Change control exists because that answer drifts.

Shape Up makes the same anatomy more product-native:

| Shape Up | Universal |
| --- | --- |
| Problem + Solution in a **Pitch** | Objective + proposed deliverable shape |
| **Appetite** | Time constraint (fixed time, variable scope) |
| **No-gos** | Explicit out-of-scope |
| **Scopes** (discovered) | Natural anatomy of the work — “arms vs legs” |
| **Cycle / cool-down** | Cadence of episodes |
| Hill chart | Progress language over scopes, not tasks |

Shape Up’s key line ([Map the Scopes](https://basecamp.com/shapeup/3.3-chapter-12)):

> Well-made scopes show the **anatomy of the project**. … every project has a natural anatomy that arises from the design you want, the system you’re working within, and the interdependencies of the problems you have to solve.

So: **parts precede episodes**. A turn without a part is a pulse with no body.

---

## 2. Software-specific overlays

Software projects add durable *product* structure that outlives any one project/episode:

| Overlay | Meaning | Typical artifact |
| --- | --- | --- |
| **Product / system** | The ongoing thing being changed | Repo, deployable |
| **Capability / feature** | User-valuable slice of the product | “Draft messages”, “Verify claims” |
| **Module / package / node** | Engineering unit of structure | `packages/ledger` |
| **Boundary / context** | Where language & model stay consistent (DDD) | Claims vs Lattice |
| **Standing obligation** | What must remain true | Spec, ADR, invariant, protocol |
| **Contract surface** | Published language between parts | Schema, API, event |
| **Evidence** | Machine-checkable proof | Tests, checks, results files |
| **Episode** | One intent→close of agent/human work | Turn |
| **Judgment** | Why we left/clarified the plan mid-episode | Decision + sources |

DDD reminder (Evans via Fowler): large systems don’t share one unified model — **bounded contexts** hold consistent language. That is anatomy of the *product*, not of a temporary project.

SDLC matrices (charter → requirements → design → implementation → test → release) are **phases and document types**, not primitives. Most of them collapse into: objective, obligations, structure, episodes, evidence.

---

## 3. Two clocks (critical)

Projects fail in Spec Ledger thinking when these are conflated:

| Clock | Lives | Question |
| --- | --- | --- |
| **Standing** (product truth) | Across turns | What must keep holding? |
| **Episode** (project / turn) | Start → end | What are we trying to change *now*, and did we? |

ISO separates **project objective** (deliverables now) from **benefits/goals** (value later). Spec Ledger already separates **claims** (standing) from **turns** (episode). Features/modules sit on the standing clock; turns attach *to* them.

---

## 4. Candidate primitive map → Spec Ledger

Keep the set small. Prefer FK joins over nesting.

| Universal / Shape Up / DDD | Spec Ledger primitive | Status |
| --- | --- | --- |
| Product / system | `graph.system` + ledger `name` | Have |
| Capability / feature / “part of the body” | **`graph.features`** | Have — elevate as turn scope |
| Module / package | `graph.nodes` + edges + layers | Have |
| Bounded context / layer policy | `policy/layers` + node.layer | Have (engineering boundary) |
| Standing obligation | **`claim`** (spec/adr/invariant/…) | Have |
| How we check obligation | **`binding`** + results | Have |
| Gate | **`verify` report + digests** | Have |
| Temporary effort / objective | **`turn.intent.objective` + open/close** | Have / tighten |
| “This episode is *for* that part” | **`turn.intent.featureIds`** (+ optional expected claims) | Agreed — spine |
| Discovered slice inside a bet (Shape Up scope) | **`workstream.suggestedSlices` (verticals)** — titles+acceptance, not turn files | **Have (contract)** — see work-model |
| Pitch / appetite / cycle | **`workstream`** (problem, appetite, seal) | **Have (contract)** |
| Mid-work judgment | **`decision`** (`turnId`) | Designed |
| Cue that triggered judgment | **`source`** (`turnId`) | Designed |
| Observed impact | **`turn.facts`** (tool) | Have — fix basis |
| Hygiene of history | **`audit`** (not verify) | Designed |

### What *not* to make first-class yet

| Tempting | Why not (now) |
| --- | --- |
| Full WBS / task tree | Agents invent task spam; use **verticals** on workstreams instead |
| Sprint / cycle objects | Cadence is process; turn already has start/end |
| Stakeholder / RACI | Org, not adherence |
| Cost / schedule baselines | Outside claim gate |
| Unbounded “project” entity parallel to feature | For agent code work, **feature (or claim repair) is the durable part**; turn is the temporary effort. A multi-week “project” is usually a feature + many turns, or a pitch outside the ledger |

---

## 5. Recommended Spec Ledger anatomy (readable)

```
PRODUCT (standing)
├── system
├── features          ← anatomy parts (“arms / legs”)
├── nodes + edges     ← how the body is wired
├── claims            ← standing obligations on parts / whole
└── bindings→results→verify

EPISODE (temporary)
├── turn
│     intent.objective + featureIds   ← why / which part
│     opened.basis + facts            ← tool truth
├── decisions (turnId)                ← judgments
└── sources (turnId)                  ← cues
```

**Queries that should feel natural:**

- “History of feature `verify`” → turns with that `featureId` (+ decisions)
- “What obligations govern this feature?” → claims on feature / nodes
- “What did this turn decide relative to SL-003?” → decisions citing claim
- “Did we leave the spec?” → deviate without follow-up claim (audit)

---

## 6. Design implications (for the architecture doc)

1. **Feature is the primary “part of the project” FK for turns** — not a free-floating objective alone.
2. **Objective remains required text** — humans say why; feature ids say where in the anatomy.
3. **Claims stay standing truth** — never “owned by” a turn.
4. **Verticals** (workstream suggested slices) replace Shape Up “scopes in the
   ledger” — e2e-checkable, not a fake WBS. See work-model.
5. **Keep two clocks explicit** in Lattice labels: *scoped to* (intent) vs *touched* (facts).

---

## 7. One-sentence takeaway

**A project is a temporary effort to change a durable anatomy under constraints; Spec Ledger’s durable anatomy is features + modules + claims, and turns are the temporary efforts aimed at those parts — with decisions/sources as the judgment trail and verify as the standing gate.**
