# Choose the engineering method; preserve the evidence contract

Proposal for discussion — not an implemented feature or an instruction to agents.

## Recommendation

Make Spec Ledger a small evidence and permission protocol with a default engineering workflow. Let users replace the skills and ordered steps used for planning, grilling, implementation, review and verification. Keep the meaning of permission, evidence, currentness and unresolved obligations outside those skills.

Start with named workflow profiles and ordered stages. Do not start with a general workflow engine, arbitrary condition language, visual DAG builder or a new agent runtime. The user should be able to say “use my planning skill and our security review” without learning a programming language.

The product promise is: **you can see what was intended, what method was selected, what actually happened, and what evidence supports the result.** It is not “we can prove an agent read a skill” or “a green workflow proves arbitrary code is correct.”

## The distinction that simplifies the design

| Concern | Owner | Example |
| --- | --- | --- |
| Product intent | Spec and acceptance criteria | Invitations cannot expose another tenant's data |
| Permission | User grant and its scope | Build this request autonomously; ask before deployment |
| Engineering method | Selected workflow profile | Plan, grill twice, implement, run our verification skill |
| Required outcomes | Project policy | Current evidence for every required criterion; no unresolved high findings |
| Observations | Typed receipts and artifacts | Check X failed on source Y; reviewer raised finding Z |
| Decision to proceed | Deterministic gate evaluation | Implementation allowed; release blocked by tenant isolation |

A skill explains how to do a job. A receipt records what happened. A gate decides whether the recorded facts satisfy the applicable policy. None substitutes for another.

## Minimal primitives

Reuse the existing workstream, revision, authority, claim, binding, result, review, finding, decision and deferral. Add only two stored concepts initially:

1. **Workflow profile:** versioned ordered stages with stable IDs, ordered steps, skill references and required outputs. Standard stage roles are plan, spec-review, implement, verify and code-review. Users can change labels, insert steps and replace skills. Roles describe the allowed outputs and applicable checkpoints; they are not commands to a particular model.
2. **Resolved workflow snapshot:** the effective profile, selected policy, exact skill content digests and capabilities available for this workstream revision. Keep it with the existing plan snapshot. Add step/stage references to existing receipts instead of creating a parallel evidence database.

Expose a computed **stage status**: ready, running, blocked, satisfied, or not-applicable. Do not store a freely editable “passed stage.” Running can be agent-reported; satisfied must come from the output contracts. Missing or unverifiable observations stay unknown/blocked where policy requires them.

A durable stage-attempt ID distinguishes retries. Existing run IDs remain the identity of individual check runs. Reusing an attempt or run ID with different content is an error.

## User experience

Default installation works with no workflow configuration. A setup screen offers:

- Use Spec Ledger defaults.
- Replace skills in the default workflow.
- Customize stages and steps.

The second option should cover most power users. A user selects local skill paths or already installed skills for each role, previews the effective sequence and sees missing capabilities before work starts. Natural-language requests produce the same reviewable configuration; they do not remain hidden chat state.

On the workstream page, show the selected workflow and current stage, then the requirements and evidence. A stage can expand to show the chosen steps, skill version, reported execution, outputs and blockers. The screen should answer “what is missing?” without requiring the user to read tool logs.

Changing a workflow during a request is an explicit amendment with a reason and new snapshot. Show which prior observations still apply. Never pretend earlier work ran under the new method.

## Example configuration

Illustrative syntax; not a committed schema or supported CLI yet:

```yaml
version: 1
id: team-web
extends: spec-ledger/default
skills:
  plan: { path: skills/our-planning/SKILL.md }
  implement: { path: skills/our-coding/SKILL.md }
stages:
  - id: plan
    role: plan
    steps:
      - id: discover
        skill: plan
      - id: interface-review
        skill: { path: skills/interface-review/SKILL.md }
    outputs: [spec-revision]
  - id: grill
    role: spec-review
    steps:
      - id: challenge-assumptions
        skill: { path: skills/grill/SKILL.md }
    outputs: [spec-review]
  - id: build
    role: implement
    steps:
      - id: code
        skill: implement
    outputs: [implementation-report]
  - id: verify
    role: verify
    steps:
      - id: tests
        skill: { path: skills/our-verification/SKILL.md }
    outputs: [check-results]
  - id: review
    role: code-review
    steps:
      - id: adversarial-review
        skill: { path: skills/code-review/SKILL.md }
    outputs: [code-review]
```

For v1, overrides replace a named stage's steps explicitly; they do not deeply merge arrays by position. Duplicate or unknown stage IDs, dependency cycles in inheritance, missing skills and unsupported output types are configuration errors. Allow one base profile plus local overrides, not an arbitrary inheritance graph. Show the fully resolved result before execution.

Skills are Markdown guidance. A separate optional manifest declares required capabilities and expected output types. Existing skills need no rewrite to be selected, but without a manifest the host must acknowledge capability uncertainty. A skill's name or description never proves compatibility.

## Guardrails and flexibility

There are two kinds of constraints:

**Protocol invariants cannot be waived by a skill or workflow:** no invented user permission; no false attribution; no converting attestation or missing evidence into a passing check; no rewriting an immutable observation; no silently treating stale evidence as current; no treating an unknown trigger as false. A user may accept risk, but the display still tells the truth.

**Engineering policy is user-configurable within the user's authority:** required review roles, finding severity thresholds, test obligations, independent reviewer requirements and release checkpoints. Profiles can add requirements. They cannot silently weaken the project's active policy. Weakening a requirement requires an explicit attributed policy amendment or scoped waiver, with reason, affected checkpoint, scope and expiry. The interface must show accepted risk separately from verified behavior.

Do not automatically require every project to have two reviewers or a browser test. Sensible defaults are a starting policy, not a universal definition of quality. Higher-risk projects can lock a stricter policy through their actual host/CI controls.

A configured independent review requires an observable separate reviewer execution when the host can provide one. A different `reviewer` string is not authentication. Portable CLI reports retain agent-reported provenance; hosts may attach verified execution identity. If the required assurance is unavailable, the checkpoint remains blocked or needs an explicit policy decision.

## Execution without building another agent runtime

The core resolves the profile, computes prerequisites and validates submitted observations. The host runs agents and skills. CLI, MCP and host adapters call the same operations:

1. `resolve` returns the effective snapshot and missing capabilities.
2. `next` returns eligible stages, instructions and missing outputs; it does not run commands.
3. `begin` creates an attributed attempt under existing permission.
4. Existing result/review/decision tools submit typed outputs tagged with attempt and stage IDs.
5. `evaluate` derives checkpoint readiness from those outputs.

These are proposed semantic operations, not five mandatory new commands. Fit them into the current plan/work/check tools where possible. Keep check execution an explicit operation. Loading a profile or skill must not install software, execute shell text or contact an external service.

Mandatory prerequisites come from policy and permission, independently of stage order. Moving implementation before a required spec review cannot bypass that review: reject an impossible ordering before execution. A repair attempt returns to implementation and repeats affected required stages; it does not restart unrelated work or erase failed observations.

Initially run stages sequentially. A failed check sends the agent back to implementation in a new attempt; code changes invalidate dependent observations. Resume reads existing attempts and remaining outputs. A crash after writing a receipt but before updating the active pointer is repaired idempotently. Do not append duplicate observations on retry.

At plan time, inspect related specs and backlog/deferrals. At relevant checkpoints, evaluate durable obligations again. Use the existing typed triggers, not arbitrary JavaScript expressions. Unknown applicability remains visible. Semantic “this might touch that feature” still needs agent/reviewer judgment; explicit feature links make known triggers deterministic.

## Freshness and reproducibility

Bind the resolved workflow snapshot to the spec revision and record its digest on each attempt. Resolve local skills to content digests when the plan is prepared; preserve the text or a retrievable immutable copy. A moving URL or a skill display name is insufficient. Start with local and installed skill references only; remote registries can follow later with explicit installation and integrity checks.

Scope dependencies instead of invalidating everything blindly:

- Test results depend on source, check definition and required artifacts.
- Spec reviews depend on the spec and relevant policy/review contract.
- Code reviews depend on source, reviewed spec and review contract.
- Step-completion claims depend on the chosen skill and step definition.

Changing a writing-style skill should not invalidate a valid test run. Changing a required security-review procedure can invalidate that review while preserving unrelated test results. When dependency information is unavailable, treat reuse as unconfirmed rather than guessing.

For the first implementation, conservative invalidation is acceptable and simpler. Display why it happened. Do not implement a dependency optimizer before the stored relationships justify one.

## Files and ownership

Proposed layout:

```text
.spec-ledger/
  workflows/team-web.json          # versioned method configuration
  policy/...                      # engineering requirements, separate authority
  workstreams/W-...seals/...       # spec + resolved workflow snapshot
  reviews/ evidence/ decisions/   # existing typed observations with stage refs

docs/workstreams/W-.../
  spec.md                         # human-readable intent
  evidence/<attempt>/...          # logs, screenshots, reports
skills/...                        # replaceable method instructions
```

Keep the configuration and small receipts in the ledger. Keep readable specs and artifacts with the workstream. Do not duplicate logs inside every stage receipt. Preserve integrity hashes and explicit artifact ownership; generated evidence exclusions must not hide product source files.

## Enforcement limits

A cooperative agent can follow the protocol through any host. Spec Ledger alone cannot prevent a process with filesystem write access from editing code early, falsifying inputs or bypassing the CLI. Runtime prevention requires host sandbox/permission controls; CI can reject invalid or unsupported completion claims afterward. State this explicitly in the UI and docs instead of describing agent instructions as a security boundary.

Likewise, checking that a receipt exists does not prove a review was insightful. Show its findings, evidence and provenance so users can judge the work. Test results establish the tested examples and assertions, not universal equivalence between prose and code.

## Migration and deletion plan

1. Keep the current workflow as a generated default profile; existing repositories require no new configuration.
2. Add skill replacement and snapshot resolution. Preserve current gates and receipts; compare old and resolved behavior in tests.
3. Replace hard-coded stage orchestration with a small shared evaluator. Retain old commands as adapters to the same operations.
4. Add custom ordered stages only after substitution works through CLI and UI. Migrate review and verification requirements into policy; keep typed core invariants.
5. Consolidate the many `sl-plan-*`/`sl-dev-*` wrappers into a few entry skills and reusable method modules. Remove duplicated policy prose; skills point to the effective policy and ask tools for prerequisites.

No need to rewrite the verifier, authority ledger, deferral triggers or all history. Rewrite orchestration where it is hard-coded. Keep the old parser only for a bounded migration period, with fixtures proving history still renders correctly. Do not carry two competing workflow engines indefinitely.

## Acceptance for a future implementation

- A fresh repository completes the default flow with no configuration.
- A user replaces planning and coding skills without editing core code or disabling evidence gates.
- A custom grilling step appears before implementation and its required output cannot be skipped by renaming a stage.
- Missing skill, changed skill digest, unsupported capability and unknown trigger all produce actionable blockers.
- A stale passing result remains stale; a custom step cannot mark it current.
- Policy weakening requires attributed explicit authority; existing denials and due obligations still apply.
- Restart and retry produce no duplicate decisions or falsely completed stages.
- CLI and UI show the same effective workflow, readiness, evidence and outstanding obligations.

## Decisions to validate with real use

Ship default plus skill substitution first. Use two real profiles — the current Spec Ledger method and a user's existing engineering skills — before adding more syntax. Only add parallel stages if those examples need them. Do not add Linear synchronization, hosted execution or a plugin marketplace to solve skill selection.

The largest architectural cleanup is separating the enforced outcome contracts from the current `sl-*` instructions. That is worthwhile even if custom stages never ship.
