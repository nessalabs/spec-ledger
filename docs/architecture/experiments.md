# Optional goals and experiments

Iterative improvement is an addition to Spec Ledger's existing work model. An ordinary task still follows its plan, turns, reviews and verification. If the user requests repeated improvement, or the agent identifies work that benefits from experiments, the agent attaches a goal to an open workstream turn. The goal is the classification signal; there is no replacement task hierarchy or automatic permission to run more work.

## Records

| Record | Meaning |
| --- | --- |
| Goal | Objective, stopping rule, optional attempt budget and optional fixed metric. Attached to an existing workstream and originating turn. |
| Experiment | One hypothesis and proposed change, its initiating turn, optional finished parent attempt, and a tool-assigned attempt sequence. |
| Result | One completed or failed result, findings, optional measurement, kept/discarded/inconclusive decision and evidence references. |
| Conclusion | An explicit stopping reason and summary after every attempt has a result. Does not complete the task or workstream. |

A metric specifies its name, unit, minimize/maximize direction and evaluation protocol, with optional baseline and target. Change the protocol or metric by starting a new goal; incomparable scores must not share a chart. Qualitative goals omit the metric and cannot accept numerical measurements. Failed results are inconclusive and cannot carry measurements. A completed attempt can omit its measurement when it only yielded qualitative findings.

Results are **agent-reported observations**, not claim evidence or `verify` verdicts. “Kept” records the agent's stated retention decision; it does not apply a patch, prove correctness, or establish the current deployment. “Best kept” is the best result ever reported kept, including the baseline when supplied. “Best observed” also includes discarded and inconclusive completed measurements. “Latest measured attempt” means the highest attempt sequence with a measurement, even if asynchronous attempts finished in another order. Target observation uses the best observed value, including a supplied baseline, and does not conclude the goal or satisfy verification.

Attempts consume budget when started, including failed attempts. Budget exhaustion prevents another start, but permits pending results and conclusion. Agents can conclude early. A stopping rule is guidance, not an executable expression. The system does not schedule experiments, claim statistical significance, fetch evidence references, or run code from these records.

## Agent workflow

Follow the existing shape/permission/build process first. On an authorized open turn, save a goal input outside the source tree, for example `/tmp/goal.json`:

```json
{
  "id": "G-evaluation-speed",
  "workstreamId": "W-014",
  "turnId": "T-043",
  "title": "Make evaluation faster",
  "objective": "Reduce evaluation time while retaining identical outputs.",
  "stopWhen": "Stop after eight attempts or when a safe candidate is under 100 ms.",
  "maxExperiments": 8,
  "metric": {
    "name": "Evaluation time",
    "unit": "ms",
    "direction": "minimize",
    "protocol": "Median of 20 runs on the same 100 cases and worker. Check outputs separately.",
    "baseline": 240,
    "target": 100
  }
}
```

Replace the workstream and turn IDs with the actual current work. Then:

```sh
spec-ledger goal create --file /tmp/goal.json
spec-ledger experiment start --file /tmp/attempt.json
# Perform the authorized experiment, evaluate it using the fixed protocol,
# and run the task's existing correctness checks separately.
spec-ledger experiment result --file /tmp/result.json
spec-ledger goal show --id G-evaluation-speed
spec-ledger goal list --turn T-043
spec-ledger goal conclude --file /tmp/conclusion.json
```

An attempt input:

```json
{
  "id": "X-cache-parsing",
  "goalId": "G-evaluation-speed",
  "turnId": "T-043",
  "hypothesis": "Reusing parsed inputs will remove repeated work.",
  "change": "Cache parsed inputs for the lifetime of one evaluation."
}
```

A result input:

```json
{
  "goalId": "G-evaluation-speed",
  "experimentId": "X-cache-parsing",
  "turnId": "T-043",
  "status": "completed",
  "decision": "kept",
  "measurement": 130,
  "findings": "Evaluation is faster and the separate output comparison found no changes.",
  "evidenceRefs": ["artifacts/evaluation/cache-parsing.json"]
}
```

A conclusion input:

```json
{
  "goalId": "G-evaluation-speed",
  "turnId": "T-043",
  "reason": "stopped",
  "summary": "Kept parsing reuse; stopped before more invasive changes."
}
```

Further attempts can supply `parentExperimentId` to explain recursive improvement. It must identify an already finished attempt in the same goal. Every new write names an open turn in that goal's workstream with current permission and executable plan context. A later authorized turn can continue a goal after the originating turn closes. This does not reopen or edit the originating turn's facts.

The CLI reads current revision/source fingerprints at invocation, or accepts explicit `--revision` and `--source-digest`. `--request-id` uses the shared durable receipt mechanism: retry identical operation input with the same request ID. A reused record ID with identical payload also returns the original record; conflicting content is refused. An unfinished operation receipt is reported as execution unknown and is not blindly replayed. Inspect the existing goal/attempt/result before deciding how to recover; record identities allow an identical effect to be reconciled with a fresh request under current source context.

The MCP exposes the same operations: `list_goals`, `get_goal`, `create_goal`, `start_experiment`, `record_experiment_result`, `conclude_goal`. Mutation envelopes include `requestId`, `expectedRevisionDigest`, `expectedSourceDigest`, and the nested `goal`, `experiment`, `result` or `conclusion`. The generic `spec-ledger operation <name> --file <json>` path uses exactly that envelope. Goal reporting grants no new authority; existing plan approval, checks, review and completion still apply.

## Inspect and share

Open **Experiments** in the existing UI, or navigate directly to `/experiments/G-evaluation-speed`. Related workstream and turn pages link to their goals. The read-only screen displays the objective, stopping rule, budget, baseline/latest/best values, a chart, results table, findings, snapshot time and last recorded timestamp. It refreshes every five seconds while visible and retains the previous snapshot with an error if refresh fails. Missing values are not zeros. Failed/pending attempts break the chart line, and hollow markers distinguish measured candidates that were not kept. The table provides values and findings without needing to hover over the chart.

A headless agent can run the existing UI against a synced checkout (`SPEC_LEDGER_ROOT`) and capture `/experiments/<goal-id>` with a browser screenshot tool. The screen has no dependency on a local editor or agent host. The agent/user chooses how to share that screenshot; this feature does not send or upload it. A remote checkout sees history only after the Git files reach it; automatic repository synchronization is out of scope.

For a synthetic demonstration, build the packages and run `node docs/workstreams/W-014-follow-agent-experiments/demo.mjs`. It creates and prints a temporary fixture root, without modifying the real ledger. Start the UI with that root and inspect `/experiments/G-demo-speed`. All demo goal titles are labeled.

## Storage and deletion

The optional namespace is `.spec-ledger/optimization/<goal-id>/`, with `goal.json`, `experiments/<experiment-id>.json`, `results/<experiment-id>.json`, and optional `conclusion.json`. Schemas live in `schemas/optimization-*.json`; runtime Zod schemas enforce the same record shapes plus cross-record rules. Record identities and paths are validated, symlinks are rejected, and complete immutable JSON files are published atomically under the shared cooperative mutation lock. A process crash cannot expose a half-written JSON record. Existing shared receipt lock recovery semantics still apply.

GET `/v1/goals` accepts optional `workstreamId` and `turnId` filters; GET `/v1/goals/:id` returns the full projection. `SpecLedgerClient.listGoals` and `getGoal` serve both in-process and HTTP transports. HTTP never writes. The UI imports client types and methods only. Delete this capability by removing the optional optimization module, its application/transport registrations and inspect components; no changes to claim algorithms or existing turn schemas are needed.
