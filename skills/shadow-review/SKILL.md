---
name: shadow-review
description: Review a requested code change or implementation for actionable correctness, security, data-loss, and compatibility problems. Use for reviews or audits; keep review-only work read-only.
---

# Review for actionable defects

Identify the requested review scope and read the relevant code plus its callers, assumptions, and tests. Prefer concrete defects with a reachable trigger and an observable consequence. Prioritize data loss, broken behavior, authorization mistakes, and compatibility regressions over speculative style preferences.

Check whether a suspected issue is already prevented by the surrounding code or established contract. Where useful, reproduce it in an isolated fixture. Label uncertainty rather than reporting an unproven hypothesis as a confirmed defect.

For each actionable finding, explain the trigger, consequence, affected location, and a proportionate correction. Do not pad the review with generic hardening lists. If there are no actionable findings, say so and identify only meaningful validation limits.

Review-only requests do not authorize edits or publication. If the user also requests fixes, implement the supported corrections, rerun the affected checks, and separate verified fixes from unresolved findings.
