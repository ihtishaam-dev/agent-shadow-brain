---
name: shadow-debug
description: Diagnose and fix a reported failure using a reproducible symptom, a focused cause investigation, and regression verification. Use for broken behavior, errors, crashes, or failing checks.
---

# Diagnose and repair

Honor diagnosis-only or analysis-only requests: report the evidence and likely correction without editing files. Continue into repair only when fixing the problem is within the requested scope.

Establish the exact symptom, expected behavior, and smallest reproduction available from the request and project. Preserve data and rollback options proportional to the impact. Inspect relevant logs and source without exposing private values.

Test a cause hypothesis against evidence before changing multiple layers. Distinguish the failing component from downstream symptoms. If a reproduction is unavailable, make the uncertainty explicit and use a bounded fixture that exercises the suspected path.

Fix the cause with a coherent change, then rerun the original reproduction or the closest valid equivalent. Add a meaningful regression test when the failure could recur. Check adjacent behavior affected by the fix, then stop when the acceptance conditions hold.

After repeated failures, use the new evidence to revise the hypothesis; do not repeat the same attempt indefinitely or silently reset user state. Report the remaining blocker if the original environment cannot be exercised. A mock, running process, successful build, or isolated fixture is not proof that the user's original scenario works.
