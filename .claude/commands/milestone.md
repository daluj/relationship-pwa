---
description: Implement a SPEC.md milestone end to end
argument-hint: <milestone number, e.g. 2>
---

Implement milestone M$ARGUMENTS from SPEC.md §14.

1. Re-read SPEC.md §14 and every section M$ARGUMENTS touches, plus CLAUDE.md and docs/DECISIONS.md.
2. List the files you will create or change and the ACs in scope. Wait for the user's OK.
3. Implement, writing tests next to each piece (unit in tests/unit, E2E in tests/e2e).
4. Log any spec ambiguity you resolved in docs/DECISIONS.md.
5. Run `npm run verify` and fix it until it is green.
6. Add a docs/CHANGELOG.md entry. Do not start the next milestone.
