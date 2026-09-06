# Validation — Follow agent experiments

T-043 is closed and W-014 is complete through the shared gates.

- All packages built successfully.
- Full repository test run: 216 core tests, 12 MCP tests, 40 UI library tests; all passed.
- Final targeted run: 16 tests passed, including the additional interrupted-publication regression and all five independent adversarial tests.
- UI typecheck and final production build passed.
- Production browser checks covered numeric, qualitative, empty, pending, failed, discarded and live-update states, narrow screens, refresh errors, and existing navigation. See browser-check.md and the labeled demo screenshots.
- Verification: 30 active claims pass; 0 fail, 0 missing, 0 attested.
- Independent spec review: W-014/SR-02. Independent final code review: T-043/R-02.
- Audit OK (only existing informational waiver records). Alignment OK: 44 product paths covered, 0 uncovered.
- Original requirements were preserved in snapshot 1; snapshot 2 adds behavioral evidence mapping after independent review under the same user delegation.

The capability is additive: optional goals attach to existing work. Agent-reported measurements and retention decisions do not imply verified correctness or current deployment. One goal uses one fixed metric/protocol, or qualitative findings. Scheduling/running experiments, automatic code retention, cross-repository goals and screenshot uploading are outside scope. A headless agent can capture the inspect page using the existing UI.

Atomic publication and cooperative mutation serialization were inspected; the breaker did not run a multi-process stress or actual process-kill test. Empty interrupted-publication directories, corrupted identities, orphan results and symlink paths have executable regression coverage.

```text
spec-ledger: OK
turn: T-043
workstream: W-014
contextDigest: e054598d1579c93450196a553a0b057e6213b74964977e8eaa5d685fcb01cb25
ledgerDigest: 80e769927f89edee902caa8e013cdf71afa1e6e3ec2733d6cda07f0b61fc8790
resultsDigest: 74caccd0d6ec7f0c9876af98665626541ae0b93148fdad83ef0acf82affe089e
sourceDigest: 355cfbbe5d071cb88cb23e745b845f66d7193bc0b33a53ea10d8194b84d63087
```
