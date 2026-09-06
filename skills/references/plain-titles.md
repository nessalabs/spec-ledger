---
name: plain-titles
description: >-
  How to write turn restatedGoal and workstream title/objective for Spec Ledger UI lists.
  Use when opening turns, shaping workstreams, or editing list-facing copy.
---

# Spec Ledger UI list copy (no new fields)

Spec Ledger UI lists already show existing fields. Write them for humans; keep technical
detail in the episode (reviews, decisions, files, `problem`, `userPrompt`).

| Surface | Field | Rule |
| --- | --- | --- |
| Turns list / Now recent | `intent.restatedGoal` | **One short outcome sentence** (≤120 chars ideal). What changed for a person. No slice ids, no file paths, no function names. |
| Turn open / builders | `intent.userPrompt` | May stay closer to the ask; hygiene still applies. Prefer aligning with `restatedGoal` when the ask is the title. |
| Workstreams list | `title` | Short product name for the bet (not jargon soup). |
| Workstreams list subtitle | `objective` | **One short success line** (≤160 chars). What “done” means in plain language. |
| Claim lists and requirement pages | `statement` | One plain sentence about observable behavior. Write for someone approving a feature, not implementing it. Keep exact algorithms, file paths, internal identifiers and transport details in linked technical docs and evidence. |
| Workstream detail | `problem` | May stay sharp / technical — that is the pitch body, not the list blurb. |

## Do

- “Stop shipping product files nobody reviewed against the plan.”
- “Show workstream pitch as real formatted text.”
- “Keep related docs open while you browse Spec Ledger UI.”

## Don’t

- “SLC-04 follow-up: align check OK when approve/waiver covers treeDigest”
- “Render bet pitch Markdown via MessageMarkdown instead of SpecDoc half-parser”
- Stuffing acceptance, claim ids, or package paths into `restatedGoal`

## Spec documents (`docs/workstreams/W-0NN-*/spec.md`)

The pitch is read by the person deciding whether to approve the bet, not only by
the agent building it. Write the whole document in plain English — the same bar
as `objective` and claim `statement`, applied to every heading and every row.

| Do | Don't |
| --- | --- |
| “Picking a saved workflow copies it — it does not stay linked to it.” | “Selection records `profileId` + the digest it copied.” |
| “The shared read-only service can only answer questions; it can never change anything.” | “Server stays GET-only (SL-003); git remains the write path.” |
| “Editing a saved workflow does not change any spec that already adopted it.” | “`preserveWorkflow` writes an immutable digest-bearing snapshot.” |
| “What ‘done’ means”, “Not doing”, “Things that could go wrong” | “Acceptance criteria”, “Out of scope”, “Rabbit holes” |

Rules:

- **Name the consequence, not the mechanism.** Say what a person gains or loses.
  Function names, field names, file paths, digests, claim ids and HTTP verbs
  belong in linked technical docs and in the ledger JSON — not in the pitch.
- **Every decision states its “or else”.** A decision the reader cannot argue
  with is not a decision; say what breaks if it goes the other way.
- **Spell out an id the first time** it earns a mention, or leave it out.
- **Plain headings.** Prefer a question or an outcome over a process noun.
- The workstream JSON keeps the precise wording (`problem`, `expectedPaths`,
  policy). The Markdown is the human half of the same record.

## Before → after (turn-scoped)

Spec Ledger UI shows **Before → after** only from that turn’s `flows/` (or nested
`intent.flows`). Do **not** reuse the workstream `problem` → `objective` chart
on every turn — each turn moves one slice of the bet.

When the change has a clear user-visible story, write a short flow for this
turn. If there isn’t one, omit the section.

## Retrofit

Editing `restatedGoal` / workstream `title`+`objective` is allowed (intent / plan
plane). **Never** hand-edit turn `facts`. Adding turn-scoped `flows/` after close
is fine when `facts.flowsDigest` was never stamped; if it was, open a new turn
rather than rewriting closed digests.

Claim example: “See what changed, the evidence for that change, and whether earlier results still apply today.” Avoid “scope current evidence to the recorded turn” or “exact turn trailers” in the visible statement. Preserve the detailed contract in linked documentation when simplifying existing wording.
