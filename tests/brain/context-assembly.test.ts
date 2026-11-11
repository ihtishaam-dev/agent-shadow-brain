import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assembleContext, contextQueryKeywords } from '../../src/brain/context-assembly.js';
import { FeatureSettingsStore } from '../../src/brain/feature-settings.js';
import { GlobalBrain } from '../../src/brain/global-brain.js';
import { getSubconscious, SubconsciousEngine } from '../../src/brain/subconscious.js';
import type { GlobalEntry } from '../../src/types.js';

const memory = {
  projectId: 'project-a',
  projectName: 'Synthetic Alpha',
  agentTool: 'codex',
  category: 'lesson',
  content: 'Use durable writes for parser imports.',
  importance: 0.6,
  metadata: {},
} as const;
type Input = Omit<GlobalEntry, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>;

let dir: string;
let dbPath: string;
let brain: GlobalBrain;
let settings: FeatureSettingsStore;
const briefingOptions = { projectId: 'project-a', projectDir: '/synthetic/alpha', agentTool: 'codex' } as const;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-context-'));
  dbPath = path.join(dir, 'global.json');
  brain = GlobalBrain.getInstance({ dbPath, syncIntervalMs: 60_000 });
  settings = new FeatureSettingsStore({ filePath: path.join(dir, 'feature-settings.json') });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await brain.shutdown();
  fs.rmSync(dir, { recursive: true, force: true });
});

function add(fields: Partial<Input> = {}): string {
  return brain.writeSync({ ...memory, ...fields });
}

describe('bounded memory context', () => {
  it('excludes other projects and their IDs by default even when local recall is empty', async () => {
    await brain.init();
    const other = add({ projectId: 'project-b', projectName: 'Synthetic Beta', content: 'Foreign telegraph routing.' });
    const result = assembleContext(brain, { projectId: 'project-a', query: 'telegraph' });
    expect(result).toMatchObject({ enabled: true, scope: 'project', entries: [], excluded: [], markdown: '' });
    expect(result.warnings).toContain('No memories matched this project and context request.');
    expect(JSON.stringify(result)).not.toContain(other);

    const misbehavingSource = { recallScored: vi.fn(() => brain.recallScored({ projectId: 'project-b' })) };
    expect(assembleContext(misbehavingSource, { projectId: 'project-a' }).entries).toEqual([]);
    expect(misbehavingSource.recallScored).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-a' }));
  });

  it('requires both setting and request intent for cross-project context and names every origin', async () => {
    await brain.init();
    const own = add({ content: 'Parser durability uses atomic commits.' });
    const other = add({
      projectId: 'project-b', projectName: 'Synthetic Beta',
      content: 'Parser durability uses a replicated log.',
    });
    const base = { projectId: 'project-a', query: 'Parser durability' };
    const requestedButOff = assembleContext(brain, { ...base, includeCrossProject: true });
    expect(requestedButOff.entries.map(entry => entry.id)).toEqual([own]);
    expect(requestedButOff.warnings.some(warning => warning.includes('disabled'))).toBe(true);
    const features = { contextAssembly: true, crossProjectContext: true };
    expect(assembleContext(brain, { ...base, features }).entries.map(entry => entry.id)).toEqual([own]);

    const cross = assembleContext(brain, { ...base, features, includeCrossProject: true });
    expect(cross.scope).toBe('cross-project');
    expect(new Set(cross.entries.map(entry => entry.id))).toEqual(new Set([own, other]));
    expect(cross.entries.find(entry => entry.id === other)).toMatchObject({ projectId: 'project-b', projectName: 'Synthetic Beta' });
    expect(cross.markdown).toContain('Synthetic Alpha');
    expect(cross.markdown).toContain('Synthetic Beta');
  });

  it('keeps the strongest exact normalized duplicate and explains relevance and recorded references', async () => {
    await brain.init();
    const primary = add({
      content: 'Parser writes use atomic replacement.',
      importance: 0.95,
      metadata: { sources: ['docs/storage.md', 'docs/storage.md', {}, 'design/source.txt'], unrelated: 'ignored metadata' },
    });
    const duplicate = add({ content: ' PARSER   WRITES use\natomic replacement. ', category: 'decision', importance: 0.1 });
    const distinct = add({ content: 'Parser writes avoid atomic replacement when the store is remote.', importance: 0.4 });
    const result = assembleContext(brain, { projectId: 'project-a', query: 'Parser parser replacement' });
    expect(result.queryKeywords).toEqual(['parser', 'replacement']);
    expect(result.entries.map(entry => entry.id)).toEqual([primary, distinct]);
    expect(result.entries[0]).toMatchObject({
      duplicateIds: [duplicate], matchedKeywords: ['parser', 'replacement'], sources: ['docs/storage.md', 'design/source.txt'],
    });
    expect(result.entries[0].reasons).toContain('Matches 2 of 2 query terms.');
    expect(result.excluded).toContainEqual({ id: duplicate, reason: 'duplicate' });
    expect(result.markdown).toContain(primary);
    expect(result.markdown).toContain('Recorded references: docs/storage.md, design/source.txt');
    expect(JSON.stringify(result)).not.toContain('ignored metadata');
  });

  it('ranks task matches before weaker matches and preserves deterministic tie order', async () => {
    await brain.init();
    const weaker = add({ content: 'Parser notes.' });
    const relevant = add({ content: 'Parser retries after durability errors.' });
    const pack = assembleContext(brain, { projectId: 'project-a', query: 'parser durability', maxEntries: 1 });
    expect(pack.entries.map(entry => entry.id)).toEqual([relevant]);
    expect(pack.excluded).toEqual([{ id: weaker, reason: 'limit' }]);

    const candidates = brain.recallScored({ projectId: 'project-a', keywords: ['parser'] });
    const first = assembleContext(brain, { projectId: 'project-a', query: 'parser' });
    const second = assembleContext(brain, { projectId: 'project-a', query: 'parser' });
    expect(first.entries.map(entry => entry.id)).toEqual(candidates.map(entry => entry.id));
    expect(second.markdown).toBe(first.markdown);
  });

  it('retains the provenance of recorded references carried by a duplicate', async () => {
    await brain.init();
    const representative = add({ content: 'Parser uses the verified fixture.', importance: 0.99 });
    const sourceRecord = add({
      content: ' PARSER uses the verified fixture. ', importance: 0.1,
      metadata: { sources: ['docs/parser-evidence.md'] },
    });
    const context = assembleContext(brain, { projectId: 'project-a', query: 'parser' });
    expect(context.entries).toMatchObject([{
      id: representative,
      duplicateIds: [sourceRecord],
      sources: ['docs/parser-evidence.md'],
      sourceReferences: [{ source: 'docs/parser-evidence.md', memoryId: sourceRecord }],
    }]);
  });

  it('measures the entire rendered context and skips oversized results in favor of smaller ones', async () => {
    await brain.init();
    const long = add({
      content: 'Parser ' + 'verbose description '.repeat(150),
      importance: 1,
      metadata: { sources: ['docs/' + 'x'.repeat(600)] },
    });
    const short = add({ content: 'Parser handles résumé fixtures 🧪.', importance: 0.4 });
    const opts = { projectId: 'project-a', query: 'parser', tokenBudget: 100, maxChars: 320 };
    const tight = assembleContext(brain, opts);
    expect(tight.entries.map(entry => entry.id)).toEqual([short]);
    expect(tight.excluded).toContainEqual({ id: long, reason: 'budget' });
    expect(tight.budget).toEqual({
      tokenBudget: 100, maxChars: 320, usedChars: tight.markdown.length, estimatedTokens: Math.ceil(tight.markdown.length / 4),
    });
    expect(tight.markdown.length).toBeLessThanOrEqual(320);
    expect(tight.markdown).toContain('résumé fixtures 🧪');

    const roomy = assembleContext(brain, { ...opts, maxChars: 2000, tokenBudget: 500 });
    expect(roomy.entries[0]).toMatchObject({ id: long, excerptTruncated: true });
    expect(roomy.markdown).toContain('> Excerpt: ');
    expect(roomy.markdown.length).toBeLessThanOrEqual(2000);
    const tiny = assembleContext(brain, { ...opts, tokenBudget: 1 });
    expect(tiny).toMatchObject({ markdown: '', entries: [], budget: { maxChars: 4, usedChars: 0, estimatedTokens: 0 } });
  });

  it('bounds candidate reporting and query terms, normalizes numeric options, and validates scope', async () => {
    await brain.init();
    for (let index = 0; index < 203; index++) add({ content: 'Parser note ' + index });
    const query = 'parser';
    const capped = assembleContext(brain, { projectId: 'project-a', query, maxEntries: 999, tokenBudget: 20_000 });
    expect(capped.entries).toHaveLength(30);
    expect(capped.entries.length + capped.excluded.length).toBe(200);
    expect(capped.warnings.some(warning => warning.includes('200'))).toBe(true);
    expect(capped.budget.maxChars).toBe(48_000);
    const numeric = assembleContext(brain, { projectId: 'project-a', query, maxEntries: 1.9, maxChars: NaN, tokenBudget: Infinity });
    expect(numeric.entries).toHaveLength(1);
    expect(numeric.budget.maxChars).toBe(8000);
    expect(contextQueryKeywords('The ' + Array.from({ length: 30 }, (_, index) => 'term' + index).join(' '))).toHaveLength(16);
    expect(() => assembleContext(brain, { projectId: ' ', includeCrossProject: true })).toThrow(TypeError);
    expect(() => assembleContext(brain, { projectId: 'a', includeCrossProject: 'true' as never })).toThrow(TypeError);
  });

  it('returns a disabled result before invoking recall', () => {
    const source = { recallScored: vi.fn() };
    const disabled = assembleContext(source, {
      projectId: 'project-a', features: { contextAssembly: false, crossProjectContext: true }, query: 'parser',
    });
    expect(disabled).toMatchObject({ enabled: false, entries: [], markdown: '', warnings: ['Context assembly is disabled.'] });
    expect(source.recallScored).not.toHaveBeenCalled();
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});

describe('actual automatic briefings', () => {
  it('keeps the existing singleton runtime-configuration behavior', async () => {
    const engine = getSubconscious();
    expect(getSubconscious({ enabled: false })).toBe(engine);
    expect(await engine.generateBriefing(briefingOptions)).toMatchObject({ disabledReason: 'configuration' });
    getSubconscious({ enabled: true });
  });

  it('checks persisted enablement before cache or memory initialization and respects runtime config', async () => {
    await brain.init();
    add();
    const engine = new SubconsciousEngine({}, brain, settings);
    const first = await engine.generateBriefing({ ...briefingOptions, currentTask: 'parser' });
    expect(first.fullText).toContain('durable writes');
    const cached = await engine.generateBriefing({ ...briefingOptions, currentTask: 'PARSER parser' });
    expect(cached.sessionId).toBe(first.sessionId);
    const init = vi.spyOn(brain, 'init');

    await settings.update({ automaticBriefing: false });
    const disabled = await engine.generateBriefing({ ...briefingOptions, currentTask: 'parser' });
    expect(disabled).toMatchObject({ fullText: '', tokenCount: 0, disabledReason: 'automaticBriefing' });
    expect(init).not.toHaveBeenCalled();
    await settings.update({ automaticBriefing: true, contextAssembly: false });
    expect(await engine.generateBriefing(briefingOptions)).toMatchObject({ disabledReason: 'contextAssembly', fullText: '' });
    expect(init).not.toHaveBeenCalled();

    engine.configure({ enabledAgents: ['cursor'] });
    expect(await engine.generateBriefing(briefingOptions)).toMatchObject({ disabledReason: 'agent', fullText: '' });
    engine.configure({ enabled: false });
    expect(await engine.generateBriefing(briefingOptions)).toMatchObject({ disabledReason: 'configuration', fullText: '' });
    expect(init).not.toHaveBeenCalled();
  });

  it('separates tasks, never mixes projects by default, and bounds the actual briefing text', async () => {
    await brain.init();
    add({ content: 'Parser durability is implemented with atomic commits.' });
    add({ content: 'Vector retrieval uses a fixture index.' });
    add({ projectId: 'project-b', projectName: 'Synthetic Beta', content: 'Parser Beryllium configuration.' });
    const engine = new SubconsciousEngine({ tokenBudget: 100 }, brain, settings);
    const parser = await engine.generateBriefing({ ...briefingOptions, currentTask: 'parser' });
    const vector = await engine.generateBriefing({ ...briefingOptions, currentTask: 'vector' });
    expect(parser.sessionId).not.toBe(vector.sessionId);
    expect(parser.fullText).toContain('atomic commits');
    expect(parser.fullText).not.toContain('Beryllium');
    expect(vector.fullText).toContain('fixture index');
    expect(vector.fullText).not.toContain('atomic commits');
    expect(parser.sections.similarPastWork).toHaveLength(1);
    expect(vector.tokenCount).toBe(Math.ceil(vector.fullText.length / 4));
    expect(vector.fullText.length).toBeLessThanOrEqual(400);

    await settings.update({ crossProjectContext: true });
    const explicit = await engine.generateBriefing({ ...briefingOptions, currentTask: 'beryllium', includeCrossProject: true });
    expect(explicit.fullText).toContain('Synthetic Beta');
    expect(explicit.fullText).toContain('Beryllium configuration');
    engine.configure({ tokenBudget: 1 });
    expect(await engine.generateBriefing({ ...briefingOptions, currentTask: 'vector' })).toMatchObject({ fullText: '', tokenCount: 0 });
  });

  it('can use older task-relevant lessons and preserves the memory-store error', async () => {
    const old = '2020-01-01T00:00:00.000Z';
    const data = {
      schemaVersion: 1,
      projects: [], agents: [],
      entries: [{ ...memory, id: 'old-lesson', content: 'Parser old evidence remains relevant.', accessCount: 0, createdAt: old, lastAccessed: old }],
    };
    fs.writeFileSync(dbPath, 'invalid fixture JSON');
    const engine = new SubconsciousEngine({}, brain, settings);
    await expect(engine.generateBriefing(briefingOptions)).rejects.toMatchObject({ code: 'STORE_INVALID_JSON' });
    expect(fs.readFileSync(dbPath, 'utf8')).toBe('invalid fixture JSON');
    fs.writeFileSync(dbPath, JSON.stringify(data));
    const general = await engine.generateBriefing(briefingOptions);
    expect(general.fullText).toBe('');
    const task = await engine.generateBriefing({ ...briefingOptions, currentTask: 'parser' });
    expect(task.fullText).toContain('old evidence remains relevant');
  });
});
