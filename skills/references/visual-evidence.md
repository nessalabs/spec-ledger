# Required screenshots for visual work

When a slice changes visible UI, declare every relevant screen, state and viewport in the preserved plan's `trust.visualEvidence` map and include `screenshot` in that slice's `evidence` list. For example:

```json
{"trust":{"visualEvidence":{"SLC-01":["Expanded results — desktop","Expanded results — mobile","Missing evidence guidance"]}}}
```

This declaration is required for visual tasks. Do not omit it because behavioral tests pass. Do not invent requirements for nonvisual tasks. During spec break, check coverage against the actual UI change; missing visual declarations are a spec gap.

After the final source is built, capture each relevant UI surface. Store captures beneath `.spec-ledger/evidence/screenshots/` so screenshot creation does not itself change source identity. Attach them using the guarded CLI or MCP `record_screenshot` operation:

```sh
spec-ledger evidence screenshot --turn T-001 --surface 'Expanded results — desktop' --path .spec-ledger/evidence/screenshots/desktop.png
spec-ledger evidence check --workstream W-001 --turn T-001
```

Use `--slice` when an authorized later turn refreshes an earlier slice's coverage. Each required surface needs a distinct current screenshot. An old unbound attachment, stale source/plan, changed image, missing file, or duplicate image reused across surfaces does not satisfy coverage. PNG/JPEG captures are bounded to 512 KiB and 16 million pixels. Capture smaller/compressed views when necessary.

Inspect the screenshots: machine checks establish recorded provenance, file integrity and coverage, not that the UI is visually correct. The independent reviewer must inspect relevant images. Missing coverage blocks turn close and workstream completion with instructions to attach screenshots of all relevant UI. Completion reevaluates even previously closed evidence. Screenshots never manufacture a behavioral test pass.
