import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCurationCommands } from '../../src/curation-cli.js';
import { getGlobalBrain } from '../../src/brain/global-brain.js';

let dir: string;
let dbPath: string;
let old: string;
let replacement: string;
let foreign: string;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-curation-cli-'));
  dbPath = path.join(dir, 'global.json');
  const brain = getGlobalBrain({ dbPath });
  await brain.init();
  const seed = {
    projectId: 'project-a', projectName: 'Alpha fixture', agentTool: 'codex',
    category: 'lesson', content: 'Parser curation fixture.', importance: 0.5, metadata: { sourceFile: 'docs/parser.md' },
  } as const;
  old = brain.writeSync(seed);
  replacement = brain.writeSync({ ...seed, content: 'Replacement fixture.' });
  foreign = brain.writeSync({ ...seed, projectId: 'project-b', content: 'Separate project fixture.' });
  await brain.shutdown();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function run(args: string[], projectId: string | null = 'project-a') {
  const program = new Command().exitOverride().configureOutput({ writeErr: () => {} });
  registerCurationCommands(program);
  for (const command of program.commands[0].commands) command.exitOverride().configureOutput({ writeErr: () => {} });
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const scope = projectId === null ? [] : ['--project-id', projectId];
    await program.parseAsync(['curate', ...args, ...scope, '--db', dbPath], { from: 'user' });
    expect(log).toHaveBeenCalledTimes(1);
    return JSON.parse(log.mock.calls[0][0]);
  } finally {
    log.mockRestore();
  }
}

describe('project-scoped curation CLI', () => {
  it('shows normalized references and requires an explicit matching project', async () => {
    expect(await run(['show', old])).toMatchObject({
      id: old, projectId: 'project-a', state: 'active', sources: ['docs/parser.md'], review: null, links: [], history: [], revision: 0,
    });
    await expect(run(['show', old], null)).rejects.toMatchObject({ code: 'commander.missingMandatoryOptionValue' });
    await expect(run(['show', foreign])).rejects.toMatchObject({ code: 'ANNOTATIONS_NOT_FOUND' });
    expect(fs.readdirSync(dir)).toEqual(['global.json']);
  });

  it('persists review, link, and unlink with scoped history and preserves raw memory bytes', async () => {
    const raw = fs.readFileSync(dbPath);
    await run(['review', foreign, 'contested', '--note', 'Separate note'], 'project-b');
    const reviewed = await run(['review', old, 'contested', '--note', 'Check the parser test.', '--revision', '1']);
    expect(reviewed).toMatchObject({ memoryId: old, revision: 2, state: 'contested', review: { note: 'Check the parser test.' } });
    expect(JSON.stringify(reviewed)).not.toContain('Separate note');
    const linked = await run(['link', replacement, old, 'supersedes', '--revision', '2']);
    expect(linked.link).toMatchObject({ fromId: replacement, toId: old, type: 'supersedes' });

    const show = await run(['show', old]);
    expect(show).toMatchObject({
      state: 'superseded', revision: 3,
      links: [{ id: linked.link.id, otherId: replacement, otherAvailable: true }],
    });
    expect(show.history).toHaveLength(2);
    expect(JSON.stringify(show)).not.toContain(foreign);
    await expect(run(['unlink', linked.link.id], 'project-b')).rejects.toMatchObject({ code: 'ANNOTATIONS_NOT_FOUND' });
    await expect(run(['unlink', linked.link.id, '--revision', '2'])).rejects.toMatchObject({ code: 'ANNOTATIONS_CONFLICT' });
    expect(await run(['unlink', linked.link.id])).toMatchObject({ linkId: linked.link.id, revision: 4 });
    expect(await run(['show', old])).toMatchObject({
      state: 'contested', links: [], history: expect.arrayContaining([
        expect.objectContaining({ command: { kind: 'unlink', linkId: linked.link.id } }),
      ]),
    });
    expect(fs.readFileSync(dbPath)).toEqual(raw);
    expect(fs.existsSync(path.join(dir, 'memory-annotations.json'))).toBe(true);
  });

  it('allows a separate annotation file and rejects invalid revision or cross-project relation', async () => {
    const annotations = path.join(dir, 'separate', 'annotations.json');
    await expect(run(['review', old, 'archived', '--annotations', annotations, '--revision', '1.5']))
      .rejects.toThrow(/nonnegative integer/);
    await expect(run(['link', old, foreign, 'related', '--annotations', annotations]))
      .rejects.toMatchObject({ code: 'ANNOTATIONS_NOT_FOUND' });
    expect(fs.existsSync(annotations)).toBe(false);
    const result = await run(['review', old, 'archived', '--annotations', annotations]);
    expect(result.state).toBe('archived');
    expect(fs.existsSync(annotations)).toBe(true);
    expect((await run(['show', old])).state).toBe('active');
    expect((await run(['show', old, '--annotations', annotations])).state).toBe('archived');
  });
});
