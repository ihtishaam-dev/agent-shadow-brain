import * as path from 'node:path';
import { Command } from 'commander';
import { getGlobalBrain, type GlobalBrain } from './brain/global-brain.js';
import {
  MemoryAnnotationsError, MemoryAnnotationsStore, memoryAnnotationsFor, memoryState,
  type MemoryAnnotationEvent,
} from './brain/memory-annotations.js';
import { normalizeMemorySources } from './brain/memory-sources.js';

interface CurationOptions {
  projectId: string;
  db?: string;
  annotations?: string;
  revision?: string;
  note?: string;
}

function scoped(command: Command): Command {
  return command
    .requiredOption('--project-id <id>', 'Existing memory project ID')
    .option('--db <path>', 'Explicit memory-store path')
    .option('--annotations <path>', 'Explicit annotation-store path');
}

function change(command: Command): Command {
  return scoped(command).option('--revision <number>', 'Require this annotation revision before writing');
}

function expectedRevision(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new TypeError('Annotation revision must be a nonnegative integer.');
  }
  return Number(value);
}

function requireScope(projectId: string): void {
  if (!projectId.trim() || projectId !== projectId.trim()) throw new TypeError('Provide a nonempty project ID.');
}

async function runCuration(
  opts: CurationOptions,
  perform: (brain: GlobalBrain, store: MemoryAnnotationsStore) => unknown | Promise<unknown>,
): Promise<void> {
  requireScope(opts.projectId);
  const brain = getGlobalBrain(opts.db ? { dbPath: path.resolve(opts.db) } : undefined);
  try {
    await brain.init();
    const store = opts.annotations
      ? new MemoryAnnotationsStore({ filePath: opts.annotations, resolveMemory: id => brain.getEntry(id) })
      : memoryAnnotationsFor(brain);
    console.log(JSON.stringify(await perform(brain, store), null, 2));
  } finally {
    await brain.shutdown();
  }
}

function isMemoryEvent(event: MemoryAnnotationEvent, projectId: string, memoryId: string): boolean {
  if (event.projectId !== projectId) return false;
  return event.command.kind === 'review'
    ? event.command.memoryId === memoryId
    : event.relation?.fromId === memoryId || event.relation?.toId === memoryId;
}

/** Register project-scoped curation commands without initializing local services. */
export function registerCurationCommands(program: Command): void {
  const curate = new Command('curate').description('Review stored memories and record explicit project relations');
  scoped(curate.command('show').description('Inspect one memory, its sources, and its review history'))
    .argument('<memory-id>')
    .action((id: string, opts: CurationOptions) => runCuration(opts, (brain, store) => {
      const memory = brain.getEntry(id);
      if (!memory || memory.projectId !== opts.projectId) {
        throw new MemoryAnnotationsError('ANNOTATIONS_NOT_FOUND', 'Memory was not found in the selected project.');
      }
      const { projectId, projectName, agentTool, category, content, createdAt, metadata } = memory;
      const snapshot = store.get();
      const review = snapshot.reviews[id];
      const links = snapshot.links.filter(link => link.projectId === projectId && (link.fromId === id || link.toId === id))
        .map(link => {
          const otherId = link.fromId === id ? link.toId : link.fromId;
          return { ...link, otherId, otherAvailable: brain.getEntry(otherId)?.projectId === projectId };
        });
      return {
        id, projectId, projectName, agentTool, category, content, createdAt,
        sources: normalizeMemorySources(metadata),
        state: memoryState(snapshot, projectId, id),
        review: review?.projectId === projectId ? review : null,
        links,
        history: snapshot.history.filter(event => isMemoryEvent(event, projectId, id)),
        revision: snapshot.revision,
      };
    }));

  change(curate.command('review').description('Set a manual review state for a memory'))
    .argument('<memory-id>')
    .argument('<state>', 'active, archived, or contested')
    .option('--note <text>', 'Optional review note')
    .action((memoryId: string, state: string, opts: CurationOptions) => {
      const revision = expectedRevision(opts.revision);
      return runCuration(opts, async (_brain, store) => {
        const snapshot = await store.update({ kind: 'review', projectId: opts.projectId, memoryId, state, note: opts.note }, revision);
        return {
          memoryId, projectId: opts.projectId, revision: snapshot.revision, updatedAt: snapshot.updatedAt,
          state: memoryState(snapshot, opts.projectId, memoryId), review: snapshot.reviews[memoryId],
        };
      });
    });

  change(curate.command('link').description('Record a relation between memories in one project'))
    .argument('<from-id>')
    .argument('<to-id>')
    .argument('<type>', 'related, supports, contradicts, or supersedes')
    .option('--note <text>', 'Optional relation note')
    .action((fromId: string, toId: string, type: string, opts: CurationOptions) => {
      const revision = expectedRevision(opts.revision);
      return runCuration(opts, async (_brain, store) => {
        const snapshot = await store.update({ kind: 'link', projectId: opts.projectId, fromId, toId, type, note: opts.note }, revision);
        return { projectId: opts.projectId, revision: snapshot.revision, updatedAt: snapshot.updatedAt,
          link: snapshot.history[snapshot.history.length - 1].relation };
      });
    });

  change(curate.command('unlink').description('Remove an explicit relation and retain its audit event'))
    .argument('<link-id>')
    .action((linkId: string, opts: CurationOptions) => {
      const revision = expectedRevision(opts.revision);
      return runCuration(opts, async (_brain, store) => {
        const before = store.get();
        const link = before.links.find(item => item.id === linkId && item.projectId === opts.projectId);
        if (!link) throw new MemoryAnnotationsError('ANNOTATIONS_NOT_FOUND', 'Memory relation was not found in the selected project.');
        const snapshot = await store.update({ kind: 'unlink', linkId }, revision ?? before.revision);
        return { projectId: opts.projectId, revision: snapshot.revision, updatedAt: snapshot.updatedAt, linkId };
      });
    });
  program.addCommand(curate);
}
