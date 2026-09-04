# Research and adaptation

Read 2026-09-04. Historical reports seed investigation; check current code and
maintainer advisories before asserting affected versions or recommending fixes.

- [Devansh: Needle in the haystack](https://devansh.bearblog.dev/needle-in-the-haystack/):
  use a compact threat model, narrow slices, invariants, and local verification.
  Its prompting effectiveness claims are author observations, not guarantees.
  We omit fabricated anchors and assertions that vulnerabilities must exist.
- [Chroma: Context Rot](https://www.trychroma.com/research/context-rot):
  controlled evaluations found nonuniform performance as context grew. This
  supports focused retrieval; it does not prove a particular context limit or
  that less context always improves security review.
- [Mozilla: Hardening Firefox](https://blog.mozilla.org/en/firefox/hardening-firefox-anthropic-red-team/)
  and [Anthropic's account](https://www.anthropic.com/news/mozilla-firefox-security):
  minimal reproductions made findings actionable. Discovery, validation, and
  exploitability are different claims; retain that distinction in reports.
- [Parse Server case study](https://devansh.bearblog.dev/parse-server/):
  restricted credentials can lose constraints across handlers and session
  minting; incomplete audience configuration is another enforcement seam.
- [Hono JWT/JWKS case study](https://devansh.bearblog.dev/honojs/):
  review algorithm defaults and absent key metadata against trusted policy.
- [Elysia cookie case study](https://devansh.bearblog.dev/elysiajs/):
  test the zero-success path during signing-key rotation and alternate execution
  implementations, rather than only correctly signed cookies.
- [harden-runner case study](https://devansh.bearblog.dev/harden-runner/):
  the reported gap concerned audit-mode visibility, required existing workflow
  code execution, and did not bypass block mode. Preserve these prerequisites
  rather than generalizing it to all egress enforcement.

Repo-specific adaptation: discovery records the security model in existing
vision/spec prose; shaping turns it into negative acceptance; spec/code breakers
use it within existing review budgets and evidence rules. No new ledger schema,
automatic security certification, model preference, or runtime scanner is added.
