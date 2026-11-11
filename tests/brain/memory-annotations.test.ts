import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MEMORY_ANNOTATION_LIMITS, MemoryAnnotationsStore, memoryState, type MemoryAnnotationSnapshot,
} from '../../src/brain/memory-annotations.js';
import { normalizeMemorySources } from '../../src/brain/memory-sources.js';

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

const at = '2026-01-01T00:00:00.000Z';
const review = { kind: 'review', projectId: 'alpha', memoryId: 'first', state: 'contested', note: 'Recorded basis.' } as const;
const link = {
  kind: 'link', projectId: 'alpha', fromId: 'second', toId: 'first', type: 'supersedes', note: 'Replaced procedure.',
} as const;
let dir: string;
let filePath: string;
let store: MemoryAnnotationsStore;
let projects: Map<string, string>;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-annotations-'));
  filePath = path.join(dir, 'store', 'memory-annotations.json');
  projects = new Map([['first', 'alpha'], ['second', 'alpha'], ['third', 'alpha'], ['outside', 'beta']]);
  store = makeStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

function makeStore(lockTimeoutMs?: number): MemoryAnnotationsStore {
  return new MemoryAnnotationsStore({
    filePath, lockTimeoutMs, resolveMemory: id => {
      const projectId = projects.get(id);
      return projectId ? { id, projectId } : undefined;
    },
  });
}

function writeFixture(contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

describe('local memory annotations', () => {
  it('returns a clean missing-store snapshot without creating files', () => {
    const before = store.get();
    expect(before).toEqual({ schemaVersion: 1, revision: 0, updatedAt: null, reviews: {}, links: [], history: [] });
    before.links.push({ id: 'fixture', projectId: 'alpha', fromId: 'first', toId: 'second', type: 'related', note: '', createdAt: at });
    expect(store.get().links).toEqual([]);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('keeps a durable manual review under a superseding link and retains previous states and link history', async () => {
    const first = await store.update(review, 0);
    expect(first.reviews.first).toMatchObject({ projectId: 'alpha', state: 'contested', note: 'Recorded basis.' });
    const changed = await store.update({ ...review, state: 'archived', note: 'Changed scope.' }, first.revision);
    expect(changed.history[1].previousReview).toEqual(first.reviews.first);
    const added = await store.update(link, changed.revision);
    const stored = makeStore().get();
    expect(stored).toEqual(added);
    expect(memoryState(stored, 'alpha', 'first')).toBe('superseded');
    expect(memoryState(stored, 'beta', 'first')).toBe('active');

    const relation = stored.links[0];
    projects.delete('second');
    expect(memoryState(store.get(), 'alpha', 'first')).toBe('superseded');
    const removed = await store.update({ kind: 'unlink', linkId: relation.id }, stored.revision);
    expect(memoryState(removed, 'alpha', 'first')).toBe('archived');
    expect(removed.links).toEqual([]);
    expect(removed.history[3]).toMatchObject({
      projectId: 'alpha', command: { kind: 'unlink', linkId: relation.id }, relationId: relation.id, relation,
    });
    expect(store.get()).toEqual(removed);
  });

  it('validates scope, keys, relation type, note bounds, and identity', async () => {
    for (const value of [
      { ...review, extra: true }, { ...review, state: 'superseded' }, { ...review, note: 'x'.repeat(1001) },
      { ...link, toId: 'second' }, { ...link, type: 'verified' },
      JSON.parse('{"kind":"review","projectId":"alpha","memoryId":"__proto__","state":"active"}'),
    ]) {
      await expect(store.update(value)).rejects.toMatchObject({ code: 'ANNOTATIONS_INVALID_COMMAND' });
    }
    expect(fs.readdirSync(dir)).toEqual([]);
    await expect(store.update({ ...link, fromId: 'outside' })).rejects.toMatchObject({ code: 'ANNOTATIONS_NOT_FOUND' });
    await expect(store.update({ ...link, fromId: 'missing' })).rejects.toMatchObject({ code: 'ANNOTATIONS_NOT_FOUND' });
    await expect(store.update({ ...review, projectId: 'beta' })).rejects.toMatchObject({ code: 'ANNOTATIONS_NOT_FOUND' });
    expect(store.get().revision).toBe(0);
  });

  it('rejects cycles and competing replacements and deduplicates symmetric links', async () => {
    await store.update(link);
    await store.update({ ...link, fromId: 'third', toId: 'second' });
    const before = fs.readFileSync(filePath);
    await expect(store.update({ ...link, fromId: 'first', toId: 'third' })).rejects.toThrow(/cycle/);
    await expect(store.update({ ...link, fromId: 'third', toId: 'first' })).rejects.toThrow(/already has a replacement/);
    expect(fs.readFileSync(filePath)).toEqual(before);
    await store.update({ ...link, type: 'contradicts' });
    await expect(store.update({ ...link, fromId: 'first', toId: 'second', type: 'contradicts' })).rejects.toThrow(/already exists/);
    await store.update({ ...link, type: 'supports' });
    await store.update({ ...link, fromId: 'first', toId: 'second', type: 'supports' });
    expect(store.get().links).toHaveLength(5);
  });

  it('serializes concurrent patches and rejects a stale revision without replacing data', async () => {
    const peer = makeStore();
    await Promise.all([store.update(review), peer.update(link)]);
    expect(store.get()).toMatchObject({ revision: 2, reviews: { first: expect.any(Object) }, links: [expect.any(Object)] });
    const competing = await Promise.allSettled([
      store.update({ ...review, state: 'active' }, 2),
      peer.update({ ...review, state: 'archived' }, 2),
    ]);
    expect(competing.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(competing.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'ANNOTATIONS_CONFLICT' } });
    expect(store.get().revision).toBe(3);
  });

  it('keeps prior review notes in their original project if a memory ID is reassigned', async () => {
    await store.update(review);
    projects.set('first', 'beta');
    await expect(store.update({ ...review, projectId: 'beta' })).rejects.toMatchObject({ code: 'ANNOTATIONS_CONFLICT' });
    expect(store.get().history).toHaveLength(1);
    expect(store.get().reviews.first.projectId).toBe('alpha');
  });

  it('bounds persisted audit history while retaining review provenance', async () => {
    const revision = MEMORY_ANNOTATION_LIMITS.history;
    const prior: MemoryAnnotationSnapshot = {
      schemaVersion: 1, revision, updatedAt: at, reviews: {}, links: [],
      history: Array.from({ length: revision }, (_, index) => ({ revision: index + 1, at, projectId: 'alpha', command: review })),
    };
    writeFixture(JSON.stringify(prior));
    const latest = await store.update(review, revision);
    expect(latest.history).toHaveLength(MEMORY_ANNOTATION_LIMITS.history);
    expect(latest.history[0].revision).toBe(2);
    expect(latest.history.at(-1)?.revision).toBe(revision + 1);
    expect(store.get()).toEqual(latest);
  });

  it.each(['not JSON', '{"schemaVersion":2}', '{"schemaVersion":1,"revision":1,"reviews":{},"links":[],"history":[]}'])(
    'keeps invalid and unsupported stores unchanged', async raw => {
      writeFixture(raw);
      expect(() => store.get()).toThrow(expect.objectContaining({ code: 'ANNOTATIONS_INVALID_STORE' }));
      await expect(store.update(review)).rejects.toMatchObject({ code: 'ANNOTATIONS_INVALID_STORE' });
      expect(fs.readFileSync(filePath, 'utf8')).toBe(raw);
      expect(fs.readdirSync(path.dirname(filePath))).toEqual(['memory-annotations.json']);
    },
  );

  it('rejects an oversized store and protects the old snapshot on replacement failure', async () => {
    writeFixture('{}');
    fs.truncateSync(filePath, MEMORY_ANNOTATION_LIMITS.bytes + 1);
    expect(() => store.get()).toThrow(/size limit/);
    expect(fs.statSync(filePath).size).toBe(MEMORY_ANNOTATION_LIMITS.bytes + 1);
    fs.unlinkSync(filePath);

    await store.update(review);
    const previous = fs.readFileSync(filePath);
    const otherTemp = filePath + '.foreign.tmp';
    fs.writeFileSync(otherTemp, 'independent fixture');
    vi.mocked(fs.renameSync).mockImplementationOnce(() => { throw new Error('injected rename failure'); });
    await expect(store.update(link)).rejects.toMatchObject({ code: 'ANNOTATIONS_WRITE_FAILED' });
    expect(fs.readFileSync(filePath)).toEqual(previous);
    expect(fs.readFileSync(otherTemp, 'utf8')).toBe('independent fixture');
    expect(fs.readdirSync(path.dirname(filePath)).sort()).toEqual(['memory-annotations.json', 'memory-annotations.json.foreign.tmp']);
  });

  it('times out without removing an existing lock', async () => {
    fs.mkdirSync(path.dirname(filePath));
    const lock = filePath + '.lock';
    fs.writeFileSync(lock, 'independent owner');
    const old = new Date('2000-01-01T00:00:00.000Z');
    fs.utimesSync(lock, old, old);
    await expect(makeStore(50).update(review)).rejects.toMatchObject({ code: 'ANNOTATIONS_LOCK_TIMEOUT' });
    expect(fs.readFileSync(lock, 'utf8')).toBe('independent owner');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('recorded source references', () => {
  it('unifies legacy and current fields while dropping malformed and duplicate values', () => {
    expect(normalizeMemorySources({
      sources: [' docs/current.md ', {}, 12, 'docs/current.md', '\r\n'],
      source: 'docs/legacy.md', sourceFile: 'docs/current.md', filePath: 'docs/second.md',
    })).toEqual(['docs/current.md', 'docs/legacy.md', 'docs/second.md']);
    expect(normalizeMemorySources({ sources: ['abcdef', 'def'] }, { limit: 1, maxChars: 4 })).toEqual(['abc…']);
  });
});
