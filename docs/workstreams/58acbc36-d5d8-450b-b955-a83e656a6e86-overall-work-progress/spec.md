# Show accurate overall work progress

The main progress bar currently treats passing checks as finished work. It can show 100% while an acceptance task has not been implemented, a review is missing, or work is still open. The user reported this contradiction in the running app and asked for progress against all tasks.

## Outcome

Show progress toward completing the whole spec. Each acceptance requirement counts as complete only when implementation is recorded for the current work and its checks pass. Include the other applicable completion tasks: permission, the preserved plan, required reviews, unresolved findings and commitments, required screenshots, any chosen workflow results, and closing open work. Grouped tasks use their actual part counts. Explanatory messages must not count the same unfinished task twice, or disappearing warning text would change the denominator without work being done.

A fully satisfied checklist reaches 100% only when the shared completion gate allows completion. Passing checks remain visible as a separate diagnostic. Missing acceptance scope or unavailable completion information must stay indeterminate. Earlier recorded completion remains historical when current work needs rechecking.

Use the same progress on Overview and spec details. The total represents applicable completion tasks, not estimated effort or time. Keep the existing read-only observation and completion rules; do not weaken a gate to make the bar green. Do not change saved historical reports, credentials, or publishing state.

## Scope and validation

One bounded fix to the session checklist and shared progress presentation. The session owns completion conditions; the UI formats their counts. Reuse the existing requirement and navigation checks. Cover all-passing checks with unimplemented work, open work, missing or stale reviews, denied permission, unresolved commitments, required screenshots and chosen workflow outputs. Check an actually eligible case, zero or missing scope, and historical evidence rechecks.

Capture the user's unfinished spec on desktop and mobile, Overview progress, and a previously completed spec with current rechecks. Independent spec review precedes a preserved plan and implementation; an independent breaker checks behavior and screenshots before close. Continue the existing library-consumer quality bar and user-authorized PR work.

## Correction

This fixes the mistaken assumption that a percentage labeled as check verification would be understood separately from overall task progress. It applies the existing guidance to distinguish recorded completion from current verification. Updates and the readable-title retrofit remain part of the earlier reviewed change.
