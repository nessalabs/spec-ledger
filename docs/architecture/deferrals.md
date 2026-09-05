# Deferred commitments

A deferred commitment extends an episode decision. It is discoverable across the entire decision collection, even when its turn is old. Planning exposes local draft workstreams as optional candidates and reports external discovery as not configured. No issue tracker status counts as evidence.

```json
{
  "schemaVersion": 1,
  "id": "T-001/D-01",
  "turnId": "T-001",
  "decision": "Defer tenant isolation",
  "rationale": "This release is single-user",
  "deferral": {
    "deferred": "Implement and verify tenant isolation",
    "originSpecRef": "W-001",
    "when": { "kind": "feature-planned", "featureId": "multi-user" },
    "response": "implement",
    "gate": "before-feature-complete",
    "requirementRef": "TENANT-ISOLATION"
  }
}
```

`originSpecRef` identifies the originating workstream, optionally followed by a criterion (`W-001/AC-01`). The trigger references a feature in the graph. The requirement references a live claim. Missing references are unknown, not false. Only the feature-planned trigger is supported; vague future conditions remain ordinary review notes.

`recordDeferredDecision` writes the decision immutably on an open turn. At explicit work start, `activateDeferralsForWork` requires permission and a valid plan snapshot, then preserves the full original decision in `.spec-ledger/deferral-activations/`. One activation per decision and workstream makes retries idempotent. Observations never activate anything. Removing a feature after activation does not remove its gate; deleting or rewriting the originating decision yields unknown until the original commitment is restored. These activation receipts are facts about when the existing decision became due, not a second task list.

`evaluateDeferrals` is read-only and returns not-due, due, unknown, or resolved. A matching feature in an executable plan is due even before its first activation write. Once any matching work has activated an obligation, it remains discoverable for later matching work. Unrelated workstreams can complete normally.

Before completing a workstream, run `assertDeferralsSatisfied` after normal permission/snapshot checks and activation. Do not gate ordinary turn close: a feature may require several turns to satisfy its obligations. Calling the gate on a matching draft plan also refuses completion; planning discovery is not satisfaction. Enforcement applies only to callers that invoke the shared gate; this does not intercept arbitrary external release commands or hostile filesystem writes.

For an `implement` response, the live requirement must have current passing evidence and at least one command or results-row binding. Existence-only checks and attestation cannot satisfy behavioral implementation. All bindings still contribute to the claim verdict. Source/check/artifact freshness uses the shared verifier. A decision cannot dismiss, cancel, or re-defer a hard implementation requirement.

For a `revisit` response, append a new decision with `deferralResolution`:

```json
{
  "decisionRef": "T-001/D-01",
  "action": "revisited",
  "authorityRef": "AUTH-request",
  "workstreamId": "W-002",
  "revisionDigest": "<current permission revision digest>"
}
```

The enclosing decision supplies a rationale. The recorder checks current explicit authority, the exact plan revision, and applicability to an activated commitment. Legacy seals alone do not establish explicit dismissal authority. Revoked authority or a changed revision makes the old resolution insufficient. `dismissed` and `cancelled` have the same authority requirements. `re-deferred` additionally requires a new `deferral` on the resolution decision, preserving the original history and bringing the replacement commitment back through the same trigger/gate checks. It cannot dismiss an implementation requirement.

The portable caller and checkout owner remain the trusted write boundary. Authority references preserve the recorded delegation; they do not authenticate a malicious local writer. Independent review still assesses whether the behavior checks are meaningful.
