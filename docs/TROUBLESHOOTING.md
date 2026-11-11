# Troubleshooting

## The installed version differs from the guide

This guide is for **7.1.3**. Install it explicitly because 7.2.0 sorts higher by semantic version. The CLI requires Node.js 22.12+ in the 22.x line, 24.x, or 26+.

```bash
node --version
shadow-brain --version
npm install -g @theihtisham/agent-shadow-brain@7.1.3
```

If another install still runs, check which executable your shell resolves with `Get-Command shadow-brain` on PowerShell or `command -v shadow-brain` on a POSIX shell.

## MCP cannot start or discover tools

Run `shadow-brain clients config` and compare its executable and argument list to the client entry. Use the absolute executable and CLI paths if the client cannot resolve the npm launcher. `mcp --stdio` waits for MCP messages on stdin, so start it through your client. Once connected, try `workflow_skills` to verify a tool call. [Client setup](INTEGRATIONS.md)

If skills are missing, run `shadow-brain clients inspect .` from the project root and check the chosen target. Apply the installation after reviewing the preview. A local-edit conflict needs a review of the existing file before an update. A linked path or inaccessible directory appears as blocked. [Skill install conflicts](WORKFLOW_INTEGRATION.md#preview-updates-and-conflicts)

## The dashboard opens but activity is empty

```bash
shadow-brain features list
shadow-brain activity tail
```

`liveActivity` controls delivery and visibility. `activityRecording` controls new journal entries. To see a new measured event, enable both and call a tool through a connected `mcp --stdio` client. The dashboard can also show explicit host reports from `activity report` or `activity_report`. The default dashboard follows the default journal. For a custom `--db`, use the same option with `activity tail` to inspect that store's adjacent journal.

```bash
shadow-brain features set liveActivity on
shadow-brain features set activityRecording on
```

The journal keeps the latest 500 events, with up to 200 returned per page. A retention gap means older events have expired from the local window. A reset can happen when the journal ID changes or when a cursor is ahead of the journal. Use the journal ID and cursor returned by the new page. The timing charts use matched measured spans in the loaded window. [Activity commands and controls](WORKSPACE.md#follow-live-operations)

## The context pack is empty or shorter than expected

Check the project ID, query terms, and `contextAssembly` setting. Context excludes archived, contested, and superseded memories before ranking. If you intend to include other projects, enable `crossProjectContext` and pass `--cross-project` for that pack.

```bash
shadow-brain context-pack "retry behavior" --project . --token-budget 1200 --json
```

The JSON output lists scope, selected memories, exclusions, and size. The assembler considers up to 200 eligible matches and uses a character budget derived from the token estimate. Large entries may be skipped so smaller entries can fit. [Context budget and review behavior](WORKSPACE.md#build-context-for-the-task)

## A store reports an error

```bash
shadow-brain storage-health --json
shadow-brain storage-health --db ./global.json --json
```

| Result | Next step |
| --- | --- |
| `STORE_INVALID_JSON`, `STORE_INVALID_SCHEMA`, or `STORE_UNSUPPORTED_SCHEMA` | Preserve the existing file. Check the file path and schema, then restore from a known-good backup or inspect a copy. |
| `STORE_READ_FAILED` | Check the selected path and file permissions. |
| `STORE_LOCK_TIMEOUT` or `ACTIVITY_JOURNAL_LOCK_TIMEOUT` | Wait for the other writer to finish. An interrupted process can leave a lock. Confirm that no writer still owns it before handling the abandoned lock. |
| `ANNOTATIONS_CONFLICT` | Reload the memory detail or read the latest revision before resubmitting a curation change. |
| `ACTIVITY_JOURNAL_INVALID_STORE` | Preserve `activity-journal.json` for inspection. The live view reports the error and the stdio tools continue operating if telemetry cannot be written. |

If the dashboard port is in use, choose another port and open the printed address.

```bash
shadow-brain dash . --no-analysis --no-open --port 7350
```
