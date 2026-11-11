import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GlobalBrain } from '../../src/brain/global-brain.js';
import type { GlobalEntry } from '../../src/types.js';

const base = {
  projectId: 'project-a',
  projectName: 'Synthetic project',
  agentTool: 'codex' as const,
  category: 'lesson',
  content: 'Synthetic test memory',
  importance: 0.5,
  metadata: {},
};

type EntryInput = Omit<GlobalEntry, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>;
let dir: string;
let dbPath: string;
let brain: GlobalBrain;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-confidence-'));
  dbPath = path.join(dir, 'global.json');
  brain = GlobalBrain.getInstance({ dbPath, syncIntervalMs: 60_000 });
});

afterEach(async () => {
  await brain.shutdown();
  fs.rmSync(dir, { recursive: true, force: true });
});

function add(input: Partial<EntryInput> = {}): string {
  return brain.writeSync({ ...base, ...input });
}

function fixtureEntry(id: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
  const date = '2020-01-01T00:00:00.000Z';
  return { ...base, id, createdAt: date, lastAccessed: date, accessCount: 0, ...fields };
}

function writeFixture(entries: Array<Record<string, unknown>>): void {
  fs.writeFileSync(dbPath, JSON.stringify({ schemaVersion: 1, entries, projects: [], agents: [] }));
}

describe('GlobalBrain.recallScored', () => {
  it('excludes curated IDs before limits and corroboration and returns isolated entry snapshots', async () => {
    await brain.init();
    const active = add({ content: 'orbit memory', importance: 0.1, metadata: { sources: ['demo.ts'] } });
    const old = add({ content: 'orbit memory', importance: 1, agentTool: 'claude-code' });
    const excluded = new Set([old]);
    const selected = brain.recallScored({ keywords: ['orbit'], limit: 1, excludeIds: excluded });
    expect(selected.map(entry => entry.id)).toEqual([active]);
    expect(selected[0].confidence.explanation?.corroboratingAgents).toEqual([]);
    expect(brain.recall({ keywords: ['orbit'], limit: 1, excludeIds: excluded })[0].id).toBe(active);
    const copy = brain.getEntry(active)!;
    copy.content = 'changed';
    (copy.metadata.sources as string[]).push('changed.ts');
    copy.createdAt.setFullYear(1900);
    expect(brain.getEntry(active)).toMatchObject({ content: 'orbit memory', metadata: { sources: ['demo.ts'] } });
    expect(brain.getEntry(active)!.createdAt.getFullYear()).not.toBe(1900);
    expect(brain.getEntry('missing')).toBeUndefined();
  });

  it('ranks actual matched terms and favors stronger fields over project name alone', async () => {
    await brain.init();
    const content = add({ content: 'Always validate webhook signatures before processing payloads' });
    const category = add({ category: 'webhook signatures' });
    const partial = add({ content: 'Webhook configuration guide' });
    const metadata = add({ metadata: { topic: 'webhook signatures' } });
    const project = add({ projectName: 'webhook signatures' });

    const keywords = [' WEBHOOK ', 'signatures', 'Webhook', '  signatures ', 'the', '12'];
    const out = brain.recallScored({ keywords });
    expect(out.map(entry => entry.id)).toEqual([content, category, metadata, partial, project]);
    expect(brain.recall({ keywords }).map(entry => entry.id)).toEqual(out.map(entry => entry.id));
    expect(out.map(entry => entry.confidence.signals.relevance)).toEqual([1, 0.9, 0.55, 0.5, 0.25]);
    expect(out[0].confidence.explanation).toEqual({
      matchedKeywords: ['webhook', 'signatures'], totalKeywords: 2, corroboratingAgents: [],
    });
    expect(out[3].confidence.explanation?.matchedKeywords).toEqual(['webhook']);
    for (const { confidence } of out) {
      expect(confidence.level).toBe(confidence.score >= 0.66 ? 'high' : confidence.score >= 0.33 ? 'medium' : 'low');
      for (const signal of [confidence.score, ...Object.values(confidence.signals)]) {
        expect(Number.isFinite(signal)).toBe(true);
        expect(signal).toBeGreaterThanOrEqual(0);
        expect(signal).toBeLessThanOrEqual(1);
      }
    }
  });

  it('normalizes whitespace in phrases and treats a stop-word-only query like an empty query', async () => {
    await brain.init();
    const match = add({ content: 'Feature requires   blue-green\n rollout' });
    add({ content: 'Feature is disabled' });
    const phrase = ['   BLUE-GREEN \t ROLLOUT   '];
    expect(brain.recallScored({ keywords: phrase })[0]).toMatchObject({
      id: match,
      confidence: { explanation: { matchedKeywords: ['blue-green rollout'], totalKeywords: 1 } },
    });
    expect(brain.recall({ keywords: phrase }).map(entry => entry.id)).toEqual([match]);

    const keywords = [' WW2BR ', 'and', ' to', 'a', '12', '  '];
    expect(brain.recall({ keywords })).toEqual(brain.recall());
    const scored = brain.recallScored({ keywords });
    expect(scored).toHaveLength(2);
    for (const { confidence } of scored) {
      expect(confidence.signals.relevance).toBe(0.5);
      expect(confidence.explanation).toMatchObject({ matchedKeywords: [], totalKeywords: 0 });
    }
  });

  it('counts distinct labels with identical normalized content only in the same project and category', async () => {
    await brain.init();
    const id = add({ category: 'deploy', content: 'Deploy uses blue-green' });
    const target = () => brain.recallScored({ projectId: base.projectId, agentTool: 'codex' }).find(entry => entry.id === id)!;
    const scoreBefore = target().confidence.score;
    add({ agentTool: 'claude-code', category: 'deploy', content: 'Deploy verified blue-green' });
    add({ agentTool: 'cursor', category: 'deploy', content: 'Deploy uses blue-green', projectId: 'project-b' });
    add({ agentTool: 'cline', category: 'different', content: 'Deploy uses blue-green' });
    add({ agentTool: 'codex', category: 'deploy', content: 'deploy uses blue-green' });
    expect(target().confidence.signals.corroboration).toBe(0);
    expect(target().confidence.score).toBe(scoreBefore);

    add({ agentTool: 'cursor', category: 'deploy', content: ' DEPLOY \n uses\t blue-green ' });
    add({ agentTool: 'cursor', category: 'deploy', content: 'deploy uses blue-green' });
    expect(target().confidence.signals.corroboration).toBe(0.5);
    expect(target().confidence.explanation?.corroboratingAgents).toEqual(['cursor']);
    add({ agentTool: 'claude-code', category: 'deploy', content: 'deploy uses blue-green' });
    expect(target().confidence.signals.corroboration).toBe(1);
    expect(target().confidence.explanation?.corroboratingAgents).toEqual(['claude-code', 'cursor']);
  });

  it('normalizes malformed legacy ranking fields without rewriting their stored representation', async () => {
    writeFixture([
      fixtureEntry('invalid-a', { importance: null, createdAt: 'invalid', lastAccessed: null, accessCount: -4 }),
      fixtureEntry('invalid-b', { importance: -9, createdAt: null, lastAccessed: false, accessCount: 'twenty' }),
      fixtureEntry('invalid-c', { importance: 12, createdAt: '9999-01-01T00:00:00.000Z', accessCount: 1e300 }),
    ]);
    const original = fs.readFileSync(dbPath);
    await brain.init();
    for (const result of brain.recallScored()) {
      expect(Number.isFinite(result.confidence.score)).toBe(true);
      expect(result.confidence.signals.recency).toBe(0);
      expect(Number.isFinite(result.confidence.signals.usage)).toBe(true);
    }
    expect(brain.recallByIds(['invalid-a', 'invalid-b', 'invalid-c'])).toMatchObject([
      { importance: 0, accessCount: 0 }, { importance: 0, accessCount: 0 }, { importance: 1 },
    ]);
    await brain.sync();
    expect(fs.readFileSync(dbPath)).toEqual(original);

    add();
    await brain.sync();
    const stored = JSON.parse(fs.readFileSync(dbPath, 'utf8')).entries;
    expect(stored[0]).toMatchObject({ importance: null, createdAt: 'invalid', lastAccessed: null, accessCount: -4 });
    expect(stored[1]).toMatchObject({ importance: -9, createdAt: null, lastAccessed: false, accessCount: 'twenty' });
  });

  it('treats a recent touch as usage without making an old entry newly created', async () => {
    writeFixture([fixtureEntry('old')]);
    await brain.init();
    const before = brain.recallScored()[0].confidence.signals;
    brain.touch('old');
    const after = brain.recallScored()[0].confidence.signals;
    expect(after.recency).toBe(before.recency);
    expect(after.usage).toBeGreaterThan(before.usage);
  });

  it('normalizes limits and thresholds and breaks exact ties by ID', async () => {
    writeFixture([
      fixtureEntry('b', { importance: 0.9 }),
      fixtureEntry('a', { importance: 0.9 }),
      fixtureEntry('c', { importance: 0.2 }),
    ]);
    await brain.init();
    const opts = { keywords: ['synthetic'] };
    expect(brain.recallScored({ ...opts, limit: 1.8 }).map(entry => entry.id)).toEqual(['a']);
    expect(brain.recallScored({ ...opts, limit: -2 })).toEqual([]);
    expect(brain.recallScored({ ...opts, limit: NaN, minConfidence: NaN, minImportance: -1 }).map(entry => entry.id))
      .toEqual(['a', 'b', 'c']);
    expect(brain.recall({ ...opts, limit: Infinity }).map(entry => entry.id)).toEqual(['a', 'b', 'c']);
    const boundary = brain.recallScored(opts)[0].confidence.score;
    expect(brain.recallScored({ ...opts, minConfidence: boundary }).map(entry => entry.id)).toEqual(['a', 'b']);
    expect(brain.recallScored({ ...opts, minConfidence: boundary + 0.001 })).toEqual([]);
    expect(brain.recallScored({ ...opts, minImportance: 0.5 }).map(entry => entry.id)).toEqual(['a', 'b']);
  });

  it('ranks the complete candidate set before applying the requested limit', async () => {
    await brain.init();
    for (let index = 0; index < 70; index++) {
      add({ category: 'orbit', content: 'decoy ' + index, importance: 0.1 });
    }
    const strongest = add({ content: 'orbit', importance: 1 });
    const otherProject = add({ content: 'orbit', importance: 1, projectId: 'project-b' });
    expect(brain.recallScored({ keywords: ['orbit'], projectId: base.projectId, limit: 1 }).map(entry => entry.id))
      .toEqual([strongest]);
    expect(brain.recallScored({ keywords: ['orbit'], projectId: 'project-b', limit: 1 }).map(entry => entry.id))
      .toEqual([otherProject]);
  });
});
