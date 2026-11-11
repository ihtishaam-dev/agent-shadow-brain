# Agent Shadow Brain 7.1.0

This release adds focused task guidance and project skill installation on top of 7.0.0's durable memory and explained recall.

## Changes

- Six bundled skills: workflow selection, implementation, debugging, review, research, and release.
- Project skill layouts for Codex, Claude Code, OpenCode, and DeepSeek Harness; portable files for other compatible clients.
- Preview-first installation that preserves project instruction text, detects local edits, validates destinations and stale plans, records ownership, and backs up managed updates.
- CLI skill catalog/install commands and advisory request analysis with explicit overrides.
- Read-only MCP guidance tools and public library functions/types.

The intended workflow is understand, plan when useful, execute authorized work, and verify. A small question stays a small answer. Plan-only, diagnosis-only, and review-only instructions keep their scope. No provider/model setup, credentials, new runtime dependencies, or global configuration changes are required.

## Start

```bash
npm install -g @theihtisham/agent-shadow-brain@7.1.0
# Run in the project root:
shadow-brain skills install . --target codex
shadow-brain skills install . --target codex --apply
```

Choose `claude-code`, `opencode`, `deepseek-harness`, `portable`, or `all` instead as appropriate. See the [integration guide](../WORKFLOW_INTEGRATION.md) for host requirements, updates, conflicts, and examples.

## Verification and limits

The release gate covers TypeScript, regression tests, installer preservation/failure scenarios, representative task-routing scenarios, skill frontmatter validation, and an installed npm tarball in a clean consumer project. CI runs on Windows and Linux with Node 22, 24, and 26. Final run counts and publication evidence are recorded in the release report.

The router is a deterministic English-language heuristic; host interpretation and explicit options handle ambiguity. The package provides guidance, not autonomous task execution or authorization. Documented host layouts and automated installation tests do not prove that a running host discovered or followed a skill. DeepSeek Harness needs its skill/context plugins enabled.

This is an additive 7.x release. No memory-store schema migration is introduced; retain the 7.0.0 upgrade guidance when coming from 6.x.
