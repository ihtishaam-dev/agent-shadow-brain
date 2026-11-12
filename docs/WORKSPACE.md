# Workspace guide

For a persistent project-local portal, run `shadow-brain project workspace .`. Knowledge, settings, reviews and activity stay in that project; generated skills use the selected host’s project skill folder. See [Project Kit](PROJECT_KIT.md). The shared-store dashboard below remains available.

Start the local workspace from your project directory.

```bash
shadow-brain dash . --no-analysis
```

The CLI binds to `127.0.0.1:7341` by default and opens the workspace. Use `--no-open` to open the printed address yourself, or `--port` to choose another port. `--no-analysis` starts the UI and API without background project analysis.

**Overview** shows the memory count, project inventory, and recent activity. **Memories** lets you search and inspect a memory's recorded sources, review history, and links. **Graph** shows project membership, recording agents, and explicit links between memories. **Context Lab** builds a pack for the task at hand. **Integrations** shows available client features and local checks. **Features** changes the runtime controls.

The workspace uses up to 2,500 recent memories for its inventory and filter lists. Text search ranks matching records in the selected scope and returns up to 2,500 results. The graph displays up to 180 memories plus their project and agent nodes. The workspace indicates when it is showing a partial view.

Visit `/advanced` for the previous dashboard and its existing tools. Its Features page links to the current controls.

## Follow live operations

Open `/live` on the dashboard address. Select a session to follow its activity network and event timeline. The charts summarize matched, measured tool calls in the loaded window. The portal marks incomplete windows when older events have been dropped.

The standalone MCP service measures its own session and tool boundaries. A host can explicitly report phases such as planning or verification, or tool start and end events from its own integration. The portal labels those events **Host-reported** and keeps them separate from measured timing.

```bash
shadow-brain activity report phase --project-id PROJECT_ID --session SESSION_ID --agent codex --phase verify
shadow-brain activity tail --project-id PROJECT_ID
```

Use a shared `--correlation` ID on tool start and end reports. The end report also takes `--outcome` and `--duration-ms`. Use the previous tail result's `cursor` and `journalId` with `--cursor` and `--journal-id` to read the next page. Set `--db <path>` to use the journal next to a particular memory store.

The local `activity-journal.json` retains the latest 500 events. It stores short labels, source, phase, tool name, outcome, and timing. Keep prompts, arguments, file paths, memory content, and credentials out of reports. A demo label identifies scripted sample events.

## Build context for the task

Choose a project and enter a task or a few search terms. Review the selected memories, their recorded references, and the reasons entries were skipped before copying the pack.

```bash
shadow-brain context-pack "trace retry behavior in the importer" --project . --profile adaptive --token-budget 1200 --json
```

The assembler excludes archived, contested, and superseded memories before ranking. It considers up to 200 eligible candidates and selects up to 12 entries by default. The library supports a maximum of 30 entries. It groups exact content matches within a project after normalizing case and whitespace, keeps the highest-ranked representative, and carries forward bounded source references and explicit links with their originating memory IDs. Distinct statements remain separate. A recorded contradiction is called out in the pack so the agent can check it.

The size limit applies to the complete Markdown, including labels and references. Long text can appear as a labeled excerpt. The assembler skips oversized entries and checks the remaining candidates. The legacy token estimate is the rendered JavaScript string length divided by four, rounded up. Adaptive retrieval uses a Unicode/code-aware heuristic and charges the full rendered output. Both estimates are approximate; model tokenizers differ. [Context Lab explains profiles, bounds, excerpts, and scoring](CONTEXT_LAB.md).

Context stays within the selected project unless you enable `crossProjectContext` and explicitly request other projects using the workspace option, `--cross-project`, or the MCP/library option. Broader packs label each memory's project. Recorded references come from saved memory metadata. Check them against current sources before relying on a claim.

Session-start briefings use the same assembler and budget. They respect the current task, project, allowed agents, runtime controls, annotation revision, and current memory content, including external commits and staged notes. A task can still recall an older relevant lesson.

## Review and connect memories

Open a memory from **Memories** or **Graph** to inspect its saved content, references, and review history. Set its review state to **Active**, **Archived**, or **Contested**. The review records your judgment. Check important claims against their sources.

Use an explicit link to relate, support, contradict, or supersede another memory in the same project. For a supersession, choose the replacement first and the older memory second. A superseded memory stays out of context if its replacement disappears. Remove the supersession link to restore the older memory's prior review state.

For CLI use, substitute the IDs shown in the workspace or the JSON output from `context-pack`.

```bash
shadow-brain curate show MEMORY_ID --project-id PROJECT_ID
shadow-brain curate review MEMORY_ID contested --project-id PROJECT_ID --note "Check the current retry test"
shadow-brain curate link REPLACEMENT_ID MEMORY_ID supersedes --project-id PROJECT_ID
shadow-brain curate unlink LINK_ID --project-id PROJECT_ID
```

The commands return JSON. Write commands accept `--revision` to reject updates based on an older annotation revision. Use `--db <path>` for an explicit memory store and `--annotations <path>` to select a separate annotation file. By default the commands use `memory-annotations.json` next to the memory store.

The annotation file holds up to 5,000 reviews, 5,000 links, and the latest 500 audit events, with a 16 MiB file limit. Notes are capped at 1,000 characters. The original `global.json` remains separate. Curation applies to context packs and automatic briefings. Memory inspection remains available for reviewing earlier records.

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
| `liveActivity` | On | Shows live operations and serves dashboard activity updates and backlog. Turning it off also hides CLI activity tail output. |
| `activityRecording` | On | Appends measured service activity and explicit host reports. Turning it off stops new records. Existing history remains available while live activity is enabled. |

Settings persist in `~/.shadow-brain/feature-settings.json` and take effect on the next relevant operation. The workspace writes validated changes and checks the settings revision before saving. If another client changes the settings first, review the refreshed values and try again. CLI commands accept `--settings <path>` for an explicitly selected file.

## Integrate with a client

Configure a compatible MCP client to launch `shadow-brain mcp --stdio`. The service offers nine read-only memory and workflow tools. When activity recording is enabled, it also records measured session and tool timing. The separate `activity_report` tool explicitly writes host-reported metadata to the journal. The service handles MCP messages without loading provider configuration. Use `--db <path>` and `--settings <path>` to point an isolated client at its own files.

The MCP tools `context_pack` and `feature_flags` provide context assembly and current feature states. `context_pack` accepts `projectId`, optional `query`, `tokenBudget`, and `includeCrossProject`. Inspect or change reviews through the workspace or `curate` commands.

The library exports `assembleContext`, `MemoryAnnotationsStore`, `FeatureSettingsStore`, and their types. Pass a recall source, current feature settings, and an annotation snapshot to `assembleContext`. Context assembly uses stored memories and recorded references without making model calls.

The **Integrations** view checks the project skill files in a selected directory and shows runtime and storage status. Host-side skill discovery and MCP configuration are separate steps. DeepSeek Harness needs its filesystem skill and MCP client plugins enabled. [Skill integration guide](WORKFLOW_INTEGRATION.md)

The local dashboard uses these HTTP endpoints.

| Method and route | Purpose |
| --- | --- |
| `GET /api/workspace/overview` | Workspace totals, projects, recent memories, and current activity state. |
| `GET /api/workspace/memories` | Filter and page through saved memories. |
| `GET /api/workspace/graph` | Get project, agent, and memory nodes and their relationships. |
| `POST /api/workspace/context` | Send a project ID, query, budget, and cross-project choice. |
| `GET /api/workspace/activity` | Read the activity feed when enabled. |
| `GET /api/workspace/telemetry` | Read a page of journal events, with `project`, `cursor`, `journalId`, and `limit` options. |
| `POST /api/workspace/activity-report` | Write an explicit host report with a project, session, agent, and event kind. |
| `GET /api/workspace/features` | Read feature settings and their revision. |
| `POST /api/workspace/features` | Send a boolean `patch` and optional `expectedRevision`. |

Install the [bundled workflow skills](WORKFLOW_INTEGRATION.md) separately to give compatible clients task guidance.
