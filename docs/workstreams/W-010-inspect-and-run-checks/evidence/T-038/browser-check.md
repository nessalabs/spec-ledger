# Inspect and rerun a test: browser walkthrough

Observed with the real Next UI and its local `/api/checks` bridge. This is a recorded browser walkthrough, not an automated assertion about every historical workstream.

## Existing claim

Opened `/claims/SL-023` on the user's checkout at port 3737. The panel showed integration test level, authored fixture inputs and expected behavior, the actual `packages/mcp/src/lifecycle.test.ts` source, the saved suite command and checkout directory. Existing output was correctly described as not captured. A click after concurrent source edits was rejected with “The source or saved check changed. Refresh before running it.”

## Isolated executable example

Used a disposable Git checkout and a separate UI server at port 3840. Its saved command was `node example.cjs`, with input `[2,3]`, expected value `5` and an actual assertion in the displayed file.

1. Clicked **Run again** using browser automation. The final claim header and current evidence both became `pass`; actual stdout contained `{"input":[2,3],"expected":5,"actual":5}` and `PASS: sum matches the expected result`. The receipt displayed exit 0, duration 2658 ms and the canonical checkout directory.
2. Changed the calculation to subtraction while keeping the expected assertion at 5. Refreshed the evidence and clicked **Run again**. Observed disabled **Running…** and “Actual run result · running” while the command waited.
3. Without reloading, the final result became `fail`, exit 1, duration 8157 ms. Stdout showed `{"input":[2,3],"expected":5,"actual":-5}`. Stderr showed the actual assertion failure `-5 !== 5` and its source location. Authored expected behavior stayed separate from those observed logs.
4. Counted two persisted run receipts. Clicked **Refresh evidence**, then navigated to the same claim again. The receipt count stayed two: these passive reads did not execute another command.

The temporary server was stopped afterward. The user's server at port 3737 remained available. Output is plain text; the UI regression also checks that source text is escaped and tampered output is not presented as intact.

## Limits

This example demonstrates explicit execution and evidence presentation, not semantic sufficiency of arbitrary tests. Detailed input/expected descriptions are authored metadata. Other tests may emit only framework summaries; missing metadata and previously discarded output remain explicit. Subsequent code changes make prior run evidence historical.
