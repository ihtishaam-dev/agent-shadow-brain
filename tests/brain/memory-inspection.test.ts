import { describe, expect, it } from 'vitest';
import { inspectMemory, inspectMemoryHealth } from '../../src/brain/memory-inspection.js';
import type { GlobalBrain } from '../../src/brain/global-brain.js';
import type { MemoryAnnotationSnapshot } from '../../src/brain/memory-annotations.js';
import type { GlobalEntry } from '../../src/types.js';

const now = new Date('2026-11-12T00:00:00Z');
const row = (id: string, projectId = 'alpha', content = id): GlobalEntry => ({ id, projectId, projectName: projectId, agentTool: 'codex', category: 'lesson', content,
  createdAt: new Date('2026-01-01T00:00:00Z'), lastAccessed: now, importance: 0.8, accessCount: 0, metadata: {} });
function source(entries: GlobalEntry[]) {
  return { getEntry: (id: string) => entries.find(entry => entry.id === id),
    timeline: (opts: { projectId?: string; limit?: number }) => entries.filter(entry => !opts.projectId || entry.projectId === opts.projectId).slice(0, opts.limit ?? 50),
  } as Pick<GlobalBrain, 'timeline' | 'getEntry'>;
}
const empty = (): MemoryAnnotationSnapshot => ({ schemaVersion: 1, revision: 0, updatedAt: null, reviews: {}, links: [], history: [] });

describe('memory attention and bounded inspection', () => {
  it('keeps review, age, missing references, duplicates and relationships explicit without changing content', () => {
    const entries = [row('one', 'alpha', 'Same text'), row('two', 'alpha', 'same   text'), row('three'), row('outside', 'beta', 'Same text')];
    entries[0].metadata = { sources: ['docs/result.md'] };
    const annotations = empty();
    annotations.reviews.three = { projectId: 'alpha', state: 'contested', note: 'Check claim', updatedAt: now.toISOString() };
    annotations.links = [
      { id: 'conflict', projectId: 'alpha', fromId: 'one', toId: 'three', type: 'contradicts', note: '', createdAt: now.toISOString() },
      { id: 'missing', projectId: 'alpha', fromId: 'one', toId: 'removed', type: 'related', note: '', createdAt: now.toISOString() },
      { id: 'other', projectId: 'beta', fromId: 'outside', toId: 'lost', type: 'contradicts', note: 'OTHER PROJECT', createdAt: now.toISOString() },
    ];
    const before = JSON.stringify({ entries, annotations });
    const report = inspectMemoryHealth(source(entries), annotations, { projectId: 'alpha', now });
    expect(report.counts).toMatchObject({ total: 3, active: 2, contested: 1, sourceBacked: 1, withoutSources: 2, reviewed: 1,
      olderThan90Days: 3, duplicateEntries: 1, contradictionLinks: 1, orphanedLinks: 1 });
    expect(report.queue.find(item => item.id === 'two')?.issues.map(issue => issue.kind)).toEqual(['duplicate', 'no-source', 'older-memory']);
    expect(report.queue.every(item => item.projectId === 'alpha')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('OTHER PROJECT');
    expect(JSON.stringify({ entries, annotations })).toBe(before);
    expect(report.warnings.join(' ')).toMatch(/not verified evidence/);
  });

  it('scopes before the coverage bound and discloses partial counts', () => {
    const entries = Array.from({ length: 5001 }, (_, i) => row('beta-' + i, 'beta'));
    entries.push(row('alpha-only'));
    expect(inspectMemoryHealth(source(entries), empty(), { projectId: 'alpha', now }).counts.total).toBe(1);
    const beta = inspectMemoryHealth(source(entries), empty(), { projectId: 'beta', now, limit: 2 });
    expect(beta.coverage).toEqual({ scanned: 5000, limit: 5000, truncated: true });
    expect(beta.queue).toHaveLength(2);
    expect(beta.queueTotal).toBe(5000);
    expect(() => inspectMemoryHealth(source(entries), empty(), { limit: 101 })).toThrow();
  });

  it('retains supersession even when its replacement is unavailable, and restricts exact lookup scope', () => {
    const entries = [row('long', 'alpha', 'x'.repeat(33000)), row('replacement', 'beta')];
    entries[0].metadata = { source: 'https://example.invalid/not-fetched', unrelated: 'do-not-return-metadata' };
    const annotations = empty();
    annotations.links = [{ id: 'supersession', projectId: 'alpha', fromId: 'replacement', toId: 'long', type: 'supersedes', note: '', createdAt: now.toISOString() }];
    const result = inspectMemory(source(entries), annotations, 'alpha', 'long')!;
    expect(result).toMatchObject({ state: 'superseded', contentTruncated: true, sourceVerification: 'references-only' });
    expect(result.content.length).toBe(32000);
    expect(JSON.stringify(result)).not.toContain('do-not-return-metadata');
    expect(inspectMemory(source(entries), annotations, 'beta', 'long')).toBeNull();
    expect(inspectMemoryHealth(source(entries), annotations, { projectId: 'alpha', now }).counts).toMatchObject({ superseded: 1, orphanedLinks: 1 });
  });
});
