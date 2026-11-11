import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerActivityCommands } from '../../src/activity-cli.js';
import { activityJournalFor } from '../../src/brain/activity-journal.js';
import { FeatureSettingsStore } from '../../src/brain/feature-settings.js';

let dir: string;
let dbPath: string;
let settings: FeatureSettingsStore;
const subject = ['--project-id', 'alpha', '--session', 'cli-fixture', '--agent', 'codex'];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-activity-cli-'));
  dbPath = path.join(dir, 'global.json');
  settings = new FeatureSettingsStore({ filePath: path.join(dir, 'feature-settings.json') });
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function run(args: string[]) {
  const program = new Command();
  registerActivityCommands(program);
  for (const subcommand of program.commands[0].commands) subcommand.exitOverride().configureOutput({ writeErr: () => {} });
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await program.parseAsync(['activity', ...args, '--db', dbPath], { from: 'user' });
    expect(log).toHaveBeenCalledTimes(1);
    return JSON.parse(log.mock.calls[0][0]);
  } finally {
    log.mockRestore();
  }
}

describe('activity CLI commands', () => {
  it('reports phases and explicit tool metadata and tails the same journal with a cursor', async () => {
    expect(await run(['tail'])).toMatchObject({ journalId: null, events: [], cursor: 0 });
    expect(fs.readdirSync(dir)).toEqual([]);
    const first = await run(['report', 'phase', ...subject, '--phase', 'work']);
    expect(first).toMatchObject({ recorded: true, event: { source: 'reported', transport: 'host', sequence: 1, phase: 'work' } });
    const cursor = await run(['tail', '--project-id', 'alpha']);
    expect(cursor).toMatchObject({ cursor: 1, events: [{ sequence: 1, phase: 'work' }] });
    const second = await run([
      'report', 'tool-end', ...subject, '--tool', 'fixture-tool', '--correlation', 'call-1',
      '--outcome', 'success', '--duration-ms', '15.5',
    ]);
    expect(second.event).toMatchObject({ sequence: 2, durationMs: 15.5, tool: 'fixture-tool', outcome: 'success' });
    expect(await run(['tail', '--project-id', 'alpha', '--cursor', String(cursor.cursor), '--journal-id', cursor.journalId]))
      .toMatchObject({ cursor: 2, events: [{ sequence: 2, durationMs: 15.5 }] });
    expect(fs.readdirSync(dir)).toEqual(['activity-journal.json']);
  });

  it('rejects invalid duration, missing reporting identity, and invalid cursor', async () => {
    await expect(run(['report', 'phase', '--phase', 'plan'])).rejects.toMatchObject({ code: 'commander.missingMandatoryOptionValue' });
    await expect(run(['report', 'tool-end', ...subject, '--duration-ms', 'nope'])).rejects.toThrow(/nonnegative number/);
    await expect(run(['tail', '--cursor', '1.5'])).rejects.toThrow(/nonnegative integer/);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('honors separate reporting and visibility settings before touching a broken journal', async () => {
    const filePath = activityJournalFor({ dbPath }).filePath;
    const alternate = new FeatureSettingsStore({ filePath: path.join(dir, 'alternate-settings.json') });
    await alternate.update({ activityRecording: false });
    expect(await run(['report', 'phase', ...subject, '--phase', 'verify', '--settings', alternate.filePath]))
      .toMatchObject({ recorded: false });
    expect(fs.existsSync(filePath)).toBe(false);

    await settings.update({ liveActivity: false });
    fs.writeFileSync(filePath, 'synthetic broken journal');
    expect(await run(['tail'])).toMatchObject({ liveEnabled: false, recordingEnabled: true, events: [] });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('synthetic broken journal');
    await settings.update({ liveActivity: true });
    await expect(run(['tail'])).rejects.toMatchObject({ code: 'ACTIVITY_JOURNAL_INVALID_STORE' });
  });
});
