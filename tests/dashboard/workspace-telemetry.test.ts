import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityJournal, activityJournalFor } from '../../src/brain/activity-journal.js';
import { FeatureSettingsStore } from '../../src/brain/feature-settings.js';
import { GlobalBrain } from '../../src/brain/global-brain.js';
import { handleWorkspaceRequest } from '../../src/dashboard/workspace-api.js';

let dir: string;
let brain: GlobalBrain;
let journal: ActivityJournal;
let settings: FeatureSettingsStore;
let server: http.Server;
let endpoint: string;
let demo: boolean;

const report = {
  kind: 'phase', phase: 'plan', projectId: 'alpha', sessionId: 'fixture-session', agent: 'codex',
} as const;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-telemetry-http-'));
  brain = GlobalBrain.getInstance({ dbPath: path.join(dir, 'global.json'), syncIntervalMs: 60_000 });
  journal = activityJournalFor(brain);
  settings = new FeatureSettingsStore({ filePath: path.join(dir, 'feature-settings.json') });
  demo = false;
  server = http.createServer((req, res) => { void handleWorkspaceRequest(req, res, { brain, journal, settings, demo }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/api/workspace/';
});

afterEach(async () => {
  vi.restoreAllMocks();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await brain.shutdown();
  fs.rmSync(dir, { recursive: true, force: true });
});

function post(input: unknown, origin?: string): Promise<Response> {
  return fetch(endpoint + 'activity-report', {
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

function page(query = '') {
  return ok(fetch(endpoint + 'telemetry' + (query ? '?' + query : '')));
}

describe('workspace activity telemetry over HTTP', () => {
  it('starts empty without creating files and labels demo only from server configuration', async () => {
    expect(await page('demo=true')).toMatchObject({
      liveEnabled: true, recordingEnabled: true, demo: false, journalId: null, cursor: 0, events: [],
    });
    expect(fs.readdirSync(dir)).toEqual([]);
    expect(brain.getStorageHealth().initialized).toBe(false);
    demo = true;
    expect(await page()).toMatchObject({ demo: true, events: [] });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('shares durable activity across producers and pages scoped events by cursor and journal identity', async () => {
    const first = await ok(post(report, new URL(endpoint).origin));
    expect(first).toMatchObject({ recorded: true, event: { source: 'reported', transport: 'host', sequence: 1, ...report } });
    const independent = new ActivityJournal({ filePath: journal.filePath });
    await independent.append({
      kind: 'tool-end', source: 'measured', transport: 'mcp', tool: 'context_pack',
      outcome: 'success', durationMs: 12.4, correlationId: 'call-1', projectId: 'beta', sessionId: 'other-session',
    });
    const third = await ok(post({ ...report, phase: 'verify' }));
    expect(third.event.sequence).toBe(3);

    const newest = await page('project=alpha&limit=1');
    expect(newest.events).toMatchObject([{ sequence: 3, phase: 'verify' }]);
    expect(newest).toMatchObject({ cursor: 3, latestSequence: 3, oldestSequence: 1, gap: false, hasMore: false });
    const firstPage = await page('project=alpha&limit=1&cursor=0&journalId=' + newest.journalId);
    expect(firstPage.events).toMatchObject([{ sequence: 1, phase: 'plan' }]);
    expect(firstPage).toMatchObject({ cursor: 1, hasMore: true });
    const next = await page('project=alpha&limit=1&cursor=' + firstPage.cursor + '&journalId=' + newest.journalId);
    expect(next.events).toMatchObject([{ sequence: 3, phase: 'verify' }]);
    expect(next).toMatchObject({ cursor: 3, hasMore: false });
    expect((await page('project=alpha&cursor=3&journalId=' + newest.journalId)).events).toEqual([]);
    expect((await page('project=beta')).events).toMatchObject([{ sequence: 2, source: 'measured', durationMs: 12.4 }]);
    const reset = await page('project=alpha&cursor=3&limit=1&journalId=' + randomUUID());
    expect(reset).toMatchObject({ reset: true, journalId: newest.journalId, events: [{ sequence: 3 }] });
    expect(brain.getStorageHealth().initialized).toBe(false);
    expect(fs.existsSync(brain.dbPath)).toBe(false);
  });

  it('separates visibility and recording gates without inspecting a hidden journal', async () => {
    await settings.update({ liveActivity: false });
    await ok(post(report));
    const read = vi.spyOn(journal, 'read');
    expect(await page()).toMatchObject({ liveEnabled: false, recordingEnabled: true, journalId: null, events: [], cursor: 0 });
    expect(read).not.toHaveBeenCalled();

    await settings.update({ liveActivity: true, activityRecording: false });
    const before = fs.readFileSync(journal.filePath);
    expect(await ok(post({ ...report, phase: 'work' }))).toMatchObject({ recorded: false, reason: expect.any(String) });
    expect(fs.readFileSync(journal.filePath)).toEqual(before);
    expect(await page()).toMatchObject({ liveEnabled: true, recordingEnabled: false, events: [{ sequence: 1, phase: 'plan' }] });
    await settings.update({ activityRecording: true });
    expect((await ok(post({ ...report, phase: 'work' }))).event.sequence).toBe(2);
  });

  it('rejects forged producer data, extra payloads, invalid cursors, and cross-origin reports', async () => {
    for (const input of [
      { ...report, source: 'measured' }, { ...report, transport: 'mcp' }, { ...report, sequence: 100 },
      { ...report, timestamp: '2026-01-01T00:00:00.000Z' }, { ...report, arguments: { text: 'synthetic command' } },
      { ...report, detail: 'synthetic content' }, { ...report, projectId: '/synthetic/project' },
    ]) {
      expect((await post(input)).status).toBe(400);
    }
    expect((await post(report, 'https://unrelated.example')).status).toBe(400);
    expect((await fetch(endpoint + 'activity-report')).status).toBe(405);
    for (const query of ['cursor=-1', 'limit=201', 'journalId=bad', 'project=bad%2Fproject']) {
      expect((await fetch(endpoint + 'telemetry?' + query)).status).toBe(400);
    }
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('preserves invalid journal bytes and never represents them as successful empty history', async () => {
    const raw = 'synthetic invalid journal';
    fs.writeFileSync(journal.filePath, raw);
    const response = await fetch(endpoint + 'telemetry');
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: 'ACTIVITY_JOURNAL_INVALID_STORE' });
    expect((await post(report)).status).toBe(500);
    expect(fs.readFileSync(journal.filePath, 'utf8')).toBe(raw);
  });
});
