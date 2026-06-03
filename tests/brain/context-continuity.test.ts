import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { analyzeMemoryQuality, generateContextResumePack } from '../../src/brain/context-continuity.js';
import { GlobalEntry } from '../../src/types.js';

function entry(partial: Partial<GlobalEntry>): GlobalEntry {
  const now = new Date('2026-06-02T12:00:00.000Z');
  return {
    id: partial.id ?? 'mem-1',
    projectId: partial.projectId ?? 'project-1',
    projectName: partial.projectName ?? 'Project',
    agentTool: partial.agentTool ?? 'codex',
    category: partial.category ?? 'project.learning',
    content: partial.content ?? 'Use source-backed memory for durable project decisions.',
    importance: partial.importance ?? 0.8,
    accessCount: partial.accessCount ?? 0,
    createdAt: partial.createdAt ?? now,
    lastAccessed: partial.lastAccessed ?? now,
    metadata: partial.metadata ?? {},
  };
}

describe('context continuity resume pack', () => {
  it('scores source-backed memories and flags stale duplicate entries', () => {
    const now = new Date('2026-06-02T12:00:00.000Z');
    const old = new Date('2025-01-01T12:00:00.000Z');
    const entries = [
      entry({
        id: 'a',
        category: 'ww2br.gate2.blocker',
        content: '[seed:same] Gate 2 requires visual proof before promotion.',
        metadata: { seedId: 'same', sources: ['DEV_PROGRESS.md'], tags: ['ww2br', 'gate2'] },
      }),
      entry({
        id: 'b',
        category: 'ww2br.gate2.blocker',
        content: '[seed:same] Gate 2 requires visual proof before promotion.',
        createdAt: old,
        lastAccessed: old,
        metadata: { seedId: 'same', tags: ['ww2br'] },
      }),
    ];

    const report = analyzeMemoryQuality(entries, now);

    expect(report.totalEntries).toBe(2);
    expect(report.sourceBacked).toBe(1);
    expect(report.stale).toBe(1);
    expect(report.duplicates).toHaveLength(1);
    expect(report.warnings.join(' ')).toContain('older than 30 days');
  });

  it('generates a compact markdown pack from visible docs and current memories', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-brain-pack-'));
    fs.writeFileSync(path.join(dir, 'DEV_PROGRESS.md'), 'Current gate: verify operator proof.\nNext: render visual evidence.\n', 'utf-8');
    const entries = [
      entry({
        id: 'proof',
        category: 'ww2br.verification.visual',
        content: 'No gate is done from code inspection alone; visual proof is required.',
        metadata: { sources: ['DEV_VERIFICATION_LOG.md'], tags: ['visual-proof'] },
      }),
    ];

    const pack = generateContextResumePack({
      projectDir: dir,
      projectId: 'project-1',
      projectName: 'WW2BR',
      entries,
      now: new Date('2026-06-02T12:00:00.000Z'),
    });

    expect(pack.disclaimer).toContain('does not read or infer hidden model context');
    expect(pack.sourceDocs).toHaveLength(1);
    expect(pack.topMemories[0].sources).toContain('DEV_VERIFICATION_LOG.md');
    expect(pack.markdown).toContain('Context Continuity Resume Pack');
    expect(pack.markdown).toContain('verify operator proof');
  });
});
