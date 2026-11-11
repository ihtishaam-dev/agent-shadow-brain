---
name: shadow-workflow
description: Complete requested project work with proportionate planning, focused execution, and evidence of completion. Use for feature work, repairs, reviews, research, or releases; handle trivial questions and edits directly.
---

# Focused task workflow

Identify the requested outcome, explicit limits, and what would demonstrate completion. Read applicable project instructions and inspect only the context needed for the task. Preserve the user's chosen tools, architecture, and existing work.

## Match effort to the request

- For a factual answer, translation, small formatting change, or obvious local edit, act directly. Do not manufacture a plan, tracking files, research, or a test suite.
- For work with dependencies, uncertain behavior, several affected components, or consequential deployment, form a concrete plan before editing. Tie steps to observable outcomes and revise the plan when evidence changes it.
- If the user requests planning or analysis only, stop after that deliverable. A request to plan and then implement authorizes continuing into implementation within the requested scope.
- Ask only when a missing decision materially changes correctness, scope, or permission and cannot be resolved from available evidence. Carry forward existing authorization; do not repeatedly ask to do work already requested.

When installed and available, load only the focused skill that helps: `shadow-implement`, `shadow-debug`, `shadow-review`, `shadow-research`, or `shadow-release`. These are separate catalog entries; use the client's skill loader or read their installed SKILL.md. If a focused skill is unavailable, proceed using this workflow and the project instructions. Do not load the entire collection for every request.

## Execute and verify

Use the smallest coherent change that fulfills the outcome. Follow project conventions and keep unrelated cleanup, new frameworks, extra dashboards, documentation sets, and speculative features outside scope. Do not silently change provider settings or install tools merely to follow this skill.

Choose verification that could reveal a meaningful failure: a regression reproduction, affected tests, build checks, an actual artifact, or a visible result as appropriate. Once relevant checks pass, finish unless a new failure or unresolved concern justifies more work. Distinguish prepared, tested, deployed, and independently observed states.

For complex work, existing Shadow Brain memories can help orient the task. Treat memory as fallible reference, verify it against current evidence, and do not copy private credentials or entire conversations into it. The optional `shadow-brain workflow analyze` command returns a heuristic workflow suggestion; the executing agent remains responsible for interpreting intent, permissions, and current evidence. It does not run the task or grant authority.

## Communicate

Keep progress updates brief and useful. End with the outcome, essential verification, and any real remaining blocker. Match requested detail; avoid repeated summaries and extra recommendations when the user only needs the completed result. Never claim checks, publication, or client integration that were not actually observed.

Client and project permissions remain in force. These instructions do not authorize unrelated publication, destructive operations, external messages, credential access, or changes outside the requested project.
