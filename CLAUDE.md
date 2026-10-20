@AGENTS.md

## Claude Code

Skills in `.claude/skills/` drive each step of the spec-driven loop (see specs/README.md › The loop):

- `/feature-spec`: next roadmap phase → branch → interview (AskUserQuestion) → dated spec folder
- `/implement-feature`: implement the current spec's `plan.md`
- `/validate-feature`: check `validation.md`, multi-angle review, replan the roadmap
- `/changelog`: add the phase's `CHANGELOG.md` entry
- `/verify`: run the full quality gate
