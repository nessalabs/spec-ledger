---
name: lattice-plain-titles
description: >-
  How to write turn restatedGoal and workstream title/objective for Lattice lists.
  Use when opening turns, shaping workstreams, or editing list-facing copy.
---

# Lattice list copy (no new fields)

Lattice lists already show existing fields. Write them for humans; keep technical
detail in the episode (reviews, decisions, files, `problem`, `userPrompt`).

| Surface | Field | Rule |
| --- | --- | --- |
| Turns list / Now recent | `intent.restatedGoal` | **One short outcome sentence** (≤120 chars ideal). What changed for a person. No slice ids, no file paths, no function names. |
| Turn open / builders | `intent.userPrompt` | May stay closer to the ask; hygiene still applies. Prefer aligning with `restatedGoal` when the ask is the title. |
| Workstreams list | `title` | Short product name for the bet (not jargon soup). |
| Workstreams list subtitle | `objective` | **One short success line** (≤160 chars). What “done” means in plain language. |
| Workstream detail | `problem` | May stay sharp / technical — that is the pitch body, not the list blurb. |

## Do

- “Stop shipping product files nobody reviewed against the plan.”
- “Show workstream pitch as real formatted text.”
- “Keep related docs open while you browse Lattice.”

## Don’t

- “SLC-04 follow-up: align check OK when approve/waiver covers treeDigest”
- “Render bet pitch Markdown via MessageMarkdown instead of SpecDoc half-parser”
- Stuffing acceptance, claim ids, or package paths into `restatedGoal`

## Before → after (turn-scoped)

Lattice shows **Before → after** only from that turn’s `flows/` (or nested
`intent.flows`). Do **not** reuse the workstream `problem` → `objective` chart
on every turn — each turn moves one slice of the bet.

When the change has a clear user-visible story, write a short flow for this
turn. If there isn’t one, omit the section.

## Retrofit

Editing `restatedGoal` / workstream `title`+`objective` is allowed (intent / plan
plane). **Never** hand-edit turn `facts`. Adding turn-scoped `flows/` after close
is fine when `facts.flowsDigest` was never stamped; if it was, open a new turn
rather than rewriting closed digests.
