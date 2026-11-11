# Agent Shadow Brain

Local-first memory and coordination for AI coding agents.

Version: 7.0.0


Agent Shadow Brain gives tools like Codex, Claude Code, Cursor, Cline, OpenCode, Aider, and related MCP clients a shared local memory layer. It stores compact, source-backed lessons about projects, recalls them later, generates fresh-session briefings, audits memory quality, and exports JSONL training/eval packs.

It does not change model weights by itself. It helps agents work better by giving them relevant, current, source-linked context before and during complex work.

## What's New in 7.0.0

- **Durable multi-agent memory.** Saves lock, reload, and merge the latest store so independent agents cannot replace each other's new memories. Queued writes acknowledge success after persistence. Failed operations remain retryable and visible in storage health.
- **Explainable recall.** Results include matched keywords, score components, and identities reporting the same normalized content within the same project and category. Unrelated notes no longer inflate scores. Scores are ranking heuristics, not probabilities of truth or proof of independent verification.
- **Storage diagnostics.** Use `shadow-brain storage-health --json` or MCP `global_storage_health` to inspect errors and pending operations. Invalid or unsupported stores fail explicitly and remain unchanged.
- **Safer setup and packaging.** Installation no longer edits agent settings. Help, version, and memory diagnostics do not load provider configuration. Dependencies are refreshed, activity-log text is escaped, and package tests install a real tarball into a fresh consumer project.

### Upgrade from 6.x

Use Node.js 22.12+ within 22.x, Node 24.x, or Node 26+. Back up your existing `global.json` before upgrading and stop older Shadow Brain writers; older versions do not participate in the new lock protocol. The schema remains version 1. Start integrations explicitly using the existing setup/attach commands after installation.

`writeSync()` remains an in-memory operation; call `await brain.sync()` for durable persistence. `await brain.write()` resolves after the background sync or an explicit sync; a false result means persistence failed or the queue was full. Failed accepted operations remain pending for retry. Recall reads the process snapshot, refreshed by sync; it is not an instantaneous cross-process read.

### New commands

```bash
shadow-brain storage-health --json
shadow-brain storage-health --db ./global.json --json
shadow-brain recall-explain "deployment rollback" --limit 5
shadow-brain recall-explain "database migration" --project . --min-confidence 0.4
```

`storage-health` validates readability and schema, reports JSON even on failure, and exits with code 1 for an invalid store. It does not repair or rewrite an existing store; when checking a missing store it may create its parent directory. `lastSuccessfulSync` describes the current process only. The MCP health tool inspects existing process state without initializing or flushing it.

The library exports `GlobalBrain`, `getGlobalBrain`, and their public types:

```js
import { getGlobalBrain } from '@theihtisham/agent-shadow-brain';
const brain = getGlobalBrain({ dbPath: './global.json' });
await brain.init();
console.log(brain.recallScored({ keywords: ['deployment'], limit: 5 }));
console.log(brain.getStorageHealth());
await brain.shutdown();
```

Details: [release notes](docs/launch/RELEASE_NOTES_v7.0.0.md).

## Earlier dashboard features

- **Simple by default, Advanced on demand.** The dashboard opens with eight plain-English tabs (Home, Brain Map, Memories, Ask the Brain, Activity, Connected Tools, Brain Health, Settings). Flip to Advanced to reveal every feature — nothing was removed, just tidied.
- **Brain Map.** An interactive graph of everything the brain remembers — memories, projects, tools, and tags — sized by importance (PageRank) and linked by shared context. Zoom, pan, click a node for details, and watch it grow live as new memories arrive.
- **Realtime activity.** Memory writes, reflections, and tool events stream live over WebSocket instead of polling, with a live pulse on Home.
- **Live Network.** A refreshed animation of your tools talking to the brain, with flowing signal pulses.
- **Two-way knowledge seeding.** Quick-Save captures knowledge in one click; "Hand to Agent" generates a ready briefing to pass context back to any tool.
- **Plain-language everywhere.** Cryptic feature names rewritten (e.g. Calibration → Accuracy, Pre-Mortem → Risk Check, Tokens → Cost & Usage), each with a hover description.


## What It Actually Does

- Stores cross-project and cross-agent memories in a local JSON brain at `~/.shadow-brain/global.json`.
- Recalls memories by project, agent, category, and keywords.
- Generates source-backed resume packs for fresh sessions, account switches, context compaction, and handoffs.
- Audits memory quality: source coverage, stale entries, duplicates, low-quality notes, recall health.
- Creates verified memory seed drafts from dashboard/API, then requires user, agent, or dual approval before writing to durable memory.
- Exports JSONL rows for evals, distillation, or local fine-tuning pipelines.
- Provides CLI, dashboard API, and MCP tool surfaces.
- Includes safety helpers such as hook audit, detach, and action firewall checks.
- Works without telemetry and without an API key for local memory features.

## What It Does Not Claim

- It does not secretly train GPT, Claude, Gemini, or any remote model.
- It does not guarantee perfect recall.
- It does not replace project docs, tests, source control, or human review.
- It does not make every listed agent automatically available. Agent support depends on local installation and hook/config compatibility.
- It does not publish or sync data unless you explicitly use export, sync, or other sharing commands.

## Install

```bash
npm install -g @theihtisham/agent-shadow-brain
```

CLI binaries:

```bash
shadow-brain --help
asb --help
```

You can also run without global install:

```bash
npx @theihtisham/agent-shadow-brain@latest --help
```

## Safe First Run

Start by auditing before attaching hooks:

```bash
shadow-brain audit-hooks .
shadow-brain live-brain status .
```

Only attach after you review what will be changed:

```bash
shadow-brain attach-all .
```

Detach later if needed:

```bash
shadow-brain detach-all .
```

## v6.0.3: Live Brain

The 6.0.3 release focuses on practical long-memory improvement for agents.

### Live Brain Status

```bash
shadow-brain live-brain status .
```

Shows:

- memory count
- average memory quality
- source coverage
- stale memories
- duplicate clusters
- recall eval score
- recommended cleanup actions

JSON output:

```bash
shadow-brain live-brain status . --json
```

### Agent Briefing

Generate a markdown briefing for a fresh agent session:

```bash
shadow-brain live-brain brief . -o SHADOW_BRAIN_AGENT_BRIEF.md
```

The briefing includes:

- rules for agents
- top source-backed memories
- memory warnings
- recall health
- commands agents should run next

### Recall Eval

Check whether the brain can retrieve useful memories for common agent tasks:

```bash
shadow-brain live-brain eval .
```

Custom eval queries use pipe separators:

```bash
shadow-brain live-brain eval . --queries "current blocker|do not repeat|verified command"
```

### Memory Hygiene

List concrete cleanup and learning actions:

```bash
shadow-brain live-brain hygiene .
```

This highlights missing sources, stale memories, duplicates, weak recall, and missing project-scoped memories.

### Training/Eval Export

Export source-backed memories as JSONL:

```bash
shadow-brain live-brain train-pack . --out shadow-brain-training.jsonl
```

This is useful for:

- retrieval evals
- local distillation experiments
- supervised fine-tuning datasets
- memory regression tests

The export is only data preparation. You choose the downstream training/eval tool.

## Core Memory Commands

Recall from the global brain:

```bash
shadow-brain global recall --query "current blocker next step" --json --limit 8
```

Show global stats:

```bash
shadow-brain global stats
```

Create a source-backed resume seed:

```bash
shadow-brain resume-seed . -o SHADOW_BRAIN_RESUME_SEED.md
```

Show what a project has learned:

```bash
shadow-brain timeline . --limit 30
```

Create a cross-agent handoff packet:

```bash
shadow-brain handoff codex claude-code . --task "continue release verification"
```

Record a durable memory from a script:

```bash
node tools/record-global-memory.mjs ^
  --project-dir "." ^
  --project-name "my-project" ^
  --agent codex ^
  --category "project.lesson" ^
  --importance 0.8 ^
  --tags "memory,release" ^
  --sources "README.md,CHANGELOG.md" ^
  --content "Keep release notes source-backed and verify npm metadata before publish."
```

## Dashboard

Start the local dashboard:

```bash
shadow-brain dash . --no-open --port 7341
```

For a fast UI/API-only launch on a large repo:

```bash
shadow-brain dash . --no-open --no-analysis --host 127.0.0.1 --port 7341
```

Open:

```text
http://127.0.0.1:7341
```

The v6 dashboard includes a **Live Brain** tab for memory health, source coverage, recall evals, hygiene actions, top memories, and the generated agent briefing.

It also includes:

- **Memory Browser intelligence cards** for total memories, source coverage, fresh learning, seed queue, top categories, agent coverage, and top tags.
- **Memory Seeder** for controlled research-to-memory workflows. Drafts stay out of the global brain until approval is complete.
- **Token Economy accuracy split**: current runtime agent is shown separately from historical model spend, so old Claude/Cursor spend records do not imply the dashboard is running that agent.

### Realtime Activity (new in 6.1.0)

The dashboard now streams brain activity live over its WebSocket instead of polling. Memory writes, dreams, seed drafts/commits, collisions, sub-agent spawns, and consolidation cycles appear the instant they happen.

- **Live Pulse** card on the Overview with a streaming mini-feed and an events/min rate.
- **Activity Log** tab with filter chips, a pulsing LIVE badge, pause/resume, clear, search, and an events/min sparkline.
- **Connection indicator** in the header — green when the realtime socket is live, amber while reconnecting.
- **Cross-process aware**: a memory written by an agent in a *different* terminal is picked up by watching `~/.shadow-brain/global.json`, so the feed reflects the whole machine, not just this process.

Polling remains as a 15-second reconciliation fallback; live events arrive in well under a second.

### Intelligence Hub — Memory Constellation (new in 6.2.0)

A new **Intelligence** tab turns the brain into an interactive graph. Every memory, project, agent, and tag is a node in a force-directed **Memory Constellation**, sized by importance (PageRank blended with each memory's own score) and linked by project, author, tags, and shared-tag relatedness.

- **Interactive**: scroll to zoom, drag to pan, click a node to focus its neighborhood and open a detail drawer; hover for a tooltip.
- **Filters + search** by node type (memory / project / agent / tag).
- **Live**: new memories pulse into the graph over the realtime stream.
- **Analytics strip**: source-coverage gauge, agent-contribution and category charts, tag cloud, and a recent-memory feed.
- Works instantly on your existing `~/.shadow-brain/global.json` — no project analysis or setup step.

Several previously sparse tabs were also rebuilt with real visualizations: **Pre-Mortem** (risk matrix + failure cards), **Attention** (weighted heat bars), **Calibration** (Brier/trust chart), **Reputation** (trust rings), **Causal Chains** (node-link DAG), and **Branch Brains** (stat cards).

Constellation API:

```text
GET /api/v6/memory-graph
```


Memory seeding API:

```text
GET  /api/v6/seed-drafts
POST /api/v6/seed-draft
POST /api/v6/seed-approve
POST /api/v6/seed-reject
POST /api/v6/seed-commit
GET  /api/v6/memory-intelligence
```

Useful API endpoints:

```text
GET/POST /api/v6/live-brain
GET/POST /api/v6/resume-pack
GET/POST /api/v6/ww2br-recall
GET/POST /api/v6/memory-browser
```

Example:

```bash
curl "http://127.0.0.1:7341/api/v6/live-brain?projectDir=C:/path/to/project"
```

## MCP Tools

The MCP server exposes memory and agent-control tools for compatible clients.

New in 6.3.0:

- `global_recall_scored` — recall with a per-memory confidence score (recency, author importance, cross-agent corroboration, prior usage, keyword relevance). Results are ranked by confidence so agents can weight memories instead of trusting every hit equally. Supports `minConfidence` to drop low-trust hits.

New in 6.0.3:

- `live_brain_status`
- `live_brain_brief`
- `live_brain_train_pack`

Existing useful tools include:

- `global_recall`
- `global_recall_scored`
- `global_stats`
- `global_timeline`
- `subconscious_inject`
- `agent_handoff`
- `firewall_check`

Start MCP from the dashboard API or existing CLI/server integration, depending on your setup.

## How Agents Should Use It

Recommended workflow for complex work:

1. Run `shadow-brain live-brain status <project>`.
2. Generate or read a live briefing.
3. Verify current project docs and source files.
4. Work normally.
5. Record only durable, source-backed lessons after proof.
6. Run recall evals when memory quality starts to drift.

Good memories are short, action-oriented, and source-backed:

```text
[lesson:release-readme-v1] Before publishing, verify package.json version, package-lock root version, README install commands, build output, and npm pack contents.
Sources: package.json; package-lock.json; README.md
Tags: release,npm,verification
```

Bad memories are vague:

```text
Make project better.
```

## Local Data

Default global brain:

```text
~/.shadow-brain/global.json
```

Project-local generated files may include:

```text
SHADOW_BRAIN_AGENT_BRIEF.md
SHADOW_BRAIN_RESUME_SEED.md
shadow-brain-training.jsonl
```

Do not store secrets, API keys, passwords, private keys, or raw credentials in memory content, metadata, tags, prompts, reports, or exported training data.

## Development

```bash
npm ci --ignore-scripts
npm run verify
npm run test:package
```

Focused tests:

```bash
npx vitest run tests/brain/live-brain.test.ts tests/brain/context-continuity.test.ts
```

On Windows PowerShell, if execution policy blocks `npm.ps1`, use:

```powershell
npm.cmd run build
npx.cmd vitest run tests\brain\live-brain.test.ts
```

## Release Checklist

Run `npm run verify`, `npm audit --audit-level=high`, and `npm run test:package`. Inspect the package allowlist, then publish the verified tarball. Confirm the npm version, integrity, and GitHub tag before announcing a release. See [the complete release checklist](docs/launch/RELEASE_CHECKLIST_v7.0.0.md).

## License

MIT
