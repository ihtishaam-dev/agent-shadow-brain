import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GlobalBrain, getGlobalBrain } from '../../src/brain/global-brain.js';
import { getMemoryGraph, resetMemoryGraphForTests } from '../../src/brain/memory-graph.js';

let tmpDir = '';
let brain: GlobalBrain;

function seed(opts: {
  project?: string; agent?: string; category?: string; content?: string;
  importance?: number; tags?: string[];
}): void {
  brain.writeSync({
    projectId: 'proj-' + (opts.project ?? 'Alpha'),
    projectName: opts.project ?? 'Alpha',
    agentTool: (opts.agent ?? 'codex') as never,
    category: opts.category ?? 'lesson',
    content: opts.content ?? 'a memory',
    importance: opts.importance ?? 0.6,
    metadata: { tags: opts.tags ?? [] },
  });
}

describe('memory graph (constellation)', () => {
  beforeEach(async () => {
    resetMemoryGraphForTests();
    await getGlobalBrain().shutdown();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-memgraph-'));
    brain = getGlobalBrain({ dbPath: path.join(tmpDir, 'global.json'), syncIntervalMs: 60_000 });
    await brain.init();
  });

  afterEach(async () => {
    await brain.shutdown();
    resetMemoryGraphForTests();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('builds typed nodes and structural edges from brain entries', async () => {
    seed({ project: 'Alpha', agent: 'codex', category: 'lesson', tags: ['auth', 'security'], content: 'use bcrypt' });
    seed({ project: 'Alpha', agent: 'claude-code', category: 'decision', tags: ['auth', 'api'], content: 'jwt rotation' });
    seed({ project: 'Beta', agent: 'cursor', category: 'lesson', tags: ['ui'], content: 'debounce input' });

    const snap = await getMemoryGraph().build();

    const types = (t: string) => snap.nodes.filter(n => n.type === t).length;
    expect(types('memory')).toBe(3);
    expect(types('project')).toBe(2);   // Alpha, Beta
    expect(types('agent')).toBe(3);     // codex, claude-code, cursor
    expect(types('tag')).toBe(4);       // auth, security, api, ui

    const edgeTypes = new Set(snap.edges.map(e => e.type));
    expect(edgeTypes.has('belongs')).toBe(true);
    expect(edgeTypes.has('wrote')).toBe(true);
    expect(edgeTypes.has('tagged')).toBe(true);

    expect(snap.stats.memories).toBe(3);
    expect(snap.stats.edges).toBe(snap.edges.length);
  });

  it('produces PageRank and blended scores normalized to 0..1', async () => {
    seed({ project: 'Alpha', agent: 'codex', tags: ['auth', 'security'] });
    seed({ project: 'Alpha', agent: 'codex', tags: ['auth', 'api'] });
    seed({ project: 'Alpha', agent: 'claude-code', tags: ['auth'] });

    const snap = await getMemoryGraph().build();

    for (const n of snap.nodes) {
      expect(n.pagerank).toBeGreaterThanOrEqual(0);
      expect(n.pagerank).toBeLessThanOrEqual(1);
      expect(n.score).toBeGreaterThanOrEqual(0);
      expect(n.score).toBeLessThanOrEqual(1);
      expect(n.size).toBeGreaterThan(0);
    }
    // Normalization makes the most central node's pagerank exactly 1.
    const maxPr = Math.max(...snap.nodes.map(n => n.pagerank));
    expect(maxPr).toBeCloseTo(1, 5);
  });

  it('forms memory<->memory related edges from shared tags', async () => {
    seed({ project: 'Alpha', agent: 'codex', tags: ['auth', 'security'], content: 'one' });
    seed({ project: 'Alpha', agent: 'codex', tags: ['auth', 'api'], content: 'two' }); // shares "auth"

    const snap = await getMemoryGraph().build();
    const related = snap.edges.filter(e => e.type === 'related');
    expect(related.length).toBeGreaterThanOrEqual(1);
    expect(related[0].weight).toBeGreaterThanOrEqual(1);
  });

  it('respects the node cap and reports dropped nodes', async () => {
    for (let i = 0; i < 40; i++) seed({ project: 'Alpha', agent: 'codex', tags: ['t' + (i % 3)], content: 'mem ' + i });

    const snap = await getMemoryGraph().build({ maxNodes: 20 });
    expect(snap.nodes.length).toBeLessThanOrEqual(20);
    expect(snap.stats.droppedNodes).toBeGreaterThan(0);
    expect(snap.stats.totalConsidered).toBeGreaterThan(snap.nodes.length);
  });

  it('keeps the graph memory-centric when tag hubs would exceed the cap', async () => {
    // Regression: a brain with many distinct tags can produce more hub nodes
    // (tags/projects/agents) than the node cap. The cap must still keep
    // memories and their edges — not fill the budget with disconnected hubs.
    for (let i = 0; i < 40; i++) {
      seed({ project: 'Alpha', agent: 'codex', tags: ['unique-tag-' + i, 'shared'], content: 'mem ' + i });
    }
    const snap = await getMemoryGraph().build({ maxNodes: 30 });
    expect(snap.nodes.length).toBeLessThanOrEqual(30);
    // The bug produced 0 memories and 0 edges; assert both survive.
    expect(snap.stats.memories).toBeGreaterThan(0);
    expect(snap.edges.length).toBeGreaterThan(0);
    // Every kept edge must connect two kept nodes (no dangling references).
    const ids = new Set(snap.nodes.map(n => n.id));
    for (const e of snap.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it('returns an empty snapshot for an empty brain without throwing', async () => {
    const snap = await getMemoryGraph().build();
    expect(snap.nodes).toEqual([]);
    expect(snap.edges).toEqual([]);
    expect(snap.stats.memories).toBe(0);
    expect(snap.stats.edges).toBe(0);
  });
});
