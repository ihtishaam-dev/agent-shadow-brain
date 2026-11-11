import type { GlobalBrain } from './global-brain.js';
import type { FeatureSettingsStore } from './feature-settings.js';
import { activityJournalFor, type ActivityJournal } from './activity-journal.js';

/** Explicit host reports remain labelled reported; callers cannot forge measured events. */
export async function reportAgentActivity(brain: Pick<GlobalBrain, 'dbPath'>, settings: FeatureSettingsStore, input: unknown, journal?: ActivityJournal) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Send an activity object.');
  const allowed = ['kind', 'projectId', 'sessionId', 'agent', 'phase', 'tool', 'correlationId', 'outcome', 'durationMs'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new TypeError('Only activity labels, phases, and timing fields are accepted.');
  const data = input as Record<string, unknown>;
  if (['projectId', 'sessionId', 'agent'].some(key => typeof data[key] !== 'string' || !data[key])) throw new TypeError('projectId, sessionId, and agent are required.');
  if (!settings.get().features.activityRecording) return { recorded: false, reason: 'Activity recording is disabled.' };
  const event = await (journal ?? activityJournalFor(brain)).append({ ...data, source: 'reported', transport: 'host' });
  return { recorded: true, event };
}
