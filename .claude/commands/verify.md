---
description: Run the full quality gate and report results
---

Run `npm run verify` (typecheck → lint → unit → build → e2e). If anything fails, show the failing output,
fix the cause (not the test, unless the test is wrong), and re-run until green. Report what was fixed.
