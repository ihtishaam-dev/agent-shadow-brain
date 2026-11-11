# Workspace guide

Start the local workspace from your project directory.

```bash
shadow-brain dash . --no-analysis
```

The CLI binds to `127.0.0.1:7341` by default and opens the workspace. Use `--no-open` to open the printed address yourself, or `--port` to choose another port. `--no-analysis` starts the UI and API without background project analysis.

**Overview** shows the memory count, projects and agents represented in the inventory, and recent activity. **Memories** supports project, category, agent, and text filters. **Graph** connects each memory to its project and recording agent. Select a node to inspect its detail. **Context** builds a pack for the task at hand. **Features** changes the runtime controls.

The workspace uses up to 2,500 recent memories for its inventory and filter lists. Text search ranks matching records in the selected scope and returns up to 2,500 results. The graph displays up to 180 memories plus their project and agent nodes. The workspace indicates when it is showing a partial view.

Visit `/advanced` for the previous dashboard and its existing tools. Its Features page links to the current controls.

## Build context for the task

Choose a project and enter a task or a few search terms. Review the selected memories, their recorded references, and the reasons entries were skipped before copying the pack.

```bash
shadow-brain context-pack "trace retry behavior in the importer" --project . --token-budget 1200 --json
```

The assembler considers up to 200 ranked candidates and selects up to 12 entries by default. The library supports a maximum of 30 entries. It groups exact content matches within a project after normalizing case and whitespace, keeps the highest-ranked representative, and carries forward bounded source references with their originating memory IDs. Distinct statements remain separate.

The size limit applies to the complete Markdown, including labels and references. Long text can appear as a labeled excerpt. The assembler skips oversized entries and checks the remaining candidates. The token estimate is the rendered JavaScript string length divided by four, rounded up. It is a rough sizing guide because model tokenizers count text differently.

Context stays within the selected project unless you enable `crossProjectContext` and explicitly request other projects using the workspace option, `--cross-project`, or the MCP/library option. Broader packs label each memory's project. Recorded references come from saved memory metadata. Check them against current sources before relying on a claim.

Session-start briefings use the same assembler and budget. They respect the current task, project, allowed agents, and runtime controls. A task can still recall an older relevant lesson.

## Change the runtime controls

Set features in the workspace or through the CLI.

```bash
shadow-brain features list
shadow-brain features set automaticBriefing off
shadow-brain features set automaticBriefing on
```

| ID | Default | What it controls |
| --- | --- | --- |
| `contextAssembly` | On | Builds context packs, including the memory context used by session briefings. |
| `crossProjectContext` | Off | Permits a context request to include other projects when the caller explicitly selects it. |
| `automaticBriefing` | On | Generates session-start briefings for eligible agents. Turning it off also suppresses previously cached briefings. |
| `liveActivity` | On | Serves the dashboard activity feed and delivers WebSocket activity events and backlog. Memory storage and other internal events continue operating. |

Settings persist in `~/.shadow-brain/feature-settings.json` and take effect on the next relevant operation. The workspace writes validated changes and checks the settings revision before saving. If another client changes the settings first, review the refreshed values and try again. CLI commands accept `--settings <path>` for an explicitly selected file.

## Integrate with a client

The read-only MCP tools `context_pack` and `feature_flags` provide context assembly and current feature states. `context_pack` accepts `projectId`, optional `query`, `tokenBudget`, and `includeCrossProject`.

The library exports `assembleContext`, `FeatureSettingsStore`, and their types. Pass a recall source and current feature settings to `assembleContext`. Context assembly uses stored memories and recorded references without making model calls.

The local dashboard uses these HTTP endpoints.

| Method and route | Purpose |
| --- | --- |
| `GET /api/workspace/overview` | Workspace totals, projects, recent memories, and current activity state. |
| `GET /api/workspace/memories` | Filter and page through saved memories. |
| `GET /api/workspace/graph` | Get project, agent, and memory nodes and their relationships. |
| `POST /api/workspace/context` | Send a project ID, query, budget, and cross-project choice. |
| `GET /api/workspace/activity` | Read the activity feed when enabled. |
| `GET /api/workspace/features` | Read feature settings and their revision. |
| `POST /api/workspace/features` | Send a boolean `patch` and optional `expectedRevision`. |

Install the [bundled workflow skills](WORKFLOW_INTEGRATION.md) separately to give compatible clients task guidance.
