import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { activityJournalFor } from './brain/activity-journal.js';
import { reportAgentActivity } from './brain/activity-reporting.js';
import { FEATURE_SETTINGS_FILENAME, FeatureSettingsStore } from './brain/feature-settings.js';

interface StoreOptions {
  db?: string;
  settings?: string;
}

interface ReportOptions extends StoreOptions {
  projectId: string;
  session: string;
  agent: string;
  phase?: string;
  tool?: string;
  correlation?: string;
  outcome?: string;
  durationMs?: string;
}

interface TailOptions extends StoreOptions {
  projectId?: string;
  cursor?: string;
  journalId?: string;
}

function stores(opts: StoreOptions) {
  const dbPath = path.resolve(opts.db ?? path.join(os.homedir(), '.shadow-brain', 'global.json'));
  const settings = new FeatureSettingsStore({
    filePath: opts.settings ?? (opts.db ? path.join(path.dirname(dbPath), FEATURE_SETTINGS_FILENAME) : undefined),
  });
  return { brain: { dbPath }, settings };
}

function storeOptions(command: Command): Command {
  return command.option('--db <path>', 'Use the activity journal adjacent to this memory store')
    .option('--settings <path>', 'Explicit feature-settings file');
}

function cursorNumber(input: string | undefined): number | undefined {
  if (input === undefined) return undefined;
  if (!/^\d+$/.test(input) || !Number.isSafeInteger(Number(input))) {
    throw new TypeError('Activity cursor must be a nonnegative integer.');
  }
  return Number(input);
}

function durationNumber(input: string | undefined): number | undefined {
  if (input === undefined) return undefined;
  const value = Number(input);
  if (!/^\d+(?:\.\d+)?$/.test(input) || !Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) {
    throw new TypeError('Activity duration must be a nonnegative number of milliseconds.');
  }
  return value;
}

export function registerActivityCommands(program: Command): void {
  const activity = new Command('activity').description('Report or read bounded local activity metadata');
  storeOptions(activity.command('report').description('Record an explicitly reported session, phase, or tool event'))
    .argument('<kind>', 'session-start, phase, tool-start, tool-end, or session-end')
    .requiredOption('--project-id <id>', 'Project label')
    .requiredOption('--session <id>', 'Host session label')
    .requiredOption('--agent <id>', 'Agent label')
    .option('--phase <phase>', 'understand, plan, work, or verify')
    .option('--tool <name>', 'Tool label')
    .option('--correlation <id>', 'Shared ID for the tool start and end')
    .option('--outcome <outcome>', 'success, error, or cancelled')
    .option('--duration-ms <number>', 'Host-reported tool duration in milliseconds')
    .action(async (kind: string, opts: ReportOptions) => {
      const durationMs = durationNumber(opts.durationMs);
      const { brain, settings } = stores(opts);
      const result = await reportAgentActivity(brain, settings, {
        kind, projectId: opts.projectId, sessionId: opts.session, agent: opts.agent,
        phase: opts.phase, tool: opts.tool, correlationId: opts.correlation, outcome: opts.outcome, durationMs,
      });
      console.log(JSON.stringify(result, null, 2));
    });

  storeOptions(activity.command('tail').description('Read a page of recent activity or continue from a cursor'))
    .option('--project-id <id>', 'Filter by recorded project label')
    .option('--cursor <number>', 'Continue after this event sequence')
    .option('--journal-id <id>', 'Journal ID paired with a previous cursor')
    .action((opts: TailOptions) => {
      const { brain, settings } = stores(opts);
      const flags = settings.get().features;
      const enabled = { liveEnabled: flags.liveActivity, recordingEnabled: flags.activityRecording };
      if (!flags.liveActivity) {
        console.log(JSON.stringify({
          ...enabled, events: [], journalId: null, revision: 0, oldestSequence: null, latestSequence: 0,
          nextAfterSequence: 0, cursor: 0, hasMore: false, gap: false, reset: false, retainedCount: 0, droppedCount: 0,
        }, null, 2));
        return;
      }
      const page = activityJournalFor(brain).read({
        projectId: opts.projectId, afterSequence: cursorNumber(opts.cursor), journalId: opts.journalId, limit: 200,
      });
      console.log(JSON.stringify({ ...enabled, ...page, cursor: page.nextAfterSequence }, null, 2));
    });
  program.addCommand(activity);
}
