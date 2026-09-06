# Experiment inspect browser verification

Synthetic fixture only; none of these measurements are product benchmark claims. Fixture generator: `docs/workstreams/W-014-follow-agent-experiments/demo.mjs`.

Verified with agent-browser against this isolated worktree's UI on loopback port 3843:

- Numeric goal: objective, stopping rule, 6/8 budget, pending/failed counts, baseline 240 ms, latest/best kept 112 ms, best observed 78 ms explicitly discarded.
- Chart: lower-is-better label, baseline and target lines, missing-result gaps, hollow discarded point; numerical values and findings also available in table.
- Qualitative goal: readable findings without invented score or numeric chart.
- Empty maximizing goal: explicit no-experiments state and absent observations shown as dashes.
- Desktop screenshot: full objective, chart, findings and all six result rows visible at 1600×1800.
- Mobile at 390×844: body width remained 390 px; text and metrics readable; results table scrolls horizontally within its container. Chart has a minimum readable width with local horizontal scroll.
- Live update: recorded pending attempt result as 94 ms through the actual CLI; the open browser reflected its findings and score without navigation.
- Refresh failure: temporarily hid the synthetic goal record, clicked Refresh, and observed “Unable to refresh. Showing the last readable snapshot.” Existing findings remained visible. Restored the record afterward.
- Navigated goal list, numeric/qualitative/empty details and the existing home page. No blank page or framework error overlay. Initial browser error collection was empty; the intentional missing-record request correctly returned 404.

Screenshots in this directory are labeled demonstrations. The real ledger is unchanged by the demonstration workflow. Production build and final-source checks are recorded in `validation.md`.

Final production-server verification: the built app rendered all six result rows and chart with no browser errors or framework overlay. At 390 px, body width was 390 px and the chart scrolled locally at a readable 560 px minimum width. Final screenshots use the production build, and the ordinary Follow work navigation entry remains first.
