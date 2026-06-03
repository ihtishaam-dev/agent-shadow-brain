import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GlobalBrain, getGlobalBrain } from '../../src/brain/global-brain.js';
import { MemorySeeder, resetMemorySeeder } from '../../src/brain/memory-seeder.js';

let tmpDir = '';
let brain: GlobalBrain;
let seeder: MemorySeeder;

describe('memory seeder', () => {
  beforeEach(async () => {
    resetMemorySeeder();
    await getGlobalBrain().shutdown();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-memory-seeder-'));
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Seed fixture\n', 'utf-8');
    brain = getGlobalBrain({
      dbPath: path.join(tmpDir, 'global.json'),
      syncIntervalMs: 60_000,
    });
    seeder = new MemorySeeder({
      storePath: path.join(tmpDir, 'seed-drafts.json'),
      brain,
    });
  });

  afterEach(async () => {
    await brain.shutdown();
    resetMemorySeeder();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a source-backed draft without writing memory immediately', async () => {
    const draft = await seeder.createDraft({
      projectDir: tmpDir,
      topic: 'Verified memory seeding',
      objective: 'Agents can prepare source-backed drafts before approval.',
      researchAgent: 'codex',
      approverAgent: 'user',
      approvalMode: 'user',
      sources: ['README.md'],
      tags: ['seeding', 'approval'],
    });

    expect(draft.status).toBe('draft');
    expect(draft.sources).toContain('README.md');
    expect(draft.requiredApprovals).toEqual(['user']);
    expect(seeder.list()).toHaveLength(1);
    expect(brain.recall({ projectId: draft.projectId, keywords: ['Verified'], limit: 10 })).toHaveLength(0);
  });

  it('requires dual approval before seeding into the global brain', async () => {
    const draft = await seeder.createDraft({
      projectDir: tmpDir,
      topic: 'Enterprise memory approval',
      objective: 'Require user and agent approval before committing research to memory.',
      researchAgent: 'codex',
      approverAgent: 'cursor',
      approvalMode: 'dual',
      sources: ['README.md'],
      content: 'Dual approval prevents unverified research from becoming durable memory.',
    });

    const userApproved = await seeder.approve(draft.id, 'user');
    expect(userApproved.status).toBe('draft');
    expect(userApproved.approvals.map(a => a.by)).toContain('user');

    const fullyApproved = await seeder.approve(draft.id, 'cursor');
    expect(fullyApproved.status).toBe('approved');

    const seeded = await seeder.seed(draft.id, 'user');
    expect(seeded.status).toBe('seeded');
    expect(seeded.seededMemoryId).toBeTruthy();

    const stored = brain.recall({ projectId: draft.projectId, keywords: ['approval'], limit: 10 });
    expect(stored.some(entry => entry.metadata.seedDraftId === draft.id)).toBe(true);
  });
});
