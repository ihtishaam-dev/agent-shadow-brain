import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GlobalEntry } from '../../src/types.js';
import {
  analyzeLiveBrainSnapshot,
  buildTrainingJsonl,
  evaluateRecallSnapshot,
  formatLiveBrainBriefing,
  scoreLiveMemory,
} from '../../src/brain/live-brain.js';

function memory(partial: Partial<GlobalEntry>): GlobalEntry {
  const now = new Date('2026-06-03T12:00:00.000Z');
  return {
    id: partial.id ?? 'mem-1',
    projectId: partial.projectId ?? 'project-1',
    projectName: partial.projectName ?? 'Agent Shadow Brain',
    agentTool: partial.agentTool ?? 'codex',
    category: partial.category ?? 'project.lesson',
    content: partial.content ?? 'Record compact source-backed lessons after verified complex work.',
    vector: partial.vector,
    importance: partial.importance ?? 0.8,
    accessCount: partial.accessCount ?? 0,
    createdAt: partial.createdAt ?? now,
    lastAccessed: partial.lastAccessed ?? now,
    metadata: partial.metadata ?? { sources: ['README.md'], tags: ['memory'] },
  };
}

describe('live brain v6.0.3', () => {
  it('scores source-backed memories higher than stale source-light memories', () => {
    const now = new Date('2026-06-03T12:00:00.000Z');
    const good = memory({
      content: 'Before implementation, generate a resume pack and read the source-backed blockers.',
      metadata: { sources: ['AGENTS.md'], tags: ['resume', 'blocker'] },
      accessCount: 3,
    });
    const stale = memory({
      id: 'stale',
      content: 'Old unsourced note.',
      createdAt: new Date('2025-01-01T12:00:00.000Z'),
      lastAccessed: new Date('2025-01-01T12:00:00.000Z'),
      metadata: {},
    });

    expect(scoreLiveMemory(good, now)).toBeGreaterThan(scoreLiveMemory(stale, now));
  });

  it('builds a live report with hygiene actions and an agent briefing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-live-brain-'));
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'Always read project memory before implementation.\n', 'utf-8');
    const now = new Date('2026-06-03T12:00:00.000Z');
    const entries = [
      memory({
        id: 'blocker',
        category: 'project.blocker',
        content: 'Current blocker: agents must verify source files before editing.',
        metadata: { sources: ['AGENTS.md'], tags: ['blocker', 'source-backed'] },
      }),
      memory({
        id: 'unsourced',
        category: 'project.lesson',
        content: 'Repeated memory without source should be cleaned up.',
        metadata: {},
      }),
    ];

    const report = analyzeLiveBrainSnapshot({
      projectDir: dir,
      projectName: 'Shadow Brain',
      projectId: 'project-1',
      entries,
      now,
    });

    expect(report.memoryQuality.totalEntries).toBe(2);
    expect(report.agentBriefing).toContain('Shadow Brain Live Agent Briefing');
    expect(report.agentBriefing).toContain('Treat visible project files as source of truth');
    expect(report.topMemories[0].sources).toContain('AGENTS.md');
  });

  it('evaluates recall and exports parseable training jsonl', () => {
    const entries = [
      memory({
        id: 'resume',
        category: 'project.resume',
        content: 'Generate a resume pack before a fresh agent session.',
        metadata: { sources: ['README.md'], tags: ['resume'] },
      }),
    ];

    const evalReport = evaluateRecallSnapshot(entries, ['resume pack agent session']);
    expect(evalReport.cases[0].hitCount).toBe(1);
    expect(evalReport.sourceBackedHitRate).toBe(1);

    const jsonl = buildTrainingJsonl(entries, {}, new Date('2026-06-03T12:00:00.000Z'));
    const parsed = JSON.parse(jsonl);
    expect(parsed.messages[0].role).toBe('system');
    expect(parsed.metadata.memoryId).toBe('resume');
  });
});

