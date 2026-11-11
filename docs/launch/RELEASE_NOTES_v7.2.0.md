# Agent Shadow Brain 7.2.0

Version 7.2 makes it easier to see what agents have saved and choose what to hand to a new session. The default local workspace has five views for overview, memory search, the project and agent graph, context assembly, and feature controls. The previous dashboard remains available at `/advanced`.

## What changed

- Context packs rank memories for the selected project and task, collapse exact duplicates, retain recorded source provenance, and explain what fits the rendered budget. Cross-project context requires both a setting and explicit opt-in.
- Session briefings use the same assembler. Cached briefings follow the current task and feature settings. Disabling automatic briefings suppresses both new and cached output.
- Four persistent switches control context packs, cross-project access within context packs, automatic briefings, and dashboard activity. The settings store validates updates, detects revision conflicts, and replaces saved settings atomically.
- The CLI adds `context-pack` and `features list|set`. MCP clients can call `context_pack` and `feature_flags`. Library consumers can import the assembler and settings store directly.
- The README includes a conceptual memory-flow illustration and screenshots from the running workspace with synthetic data.

## Start the workspace

```bash
npm install -g @theihtisham/agent-shadow-brain@7.2.0
shadow-brain dash . --no-analysis
```

From a second terminal, run `shadow-brain context-pack "import retry behavior" --project . --token-budget 1200` to inspect what an agent would receive for that task.

Memory storage keeps schema version 1. The six bundled skills and the existing skill install workflow remain available. If you are coming from 6.x, follow the [7.0 migration notes](RELEASE_NOTES_v7.0.0.md).

[Workspace guide](../WORKSPACE.md) · [Skill integration guide](../WORKFLOW_INTEGRATION.md)
