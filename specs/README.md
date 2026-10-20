# Specs

Kin is built with **spec-driven development**: specs are written and agreed before code, the agent implements from
them, and the result is validated against them. These files are the source of truth for what Kin is and how it is
built. If code and spec disagree, fix one of them in the same change.

## Layout

| File                                           | Holds                                                       | Changes when                           |
| ---------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| [mission.md](mission.md)                       | What Kin is, for whom, principles, scope (§1–§2)            | Rarely; the product's direction moves  |
| [tech-stack.md](tech-stack.md)                 | Stack, architecture rules, quality targets (§3–§4, §10–§13) | A dependency or rule changes           |
| [roadmap.md](roadmap.md)                       | Phases with checklists, v1 definition of done (§14–§15)     | Every replan, after each phase         |
| [decisions.md](decisions.md)                   | Project-wide decision log (D-001…)                          | A decision outlives one feature        |
| [product/data-model.md](product/data-model.md) | Entities and Dexie schema (§5)                              | A feature changes the data model       |
| [product/ui.md](product/ui.md)                 | Layout, screens, theming, a11y, routes (§6–§7)              | A feature changes the UI contract      |
| [product/features.md](product/features.md)     | Feature behaviour and acceptance criteria (§8)              | A feature adds or changes an AC        |
| [product/pwa.md](product/pwa.md)               | Manifest, service worker, install, offline (§9)             | PWA behaviour changes                  |
| `YYYY-MM-DD-<feature>/`                        | One feature: `requirements.md`, `plan.md`, `validation.md`  | Written before the feature, kept after |

`mission.md`, `tech-stack.md` and `roadmap.md` are the **constitution**: read them before every feature spec.
The `product/` files are the living reference that feature specs extend; when a feature lands, fold its lasting
requirements and ACs back into them.

## Section numbers

The `§n` numbers come from the original single-file spec and are stable IDs, unique across all files. Code cites them
as `<file> §n`, for example `// features §8.5`, `// ui §6.4`, `// pwa §9`, `// tech-stack §11`, `// mission §1`.
Never renumber; add new subsections at the end of their section.

## The loop

1. **Spec** (`/feature-spec`): take the next phase from the roadmap, create branch `phase-N-<name>`, interview the user
   (scope, decisions, context), and write `specs/YYYY-MM-DD-<name>/{requirements,plan,validation}.md`. Stop for review.
2. **Implement** (`/implement-feature`): work through `plan.md` group by group, ticking tasks; tests come with each group.
3. **Validate** (`/validate-feature`): run `npm run verify`, tick `validation.md`, review the branch from several angles,
   and walk the manual checks with the user.
4. **Replan**: tick the phase in `roadmap.md`, fold lasting requirements into `product/`, log project-wide decisions,
   and adjust upcoming phases.
5. **Record** (`/changelog`): add the phase's entry to `CHANGELOG.md`, then commit and merge with the user's OK.

Phases 1–8 (M1–M8) were built before this layout from the original single-file spec. Their record is the roadmap,
[CHANGELOG.md](../CHANGELOG.md) and [decisions.md](decisions.md); dated feature folders start with Phase 9.
