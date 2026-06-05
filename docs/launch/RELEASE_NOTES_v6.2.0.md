# Shadow Brain v6.2.0

**Date:** 2026-06-04
**Codename:** Constellation

The release where the brain becomes something you can *see*. v6.1.0 added a realtime event bus under the hood; v6.2.0 spends that on visible, best-in-class UI. The headline is the **Memory Constellation** — an interactive, physics-driven graph of the brain itself — plus a full revival of the dashboard tabs that previously showed only a form or "no data." Zero new runtime dependencies. Full TypeScript build passes; 167 tests green.

## Flagship — Intelligence hub

A new top-level **Intelligence** tab (and an Overview hero card that links into it).

- **Memory Constellation** — every memory, project, agent, and tag rendered as a living node graph. Nodes are sized by importance using **PageRank** blended with each memory's own importance score; edges connect memories to their projects, the agents that wrote them, the tags that describe them, and to *each other* via shared tags.
  - Hand-rolled canvas force-directed layout (repulsion + edge springs + center gravity + damping) — no D3, no cytoscape, no new dependency.
  - **Interactive**: scroll to zoom, drag to pan, click a node to focus its neighborhood and open a detail drawer (content, project, agent, importance, sources, tags), hover for a tooltip.
  - Filter chips (memories / projects / agents / tags) and node search.
  - **Live**: subscribes to the realtime activity stream from 6.1.0 — when a memory is written, the constellation pulses and grows.
  - Layout is capped at ~180 nodes for smooth 60fps; any overflow is surfaced as a hidden-node count, never silently dropped.
- **Analytics strip** — total memories, source-coverage gauge, fresh-24h, high-importance counts, plus agent-contribution and category charts, a tag cloud, and a recent-memory feed.

### New backend
- `src/brain/memory-graph.ts` (`getMemoryGraph()`) builds the constellation snapshot from existing brain entries. Pure in-memory derivation, no new storage.
- New endpoint `GET/POST /api/v6/memory-graph` (optional `projectDir`, `limit`, `maxNodes`, `minImportance`).

## Revived dashboard tabs

Tabs that previously rendered a form or plain text now have real visualizations:

- **Pre-Mortem** — a risk gauge, a probability × severity **risk matrix**, and severity-colored failure cards with mitigations.
- **Attention Heatmap** — ranked, color-graded weight bars (green→red) with per-memory reasoning, instead of monospace text.
- **Calibration** — a Brier-vs-trust-weight **bar chart** above the reliability table.
- **Reputation** — per-agent **trust cards** with canvas accuracy rings, alongside the leaderboard.
- **Causal Chains** — traces now render as a **node-link DAG** on canvas (layered by depth, weighted/arrowed links) instead of raw Graphviz DOT.
- **Branch Brains** — stat cards + a category cloud instead of a bare key/value list.

## Polish

- A reusable **animated empty-state** component (icon + title + message + optional CTA) replaces bare "No data" across revived tabs, so empty states guide instead of dead-end.
- Subtle **GSAP staggered card entrance** on real tab switches (guarded — no-ops if the CDN is unavailable, and never fires on the background refresh loop).
- Intelligence is wired into the ⌘K command palette.

## Tests

- New `tests/brain/memory-graph.test.ts`: typed node/edge construction, PageRank normalization (0–1, top node = 1), shared-tag relatedness edges, node-cap + dropped-count reporting, and empty-brain safety.

## Compatibility

- No new runtime dependencies. The constellation and all revived visualizations use the canvas API and the already-loaded Chart.js / GSAP.
- The constellation is derived from data the brain already holds — it works immediately on an existing `~/.shadow-brain/global.json`, with no project analysis or setup step.
- The legacy v5 dashboard (`/legacy`) is unchanged.

## Honest notes

- Competitive research for this release was done offline (the web-search gateway was unavailable); the design draws on prior knowledge of memory-graph tools plus a verified internal audit that found the PageRank graph engine and the stub tabs.
- The force layout is intentionally capped (~180 nodes) for performance; larger brains show the most important nodes and report the rest as hidden.
