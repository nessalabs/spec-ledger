# Custom workflow browser verification

Owned disposable fixture, local UI at port 3840; the user checkout remained on port 3737. This is manual observation evidence, not a current passing automated check.

- Actual MCP selected Team greeting method and began its Plan step. The browser displayed the custom title, running step, missing acceptance evidence and blocked downstream steps.
- Actual CLI recorded the current preserved spec output. Without navigating or refreshing the existing browser tab, its next observation showed Plan satisfied and Review the intent ready. The extra edge-case attestation stayed blocked behind that review.
- The current stage expands by default; downstream stages stay collapsed with visible status. Human output labels retain their machine contracts inside details.

- Changed the owned fixture greeting from Hello to Hi and executed its behavioral check through the actual CLI. The report failed; the existing browser tab changed the acceptance card to Failed with `greeting: exit 1`, keeping verification at 0/1.
- Stopped only the owned port-3840 fixture process. The existing tab changed to “Live updates disconnected · showing the last observation” and retained the failed evidence and method details. The user server on port 3737 remained available.
- The ready first step now makes its current stage Ready even when later ordered steps are waiting; future prerequisites no longer label the whole method blocked.
