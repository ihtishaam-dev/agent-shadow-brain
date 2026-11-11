import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FeatureSettingsStore } from '../../src/brain/feature-settings.js';
import { GlobalBrain } from '../../src/brain/global-brain.js';
import { MemoryAnnotationsStore, memoryAnnotationsFor } from '../../src/brain/memory-annotations.js';
import { handleWorkspaceRequest } from '../../src/dashboard/workspace-api.js';

let dir: string;
let projectDir: string;
let brain: GlobalBrain;
let annotations: MemoryAnnotationsStore;
let server: http.Server;
let endpoint: string;
let oldId: string;
let replacementId: string;
let unrelatedId: string;
let foreignId: string;

const base = {
  projectId: 'alpha', projectName: 'Alpha fixture', agentTool: 'codex',
  category: 'decision', importance: 0.7, metadata: {},
} as const;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'sb-workspace-curation-'));
  projectDir = path.join(dir, 'project');
  fs.mkdirSync(projectDir);
  brain = GlobalBrain.getInstance({ dbPath: path.join(dir, 'global.json'), syncIntervalMs: 60_000 });
  annotations = memoryAnnotationsFor(brain);
  const settings = new FeatureSettingsStore({ filePath: path.join(dir, 'feature-settings.json') });
  await brain.init();
  oldId = brain.writeSync({
    ...base, importance: 0.95, content: 'Checkout uses the old retry procedure.',
    metadata: { sources: [' docs/retry.md ', 42, {}], source: 'docs/retry.md', sourceFile: 'docs/history.md', filePath: 'docs/history.md' },
  });
  replacementId = brain.writeSync({
    ...base, content: 'Checkout uses the current retry procedure.', metadata: { filePath: 'src/retry.ts' },
  });
  unrelatedId = brain.writeSync({ ...base, content: 'Parser details.', metadata: { sources: [true, {}] } });
  foreignId = brain.writeSync({ ...base, projectId: 'beta', projectName: 'Beta fixture', content: 'Checkout in a different project.' });
  await brain.sync();

  server = http.createServer((req, res) => { void handleWorkspaceRequest(req, res, { brain, settings, annotations, projectDir }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/api/workspace/';
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await brain.shutdown();
  fs.rmSync(dir, { recursive: true, force: true });
});

function post(route: string, input: unknown, origin?: string): Promise<Response> {
  return fetch(endpoint + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(input),
  });
}

async function ok(response: Promise<Response>) {
  const result = await response;
  expect(result.status).toBe(200);
  return result.json();
}

function detail(id: string, project = 'alpha'): Promise<Response> {
  return fetch(endpoint + 'memory?' + new URLSearchParams({ id, project }));
}

async function review(memoryId: string, state: string, expectedRevision: number, projectId = 'alpha', note?: string) {
  return ok(post('memory-review', { projectId, memoryId, state, expectedRevision, ...(note ? { note } : {}) }));
}

async function link(fromId: string, toId: string, type: string, expectedRevision: number, projectId = 'alpha') {
  return ok(post('memory-link', { projectId, fromId, toId, type, expectedRevision, note: 'Recorded fixture relation.' }));
}

describe('workspace memory curation over HTTP', () => {
  it('applies persisted reviews and replacement links to the actual context response', async () => {
    const raw = fs.readFileSync(brain.dbPath);
    const request = { projectId: 'alpha', query: 'checkout' };
    const original = await ok(post('context', request));
    expect(original.entries.map((entry: { id: string }) => entry.id)).toEqual([oldId, replacementId]);

    const archived = await review(oldId, 'archived', 0, 'alpha', 'Procedure was retired.');
    expect(archived.revision).toBe(1);
    const hidden = await ok(post('context', request));
    expect(hidden.entries.map((entry: { id: string }) => entry.id)).toEqual([replacementId]);
    expect(hidden.excluded).toContainEqual({ id: oldId, projectId: 'alpha', title: 'Checkout uses the old retry procedure.', reason: 'archived' });
    expect((await ok(detail(oldId))).review).toMatchObject({ state: 'archived', note: 'Procedure was retired.' });

    await review(oldId, 'active', 1);
    const replaced = await link(replacementId, oldId, 'supersedes', 2);
    expect(replaced.revision).toBe(3);
    const reopened = new MemoryAnnotationsStore({ filePath: annotations.filePath, resolveMemory: id => brain.getEntry(id) }).get();
    const relation = reopened.links[0];
    expect(relation).toMatchObject({ fromId: replacementId, toId: oldId, type: 'supersedes' });
    const superseded = await ok(post('context', request));
    expect(superseded.entries.map((entry: { id: string }) => entry.id)).toEqual([replacementId]);
    expect(superseded.excluded).toContainEqual({ id: oldId, projectId: 'alpha', title: 'Checkout uses the old retry procedure.', reason: 'superseded' });

    const removed = await ok(post('memory-unlink', { projectId: 'alpha', memoryId: oldId, linkId: relation.id, expectedRevision: 3 }));
    expect(removed.revision).toBe(4);
    const inspected = await ok(detail(oldId));
    expect(inspected).toMatchObject({ effectiveState: 'active', links: [], revision: 4 });
    expect(inspected.history.map((event: { command: { kind: string } }) => event.command.kind))
      .toEqual(['review', 'review', 'link', 'unlink']);
    expect((await ok(post('context', request))).entries.map((entry: { id: string }) => entry.id)).toEqual([oldId, replacementId]);
    expect(fs.readFileSync(brain.dbPath)).toEqual(raw);
  });

  it('returns a revision conflict without replacing existing annotation bytes', async () => {
    await review(oldId, 'archived', 0);
    const before = fs.readFileSync(annotations.filePath);
    const stale = await post('memory-review', { projectId: 'alpha', memoryId: oldId, state: 'active', expectedRevision: 0 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'ANNOTATIONS_CONFLICT' });
    expect(fs.readFileSync(annotations.filePath)).toEqual(before);
    expect((await ok(detail(oldId))).effectiveState).toBe('archived');
  });

  it('restricts detail, history, linking, and unlinking to the named project and incident memory', async () => {
    await review(foreignId, 'contested', 0, 'beta', 'Separate project review note.');
    await link(replacementId, oldId, 'supports', 1);
    const relation = annotations.get().links[0];
    const inspected = await ok(detail(oldId));
    expect(inspected.history).toHaveLength(1);
    expect(JSON.stringify(inspected)).not.toContain('Separate project review note.');
    expect(JSON.stringify(inspected)).not.toContain(foreignId);
    expect((await detail(foreignId)).status).toBe(404);
    expect((await detail(oldId, 'beta')).status).toBe(404);
    expect((await fetch(endpoint + 'memory?id=' + oldId)).status).toBe(400);

    const before = fs.readFileSync(annotations.filePath);
    const cross = await post('memory-link', { projectId: 'alpha', fromId: oldId, toId: foreignId, type: 'related', expectedRevision: 2 });
    expect(cross.status).toBe(404);
    expect(await cross.json()).toMatchObject({ code: 'ANNOTATIONS_NOT_FOUND' });
    for (const [projectId, memoryId] of [['beta', foreignId], ['alpha', unrelatedId]]) {
      const invalid = await post('memory-unlink', { projectId, memoryId, linkId: relation.id, expectedRevision: 2 });
      expect(invalid.status).toBe(404);
    }
    expect(fs.readFileSync(annotations.filePath)).toEqual(before);
  });

  it('builds explicit graph edges only for visible project endpoints and includes an in-scope focus node', async () => {
    await link(replacementId, oldId, 'supports', 0);
    await link(replacementId, oldId, 'contradicts', 1);
    await link(replacementId, oldId, 'supersedes', 2);
    await link(replacementId, oldId, 'related', 3);
    const graph = await ok(fetch(endpoint + 'graph?project=alpha'));
    const typed = graph.edges.filter((edge: { id?: string }) => edge.id);
    expect(typed.map((edge: { kind: string }) => edge.kind).sort())
      .toEqual(['contradicts', 'related', 'supersedes', 'supports']);
    for (const edge of typed) {
      expect(edge).toMatchObject({ source: 'memory:' + replacementId, target: 'memory:' + oldId, note: 'Recorded fixture relation.' });
    }
    expect(graph.nodes.find((node: { memoryId?: string }) => node.memoryId === oldId)).toMatchObject({ effectiveState: 'superseded' });
    expect(JSON.stringify(graph.nodes)).not.toContain(foreignId);

    const focused = await ok(fetch(endpoint + 'graph?project=alpha&state=active&limit=1&memory=' + oldId));
    expect(focused.nodes.filter((node: { kind: string }) => node.kind === 'memory')).toMatchObject([{ memoryId: oldId }]);
    expect(focused.edges.some((edge: { id?: string }) => edge.id)).toBe(false);
    const visibleIds = new Set(focused.nodes.map((node: { id: string }) => node.id));
    expect(focused.edges.every((edge: { source: string; target: string }) => visibleIds.has(edge.source) && visibleIds.has(edge.target))).toBe(true);

    const refusedFocus = await ok(fetch(endpoint + 'graph?project=alpha&limit=1&memory=' + foreignId));
    expect(JSON.stringify(refusedFocus.nodes)).not.toContain(foreignId);
  });

  it('normalizes stored source fields and returns scoped quality totals and state filters', async () => {
    await review(oldId, 'archived', 0);
    await review(replacementId, 'contested', 1);
    const overview = await ok(fetch(endpoint + 'overview?project=alpha'));
    expect(overview.quality).toEqual({ total: 3, sourceBacked: 2, active: 1, archived: 1, contested: 1, superseded: 0, reviewed: 2 });
    expect(overview.scope).toEqual({ projectId: 'alpha', basis: 'recent-inventory' });
    const archived = await ok(fetch(endpoint + 'memories?project=alpha&state=archived'));
    expect(archived.items).toMatchObject([{ id: oldId, effectiveState: 'archived', sources: ['docs/retry.md', 'docs/history.md'] }]);
    const active = await ok(fetch(endpoint + 'memories?project=alpha&state=active'));
    expect(active.items).toMatchObject([{ id: unrelatedId, effectiveState: 'active', sources: [] }]);
    expect((await fetch(endpoint + 'memories?state=unsupported')).status).toBe(400);
  });

  it('rejects unsafe changes and keeps valid curation separate from queued raw writes', async () => {
    const raw = fs.readFileSync(brain.dbPath);
    brain.writeSync({ ...base, content: 'An unrelated staged write.' });
    const valid = { projectId: 'alpha', memoryId: oldId, state: 'archived', expectedRevision: 0 };
    const wrongOrigin = await post('memory-review', valid, 'https://unrelated.example');
    expect(wrongOrigin.status).toBe(400);
    expect(await wrongOrigin.json()).toMatchObject({ error: expect.stringContaining('Cross-origin') });
    expect(fs.existsSync(annotations.filePath)).toBe(false);
    expect(fs.readFileSync(brain.dbPath)).toEqual(raw);

    expect((await post('memory-review', { ...valid, unexpected: 'field' })).status).toBe(400);
    expect((await post('memory-review', { ...valid, expectedRevision: '0' })).status).toBe(400);
    expect(fs.existsSync(annotations.filePath)).toBe(false);
    expect(fs.readFileSync(brain.dbPath)).toEqual(raw);

    expect(await ok(post('memory-review', valid, new URL(endpoint).origin))).toMatchObject({ revision: 1 });
    expect(annotations.get().reviews[oldId]?.state).toBe('archived');
    expect(brain.getStorageHealth().pendingOperations).toBe(1);
    expect(fs.readFileSync(brain.dbPath)).toEqual(raw);
  });

  it('reports project skill presence and a transport capability using fixture files', async () => {
    const skill = path.join(projectDir, '.dsh', 'skills', 'shadow-workflow', 'SKILL.md');
    fs.mkdirSync(path.dirname(skill), { recursive: true });
    fs.writeFileSync(skill, 'Synthetic skill content.');
    const integration = await ok(fetch(endpoint + 'integrations'));
    expect(integration.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'project', status: 'pass' }),
      expect.objectContaining({ id: 'storage', status: 'pass' }),
      expect.objectContaining({ id: 'stdio', command: 'shadow-brain mcp --stdio' }),
    ]));
    expect(integration.agents.find((agent: { id: string }) => agent.id === 'deepseek-harness'))
      .toMatchObject({ installation: 'partial', presentSkills: 1, totalSkills: 6 });
    expect(integration.agents.find((agent: { id: string }) => agent.id === 'codex'))
      .toMatchObject({ installation: 'missing', presentSkills: 0 });
    expect(integration.diagnostics).not.toContain(projectDir);
    expect(JSON.stringify(integration)).not.toContain('Synthetic skill content.');
  });
});
