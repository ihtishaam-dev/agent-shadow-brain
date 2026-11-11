import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGlobalBrain } from '../../src/brain/global-brain.js';
import { DashboardServer } from '../../src/dashboard/server.js';

const installer = vi.hoisted(() => ({
  attach: vi.fn(),
  detach: vi.fn(),
  attachAll: vi.fn(),
  detachAll: vi.fn(),
  detectInstalled: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('../../src/brain/session-hooks.js', () => ({ getHookInstaller: () => installer }));

let dir: string;
let dashboard: DashboardServer;
let url: string;

beforeEach(async () => {
  vi.resetAllMocks();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-targeted-hooks-'));
  getGlobalBrain({ dbPath: path.join(dir, 'global.json') });
  const orchestrator = Object.assign(new EventEmitter(), {
    getStatus: () => ({ projectDir: dir, agents: [] }), getLastHealthScore: () => null, getLastFixes: () => [],
  });
  dashboard = new DashboardServer(orchestrator as never, { host: '127.0.0.1', port: 0 });
  url = await dashboard.start();
});

afterEach(async () => {
  await dashboard.stop();
  await getGlobalBrain().shutdown();
  fs.rmSync(dir, { recursive: true, force: true });
});

function request(action: 'attach' | 'detach', agent: unknown): Promise<Response> {
  return fetch(url + '/api/v6/agents-' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent, projectDir: dir }),
  });
}

function expectNoDiscoveryOrBatchCalls(): void {
  expect(installer.attachAll).not.toHaveBeenCalled();
  expect(installer.detachAll).not.toHaveBeenCalled();
  expect(installer.detectInstalled).not.toHaveBeenCalled();
  expect(installer.audit).not.toHaveBeenCalled();
}

describe('targeted legacy dashboard hook actions', () => {
  it('invokes exactly the requested attach or detach operation and reports only that agent', async () => {
    const hook = { agent: 'codex', installPath: path.join(dir, 'synthetic-hook.json') };
    installer.attach.mockResolvedValue([hook]);
    installer.detach.mockResolvedValue(true);

    const attached = await request('attach', 'codex');
    expect(attached.status).toBe(200);
    expect(await attached.json()).toMatchObject({ ok: true, report: { attached: ['codex'], hooks: [hook], failed: [], totalAgents: 1 } });
    expect(installer.attach).toHaveBeenCalledExactlyOnceWith('codex', dir);
    expect(installer.detach).not.toHaveBeenCalled();

    const detached = await request('detach', 'opencode');
    expect(detached.status).toBe(200);
    expect(await detached.json()).toMatchObject({ ok: true, report: { detached: ['opencode'], hooks: [], failed: [], totalAgents: 1 } });
    expect(installer.detach).toHaveBeenCalledExactlyOnceWith('opencode', dir);
    expect(installer.attach).toHaveBeenCalledTimes(1);
    expectNoDiscoveryOrBatchCalls();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('rejects unsupported selections and never turns a missing hook into an all-agent action', async () => {
    installer.attach.mockResolvedValue([]);
    installer.detach.mockResolvedValue(false);

    for (const agent of ['constructor', 'deepseek-harness', undefined]) {
      expect((await request('attach', agent)).status).toBe(400);
      expect((await request('detach', agent)).status).toBe(400);
    }
    expect(installer.attach).not.toHaveBeenCalled();
    expect(installer.detach).not.toHaveBeenCalled();

    expect(await (await request('attach', 'codex')).json()).toMatchObject({
      ok: false, report: { attached: [], failed: [{ agent: 'codex' }], totalAgents: 1 },
    });
    expect(await (await request('detach', 'codex')).json()).toMatchObject({
      ok: false, report: { detached: [], failed: [{ agent: 'codex' }], totalAgents: 1 },
    });
    expect(installer.attach).toHaveBeenCalledExactlyOnceWith('codex', dir);
    expect(installer.detach).toHaveBeenCalledExactlyOnceWith('codex', dir);
    expectNoDiscoveryOrBatchCalls();
  });
});
