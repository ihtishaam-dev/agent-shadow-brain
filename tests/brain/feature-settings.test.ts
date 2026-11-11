import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FEATURE_FLAGS, FeatureSettingsStore } from '../../src/brain/feature-settings.js';

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

let dir: string;
let filePath: string;
let settings: FeatureSettingsStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-settings-'));
  filePath = path.join(dir, 'app', 'feature-settings.json');
  settings = new FeatureSettingsStore({ filePath });
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('feature settings store', () => {
  it('reads the original four-flag file without rewriting it and persists the new recording control on change', async () => {
    fs.mkdirSync(path.dirname(filePath));
    const legacy = { schemaVersion: 1, revision: 3, updatedAt: '2026-11-11T10:00:00.000Z',
      features: { contextAssembly: true, crossProjectContext: false, automaticBriefing: false, liveActivity: false } };
    fs.writeFileSync(filePath, JSON.stringify(legacy));
    const bytes = fs.readFileSync(filePath);
    expect(settings.get()).toMatchObject({ revision: 3, features: { activityRecording: true, automaticBriefing: false, liveActivity: false } });
    expect(fs.readFileSync(filePath)).toEqual(bytes);
    await settings.update({ activityRecording: false }, 3);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toMatchObject({ revision: 4, features: { ...legacy.features, activityRecording: false } });
  });

  it('returns fresh defaults without creating files or directories', () => {
    const initial = settings.get();
    expect(initial).toEqual({ schemaVersion: 1, revision: 0, updatedAt: null, features: DEFAULT_FEATURE_FLAGS });
    initial.features.contextAssembly = false;
    expect(settings.isEnabled('contextAssembly')).toBe(true);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('validates keys, values and revision preconditions before touching disk', async () => {
    for (const patch of [
      null, true, [], { nonexistent: false }, { liveActivity: 'false' }, { contextAssembly: { enabled: false } },
      JSON.parse('{"__proto__":false}'), JSON.parse('{"constructor":false}'),
    ]) {
      await expect(settings.update(patch)).rejects.toMatchObject({ code: 'FEATURE_SETTINGS_INVALID_PATCH' });
    }
    await expect(settings.update({ liveActivity: false }, -1)).rejects.toMatchObject({ code: 'FEATURE_SETTINGS_INVALID_PATCH' });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('persists successful edits, increments revision, and rejects stale revisions without changing bytes', async () => {
    const next = await settings.update({ liveActivity: false }, 0);
    expect(next).toMatchObject({ revision: 1, features: { liveActivity: false }, updatedAt: expect.any(String) });
    expect(new FeatureSettingsStore({ filePath }).get()).toEqual(next);
    const bytes = fs.readFileSync(filePath);
    await expect(settings.update({ crossProjectContext: true }, 0)).rejects.toMatchObject({ code: 'FEATURE_SETTINGS_CONFLICT' });
    expect(fs.readFileSync(filePath)).toEqual(bytes);
    expect(await settings.update({ liveActivity: false }, 1)).toEqual(next);
    expect(await settings.update({ crossProjectContext: true }, 1)).toMatchObject({
      revision: 2, features: { liveActivity: false, crossProjectContext: true },
    });
  });

  it('merges concurrent independent patches and permits only one writer for a shared revision', async () => {
    const peer = new FeatureSettingsStore({ filePath });
    await Promise.all([
      settings.update({ contextAssembly: false }),
      peer.update({ automaticBriefing: false }),
    ]);
    expect(settings.get()).toMatchObject({ revision: 2, features: { contextAssembly: false, automaticBriefing: false } });

    const competing = await Promise.allSettled([
      settings.update({ liveActivity: false }, 2),
      peer.update({ crossProjectContext: true }, 2),
    ]);
    expect(competing.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(competing.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'FEATURE_SETTINGS_CONFLICT' } });
    expect(settings.get().revision).toBe(3);
  });

  it.each([
    'not JSON',
    '{"schemaVersion":17,"revision":1,"features":{}}',
    '{"schemaVersion":1,"revision":1,"features":{"contextAssembly":"false"}}',
  ])('preserves malformed or unsupported settings files during reads and updates', async raw => {
    fs.mkdirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, raw);
    expect(() => settings.get()).toThrow(expect.objectContaining({ code: 'FEATURE_SETTINGS_INVALID_STORE' }));
    await expect(settings.update({ liveActivity: false })).rejects.toMatchObject({ code: 'FEATURE_SETTINGS_INVALID_STORE' });
    expect(fs.readFileSync(filePath, 'utf8')).toBe(raw);
    expect(fs.readdirSync(path.dirname(filePath))).toEqual(['feature-settings.json']);
  });

  it('preserves the previous file after a failed replacement and cleans only its own artifacts', async () => {
    const initial = await settings.update({ contextAssembly: false });
    const bytes = fs.readFileSync(filePath);
    const otherTemp = filePath + '.foreign.tmp';
    fs.writeFileSync(otherTemp, 'independent writer fixture');
    vi.mocked(fs.renameSync).mockImplementationOnce(() => { throw new Error('synthetic EPERM'); });
    await expect(settings.update({ liveActivity: false })).rejects.toMatchObject({ code: 'FEATURE_SETTINGS_WRITE_FAILED' });
    expect(fs.readFileSync(filePath)).toEqual(bytes);
    expect(settings.get()).toEqual(initial);
    expect(fs.readdirSync(path.dirname(filePath)).sort()).toEqual(['feature-settings.json', 'feature-settings.json.foreign.tmp']);
  });

  it('times out on an existing lock without stealing or removing it', async () => {
    fs.mkdirSync(path.dirname(filePath));
    const lockPath = filePath + '.lock';
    fs.writeFileSync(lockPath, 'separate owner');
    const old = new Date('2000-01-01T00:00:00.000Z');
    fs.utimesSync(lockPath, old, old);
    const writer = new FeatureSettingsStore({ filePath, lockTimeoutMs: 50 });
    const started = performance.now();
    await expect(writer.update({ liveActivity: false })).rejects.toMatchObject({ code: 'FEATURE_SETTINGS_LOCK_TIMEOUT' });
    expect(performance.now() - started).toBeLessThan(3_000);
    expect(fs.readFileSync(lockPath, 'utf8')).toBe('separate owner');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
