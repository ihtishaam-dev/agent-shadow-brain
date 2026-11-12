import { Command } from 'commander';
import * as path from 'node:path';
import { getGlobalBrain, GlobalBrain } from './brain/global-brain.js';
import { assembleContext } from './brain/context-assembly.js';
import { FeatureSettingsStore, FEATURE_DEFINITIONS } from './brain/feature-settings.js';
import { memoryAnnotationsFor } from './brain/memory-annotations.js';
import { parseContextRequest } from './brain/context-request.js';
import { inspectMemoryHealth } from './brain/memory-inspection.js';
import { ProjectFeedbackStore } from './brain/project-feedback.js';
import { requireProjectStore } from './brain/project-memory.js';

export function registerContextCommands(program: Command): void {
  program.command('context-pack').description('Build a bounded, explained project context pack without model calls')
    .argument('[query]', 'Current task or search terms', '')
    .option('--project <directory>', 'Project directory', process.cwd())
    .option('--project-id <id>', 'Use an existing memory project ID directly')
    .option('--db <path>', 'Explicit memory-store path')
    .option('--settings <path>', 'Explicit feature-settings file')
    .option('--token-budget <number>', 'Approximate token budget, including the rendered context', '2000')
    .option('--cross-project', 'Request broader context when the feature is enabled')
    .option('--profile <name>', 'Retrieval profile: legacy or adaptive', 'legacy')
    .option('--no-related', 'Disable recorded one-hop expansion in adaptive retrieval')
    .option('--json', 'Print entries, exclusions, reasons, and budget as JSON')
    .action(async (query: string, opts) => {
      const tokenBudget = Number(opts.tokenBudget);
      if (!Number.isSafeInteger(tokenBudget) || tokenBudget < 0 || tokenBudget > 12000) throw new TypeError('Token budget must be an integer from 0 to 12000.');
      const request = parseContextRequest({ projectId: opts.projectId ?? GlobalBrain.projectIdFor(path.resolve(opts.project)),
        query, tokenBudget, includeCrossProject: !!opts.crossProject, profile: opts.profile, expandRelated: opts.related });
      const brain = getGlobalBrain(opts.db ? { dbPath: path.resolve(opts.db) } : undefined);
      const local = opts.db && path.resolve(opts.db) === path.resolve(opts.project, '.shadow-brain/project-memory.json');
      if (local) {
        const pinned = requireProjectStore(opts.project, brain);
        if (request.projectId !== pinned.projectId || request.includeCrossProject) throw new TypeError('This memory store is pinned to its local project.');
      }
      const settings = new FeatureSettingsStore({ filePath: opts.settings ?? (opts.db ? path.join(path.dirname(path.resolve(opts.db)), 'feature-settings.json') : undefined) });
      const features = settings.get().features;
      try {
        if (features.contextAssembly) brain.refresh();
        const pack = assembleContext(brain, {
          ...request, features,
          feedback: features.contextAssembly && local && request.profile === 'adaptive' ? new ProjectFeedbackStore(opts.project, brain).get() : undefined,
          annotations: features.contextAssembly ? memoryAnnotationsFor(brain).get() : undefined,
        });
        if (opts.json) console.log(JSON.stringify(pack, null, 2));
        else {
          console.log(pack.markdown || (pack.enabled ? 'No matching context fits this request and budget.' : 'Context packs are disabled in feature settings.'));
          for (const warning of pack.warnings) console.log(`Note: ${warning}`);
        }
      } finally { await brain.shutdown(); }
    });

  program.command('memory-health').description('Inspect scoped source, review, duplication, age, and relationship attention hints without model calls')
    .option('--project <directory>', 'Project directory', process.cwd())
    .option('--project-id <id>', 'Use an existing memory project ID directly')
    .option('--db <path>', 'Explicit memory-store path')
    .option('--limit <number>', 'Maximum attention items, 1 to 100', '30')
    .action(async opts => {
      const brain = getGlobalBrain(opts.db ? { dbPath: path.resolve(opts.db) } : undefined);
      try {
        if (opts.db && path.resolve(opts.db) === path.resolve(opts.project, '.shadow-brain/project-memory.json')) {
          const pinned = requireProjectStore(opts.project, brain);
          if (opts.projectId && opts.projectId !== pinned.projectId) throw new TypeError('This memory store is pinned to its local project.');
        }
        brain.refresh();
        console.log(JSON.stringify(inspectMemoryHealth(brain, memoryAnnotationsFor(brain).get(), {
          projectId: opts.projectId ?? GlobalBrain.projectIdFor(path.resolve(opts.project)), limit: Number(opts.limit),
        }), null, 2));
      } finally { await brain.shutdown(); }
    });

  const features = new Command('features').description('Inspect or change the dedicated runtime feature controls');
  features.command('list').option('--settings <path>', 'Explicit feature-settings file').action((opts) => {
    console.log(JSON.stringify({ ...new FeatureSettingsStore({ filePath: opts.settings }).get(), definitions: FEATURE_DEFINITIONS }, null, 2));
  });
  features.command('set').argument('<name>', 'Feature ID from features list').argument('<state>', 'on or off')
    .option('--settings <path>', 'Explicit feature-settings file').action(async (name: string, state: string, opts) => {
      if (!['on', 'off'].includes(state)) throw new TypeError('Choose on or off.');
      console.log(JSON.stringify(await new FeatureSettingsStore({ filePath: opts.settings }).update({ [name]: state === 'on' }), null, 2));
    });
  program.addCommand(features);
}
