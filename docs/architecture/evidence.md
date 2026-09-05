# Checks and observations

`spec-ledger check` explicitly executes command bindings and saves the resulting observations and report. The existing CLI `verify` command is a compatibility alias for this explicit operation. Commands have a two-minute timeout. Each run retains up to 32 KiB each of stdout and stderr, with an explicit truncation flag, exit status, duration and hashed artifacts. Historical runs that discarded output remain “Not captured”.

`verifyLedger`, client `verify`, snapshots, and HTTP GETs evaluate observations without executing commands or writing reports. An unobserved command binding is missing. Context reads show pending automation; opening a turn performs authorized resume transitions. Visiting a page cannot perform that transition.

A failed verification result is a successful HTTP read with `ok: false`. The transport uses HTTP 200 so clients can display the failures. Missing resources and invalid requests still use HTTP error statuses.

Every binding contributes to its claim verdict. Failure dominates missing evidence, which dominates attestation, which dominates pass. Duplicate results keys are rejected even if their values agree. Attestation never satisfies a required claim, and an empty ledger contains no verified requirements.

## Freshness and runner integration

`spec-ledger fingerprint` returns the current source-content fingerprint and one check fingerprint per binding. External runners capture these before execution, then emit rows with `sourceDigest`, `checkDigest`, and `runId`. Recheck the source after execution. Missing fingerprints are unknown evidence; a legacy passing result never silently becomes current. The built-in command runner captures and compares both source and check inputs itself.

Source fingerprints include tracked and untracked product contents and executable bits, not commit IDs. Ledger history and generated reports do not affect the source fingerprint. Check fingerprints include the claim and binding contents. Changing a check under the same ID invalidates its previous result. Source symlinks must resolve to observable files inside the checkout.

For external runners, `spec-ledger evidence record --file runner-evidence.json` accepts `bindingId`, `outcome`, the captured `sourceDigest` and `checkDigest`, `producer: {name, version}`, and optional `artifactPaths`, `runId`, and `detail`. It rejects mismatching current inputs, hashes referenced local artifacts, preserves an immutable run receipt, and updates current results. Reuse the same run ID for retry; different evidence under that ID is refused. Producer attribution is not cryptographic authentication of a test run.

Declare exact generated evidence filenames in `ledger.json.generatedArtifactPaths` before capturing the fingerprint. Only non-source files under `docs/workstreams/<workstream>/evidence/<run>/` qualify; merely placing a file in that directory never excludes it. Retain declarations for historical outputs. Artifacts are hashed separately, and missing, changed, or escaping required artifacts yield missing evidence. Remote links can remain optional references; required remote artifacts need an observable local copy before they can support verification.

Code-break reviews and scope approvals use the same current-content fingerprint. A content-preserving commit keeps them current; a later source edit does not. Historical close-time digests cannot authorize new content.


## Inspect and rerun a saved check

Claim, turn and workstream evidence panels expose the saved command, canonical checkout directory, optional test source, and authored input/expected descriptions. These descriptions explain intent; actual stdout/stderr shows what the command reported. A passing command proves only the assertions it ran. Source previews are confined to the checkout and bounded; missing metadata is explicit.

`get_check_evidence` and `get_check_run` are passive reads shared by CLI, MCP and client. `run_saved_check` takes only `requestId`, `bindingId`, `expectedSourceDigest` and `expectedCheckDigest`. Use the digests from the evidence read. The operation returns a run identity promptly; poll `get_check_run` for completion. Run status and verification outcome are separate. The latest run may be historical even when current evidence is missing.

The website's explicit **Run again** action calls a narrow local bridge through the client facade. Same-origin, loopback and token checks protect it. The generic projection server remains GET-only. Requests cannot supply commands, directories, environment values or output paths; the configured checkout and saved binding determine execution. Saved commands run with host privileges and are trusted repository code, not sandboxed programs.

CLI batch checks and individual runs share one execution guard per checkout and the same worker. Retries retain their request identity; new explicit reruns reference the previous run. An uncertain worker or orphan keeps its guard and is never automatically restarted. Output is stored under `.spec-ledger/evidence/` with integrity hashes, excluded from source content but still required for the resulting evidence. A source/check change during execution produces missing evidence, never a fresh pass.
