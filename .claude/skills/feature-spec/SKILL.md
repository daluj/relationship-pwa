---
name: feature-spec
description: Starts a new Kin feature the spec-driven way. Finds the next incomplete phase in specs/roadmap.md, creates a phase branch, interviews the user about scope, decisions and context, then writes a dated spec folder under specs/ with requirements.md, plan.md and validation.md. Use when the user says "feature spec", "next phase", "start the next feature", "spec out X", or invokes /feature-spec.
argument-hint: '[optional feature idea, if it is not the next roadmap phase]'
---

# Feature spec

Write the spec; do **not** write feature code. Stop for the user's review at the end.

## 1. Find the phase

Read `specs/roadmap.md`. The next phase is the first `### Phase N` whose checklist has `[ ]` items. If the user passed
an idea that is not on the roadmap, add it as a new phase first (replanning) and confirm its position with the user.

## 2. Create the branch

```bash
git checkout main && git pull --ff-only && git checkout -b phase-N-<kebab-name>
```

## 3. Read the guidance

`specs/mission.md`, `specs/tech-stack.md`, `specs/decisions.md`, the `specs/product/` sections the phase touches, and
the most recent `specs/YYYY-MM-DD-*/` folder as a template. Look at the existing code the phase will extend.

## 4. Interview the user before writing any file

Use `AskUserQuestion` with exactly **3 questions in one call**, each offering concrete options drawn from what you read:

| Header        | Focus                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| **Scope**     | What the feature does and does not do: data, screens, behaviour, edge cases                 |
| **Decisions** | Key implementation choices: data model change, where it lives in the UI, offline/PWA impact |
| **Context**   | Constraints and tone: copy, accessibility, platforms, anything that shapes the spec         |

Write nothing until all three are answered.

## 5. Write `specs/YYYY-MM-DD-<feature-name>/` (today's date)

### `requirements.md`

- **Scope**: included / out of scope; a table for data fields or screens where useful.
- **Acceptance criteria**: numbered `AC-1…`, each observable and testable.
- **Decisions**: each choice and why (from the interview). Mark project-wide ones for `specs/decisions.md`.
- **Context**: spec sections it extends (`features §8.x`, `ui §6.x`, `data-model §5.x`), existing files and patterns to
  follow, i18n (en + es), accessibility (WCAG 2.1 AA), offline behaviour, privacy (mission §1.2).

### `plan.md`

Numbered task groups, each independently implementable and leaving `npm run verify` green, typically
Domain → Data (new `db.version(n)` + `.upgrade()` if needed) → Repositories/services → UI → i18n → Tests → Docs.
Number sub-tasks `1.1, 1.2…` as `- [ ]` checkboxes and name the files each one touches.

### `validation.md`

- **Automated**: `npm run verify` green; one line per AC naming the unit/E2E test that proves it.
- **Manual**: walkthrough steps, edge cases, mobile layout, the three themes, Spanish locale, offline.
- **Definition of done**: all checks ticked, roadmap phase ticked, lasting requirements folded into `specs/product/`,
  `CHANGELOG.md` entry, user OK to merge.

## 6. Stop

Summarise the spec and ask the user to review it. Implementation starts only after their OK (`/implement-feature`).

## Constraints

- Stay within `specs/tech-stack.md`; any new dependency needs the user's explicit approval.
- Keep the phase small and shippable on its own; split it in the roadmap if it is not.
