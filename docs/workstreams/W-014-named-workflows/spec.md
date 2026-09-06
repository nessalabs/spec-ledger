# W-014 — Name a workflow once and reuse it

**Objective:** Save a workflow under a name, pick which one is normal, and choose
it for a spec instead of rebuilding the steps every time.

## Problem

Right now there is no such thing as a saved workflow. There is the one that
ships with the product, and there is whatever steps you typed into a single
spec. Nothing else.

What that costs a person:

- Choosing how the agent should work means filling in a long form of stages,
  steps, skills and required results — even when you just want "the usual one".
- The only way to reuse a workflow is to download it as a file and upload it
  into the next spec. Nothing checks the two copies still match.
- There is no way to answer "what is our normal way of working?" The built-in
  one is the only standing answer, and you cannot change it.
- A spec's workflow sits on its own page, away from the evidence and changes it
  produced.

## What we want instead

A workflow is something you save with a name. One of them is marked as normal.
Choosing a workflow for a spec means picking a name from a list. Building a
workflow is a separate, deliberate thing you do on purpose.

## Decisions we are making, and why

**Saved workflows live with the project's own records, not on one laptop.**
They go in the project's records folder and get committed like everything else,
so teammates and the automated checks see the same names, and changing a
workflow shows up in review. That folder is deliberately outside what the
freshness check watches — so editing a workflow cannot make unrelated specs
suddenly look out of date.

**A saved workflow does not carry another spec's requirement numbers.**
Steps say *what kind* of result they must produce; they do not name which
requirements they cover. Saving strips them, and adopting attaches the adopting
spec's own requirements to every step that must produce an implementation report
or passing tests — the same way the built-in workflow already gets them. A step
where somebody deliberately narrowed the coverage by hand is left alone. Without this, a workflow saved from one spec
would refuse to load into almost any other, because requirement numbers are
counted per spec and mean nothing outside it.

**A workflow that does not meet a spec's review rules is refused when you pick
it, and the list says so first.** Whether a spec demands a plan review or a code
review is a property of that spec, not of the workflow. So the same saved
workflow can be fine for one spec and wrong for another, and you find out at the
moment of choosing, with the missing stage named.

**Picking a saved workflow copies it — it does not stay linked.**
The steps are copied and frozen for that spec, with a note of which saved
workflow they came from and which version. Editing "Standard workflow" next
month does not change what an older spec is judged against; to get the new
steps, you pick it again. Without this, editing a saved workflow could silently
change whether a finished spec still counts as passing.

**A workflow says which of its own stages are required.**
Today, whether a stage counts is inferred from where the workflow came from: a
hand-written one has every stage treated as required, a built-in one falls back
to the spec's review rules. That inference is why adding a third kind of
workflow would silently change what counts as done. Instead, each stage says
outright whether it is required, and the spec's review rules fill in the answer
only when the workflow does not say. Where a workflow came from becomes a label
you can read, not a rule that changes the outcome. This keeps today's behaviour
that a review stage someone deliberately added still counts even when the
project does not demand one, while making a saved copy of the built-in workflow
behave exactly like the built-in workflow.

**One normal workflow for the whole project, recorded with the workflows.**
The pointer to the normal workflow lives beside the saved workflows themselves,
rather than in the project's root settings file, because that file rejects any
field it does not already know about — adding one there would mean changing a
shared format for every project, including the ones that never save a workflow.

**Saving a workflow is a project-level act with no spec to authorize it.**
Every existing workflow change is authorized against one spec and one approved
revision. A saved workflow belongs to no spec, so none of that applies. Library
changes are ordinary file changes: review in a pull request is the real gate.
From the website, they go through the same local-machine-only, token-checked
route as today's other write actions. We are not inventing a new project-wide
permission concept in this bet.

**The shared read-only service stays read-only.**
The service other tools read project information from can only answer questions;
it can never change anything. Saving a workflow happens from the terminal, from
an agent's tools, or from the website running on your own machine.

**New workflow opens a dedicated Nessa UI workflow builder.**
The library links to a separate builder for creating and editing saved workflows.
The Nessa UI workflow canvas shows stages connected in execution order, filling the builder view. Clicking a stage opens its details and step settings
in a Nessa UI drawer; settings do not remain in the page below the canvas. The system still runs
one stage after another: the canvas does not offer branches or loops. Preview and
save use the shared validator. This follows the user's correction recorded in
T-044/D-01 and T-044/D-02.

**The editor does not keep its own copy of the rules.**
What counts as a valid workflow is decided in one place and the editor asks it,
rather than re-implementing size limits, ordering and required results in the
website where the two copies would drift apart.

## Not doing

- Workflows that branch or take different paths depending on a condition.
- Different normal workflows per feature or per person.
- Sharing workflows between projects, or any shared catalogue.
- A new project-wide permission concept.
- Converting the workflows already saved inside existing specs.
- Starting an agent from the website. Choosing a workflow still runs nothing.

## What "done" means

1. You can save a workflow under a name and apply it to a different spec by
   name, and that spec records which saved workflow and version it copied.
2. Editing or deleting a saved workflow does not change any spec that already
   adopted it.
3. You can see the list, edit, delete, and mark one workflow as normal, and the
   list tells you which ones a given spec can actually use.
4. Saving and choosing workflows behaves identically from the terminal and from
   an agent's tools.
5. You can read a spec's workflow next to its evidence and changes, and switch
   it to a different saved workflow from there.

## The three pieces of work

### SLC-01 — Save one workflow and use it on another spec

The smallest end-to-end moment: take the workflow a spec is already using, save
it under a name, and adopt it on a second spec from the terminal.

**Done when**
- Saving the workflow a spec is using, then adopting it by name on a second spec, gives that spec a working workflow without retyping steps, and records which saved workflow and version it copied.
- Saving is create-only: a name that already exists is refused, and nothing is overwritten.
- Requirement coverage is attached from the adopting spec, so a workflow saved from a spec with different requirements still applies cleanly.
- Adopting a workflow that lacks a review stage the spec requires is refused, naming the missing stage, and nothing is stored.
- Adopting a workflow whose instruction file is missing, unreadable, outside the project, or too large is refused naming the path, and nothing is stored.
- After editing or deleting the saved workflow, the adopting spec's progress and evidence are unchanged.
- A stage the project's rules do not demand still counts when the workflow marks it required, and a saved copy of the built-in workflow behaves exactly like the built-in one.

**Evidence:** unit, integration

### SLC-02 — Manage the saved workflows

List, edit, delete, and mark one as normal, safely and with conflicts refused.

**Done when**
- The list shows every saved workflow, and marks which ones a chosen spec can use and why the others cannot.
- Two workflows cannot share a name; renaming changes the display name and leaves the record of what earlier specs adopted intact.
- Editing, deleting, or changing which workflow is normal requires the version you expect, and is refused as a conflict when someone changed it first, changing nothing.
- Deleting a workflow specs have adopted is allowed and leaves them running, still showing its name marked deleted; deleting the normal one falls back to the built-in workflow.
- The terminal and an agent's tools behave identically, and the website's local route refuses malformed, oversized and cross-site requests.
- Every change to the library is recorded, with who made it and why.

**Evidence:** unit, integration, e2e

### SLC-03 — Choose a workflow where the work is

The Workflows page becomes only about building and naming workflows. A spec's
own workflow moves next to its Evidence and Changes, and switching it there
means picking a saved name.

**Done when**
- You can read and switch a spec's workflow beside its evidence and changes, without a separate page, and switching records the reason the system already asks for.
- Building a workflow is only reachable from the Workflows page, and switching a spec's workflow never asks you to retype its steps.
- The editor shows stages and steps in run order with what each must produce, refuses exactly what the engine refuses, and never offers a shape the system cannot run.
- A spec shows the name and version of the saved workflow it adopted, and marks it deleted when that workflow is gone.

**Evidence:** unit, integration, e2e

## Things that could go wrong

- Do not convert workflows already saved inside existing specs. They keep
  working and stay readable; this is an addition.
- Do not let editing a workflow on the Workflows page change a spec already
  using it. Switching a spec is always a separate, explained choice.
- The Workflows page address currently belongs to the per-spec view, and one of
  the checks behind an existing promise looks for those links. Moving the page
  means updating that check while the promise it proves stays true.
- Do not copy the rules about valid workflows into the website.

## Before this can be sealed

The new promises this bet makes — saving and applying by name, adopted specs
staying untouched, and unsafe changes being refused — have to exist as live
requirements with real checks behind them before the plan is frozen. Requirement
links are part of what gets frozen, so pointing them at promises that do not
exist yet cannot be corrected afterwards without breaking the freeze.

## Promises this must not break

`SL-023` (same result from the terminal or an agent's tools), `SL-024` and
`SL-030` (choose your own steps and skills, with required reviews and evidence
still in place), and `SL-029` (find the spec, progress and evidence without
losing your place).

## How careful we need to be

| Question | Answer |
| --- | --- |
| Where does it run | As a library, and locally |
| Do people see it | Yes |
| Does speed matter | No |
| Is it security sensitive | Yes — this puts project-wide delete and default changes behind the website's local write route, which previously only re-selected one spec's workflow |
| Must it be exactly right | Yes — a workflow name decides what a spec gets judged against |
| Evidence required | unit, integration, e2e |
