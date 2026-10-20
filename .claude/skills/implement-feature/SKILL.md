---
name: implement-feature
description: Implements an approved Kin feature spec. Works through the plan.md task groups of the current specs/YYYY-MM-DD-*/ folder in order, ticking each task, writing tests with each group and keeping npm run verify green. Use when the user says "implement the spec", "implement this plan", "build the phase", or invokes /implement-feature.
argument-hint: '[spec folder, defaults to the one for the current phase branch]'
---

# Implement feature

## 1. Load the spec

Pick the spec folder from the argument, else the newest `specs/YYYY-MM-DD-*/` matching the current `phase-N-*` branch.
Read its `requirements.md`, `plan.md` and `validation.md`, plus `AGENTS.md` and the `specs/product/` sections it cites.
If there is no approved spec, stop and suggest `/feature-spec`.

## 2. Work group by group

For each task group in `plan.md`:

1. Implement the sub-tasks, following the architecture rules in `AGENTS.md` and existing patterns in the code.
2. Write the tests the group needs (unit in `tests/unit`, E2E in `tests/e2e`); every AC gets an automated test.
3. Run the fast checks (`npm run typecheck && npm run lint && npm run test`) and fix failures at the cause.
4. Tick the sub-tasks `- [x]` in `plan.md`. Commit the group on the phase branch if the user has asked for commits.

If the plan is wrong or incomplete, update `plan.md` (and `requirements.md` if scope moves) before changing course,
and tell the user. Record new choices in `requirements.md` → _Decisions_.

## 3. Finish

Run `npm run verify` until green, then hand over to `/validate-feature`. Do not merge, push or start the next phase.
