---
id: "sl-checks"
title: "Run saved checks"
kind: "guide"
status: "implemented"
summary: "Reading evidence and executing a check are different operations. The shared read-side verifier evaluates saved inputs. An explicit saved-check operation starts a worker that executes a configured command and captures its result."
parent: "sl"
sources:
  [
    "packages/ledger/src/verify/saved-check.ts",
    "packages/ledger/src/verify/execute.ts",
    "packages/ledger/src/cli/main.ts",
    "packages/ledger/src/evidence/record.ts",
    "packages/ledger/src/evidence/visual.ts",
  ]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Run checks and inspect their evidence

Reading evidence and executing a check are different operations. The shared read-side verifier evaluates saved inputs. An explicit saved-check operation starts a worker that executes a configured command and captures its result.

At this source revision, the CLI aliases `verify` and `check` both call the write-side runChecks operation. The typed client and HTTP projection use the read-side verifier. Do not run the CLI alias merely to inspect untrusted check definitions: inspect the command and repository first.

## Follow one saved run

A saved run pins a binding, source fingerprint and check fingerprint. The worker rechecks those inputs before starting. It records queued/running/finished states, bounded stdout/stderr and exit information. The command runs in a shell at the repository root using the inherited environment. The configured command is executable repository content, not a sandboxed expression.

If inputs change during execution, its outcome is missing for current purposes even if the process exits zero. Required output artifacts are hashed. A 120-second timer attempts termination; process-group signaling is platform-dependent and is not a proof that all descendants or remote effects stopped. If execution/publication becomes uncertain after invocation, the run stays unknown and is not silently repeated.

Read the same run ID after losing a reply. The same operation request ID replays its receipt rather than launching another check. A new run is a deliberate new execution, which may repeat external effects. Unknown retained ownership is a reason to inspect the run/process, not to delete a guard and assume nothing happened.

External results can be recorded for results-row bindings with the current identities and artifact references. Screenshot evidence is a separate requirement: declared surfaces need current local PNG/JPEG attachments with revision, source and file-integrity evidence. A passing command does not replace required screenshots, and a screenshot does not prove a behavioral test passed.
