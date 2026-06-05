# Shadow Brain v6.1.0

**Date:** 2026-06-04
**Codename:** Live Wire

A focused release that makes the dashboard genuinely realtime. Until now the v6 dashboard *looked* live but polled the activity API every 3 seconds, and the brain emitted no events — so nothing could actually be pushed. v6.1.0 adds a brain-wide event bus, streams activity over the existing WebSocket the instant it happens (in-process **and** cross-process), and overhauls the Activity experience. Zero new runtime dependencies. Full TypeScript build passes; 162 tests green.

## Realtime core

- **Brain Bus** (`src/brain/brain-bus.ts`) — a single dependency-free pub/sub singleton (`getBrainBus()`) that every subsystem publishes to and the dashboard subscribes to once. Extends Node's `EventEmitter`, keeps a 500-event ring buffer for backlog replay, and dedups by composite event id so the same logical event never fires twice.
- **Memory-write events** — `GlobalBrain` now emits on every committed write (both the synchronous path and the async write-queue flush), tagged with category, importance, and project.
- **Cognition events** — the Dream Engine, Memory Seeder (draft + commit), Collision Detective, Sub-Agent Bridge, and Forgetting Curve each publish the instant they produce something. Every publish is wrapped so a bus failure can never break a brain operation.
- **Cross-process realtime** — because each terminal owns its own brain singleton, a memory written by an agent in another process would otherwise be invisible. The dashboard now watches `~/.shadow-brain/global.json` (via the existing `chokidar` dependency) and republishes new entries it sees on disk. Dedup-by-id means your own in-process writes are never double-counted. Very large stores fall back to a single "brain updated" pulse instead of a full diff.

## Dashboard server

- The WebSocket layer subscribes to the bus and broadcasts each event as `{ type: 'activity', event }`. New clients receive an `activity-backlog` of the last 50 events on connect, so the feed is never empty on first paint.
- The file watcher, bus subscription, and debounce timer are all torn down cleanly on `stop()`.
- Polling endpoints (`/api/v6/activity-log`) are unchanged and now serve as a reconciliation fallback.

## Dashboard UI

- **Live Activity tab** — filter chips (Memory / Dreams / Seeds / Collisions / Sub-Agents / Consolidation), a pulsing **LIVE** badge, **Pause/Resume** and **Clear** controls, and a client-side search box. New rows animate in as they stream.
- **Events/min sparkline** — a rolling per-minute Chart.js bar on the Activity tab, plus a live rate on the Overview.
- **Overview "Live Pulse" card** — a streaming mini-feed of the last 8 events, driven entirely by the WebSocket.
- **Connection state** — a header dot goes green when the realtime socket is live and amber while reconnecting; the LIVE badge mirrors the state.
- Polling cadence for activity dropped from every 3s to a 15s reconciliation tick — live events now arrive over the socket in well under a second.
- Removed a dead no-op `logActivity()` stub from the legacy dashboard.

## Tests

- New `tests/brain/brain-bus.test.ts`: delivery, dedup-by-id, distinct-id separation, 500-entry ring cap, newest-first ordering, unsubscribe, and id/ts defaulting.

## Compatibility

- No new runtime dependencies; `chokidar` was already in use by the file watchers.
- The legacy v5 dashboard (`/legacy`) is unchanged and harmlessly ignores the new `activity` message type.
- The brain bus is in-process by design (local-first, zero network). Cross-process realtime is achieved by watching the shared on-disk store. Multi-machine sync remains out of scope.
