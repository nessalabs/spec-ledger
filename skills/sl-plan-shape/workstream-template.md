# Workstream + proposed-claim templates

Paths under repo root. Contract: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md).

## `.spec-ledger/workstreams/W-001.json`

**Product defaults** already filled in `policy` below — override only if the human asks.

```json
{
  "schemaVersion": 1,
  "id": "W-001",
  "status": "draft",
  "createdAt": "2026-09-02T00:00:00.000Z",
  "featureIds": ["verify"],
  "primaryFeatureId": "verify",
  "title": "Short bet title",
  "specPath": "docs/workstreams/W-001-short-bet-title/spec.md",
  "problem": "One-line agent summary (full prose in specPath Markdown)",
  "objective": "One-line agent summary (full prose in specPath Markdown)",
  "appetite": "1–2 days",
  "changeType": "feature",
  "riskLevel": "moderate",
  "trust": {
    "deployTarget": "local",
    "userFacing": false,
    "performanceCritical": false,
    "securitySensitive": false,
    "correctnessCritical": true,
    "requiredEvidence": ["unit", "property"]
  },
  "policy": {
    "alertOnSeverity": "high",
    "onAlert": "wait",
    "alertWaitMinutes": 10,
    "onAlertTimeout": "move",
    "onSealedSpecDeviation": "wait",
    "sealedDeviationWaitMinutes": 10,
    "onSealedDeviationTimeout": "move",
    "requireSpecBreak": true,
    "requireCodeBreak": true
  },
  "acceptanceCriteria": [
    "Concrete checkable outcome for the whole bet"
  ],
  "outOfScope": ["Explicit no-go"],
  "rabbitHoles": [],
  "expectedClaimIds": [],
  "proposedClaimIds": ["PC-001"],
  "suggestedSlices": [
    {
      "id": "SLC-01",
      "title": "Isolated vertical with e2e-checkable outcome",
      "kind": "vertical",
      "acceptance": [
        "Behavior X holds under listed evidence"
      ],
      "expectedClaimIds": [],
      "evidence": ["unit", "property"],
      "notes": "optional"
    }
  ],
  "shapedBy": "agent:sl-plan-shape",
  "attachmentIds": []
}
```

For `trust.deployTarget: "prod"`, set `"onSealedSpecDeviation": "block"` (omit wait
knobs or leave them unused).

Statuses: `draft` → `shaped` → `spec_review` → `sealed` → `active` → `done`

## `.spec-ledger/proposed-claims/PC-001.json`

```json
{
  "schemaVersion": 1,
  "id": "PC-001",
  "status": "proposed",
  "statement": "Standing obligation once promoted",
  "rationale": "Why we expect to need this claim",
  "workstreamId": "W-001",
  "suggestedLiveId": "SL-006",
  "requiredEvidence": ["unit", "property"]
}
```
