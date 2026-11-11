# Agent Shadow Brain 7.1.3

Version 7.1.3 connects memory review, the workspace graph, and the context handed to an agent. The new live operations portal shows recorded agent activity and tool timing.

## Live operations

Open `/live` on the dashboard address for the session list, activity network, charts, and event timeline. Measured activity comes from the local MCP service. Hosts can explicitly report task phases and tool spans. The portal labels the two sources and uses matched, measured calls for timing metrics.

The shared local journal keeps the latest 500 metadata events. It tracks sequence and journal identity so readers can continue from a cursor and detect gaps or a restarted journal. `activityRecording` controls new records and `liveActivity` controls visibility. Both are enabled by default and can be changed with the other three runtime controls. Use `activity report` to send a host report and `activity tail` to inspect the journal.

## Memory review and relations

Open a memory in the workspace to see its content, recorded references, current review, and history. Set its state to active, archived, or contested. Record a same-project link of type related, supports, contradicts, or supersedes. Supersession links point from the replacement to the older memory.

Context assembly filters inactive memories before ranking, preserves relevant relation and source provenance when collapsing duplicates, and labels recorded contradictions. If a replacement disappears, its older memory stays superseded until you remove the relation. Manual reviews and links record decisions to inspect against the underlying evidence.

The `curate show`, `curate review`, `curate link`, and `curate unlink` commands use the same annotation store as the workspace. The store validates project identities, revisions, duplicate relations, and supersession cycles. It keeps an audit trail alongside the existing memory store.

## Connect a client

The workspace's Integrations view shows project skill-file presence, supported client capabilities, and local runtime and storage checks. Codex, Claude Code, OpenCode, and DeepSeek Harness can use their documented project skill layouts. Host-side discovery depends on client configuration.

The standalone MCP service now runs over standard input and output.

```bash
shadow-brain mcp --stdio
```

Configure this command as the executable and arguments in a compatible client. The service exposes nine read-only memory, context, and workflow tools plus the explicit `activity_report` write tool. Activity recording uses a separate journal from the memory store. DeepSeek Harness needs its MCP client and filesystem skill plugins enabled. See the [workspace guide](../WORKSPACE.md) and [skill integration guide](../WORKFLOW_INTEGRATION.md).

## Upgrade

```bash
npm install -g @theihtisham/agent-shadow-brain@7.1.3
shadow-brain dash . --no-analysis
```

Existing memories retain schema version 1. Keep `global.json` and the separate `memory-annotations.json` when backing up your memory and review state. Follow the [7.0 migration notes](RELEASE_NOTES_v7.0.0.md) if you are upgrading from 6.x.

This upgrade uses the maintainer-requested version **7.1.3**, published after 7.2.0. It is assigned the npm `latest` tag, but semver update tools may still prefer 7.2.0. Use the exact install command above.
