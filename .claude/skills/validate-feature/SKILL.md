---
name: validate-feature
description: Validates an implemented Kin feature against its spec, reviews the branch from several angles, and replans the project. Ticks validation.md, runs npm run verify, walks the manual checks with the user, updates specs/roadmap.md, folds lasting requirements into specs/product/ and logs project-wide decisions. Use when the user says "validate", "is the phase done", "review the branch", or invokes /validate-feature.
---

# Validate feature

## 1. Automated checks

Run `npm run verify`. For each automated line in the spec's `validation.md`, confirm the named test exists and asserts
the AC, then tick it. Report failures with their output; fix the cause, not the test (unless the test is wrong).

## 2. Review

Review the branch diff (`git diff main...HEAD`) from three angles, using parallel subagents when the diff is large:

- **Spec fidelity**: every requirement and AC is met; nothing out of scope slipped in.
- **Architecture and quality**: AGENTS.md rules, data-layer transactions, migrations, i18n completeness, tests.
- **User experience**: accessibility (WCAG 2.1 AA, three themes), mobile layout, offline behaviour, privacy.

Fix confirmed issues, or list them for the user if they change scope.

## 3. Manual checks

Walk the user through the manual section of `validation.md` (use the browser preview where possible) and tick what
they confirm. Ask; never tick a manual check yourself without evidence.

## 4. Replan

- Tick the phase in `specs/roadmap.md` and link its spec folder; split, add or reorder upcoming phases if the work
  showed they need it (confirm changes with the user).
- Fold the feature's lasting requirements and ACs into `specs/product/` (new subsections at the end of a section).
- Copy project-wide decisions into `specs/decisions.md` as the next `D-NNN`.
- Ask: did the work reveal anything in the specs that needs clarifying?

Then run `/changelog`. Commit, push and merge only with the user's OK.
