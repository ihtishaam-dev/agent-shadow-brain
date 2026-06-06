// tests/brain/global-recall-confidence.test.ts — v6.3.0 confidence scoring
//
// Verifies recallScored() attaches a sane RecallConfidence to each hit and
// ranks results by blended confidence. Uses an isolated tmp HOME so it never
// touches a developer's real ~/.shadow-brain store.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { GlobalBrain } from '../../src/brain/global-brain.js';

let dbPath: string;
let brain: GlobalBrain;

beforeEach(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-confidence-'));
  dbPath = path.join(dir, 'global.json');
  // Reset the singleton so each test gets a fresh, isolated store.
  await (GlobalBrain as any).getInstance({ dbPath, syncIntervalMs: 999999 }).shutdown?.().catch?.(() => {});
  brain = GlobalBrain.getInstance({ dbPath, syncIntervalMs: 999999 });
  await brain.init();
});

afterEach(async () => {
  await brain.shutdown();
});

describe('GlobalBrain.recallScored — memory recall confidence', () => {
  it('attaches a confidence score, level, and signals to each hit', () => {
    const projectId = GlobalBrain.projectIdFor('/tmp/projA');
    brain.writeSync({
      projectId,
      projectName: 'projA',
      agentTool: 'claude-code',
      category: 'lesson',
      content: 'Always validate webhook signatures before processing payloads',
      importance: 0.9,
      metadata: {},
    });

    const out = brain.recallScored({ keywords: ['webhook', 'signatures'] });
    expect(out.length).toBeGreaterThan(0);
    const top = out[0];
    expect(top.confidence).toBeDefined();
    expect(top.confidence.score).toBeGreaterThanOrEqual(0);
    expect(top.confidence.score).toBeLessThanOrEqual(1);
    expect(['high', 'medium', 'low']).toContain(top.confidence.level);
    // All five signals present and normalized.
    for (const v of Object.values(top.confidence.signals)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('ranks higher-importance memories above low-importance ones', () => {
    const projectId = GlobalBrain.projectIdFor('/tmp/projB');
    brain.writeSync({
      projectId, projectName: 'projB', agentTool: 'cursor', category: 'auth',
      content: 'auth flow uses short-lived tokens', importance: 0.95, metadata: {},
    });
    brain.writeSync({
      projectId, projectName: 'projB', agentTool: 'cursor', category: 'auth',
      content: 'auth flow note minor detail', importance: 0.1, metadata: {},
    });

    const out = brain.recallScored({ keywords: ['auth', 'flow'] });
    expect(out.length).toBe(2);
    expect(out[0].confidence.score).toBeGreaterThanOrEqual(out[1].confidence.score);
    expect(out[0].importance).toBeGreaterThan(out[1].importance);
  });

  it('rewards cross-agent corroboration within a category', () => {
    const projectId = GlobalBrain.projectIdFor('/tmp/projC');
    // Same category written by three distinct agents → high corroboration.
    brain.writeSync({ projectId, projectName: 'projC', agentTool: 'claude-code', category: 'deploy', content: 'deploy uses blue-green', importance: 0.5, metadata: {} });
    brain.writeSync({ projectId, projectName: 'projC', agentTool: 'cursor', category: 'deploy', content: 'deploy verified blue-green', importance: 0.5, metadata: {} });
    brain.writeSync({ projectId, projectName: 'projC', agentTool: 'codex', category: 'deploy', content: 'deploy confirmed blue-green', importance: 0.5, metadata: {} });
    // A lone category written by a single agent → no corroboration.
    brain.writeSync({ projectId, projectName: 'projC', agentTool: 'cline', category: 'solo', content: 'solo deploy idea blue-green', importance: 0.5, metadata: {} });

    const out = brain.recallScored({ keywords: ['deploy', 'blue-green'] });
    const corroborated = out.find(e => e.category === 'deploy');
    const lone = out.find(e => e.category === 'solo');
    expect(corroborated).toBeDefined();
    expect(lone).toBeDefined();
    expect(corroborated!.confidence.signals.corroboration).toBeGreaterThan(lone!.confidence.signals.corroboration);
  });

  it('filters out results below minConfidence', () => {
    const projectId = GlobalBrain.projectIdFor('/tmp/projD');
    brain.writeSync({
      projectId, projectName: 'projD', agentTool: 'cursor', category: 'misc',
      content: 'trivial throwaway note about config', importance: 0.05, metadata: {},
    });
    const unfiltered = brain.recallScored({ keywords: ['config'] });
    const filtered = brain.recallScored({ keywords: ['config'], minConfidence: 0.99 });
    expect(unfiltered.length).toBeGreaterThanOrEqual(filtered.length);
    for (const e of filtered) expect(e.confidence.score).toBeGreaterThanOrEqual(0.99);
  });
});
