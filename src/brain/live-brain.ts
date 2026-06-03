// src/brain/live-brain.ts - v6.0.3 live memory control layer

import * as fs from 'fs';
import * as path from 'path';
import { AgentTool, GlobalBrainStats, GlobalEntry } from '../types.js';
import {
  analyzeMemoryQuality,
  generateContextResumePack,
  ContextResumePack,
  MemoryQualityReport,
} from './context-continuity.js';
import { GlobalBrain, getGlobalBrain } from './global-brain.js';

export type LiveBrainActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface LiveBrainAction {
  priority: LiveBrainActionPriority;
  title: string;
  reason: string;
  command?: string;
}

export interface LiveBrainRecallEvalCase {
  query: string;
  hitCount: number;
  sourceBackedHits: number;
  topIds: string[];
  topCategories: string[];
  warnings: string[];
}

export interface LiveBrainRecallEval {
  generatedAt: string;
  queryCount: number;
  avgHitCount: number;
  sourceBackedHitRate: number;
  cases: LiveBrainRecallEvalCase[];
}

export interface LiveBrainTrainingPackOptions {
  maxRows?: number;
  includeLowQuality?: boolean;
  systemPrompt?: string;
}

export interface LiveBrainTrainingRow {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  metadata: {
    memoryId: string;
    projectId: string;
    projectName: string;
    agentTool: AgentTool;
    category: string;
    importance: number;
    sources: string[];
    tags: string[];
    qualityScore: number;
  };
}

export interface LiveBrainReport {
  generatedAt: string;
  projectDir: string;
  projectName: string;
  projectId: string;
  projectExists: boolean;
  projectScoped: boolean;
  stats: Partial<GlobalBrainStats>;
  memoryQuality: MemoryQualityReport;
  agentCoverage: Array<{ agent: AgentTool; count: number }>;
  categoryCoverage: Array<{ category: string; count: number }>;
  topMemories: Array<GlobalEntry & { qualityScore: number; sources: string[]; tags: string[] }>;
  staleMemories: Array<GlobalEntry & { qualityScore: number; sources: string[]; tags: string[] }>;
  lowQualityMemories: Array<GlobalEntry & { qualityScore: number; sources: string[]; tags: string[] }>;
  recallEval: LiveBrainRecallEval;
  learningActions: LiveBrainAction[];
  resumePack: ContextResumePack;
  agentBriefing: string;
}

export interface LiveBrainReportOptions {
  projectDir: string;
  projectName?: string;
  maxMemories?: number;
  queries?: string[];
  globalFallback?: boolean;
}

export interface LiveBrainSnapshotOptions {
  projectDir: string;
  projectName: string;
  projectId: string;
  projectScoped?: boolean;
  entries: GlobalEntry[];
  stats?: Partial<GlobalBrainStats>;
  queries?: string[];
  maxMemories?: number;
  now?: Date;
}

const DEFAULT_LIVE_QUERIES = [
  'current state next step blocker',
  'mistake rejected route do not repeat',
  'source backed lesson verified evidence',
  'agent handoff resume context continuity',
  'tool command workflow successful fix',
  'memory quality stale duplicate source',
];

const DEFAULT_SYSTEM_PROMPT = [
  'You are using Shadow Brain memory.',
  'Answer from source-backed project memory when possible.',
  'Mention uncertainty when a memory has no source, is stale, or conflicts with visible project files.',
  'Do not invent missing facts.',
].join(' ');

function metadataList(entry: GlobalEntry, key: string): string[] {
  const value = entry.metadata?.[key];
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function entryText(entry: GlobalEntry): string {
  return [
    entry.projectName,
    entry.agentTool,
    entry.category,
    entry.content,
    JSON.stringify(entry.metadata ?? {}),
  ].join(' ').toLowerCase();
}

function normalizeTerms(query: string): string[] {
  const stop = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into',
    'is', 'it', 'of', 'on', 'or', 'that', 'the', 'to', 'with',
  ]);
  return query
    .toLowerCase()
    .split(/[^a-z0-9_.:-]+/)
    .map(term => term.trim())
    .filter(term => term.length > 2 && !stop.has(term));
}

export function scoreLiveMemory(entry: GlobalEntry, now = new Date()): number {
  const sources = metadataList(entry, 'sources');
  const tags = metadataList(entry, 'tags');
  const ageDays = (now.getTime() - new Date(entry.createdAt).getTime()) / 86_400_000;
  const contentLength = String(entry.content ?? '').trim().length;
  let score = 30;

  if (contentLength >= 120) score += 18;
  else if (contentLength >= 60) score += 10;
  if (sources.length) score += 25;
  if (tags.length) score += 8;
  if (entry.category.includes('.')) score += 5;
  score += Math.min(10, Math.round(entry.importance * 10));
  score += Math.min(6, Math.log2((entry.accessCount ?? 0) + 1) * 2);
  if (ageDays > 30) score -= 10;
  if (ageDays > 90) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function enrich(entry: GlobalEntry, now = new Date()): GlobalEntry & { qualityScore: number; sources: string[]; tags: string[] } {
  return {
    ...entry,
    qualityScore: scoreLiveMemory(entry, now),
    sources: metadataList(entry, 'sources'),
    tags: metadataList(entry, 'tags'),
  };
}

function countBy<T extends string>(items: T[]): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
}

export function rankMemoryEntries(entries: GlobalEntry[], query: string, limit = 8, now = new Date()): Array<GlobalEntry & { score: number }> {
  const terms = normalizeTerms(query);
  const ranked = entries.map(entry => {
    const haystack = entryText(entry);
    let score = scoreLiveMemory(entry, now) / 100;
    for (const term of terms) {
      if (entry.category.toLowerCase().includes(term)) score += 5;
      if (String(entry.content).toLowerCase().includes(term)) score += 3;
      if (JSON.stringify(entry.metadata ?? {}).toLowerCase().includes(term)) score += 1.5;
      if (haystack.includes(term)) score += 0.5;
    }
    return { ...entry, score };
  });

  return ranked
    .filter(entry => terms.length === 0 || entry.score > scoreLiveMemory(entry, now) / 100)
    .sort((a, b) => b.score - a.score || b.importance - a.importance)
    .slice(0, limit);
}

export function evaluateRecallSnapshot(entries: GlobalEntry[], queries = DEFAULT_LIVE_QUERIES, limit = 5, now = new Date()): LiveBrainRecallEval {
  const cases = queries.map(query => {
    const hits = rankMemoryEntries(entries, query, limit, now);
    const sourceBackedHits = hits.filter(hit => metadataList(hit, 'sources').length > 0).length;
    const warnings: string[] = [];
    if (!hits.length) warnings.push('No memory matched this query.');
    if (hits.length && sourceBackedHits === 0) warnings.push('Hits exist, but none include source paths.');
    return {
      query,
      hitCount: hits.length,
      sourceBackedHits,
      topIds: hits.map(hit => hit.id),
      topCategories: Array.from(new Set(hits.map(hit => hit.category))).slice(0, 4),
      warnings,
    };
  });
  const totalHits = cases.reduce((sum, item) => sum + item.hitCount, 0);
  const sourceBackedHits = cases.reduce((sum, item) => sum + item.sourceBackedHits, 0);
  return {
    generatedAt: now.toISOString(),
    queryCount: cases.length,
    avgHitCount: cases.length ? Number((totalHits / cases.length).toFixed(2)) : 0,
    sourceBackedHitRate: totalHits ? Number((sourceBackedHits / totalHits).toFixed(3)) : 0,
    cases,
  };
}

function buildLearningActions(opts: {
  projectDir: string;
  entries: GlobalEntry[];
  quality: MemoryQualityReport;
  recallEval: LiveBrainRecallEval;
  agentCount: number;
  sourceDocCount: number;
  projectScoped: boolean;
}): LiveBrainAction[] {
  const actions: LiveBrainAction[] = [];
  const project = JSON.stringify(opts.projectDir);

  if (!opts.entries.length) {
    actions.push({
      priority: 'critical',
      title: 'Seed the first project memories',
      reason: 'The live brain has no project-scoped entries, so agents cannot resume complex work from memory.',
      command: `shadow-brain resume-seed ${project}`,
    });
  }

  if (!opts.projectScoped && opts.entries.length) {
    actions.push({
      priority: 'high',
      title: 'Create project-scoped memories',
      reason: 'The report is using global fallback memory. Project isolation will be weak until this project records its own lessons.',
      command: `shadow-brain timeline ${project}`,
    });
  }

  if (opts.quality.sourceCoverage < 0.7 && opts.entries.length > 0) {
    actions.push({
      priority: 'high',
      title: 'Backfill evidence sources',
      reason: 'Agents trust and reuse memories better when each durable lesson points to docs, logs, commits, or proof files.',
      command: `shadow-brain live-brain status ${project} --json`,
    });
  }

  if (opts.quality.stale > 0) {
    actions.push({
      priority: 'medium',
      title: 'Verify stale memories',
      reason: `${opts.quality.stale} memories are older than 30 days. They should be checked against current files before agents rely on them.`,
      command: `shadow-brain live-brain brief ${project}`,
    });
  }

  if (opts.quality.duplicates.length) {
    actions.push({
      priority: 'medium',
      title: 'Merge duplicate memory clusters',
      reason: `${opts.quality.duplicates.length} possible duplicate clusters can pollute recall ranking and agent context.`,
      command: `shadow-brain live-brain hygiene ${project}`,
    });
  }

  if (opts.recallEval.avgHitCount < 2 && opts.entries.length > 3) {
    actions.push({
      priority: 'medium',
      title: 'Improve recall keywords and categories',
      reason: 'The default recall eval returns too few hits. Add clearer categories, tags, and action words to durable memories.',
      command: `shadow-brain live-brain eval ${project}`,
    });
  }

  if (opts.agentCount < 2) {
    actions.push({
      priority: 'low',
      title: 'Connect more agents deliberately',
      reason: 'Only one agent has written useful memory. Cross-agent learning improves when Codex, Claude Code, Cursor, or other tools share source-backed lessons.',
      command: `shadow-brain audit-hooks ${project}`,
    });
  }

  if (opts.sourceDocCount === 0) {
    actions.push({
      priority: 'low',
      title: 'Add visible source-of-truth docs',
      reason: 'Resume packs are strongest when the project has README, AGENTS.md, progress docs, or verification logs to quote.',
    });
  }

  return actions;
}

export function buildTrainingRows(entries: GlobalEntry[], opts: LiveBrainTrainingPackOptions = {}, now = new Date()): LiveBrainTrainingRow[] {
  const maxRows = opts.maxRows ?? 200;
  const rows = entries
    .map(entry => enrich(entry, now))
    .filter(entry => opts.includeLowQuality || entry.qualityScore >= 55)
    .sort((a, b) => b.qualityScore - a.qualityScore || b.importance - a.importance)
    .slice(0, maxRows)
    .map(entry => {
      const sources = entry.sources.length ? entry.sources.join('; ') : 'No source path recorded.';
      const tags = entry.tags.length ? entry.tags.join(', ') : 'none';
      return {
        messages: [
          { role: 'system' as const, content: opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
          {
            role: 'user' as const,
            content: `Project: ${entry.projectName}\nCategory: ${entry.category}\nTask: Recall the durable lesson this agent should use before similar work.`,
          },
          {
            role: 'assistant' as const,
            content: `${entry.content}\n\nSources: ${sources}\nTags: ${tags}\nQuality score: ${entry.qualityScore}/100`,
          },
        ],
        metadata: {
          memoryId: entry.id,
          projectId: entry.projectId,
          projectName: entry.projectName,
          agentTool: entry.agentTool,
          category: entry.category,
          importance: entry.importance,
          sources: entry.sources,
          tags: entry.tags,
          qualityScore: entry.qualityScore,
        },
      };
    });

  return rows;
}

export function buildTrainingJsonl(entries: GlobalEntry[], opts: LiveBrainTrainingPackOptions = {}, now = new Date()): string {
  return buildTrainingRows(entries, opts, now).map(row => JSON.stringify(row)).join('\n');
}

export function formatLiveBrainBriefing(report: Omit<LiveBrainReport, 'agentBriefing'>): string {
  const actions = report.learningActions.length
    ? report.learningActions.map(action => `- [${action.priority}] ${action.title}: ${action.reason}${action.command ? `\n  Command: ${action.command}` : ''}`).join('\n')
    : '- No immediate hygiene actions. Continue recording compact, source-backed lessons.';
  const topMemories = report.topMemories.length
    ? report.topMemories.slice(0, 8).map(memory => {
        const sources = memory.sources.length ? `\n  Sources: ${memory.sources.join('; ')}` : '\n  Sources: none recorded';
        return `- ${memory.category} (${memory.agentTool}, score ${memory.qualityScore}/100)\n  ${memory.content.slice(0, 700)}${sources}`;
      }).join('\n')
    : '- No memories available yet.';
  const warnings = [
    ...report.resumePack.warnings,
    ...report.memoryQuality.warnings,
    ...report.recallEval.cases.flatMap(item => item.warnings.map(warning => `${item.query}: ${warning}`)),
  ];
  const warningText = warnings.length ? Array.from(new Set(warnings)).map(w => `- ${w}`).join('\n') : '- None.';

  return [
    '# Shadow Brain Live Agent Briefing',
    '',
    `Generated: ${report.generatedAt}`,
    `Project: ${report.projectName}`,
    `Path: ${report.projectDir}`,
    '',
    '## Rules For Agents',
    '',
    '- Treat visible project files as source of truth when they conflict with memory.',
    '- Prefer source-backed memories over agent-inferred memories.',
    '- Do not store secrets, tokens, passwords, private keys, or raw credentials.',
    '- Record only durable lessons, current blockers, proven commands, and verified decisions.',
    '- Keep memory compact: one reusable lesson per memory.',
    '',
    '## Live Brain Health',
    '',
    `- Memories: ${report.memoryQuality.totalEntries}`,
    `- Average quality score: ${report.memoryQuality.avgScore}/100`,
    `- Source coverage: ${Math.round(report.memoryQuality.sourceCoverage * 100)}%`,
    `- Stale memories: ${report.memoryQuality.stale}`,
    `- Duplicate clusters: ${report.memoryQuality.duplicates.length}`,
    `- Recall eval avg hits: ${report.recallEval.avgHitCount}`,
    '',
    '## Actions',
    '',
    actions,
    '',
    '## Top Memories',
    '',
    topMemories,
    '',
    '## Warnings',
    '',
    warningText,
    '',
    '## Useful Commands',
    '',
    `- shadow-brain live-brain status ${JSON.stringify(report.projectDir)}`,
    `- shadow-brain live-brain brief ${JSON.stringify(report.projectDir)}`,
    `- shadow-brain live-brain eval ${JSON.stringify(report.projectDir)}`,
    `- shadow-brain live-brain train-pack ${JSON.stringify(report.projectDir)} --out shadow-brain-training.jsonl`,
    `- shadow-brain global recall --query "current blocker next step" --json --limit 8`,
  ].join('\n');
}

export function analyzeLiveBrainSnapshot(opts: LiveBrainSnapshotOptions): LiveBrainReport {
  const now = opts.now ?? new Date();
  const maxMemories = opts.maxMemories ?? 12;
  const projectExists = fs.existsSync(opts.projectDir);
  const quality = analyzeMemoryQuality(opts.entries, now);
  const enriched = opts.entries
    .map(entry => enrich(entry, now))
    .sort((a, b) => b.qualityScore - a.qualityScore || b.importance - a.importance);
  const recallEval = evaluateRecallSnapshot(opts.entries, opts.queries ?? DEFAULT_LIVE_QUERIES, 5, now);
  const resumePack = generateContextResumePack({
    projectDir: opts.projectDir,
    projectName: opts.projectName,
    projectId: opts.projectId,
    entries: opts.entries,
    maxMemories,
    now,
  });
  const agentCoverage = countBy(opts.entries.map(entry => entry.agentTool))
    .map(({ key, count }) => ({ agent: key, count }));
  const categoryCoverage = countBy(opts.entries.map(entry => entry.category))
    .map(({ key, count }) => ({ category: key, count }));
  const sourceDocCount = resumePack.stats.docCount;
  const staleCutoff = now.getTime() - 30 * 86_400_000;
  const staleMemories = enriched.filter(entry => new Date(entry.createdAt).getTime() < staleCutoff).slice(0, 12);
  const lowQualityMemories = enriched.filter(entry => entry.qualityScore < 55).slice(0, 12);
  const learningActions = buildLearningActions({
    projectDir: opts.projectDir,
    entries: opts.entries,
    quality,
    recallEval,
    agentCount: agentCoverage.length,
    sourceDocCount,
    projectScoped: opts.projectScoped ?? true,
  });

  const reportBase: Omit<LiveBrainReport, 'agentBriefing'> = {
    generatedAt: now.toISOString(),
    projectDir: path.resolve(opts.projectDir),
    projectName: opts.projectName,
    projectId: opts.projectId,
    projectExists,
    projectScoped: opts.projectScoped ?? true,
    stats: opts.stats ?? {},
    memoryQuality: quality,
    agentCoverage,
    categoryCoverage,
    topMemories: enriched.slice(0, maxMemories),
    staleMemories,
    lowQualityMemories,
    recallEval,
    learningActions,
    resumePack,
  };

  return {
    ...reportBase,
    agentBriefing: formatLiveBrainBriefing(reportBase),
  };
}

export class LiveBrain {
  private brain: GlobalBrain;

  constructor(brain = getGlobalBrain()) {
    this.brain = brain;
  }

  async report(opts: LiveBrainReportOptions): Promise<LiveBrainReport> {
    const projectDir = path.resolve(opts.projectDir);
    const projectId = GlobalBrain.projectIdFor(projectDir);
    const maxMemories = opts.maxMemories ?? 12;
    await this.brain.init();
    try {
      let entries = this.brain.recall({ projectId, minImportance: 0, limit: 800 });
      let projectScoped = true;
      if (!entries.length && opts.globalFallback !== false) {
        entries = this.brain.recall({ minImportance: 0, limit: 800 });
        projectScoped = false;
      }
      return analyzeLiveBrainSnapshot({
        projectDir,
        projectName: opts.projectName ?? path.basename(projectDir),
        projectId,
        projectScoped,
        entries,
        stats: this.brain.getStats(),
        queries: opts.queries,
        maxMemories,
      });
    } finally {
      await this.brain.shutdown();
    }
  }

  async trainingJsonl(opts: LiveBrainReportOptions & LiveBrainTrainingPackOptions): Promise<string> {
    const report = await this.report(opts);
    const entries = [
      ...report.topMemories,
      ...report.staleMemories,
      ...report.lowQualityMemories,
    ];
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    return buildTrainingJsonl(Array.from(byId.values()), opts);
  }
}

export function getLiveBrain(brain?: GlobalBrain): LiveBrain {
  return new LiveBrain(brain);
}

