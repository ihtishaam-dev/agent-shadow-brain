---
name: shadow-implement
description: Implement or improve an explicitly requested project feature while preserving existing behavior and limiting changes to the requested outcome. Use after the goal is understood; not for analysis-only or review-only requests.
---

# Implement the requested change

Trace the existing behavior through the relevant entry point, data flow, and tests before choosing an implementation. Reuse established components and configuration. Turn the requested behavior into a small set of acceptance conditions, including compatibility constraints that matter.

For a small edit, make it directly. For a larger change, order the work around dependencies and failure risks; preserve a working intermediate state where practical. Do not add architecture, infrastructure, configuration options, or supporting features just because they might be useful later.

Keep unrelated user changes intact. Handle input validation and errors where they affect the actual feature. Make user-facing controls explain meaningful choices instead of implementation details.

Verify the affected path with an observable before/after case. Run repository-required checks and targeted tests appropriate to the change. Inspect a produced artifact or running result when build success alone cannot establish correctness. Add regression tests for behavior that can plausibly break; avoid tests that only repeat the implementation.

Report what now works, what was verified, and any material limitation. Do not publish or deploy unless the request or existing authorization includes that action. If delivery is authorized, continue through delivery and verify the destination.
