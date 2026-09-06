# Required visual evidence browser checks

Verified the production build against the real workstream.

- Passing cards show the test description and captured standard output without repeated current-pass, finished-run or successful-exit metadata.
- Successful metadata remains collapsed in provenance. Automated tests retain failure, pending, historical and unavailable-output information.
- Missing screenshot guidance lists the three declared surfaces and tells the agent to attach all relevant UI.
- Captured and recorded desktop, mobile and missing-guidance screenshots through the guarded screenshot operation. The visual check reports all three surfaces satisfied.
- The first mobile capture exposed a narrow description column alongside actions. Fixed the layout to stack the description and buttons on small screens; the final 390 px capture shows readable text and no document overflow.
- Screenshot captures are stored in .spec-ledger/evidence/screenshots/T-045-*.png and bound to current source/plan/file integrity. Their recording does not change source identity.
- Production page loads without browser errors or framework overlays.

Full tests passed after correcting a CLI test path that assumed invocation from the repository root. Latest UI tests and production build passed again after the mobile class change; final ledger checks reran all current bindings.
