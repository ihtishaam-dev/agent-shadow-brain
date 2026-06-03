# Shadow Brain v6.0.3

Date: 2026-06-03

v6.0.3 is a practical memory-quality release. It focuses on making Shadow Brain useful for real long-running agent work instead of adding more marketing claims.

## Highlights

- Added the Live Brain module.
- Added live memory health reports.
- Added source coverage, stale-memory, duplicate, and low-quality memory checks.
- Added recall evals for common agent workflows.
- Added markdown agent briefings for fresh sessions and handoffs.
- Added JSONL training/eval pack export.
- Added dashboard API route and dashboard Live Brain tab for Live Brain reports.
- Added Memory Seeder: dashboard/API draft creation, source capture, user approval, agent approval, dual approval, rejection, and seed-to-global-brain commit.
- Added Memory Intelligence API and dashboard cards for source coverage, freshness, categories, agents, tags, recent writes, and seed queue counts.
- Fixed Token Economy dashboard wording and data split so the active runtime agent is shown separately from historical model spend.
- Added MCP tools for Live Brain status, briefing, and training-pack export.
- Added dashboard `--host` and `--no-analysis` controls for reliable local UI launches on large repos.
- Fixed CLI config merging so commands that request one-shot mode can actually disable watch mode.
- Rewrote the README to describe real behavior and release workflow.
- Updated npm metadata to 6.0.3 with a realistic package description.

## New CLI Commands

```bash
shadow-brain live-brain status .
shadow-brain live-brain brief . -o SHADOW_BRAIN_AGENT_BRIEF.md
shadow-brain live-brain eval .
shadow-brain live-brain hygiene .
shadow-brain live-brain train-pack . --out shadow-brain-training.jsonl
```

Short alias:

```bash
shadow-brain live status .
```

## New API

```text
GET/POST /api/v6/live-brain
GET      /api/v6/memory-intelligence
GET      /api/v6/seed-drafts
POST     /api/v6/seed-draft
POST     /api/v6/seed-approve
POST     /api/v6/seed-reject
POST     /api/v6/seed-commit
```

Use `format=markdown` to return the agent briefing instead of JSON.

## New Dashboard Surface

The v6 dashboard now includes a Live Brain tab showing memory quality, source coverage, recall eval results, recommended hygiene actions, top memories, and the markdown briefing that agents can use during handoffs.

The Memory Browser now includes live memory intelligence: total memory count, source coverage, fresh learning, seed queue, top categories, agent coverage, and tags.

The Memory Seeder tab turns research into durable memory safely. A draft can be prepared by a selected research agent, checked against sources and existing memory, then approved by the user, by a selected agent, or by both before it is written to the global brain.

## New MCP Tools

- `live_brain_status`
- `live_brain_brief`
- `live_brain_train_pack`

## What "Training" Means Here

Shadow Brain does not train remote model weights. The new training pack exports source-backed memory examples as JSONL so users can run their own eval, distillation, or local fine-tuning workflows.

## Verification

Validated locally:

```bash
npm.cmd run build
npm.cmd test
npm.cmd pack --dry-run
```

Result:

- TypeScript build passed.
- Full Vitest suite passed.
- npm package dry run passed.

## Files Added

- `src/brain/live-brain.ts`
- `src/brain/memory-seeder.ts`
- `tests/brain/live-brain.test.ts`
- `tests/brain/memory-seeder.test.ts`
- `docs/launch/RELEASE_NOTES_v6.0.3.md`

## Files Updated

- `README.md`
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `src/cli.ts`
- `src/index.ts`
- `src/dashboard/server.ts`
- `src/dashboard/v6-dashboard-html.ts`
- `src/brain/context-continuity.ts`
- `src/brain/mcp-server.ts`
- `src/brain/auto-update.ts`
- `src/brain/brain-portability.ts`
- `src/brain/orchestrator.ts`
