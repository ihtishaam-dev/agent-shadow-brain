import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { AgentTool, SubconsciousBriefing, SubconsciousConfig, SubconsciousStats } from '../types.js';
import { assembleContext, contextQueryKeywords, type ContextPackEntry } from './context-assembly.js';
import { FEATURE_SETTINGS_FILENAME, FeatureSettingsStore } from './feature-settings.js';
import { getGlobalBrain, GlobalBrain } from './global-brain.js';
import { L0Cache } from './l0-cache.js';
import { memoryAnnotationsFor, type MemoryAnnotationsStore } from './memory-annotations.js';

const DEFAULT_CONFIG: SubconsciousConfig = {
  enabled: true,
  tokenBudget: 2000,
  lookbackHours: 24,
  relevanceThreshold: 0.3,
  alwaysInclude: ['decision', 'pattern', 'warning'],
  enabledAgents: [],
};

interface BriefingOptions {
  agentTool: AgentTool;
  projectDir: string;
  projectId?: string;
  projectName?: string;
  currentTask?: string;
  includeCrossProject?: boolean;
}

export class SubconsciousEngine {
  private config: SubconsciousConfig;
  private readonly brain: GlobalBrain;
  private readonly settings: Pick<FeatureSettingsStore, 'get'>;
  private readonly annotations: Pick<MemoryAnnotationsStore, 'get'>;
  private readonly cache = new L0Cache<SubconsciousBriefing>({ bytesLimit: 2 * 1024 * 1024 });
  private readonly stats: SubconsciousStats = {
    totalBriefings: 0,
    avgTokenCount: 0,
    avgGenerationMs: 0,
    acceptedRate: 1,
    byAgent: {},
    lastBriefing: null,
  };

  constructor(
    config: Partial<SubconsciousConfig> = {},
    brain?: GlobalBrain,
    settings?: Pick<FeatureSettingsStore, 'get'>,
    annotations?: Pick<MemoryAnnotationsStore, 'get'>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.brain = brain ?? getGlobalBrain();
    this.settings = settings ?? new FeatureSettingsStore({
      filePath: path.join(path.dirname(this.brain.dbPath), FEATURE_SETTINGS_FILENAME),
    });
    this.annotations = annotations ?? memoryAnnotationsFor(this.brain);
  }

  /** Generate a session-start briefing from the current project and task. */
  async generateBriefing(opts: BriefingOptions): Promise<SubconsciousBriefing> {
    const start = Date.now();
    const briefing = this.emptyBriefing(opts);
    const config = this.getConfig();
    if (!config.enabled) return { ...briefing, disabledReason: 'configuration' };
    if (config.enabledAgents.length && !config.enabledAgents.includes(opts.agentTool)) {
      return { ...briefing, disabledReason: 'agent' };
    }
    const settings = this.settings.get();
    if (!settings.features.automaticBriefing) return { ...briefing, disabledReason: 'automaticBriefing' };
    if (!settings.features.contextAssembly) return { ...briefing, disabledReason: 'contextAssembly' };

    const projectId = opts.projectId ?? GlobalBrain.projectIdFor(opts.projectDir);
    const terms = contextQueryKeywords(opts.currentTask);
    await this.brain.init();
    const annotations = this.annotations.get();
    const key = createHash('sha256').update(JSON.stringify({
      projectDir: opts.projectDir, projectId, agentTool: opts.agentTool, terms, config,
      includeCrossProject: opts.includeCrossProject, settings,
      annotationRevision: annotations.revision,
      lastCommit: this.brain.getStorageHealth().lastSuccessfulSync,
    })).digest('hex');
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.generatedAt.getTime() < 60_000) return structuredClone(cached);

    const context = assembleContext(this.brain, {
      projectId,
      query: opts.currentTask,
      maxEntries: 15,
      tokenBudget: config.tokenBudget,
      minImportance: config.relevanceThreshold,
      lookbackHours: config.lookbackHours,
      alwaysInclude: config.alwaysInclude,
      includeCrossProject: opts.includeCrossProject,
      features: settings.features,
      annotations,
    });
    for (const entry of context.entries) this.addSection(briefing.sections, entry, projectId, opts.agentTool, terms.length > 0);
    briefing.fullText = context.markdown;
    briefing.tokenCount = context.budget.estimatedTokens;

    this.cache.set(key, structuredClone(briefing));
    this.stats.totalBriefings++;
    this.stats.avgTokenCount += (briefing.tokenCount - this.stats.avgTokenCount) / this.stats.totalBriefings;
    this.stats.avgGenerationMs += (Date.now() - start - this.stats.avgGenerationMs) / this.stats.totalBriefings;
    this.stats.byAgent[opts.agentTool] = (this.stats.byAgent[opts.agentTool] ?? 0) + 1;
    this.stats.lastBriefing = new Date();
    return briefing;
  }

  getStats(): SubconsciousStats {
    return { ...this.stats, byAgent: { ...this.stats.byAgent } };
  }

  configure(patch: Partial<SubconsciousConfig>): void {
    this.config = { ...this.config, ...patch };
    this.cache.clear();
  }

  getConfig(): SubconsciousConfig {
    return { ...this.config, alwaysInclude: [...this.config.alwaysInclude], enabledAgents: [...this.config.enabledAgents] };
  }

  private addSection(
    sections: SubconsciousBriefing['sections'],
    entry: ContextPackEntry,
    projectId: string,
    agentTool: AgentTool,
    hasTask: boolean,
  ): void {
    const origin = entry.projectId === projectId ? '' : '[' + (entry.projectName || entry.projectId) + '] ';
    const text = origin + (entry.excerptTruncated ? 'Excerpt: ' : '') + entry.excerpt;
    if (['warning', 'critical', 'security'].includes(entry.category)) sections.warnings.push(text);
    else if (entry.category === 'decision') sections.recentDecisions.push(text);
    else if (entry.category === 'task' || entry.category === 'todo') sections.activeTasks.push(text);
    else if (entry.category === 'state' && !sections.projectState) sections.projectState = text;
    else if (entry.agentTool !== agentTool && !hasTask) sections.crossAgentInsights.push('[' + entry.agentTool + '] ' + text);
    else sections.similarPastWork.push(text);
  }

  private emptyBriefing(opts: BriefingOptions): SubconsciousBriefing {
    return {
      agentTool: opts.agentTool,
      projectDir: opts.projectDir,
      sessionId: randomUUID(),
      generatedAt: new Date(),
      tokenCount: 0,
      sections: {
        recentDecisions: [],
        activeTasks: [],
        similarPastWork: [],
        projectState: '',
        crossAgentInsights: [],
        warnings: [],
      },
      fullText: '',
    };
  }
}

let defaultEngine: SubconsciousEngine | null = null;

export function getSubconscious(config?: Partial<SubconsciousConfig>): SubconsciousEngine {
  if (!defaultEngine) defaultEngine = new SubconsciousEngine(config);
  else if (config) defaultEngine.configure(config);
  return defaultEngine;
}
