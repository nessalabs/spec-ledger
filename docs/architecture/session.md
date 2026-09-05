# Follow a session

`spec-ledger session --workstream W-006` and `GET /v1/session?workstream=W-006` return the same read-only projection. No workstream argument selects the sole active candidate; several candidates require an explicit selection. The reference UI polls observations every five seconds, aborts a request after eight seconds, and labels failed observations disconnected while retaining the last observation.

Acceptance prose remains in `workstream.acceptanceCriteria`, or each slice's `acceptance` when no top-level list exists. Addresses are `AC-1`, `AC-2`, or `SLC-01/AC-1`. Optional `acceptanceClaimIds` maps these addresses to standing claim IDs. This mapping belongs to the sealed spec. Changing acceptance or its mapping changes the revision; it does not preserve an old denominator or approval.

Record meaningful implementation progress as an existing episode decision:

```json
{
  "turnId": "T-030",
  "summary": "A deferred requirement returns when its feature starts",
  "criterionIds": ["SLC-05/AC-1"],
  "implemented": true,
  "preview": { "url": "http://127.0.0.1:3737/", "label": "Try this checkout" }
}
```

Run `spec-ledger progress --file progress.json`. The writer stamps the current plan and source digests; progress cannot supply its own trusted version stamp. The session keeps implementation separate from verification. A criterion with no explicit claim mapping, only file-existence checks, stale results, or missing results cannot count as passing evidence. Preview availability is unconfirmed until an actual check establishes it; a recorded URL alone never implies a healthy running site.

The local Spec Ledger UI host saves revision-bound approval and denial through `/api/approval`. It is separate from the read-only projection server. Run this host bound to loopback (the provided dev/start commands do so); it is not a remotely authenticated service. A same-origin token, literal loopback host, bounded typed payload, observed authority digest, and idempotency ID protect the operation; it cannot execute arbitrary shell commands. Saving an approval explicitly replaces earlier denials for that workstream. Stale spec or authority state refuses and requires a fresh review. Success is shown only after persistence and a refreshed observation. Records retain agent-reported provenance; local browser access does not authenticate a human identity. Already authorized or completed work does not show approval prompts. The portable CLI remains available to other hosts.

`spec-ledger complete --workstream W-006` is a separate completion checkpoint. It activates and evaluates affected deferred commitments, requires current implementation and behavioral evidence for every criterion, required spec/code reviews, valid permission and spec snapshot, and no open turn. Claims-only `verify.ok` does not mean a feature is complete. As with other Git-backed records, these gates protect supported tool paths; a writer with filesystem access is not cryptographically prevented from changing JSON directly.

Human-readable specs, explanations, and useful evidence files live under `docs/workstreams/<id-title>/`. Structured permission, decisions, activation receipts, review records, and evidence indexes live under `.spec-ledger/`. There is no second hand-maintained progress log or backlog database.
