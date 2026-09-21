# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create, read, comment on, label, and close issues with `gh issue`.
- Infer the repository from the GitHub git remote.
- Use the issue body and comments when fetching a ticket.
- When a skill says “publish to the issue tracker,” create a GitHub issue.

## Pull requests as a triage surface

**PRs as a request surface: no.** Set this to `yes` if external PRs should enter the triage queue.

## Wayfinding operations

Use one issue labelled `wayfinder:map` as the map, with linked child issues as tickets. Use GitHub sub-issues where available; otherwise link children from a task list in the map body. Use native issue dependencies for blockers where available, falling back to a `Blocked by: #<n>` line. An unassigned, open child with no open blockers is available to claim.
