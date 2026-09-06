# Detailed claim contracts

The website describes the user-visible behavior in plain language. These technical details preserve the precise checks behind those descriptions; the wording change does not remove or weaken those checks.

## 67609c19-de05-862c-8db7-e5dc95f38cee

A verify verdict is a pure function of ledger files, source tree, and ingested results, and carries digests of those inputs.

## 2884eafb-114e-85f1-ae07-ce1fbd140550

Evidence bindings never carry pass/fail status; outcomes live only on results and reports.

## 14d9b121-df2b-8ede-bce7-fdee648a4320

The HTTP server has no write endpoints in v1; git is the write path.

## 77fb26cd-bc46-8037-a8f2-7573f7d6d33d

Graph node locators that are set must resolve on disk or verify fails.

## b69a663d-e2dd-8655-be45-0e07bfb45c89

Reference UI must not import ledger core filesystem APIs; it talks only through the client SDK.

## f0309cdb-3ac5-8d55-a06a-f7b71e5c06ad

Turn open stamps treeDigest and refuses a dirty worktree unless --allow-dirty is set.

## e7222390-759f-8d86-9f2c-1115b9b20261

GET /v1/context returns VerticalContext with a stable contextDigest for a sealed workstream slice.

## a642f738-2313-853e-a94d-d9936dcbc596

spec-ledger audit exits non-zero when findings match policy.failOn severities.

## 259e1acf-d082-8bfe-b0ab-76fab45ae7d0

spec-ledger init creates exactly the normative .spec-ledger/ path table (ledger.json last; vision stub; empty claims/bindings/turns/workstreams/proposed-claims/reviews/themes/tenets; graph+policy files; results/.gitkeep). Re-init when ledger.json exists is refused. After init, verify invents no claim outcome pass and no binding contains status or pass.

## 4478b980-87e5-8f31-a57e-8c06246e0798

At version 0.1.0-alpha.0, packed @nessalabs/spec-ledger installs outside this monorepo and exposes bin spec-ledger that runs --help, init, and verify; packed @nessalabs/spec-ledger-client and @nessalabs/spec-ledger-server contain no workspace: or file: dependency protocols and install/resolve against that ledger version.

## ebc0a361-534e-8527-99a7-57611aae823d

Spec Ledger UI for consumers is delivered as a GitHub Release asset (not an npm @nessalabs/spec-ledger-ui package in this bet); the shipped tree has zero file: or workspace: dependency protocols; README documents a one-liner to view a consumer .spec-ledger/ using published client/server plus that asset.

## db092384-a2b9-8db4-b9b8-ff7b5e58f133

On GitHub Release published events only, .github/workflows/publish.yml publishes @nessalabs/spec-ledger, @nessalabs/spec-ledger-client, and @nessalabs/spec-ledger-server at version equal to the release tag (0.1.0-alpha.0 line) to the nessalabs npm org; pull_request and push must not publish; workflow_dispatch may dry-run; NPM_TOKEN is required for live publish and documented in the workflow.

## 505a71e7-37de-8e56-ae5c-467828201dba

When a workstream with specPath is sealed, seal.specDocDigest is the sha256 of the UTF-8 bytes at that path and is never rewritten for that seal revision. Last expected doc digest is latest postSealAmends.afterDocDigest if any, else seal.specDocDigest. If sealed with specPath and no expected digest, check-seal and ledger audit fail until workstream backfill-doc-digest. If bytes diverge, check-seal and audit fail until workstream amend. Audit also fails seal-digest-drift when live sealPayload diverges from the seal without re-seal.

## 4265ae8b-dc22-8851-9a29-a9dab77fb7bb

Every required binding contributes to a deterministic verdict; failed reports remain readable through both transports.

## d6bec874-d62d-850e-bf0f-f19d5b07f7a9

Reading verification, context, snapshots, and client/server projections does not execute checks or persist reports.

## ef771e69-a55e-8f9c-8c2b-b5238a3fcff3

Evidence becomes stale when source or check content changes; code reviews become stale when source changes; required artifacts must retain integrity.

## fb335474-ec02-8a07-a399-a948d076a225

Execution permission honors scoped grants, denial, revocation, current revisions and scoped corrections without claiming host authentication.

## 5287dabc-25de-8934-a4bb-364acca2b942

Deferred requirements remain discoverable, activate durably for affected work, and prevent completion until their response is satisfied.

## 9767b1da-9568-8e2f-ad2a-c2c3eb3e424c

Session projections separate implementation from evidence, remain read-only across transports, and enforce current permission at completion.

## dd5caaee-dace-8f53-bff5-65b6a7646b6d

Workstream evidence preserves current versus recorded results, explains missing coverage, and reads only confined integrity-checked text artifacts without executing checks.

## 2f8cf085-d7a5-83b9-89f8-9d0754cb16a0

CLI and MCP share validation, permission, persistence and completion gates with equivalent lifecycle outcomes and retry behavior.

## 4d4f7c20-b7e0-86d8-9b17-f45053bbf43b

Custom workflow satisfaction comes from current typed outputs, and the live UI separates reported progress from inspectable verification.

## a3c38839-cf13-837c-8866-ce46af309e15

Best-effort execution activity cannot mint completion or recovery authority; unknown host state and absent capabilities prevent automatic recovery.

## 2bdf48ad-ad8b-86b1-a043-5b16496999b3

Change pages scope current evidence to the recorded turn, separate historical completion, and attribute commits only by exact turn trailers.

## 3d819ad1-8f9b-893c-a5bf-92d67c933cd3

A saved check can be inspected and explicitly rerun through shared CLI, MCP and local UI logic with bounded authentic output and safe retry behavior.
