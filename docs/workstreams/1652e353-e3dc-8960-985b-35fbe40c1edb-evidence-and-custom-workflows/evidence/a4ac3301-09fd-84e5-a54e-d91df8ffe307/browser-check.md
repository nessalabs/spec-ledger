# Workstream evidence browser observations

Manual verification on 2026-09-04, using the actual Next UI at port 3737 and workstream W-006.

- Evidence is above shipped history, with all six criteria visible.
- While source changes were in progress, all six correctly displayed evidence needed, with stale source/check reasons; historical Done was accompanied by a current-prerequisite warning.
- Expanded the aggregation check. Its command, historical pass, run ID, receipt time, producer, source/check hashes and recorded exit status were visible.
- Expanded the Local approval browser verification artifact. Its integrity-checked original text was readable inline.
- The review list is collapsed behind a current/historical count; findings and residual risks are available without replacing the workstream page.
- Screenshot inspection of the expanded check showed readable contained text and code without overlap at the observed desktop viewport.

These observations are manual, not automated UI CI. The independent projection tests cover stale and duplicate rows, read-only behavior, artifact corruption, oversized/missing files, symlink confinement, receipt attribution, review freshness and path-only coverage.
