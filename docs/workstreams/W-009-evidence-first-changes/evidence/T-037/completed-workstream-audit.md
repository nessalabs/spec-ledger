# Audit of completed workstreams

This is a current review of old acceptance, not a reconstruction of historical proof. Missing mappings and superseded requirements are explicit gaps; old done flags are not independent verification.

## W-001

- **AC-1**: partial-or-unmapped. Existing SL-015 overlaps digest preservation but does not fully name seal lifecycle; new scoped claim needed.
- **AC-2**: partial-or-unmapped. Stable API context tested; exact CLI/API equality not asserted by this test.
- **AC-3**: partial-or-unmapped. Behavior test exists, but SL-006 only describes dirty/tree gate. Add scoped claim before mapping.
- **AC-4**: partial-or-unmapped. Behavior test exists; no standing claim precisely represents review-close gate.
- **AC-5**: partial-or-unmapped. Needs current browser observation of feature and turn detail after this turn UI edits. Legacy Lattice name superseded.
- **AC-6**: partial-or-unmapped. Existing test calls verifier twice without changing metadata: insufficient assertion of independence. Add mutation-based test.

## W-002

- **AC-1**: partial-or-unmapped. No direct check-no-write/abandon facts behavior assertion found.
- **AC-2**: partial-or-unmapped. Upgrade SL-006 path binding and add explicit dirty-refusal test if not in latest suite; current named turn test permits dirty.
- **AC-3**: partial-or-unmapped. SL-007 binding is only routes.ts existence. Need actual HTTP client context test.
- **AC-4**: partial-or-unmapped. Original resume-on-context behavior intentionally superseded by W006 read purity. Do not claim old acceptance passing; record supersession.
- **AC-5**: partial-or-unmapped. Related function checked, not CLI shape. No exact standing claim.
- **AC-6**: partial-or-unmapped. Test runs real side-collection CLI and close; add scoped claim for mapping.
- **AC-7**: partial-or-unmapped. Current test checks audit shape only, not policy nonzero exit. SL-008 path binding insufficient; CI config inspection required.
- **AC-8**: partial-or-unmapped. Needs browser observation; /timeline may now route through turns history. Legacy Lattice label superseded.
- **AC-9**: partial-or-unmapped. Dogfood turn metadata can establish historical use; proposals/themes behavior not meaningfully asserted.

## W-003

- **AC-1**: partial-or-unmapped. pnpm lattice script no longer exists; pnpm ui is authorized naming successor. Preserve original spec and explain supersession.
- **AC-2**: partial-or-unmapped. Home was replaced by Follow the work; prior pulse/open-turn/live-badge layout is not current contract. Verify current experience as W008/W009 instead.
- **AC-3**: partial-or-unmapped. Needs browser check of workstream index/detail after current edits.
- **AC-4**: partial-or-unmapped. Needs browser check of turn metadata and artifacts after current edits.
- **AC-5**: partial-or-unmapped. Needs browser check of brand/navigation. Screenshot revealed old Lattice in W004 objective; do not silently rewrite sealed prose.
- **AC-6**: partial-or-unmapped. SL-005 tests only package path existence currently. Need real client/API episode test and import-boundary test before whole criterion can pass.

## W-004

- **AC-1**: partial-or-unmapped. Document layout intentionally evolved to workstream directories with evidence. Inspect current docs layout; original title-slug exact shape superseded.
- **AC-2**: partial-or-unmapped. Current branding requirement superseded original specLedger typography; verify Spec Ledger chrome in browser.
- **AC-3**: partial-or-unmapped. Turn order explicitly changes under W009 evidence-first request; original plan-first ordering must be labeled superseded, not falsely passed.
- **AC-4**: partial-or-unmapped. Needs current browser assertion of named features/workstream/count.
- **AC-5**: partial-or-unmapped. Needs browser observation of covered totals and statement-first verdict rows.
- **AC-6**: partial-or-unmapped. Needs browser observation of compact claims/features/workstreams/turns rows.
- **AC-7**: partial-or-unmapped. Behavior suites exist but no SL-009 claim is present: create scoped coverage claim.
- **AC-8**: partial-or-unmapped. Behavior suites exist but no SL-010 claim is present: create scoped approval claim.
- **AC-9**: partial-or-unmapped. Existing suites cover forged/invalid waiver refs; add direct minimum reason/max-per-turn and waiver audit tests if mapping full criterion.
- **AC-10**: partial-or-unmapped. Existing align suites exercise refusal; needs scoped align gate claim.
- **AC-11**: partial-or-unmapped. Inspect/run hook/CI path with negative fixture; static config alone is not full gate execution.
- **AC-12**: partial-or-unmapped. Skill and AGENTS inspection can be recorded as attestation, not behavioral pass. User instructions override old named model choice.

## W-005

- **AC-1**: supported-after-execution. Mapped to SL-011; executable checks replace former path bindings.
- **AC-2**: supported-after-execution. Mapped to SL-011; executable checks replace former path bindings.
- **AC-3**: supported-after-execution. Mapped to SL-012; executable checks replace former path bindings.
- **AC-4**: supported-after-execution. Mapped to SL-012; executable checks replace former path bindings.
- **AC-5**: supported-after-execution. Mapped to SL-013; executable checks replace former path bindings.
- **AC-6**: supported-after-execution. Mapped to SL-014; executable checks replace former path bindings.
- **AC-7**: supported-after-execution. Mapped to SL-015; executable checks replace former path bindings.
- **AC-8**: partial-or-unmapped. Scope condition: first actual release optional. Do not force a behavioral claim or imply npm publication occurred. Workflow/docs/dry-run evidence belongs AC-6; record scope note.

## W-006

- **SLC-01/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.
- **SLC-02/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.
- **SLC-03/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.
- **SLC-04/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.
- **SLC-05/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.
- **SLC-06/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

## W-007

- **SLC-01/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

## W-008

- **SLC-01/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.
- **SLC-02/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.
- **SLC-03/AC-1**: existing-mapping-retain. Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

W-005 AC1–7 mappings have been applied and SL-011 through SL-015 now run real behavioral suites. AC8 remains unmapped because it makes an actual release optional; no publication has been implied. W-006 through W-008 mappings are retained. Other tentative overlaps were not applied as if they proved the whole criterion. Current-turn source changes require a final rerun.
