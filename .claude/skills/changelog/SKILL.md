---
name: changelog
description: Adds or updates the CHANGELOG.md entry for the current Kin phase from its feature spec and the branch's commits. Use when the user invokes /changelog, asks to "update the changelog", or before merging a phase branch.
---

# Changelog

`CHANGELOG.md` (repo root) records what changed for users and maintainers, newest first, one entry per phase or fix.

## Workflow

1. Gather the input: the phase name in `specs/roadmap.md`, the spec's `requirements.md`, and the branch's commits
   (`git log main..HEAD --format='%s%n%b'`). Without a phase branch, use commits since the last entry's date.
2. Add an entry at the top (below `# Changelog`), or update this phase's entry if it exists:

   ```markdown
   ## Phase 9 — v1 release check (2026-10-21)

   Spec: [specs/2026-10-21-v1-release-check](specs/2026-10-21-v1-release-check/)

   - What users can now do, one bullet per capability, plain language.
   - Notable fixes, then quality results (tests, accessibility, performance) when they changed.
   - Decisions logged: D-069–D-070.
   ```

   Fixes outside a phase use `## Fix — <short description> (YYYY-MM-DD)`.

3. Keep bullets factual and short; mention numbers you verified (bundle size, Lighthouse) only if measured this phase.
4. Show the entry to the user and commit it with the phase.
