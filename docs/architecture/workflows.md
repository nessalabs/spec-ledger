# Engineering methods and their evidence

A workflow describes the method selected for a workstream: ordered stages, steps, skills and required outputs. The agent performs the work. Spec Ledger preserves the method and evaluates its recorded outputs. CLI and MCP use the same operations; the website renders their shared observation.

## Choosing a method

Existing repositories need no configuration to keep using the default work loop. Their generated default view derives status from existing spec, progress, review and evidence records. Selecting a method explicitly preserves a snapshot and enables step attempts and required output checks for that selection.

Use `get_workflow` to inspect the effective method and `preview_workflow` to resolve a proposed profile without writing it. Use `set_workflow` to select the bundled default or supply a local profile. Both names are MCP tools and portable CLI operations:

```sh
spec-ledger operation get_workflow --file observe.json
spec-ledger operation set_workflow --file select.json
```

The read input is `{ "workstreamId": "W-001" }`. Selection includes that ID, a stable `requestId`, the observed `expectedRevisionDigest` and `expectedSourceDigest`, and an optional `profile`. Omitting the profile selects the bundled default. An amendment includes the existing `expectedSnapshotDigest` and a reason. Inspect the effective method before starting steps. Selection changes guidance and method requirements within existing permission; it does not grant permission or weaken project policy.

A profile can supply an ordered list of stages or extend `spec-ledger/default` to replace skill choices. Each step declares nonempty typed outputs. Stage satisfaction requires all its steps; recording one step's output does not silently complete its siblings. Full stage replacements use explicit order, never a positional array merge.

A local skill reference preserves the file text and digest. Capability declarations describe the outputs the skill is intended to help produce; they are agent-reported metadata, not evidence that the host can run it. A skill without a capability declaration requires explicit acknowledgement of that uncertainty. Missing, oversized or escaping paths are errors. Reading or selecting a skill does not install anything or execute its contents.

For example, this profile keeps the default stages and substitutes two local skills:

```json
{
  "id": "team-web",
  "title": "Team web method",
  "extends": "spec-ledger/default",
  "skills": {
    "plan": { "path": "skills/team-planning/SKILL.md", "acknowledgeUncertain": true },
    "implement": { "path": "skills/team-coding/SKILL.md", "acknowledgeUncertain": true }
  }
}
```

Pass it as `profile` with `workstreamId` to `preview_workflow`, then include the observed digests and request ID when selecting it. The acknowledgement records that these existing Markdown skills have no declared capabilities; it does not assert compatibility or passing evidence. A fully customized profile supplies `stages`, each containing `id`, `title`, `role` and ordered `steps`. Each step supplies `id`, `title`, `skill` and `outputs`, such as `[{"kind":"check-results","criterionIds":["AC-1"]}]`.

## Following the selected method

The normal loop is:

1. Read `get_workflow` or `get_session` for eligible steps, missing outputs and current digests.
2. Call `begin_workflow_step` with its stage and step IDs and the observed revision, source and method snapshot digests.
3. Follow the preserved skill guidance within the task's existing permission. Use the usual progress, decision, check and review operations to create records.
4. Call `record_workflow_output` to reference those records from the attempt. References must belong to this workstream and satisfy the declared output type.
5. Read the computed status. `report_workflow_attempt` records an execution report or blockage; it cannot manufacture satisfied outputs.

Mutation inputs use the same request-receipt protocol as [other agent tools](agent-tools.md). Retry with the original identity and input; an unfinished receipt is unknown and needs reconciliation. Do not create a new request ID merely to repeat an operation with uncertain effects.

An output names `attemptId`, `kind`, `recordType` and `recordIds`, plus its declared `criterionIds` when scoped. Spec revisions reference the preserved seal's `snapshotPath`; reviews and decisions use their existing IDs; check results use persisted result-row keys, such as `command:<bindingId>`. A method snapshot ID is not a spec revision or a passing check.

A failed or stale output remains visible. Repair the implementation in a new attempt and repeat the affected checks and reviews. A method amendment creates a new snapshot and requires new attempts. Earlier snapshots and records remain inspectable; no history is relabeled as having run under the replacement method. For explicit methods, review, decision and result outputs must be produced after the attempt began. Shared operation receipts provide that attribution; the current preserved spec snapshot can be reused. A newer attempt cannot relabel an older review as execution of a replacement skill.

## What each output means

| Output | Evidence required |
| --- | --- |
| `spec-revision` | A preserved current spec revision |
| `spec-review` | Current revision-bound approval with no unresolved blocking findings |
| `implementation-report` | Current source/revision-bound criterion report; visibly agent reported |
| `check-results` | Current passing behavioral evidence for the scoped acceptance criteria |
| `code-review` | Current source-bound approval meeting the applicable review policy |
| `attestation` | An explicit decision, shown as attested; it cannot replace a check or independent review |

Unknown output kinds and empty output contracts are rejected. Steps cannot rearrange implementation ahead of a policy-required spec review. Existing permission, review and deferred-obligation gates remain in force independently of labels and order.

Spec outputs depend on the spec revision. Code, implementation and check outputs depend on current source and their underlying evidence contracts. A method change conservatively requires new attempts; it does not rewrite a historical check result. The UI explains when an output is missing, failed or stale instead of presenting a historical success as current.

## Reading progress

The workstream page shows the selected method, stages, steps, preserved skills, attempts, output references and blockers alongside acceptance evidence. The Now page provides a compact view. Both refresh through passive observations after CLI or MCP writes. A disconnected page retains its last observation and labels it disconnected.

Acceptance percentage counts criteria with current passing evidence, with agent-reported implementation shown separately. Stage satisfaction describes the method's output contracts. Neither percentage nor a stage label independently marks the workstream complete. Completion also checks permission, required reviews, open turns and deferred obligations.

## Storage and enforcement limits

Profiles, resolved snapshots and small attempt/output records belong in `.spec-ledger/`. Human-readable specs and logs, screenshots and reports stay with `docs/workstreams/<workstream>/evidence/`, referenced with their integrity metadata. Do not duplicate large logs in method receipts.

This protocol constrains cooperative tool calls. A process with unrestricted repository write access can bypass tools; host controls and CI must enforce stronger restrictions where needed. A receipt cannot prove the agent understood a skill, and a reviewer label cannot authenticate a separate human or agent. Keep those claims distinct from the evidence actually available.
