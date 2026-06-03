import * as fs from 'fs';
import * as path from 'path';
import { GlobalBrain } from './global-brain.js';
import { BrainTimelineEvent, GlobalEntry } from '../types.js';

export interface ContextSeedSource {
  label: string;
  path: string;
  exists: boolean;
  lastModified?: string;
  excerpt?: string;
}

export interface ContextSeedPack {
  generatedAt: string;
  projectDir: string;
  projectName: string;
  projectExists: boolean;
  note: string;
  sources: ContextSeedSource[];
  memories: BrainTimelineEvent[];
  warnings: string[];
  markdown: string;
}

export interface MemoryQualityReport {
  totalEntries: number;
  avgScore: number;
  sourceBacked: number;
  sourceCoverage: number;
  stale: number;
  lowQuality: number;
  duplicates: Array<{ signature: string; count: number; ids: string[] }>;
  warnings: string[];
}

export interface ContextResumePack {
  generatedAt: string;
  projectDir: string;
  projectName: string;
  projectId: string;
  disclaimer: string;
  stats: {
    docCount: number;
    memoryCount: number;
    avgQualityScore: number;
    sourceCoverage: number;
    staleCount: number;
    duplicateClusterCount: number;
  };
  warnings: string[];
  suggestedRecallQueries: string[];
  blockers: Array<GlobalEntry & { qualityScore?: number; sources?: string[]; tags?: string[] }>;
  topMemories: Array<GlobalEntry & { qualityScore?: number; sources?: string[]; tags?: string[] }>;
  sourceDocs: ContextSeedSource[];
  markdown: string;
}

const DEFAULT_SOURCE_FILES = [
  'README.md',
  'AGENTS.md',
  'CHANGELOG.md',
  'package.json',
  'docs/ROADMAP.md',
  'docs/ROADMAP-v7.md',
  'DEV_AGENT_BRAIN.md',
  'DEV_PROGRESS.md',
  'DEV_VERIFICATION_LOG.md',
  'DEV_WORK_PREFLIGHT.md',
  'DEV_RESOURCE_REGISTRY.md',
  'WORKER_ORCHESTRATION_STATUS.md',
  'DEV_AGENT_TASKS.md',
];

const DEFAULT_RECALL_QUERIES = [
  'active gate blocker next movement visual proof',
  'rejected paths do not repeat gotcha',
  'tool availability resource registry VPS Blender Unity Triverse',
  'context continuity resume compacted session',
];

function redactSecrets(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, '[REDACTED_API_KEY]')
    .replace(/\b([A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/g, '[REDACTED_TOKEN]')
    .replace(/^(\s*(?:pass|password|api[_ -]?key|token|secret)\s*[:=]\s*).+$/gim, '$1[REDACTED]');
}

function tailLines(text: string, maxLines: number, maxChars: number): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const tail = lines.slice(Math.max(0, lines.length - maxLines)).join('\n').trim();
  if (tail.length <= maxChars) return tail;
  return tail.slice(tail.length - maxChars).trim();
}

function readSource(projectDir: string, relPath: string): ContextSeedSource {
  const fullPath = path.join(projectDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return { label: relPath, path: fullPath, exists: false };
  }

  const stat = fs.statSync(fullPath);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  const excerpt = redactSecrets(tailLines(raw, 90, 7000));
  return {
    label: relPath,
    path: fullPath,
    exists: true,
    lastModified: stat.mtime.toISOString(),
    excerpt,
  };
}

function memoryToMarkdown(memory: BrainTimelineEvent): string {
  const created = new Date(memory.createdAt).toISOString();
  const sourceHint = Array.isArray(memory.metadata?.sources)
    ? `\n  Sources: ${(memory.metadata.sources as unknown[]).join('; ')}`
    : '';
  return `- ${memory.category} (${memory.agentTool}, ${created}, importance ${memory.importance})\n  id: ${memory.id}\n  ${redactSecrets(memory.content).slice(0, 900)}${sourceHint}`;
}

function scoreMemory(entry: GlobalEntry, nowDate = new Date()): number {
  const metadata = entry.metadata ?? {};
  const hasSources = Array.isArray(metadata.sources) && metadata.sources.length > 0;
  const hasTags = Array.isArray(metadata.tags) && metadata.tags.length > 0;
  const contentLength = String(entry.content ?? '').trim().length;
  const ageDays = (nowDate.getTime() - new Date(entry.createdAt).getTime()) / 86_400_000;
  let score = 35;
  if (contentLength >= 160) score += 20;
  else if (contentLength >= 80) score += 12;
  if (hasSources) score += 25;
  if (hasTags) score += 8;
  score += Math.round(Math.min(10, Math.max(0, entry.importance * 10)));
  if (ageDays > 30) score -= 12;
  if (ageDays > 90) score -= 15;
  return Math.max(0, Math.min(100, score));
}

function enrichMemory(entry: GlobalEntry, nowDate = new Date()): GlobalEntry & { qualityScore: number; sources: string[]; tags: string[] } {
  const metadata = entry.metadata ?? {};
  return {
    ...entry,
    qualityScore: scoreMemory(entry, nowDate),
    sources: Array.isArray(metadata.sources) ? metadata.sources.map(String) : [],
    tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : [],
  };
}

export function analyzeMemoryQuality(entries: GlobalEntry[], nowDate = new Date()): MemoryQualityReport {
  if (!entries.length) {
    return { totalEntries: 0, avgScore: 0, sourceBacked: 0, sourceCoverage: 0, stale: 0, lowQuality: 0, duplicates: [], warnings: [] };
  }

  const now = nowDate.getTime();
  const scores = entries.map(entry => scoreMemory(entry, nowDate));
  const withSources = entries.filter(e => Array.isArray(e.metadata?.sources) && e.metadata.sources.length > 0).length;
  const stale = entries.filter(e => now - new Date(e.createdAt).getTime() > 30 * 86_400_000).length;
  const lowQuality = scores.filter(score => score < 55).length;
  const bySignature = new Map<string, string[]>();

  for (const entry of entries) {
    const signature = String(entry.content ?? '')
      .toLowerCase()
      .replace(/\[[^\]]+\]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 18)
      .join(' ');
    if (!signature) continue;
    const ids = bySignature.get(signature) ?? [];
    ids.push(entry.id);
    bySignature.set(signature, ids);
  }

  const duplicates = Array.from(bySignature.entries())
    .filter(([, ids]) => ids.length > 1)
    .slice(0, 10)
    .map(([signature, ids]) => ({ signature, count: ids.length, ids }));
  const warnings: string[] = [];
  if (withSources / entries.length < 0.65) warnings.push('Low source coverage: many memories lack evidence paths.');
  if (stale > 0) warnings.push(`${stale} stale memories are older than 30 days; verify against visible project files before acting.`);
  if (duplicates.length) warnings.push(`${duplicates.length} possible duplicate memory clusters found.`);
  if (lowQuality) warnings.push(`${lowQuality} memories scored below 55 and may need better tags, sources, or action text.`);

  return {
    totalEntries: entries.length,
    avgScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    sourceBacked: withSources,
    sourceCoverage: withSources / entries.length,
    stale,
    lowQuality,
    duplicates,
    warnings,
  };
}

function sourceToMarkdown(source: ContextSeedSource): string {
  if (!source.exists) return `### ${source.label}\nMissing at ${source.path}`;
  return `### ${source.label}\nPath: ${source.path}\nLast modified: ${source.lastModified}\n\n${source.excerpt || '(empty)'}`;
}

function buildMarkdown(pack: Omit<ContextSeedPack, 'markdown'>): string {
  const warnings = pack.warnings.length
    ? pack.warnings.map(w => `- ${w}`).join('\n')
    : '- None.';
  const memories = pack.memories.length
    ? pack.memories.map(memoryToMarkdown).join('\n\n')
    : '- No project-scoped or global memories matched the continuity queries.';
  const sources = pack.sources.map(sourceToMarkdown).join('\n\n');

  return [
    '# Shadow Brain Context Continuity Seed',
    '',
    `Generated: ${pack.generatedAt}`,
    `Project: ${pack.projectName}`,
    `Path: ${pack.projectDir}`,
    '',
    '## Read First',
    '',
    pack.note,
    '',
    'This pack is designed for Codex/Cursor/Claude/other agents after context compaction or a fresh session. It cannot read hidden model context. It reconstructs the working state from source-backed project files and Shadow Brain memories.',
    '',
    '## Warnings',
    '',
    warnings,
    '',
    '## High-Value Memories',
    '',
    memories,
    '',
    '## Source File Excerpts',
    '',
    sources,
    '',
    '## Required Agent Behavior',
    '',
    '- Treat project files as source of truth if they conflict with memory.',
    '- Verify the active blocker before implementation.',
    '- Do not repeat rejected routes listed above.',
    '- Do not store secrets in repo files, memory, prompts, logs, or reports.',
    '- Update progress and verification files after meaningful work.',
  ].join('\n');
}

function buildResumeMarkdown(pack: Omit<ContextResumePack, 'markdown'>): string {
  const warnings = pack.warnings.length ? pack.warnings.map(w => `- ${w}`).join('\n') : '- None.';
  const blockers = pack.blockers.length
    ? pack.blockers.map(memoryToMarkdown).join('\n\n')
    : '- No blocker memories found.';
  const top = pack.topMemories.length
    ? pack.topMemories.map(memoryToMarkdown).join('\n\n')
    : '- No high-value memories found.';
  const docs = pack.sourceDocs.map(sourceToMarkdown).join('\n\n');
  const queries = pack.suggestedRecallQueries.map(q => `- ${q}`).join('\n');

  return [
    '# Shadow Brain Resume Pack',
    '',
    'Context Continuity Resume Pack',
    '',
    `Generated: ${pack.generatedAt}`,
    `Project: ${pack.projectName}`,
    `Path: ${pack.projectDir}`,
    '',
    '## Purpose',
    '',
    pack.disclaimer,
    '',
    '## Stats',
    '',
    `- Source docs: ${pack.stats.docCount}`,
    `- Memories: ${pack.stats.memoryCount}`,
    `- Average memory quality: ${pack.stats.avgQualityScore}/100`,
    `- Source coverage: ${Math.round(pack.stats.sourceCoverage * 100)}%`,
    '',
    '## Warnings',
    '',
    warnings,
    '',
    '## Suggested Recall Queries',
    '',
    queries,
    '',
    '## Current Blockers And Stop Rules',
    '',
    blockers,
    '',
    '## Top Memories',
    '',
    top,
    '',
    '## Source File Excerpts',
    '',
    docs,
  ].join('\n');
}

export function generateContextResumePack(opts: {
  projectDir: string;
  projectName: string;
  projectId: string;
  entries: GlobalEntry[];
  maxMemories?: number;
  now?: Date;
}): ContextResumePack {
  const maxMemories = opts.maxMemories ?? 12;
  const nowDate = opts.now ?? new Date();
  const quality = analyzeMemoryQuality(opts.entries, nowDate);
  const sourceDocs = DEFAULT_SOURCE_FILES.map(file => readSource(opts.projectDir, file));
  const existingDocs = sourceDocs.filter(s => s.exists);
  const enriched = opts.entries
    .map(entry => enrichMemory(entry, nowDate))
    .sort((a, b) => {
      if ((b.qualityScore ?? 0) !== (a.qualityScore ?? 0)) return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const blockerTerms = /\b(blocked|blocker|rejected|reject|do not|next movement|active gate|gate 2|visual proof|gotcha)\b/i;
  const blockers = enriched.filter(e => blockerTerms.test(`${e.category} ${e.content}`)).slice(0, Math.min(8, maxMemories));
  const topMemories = enriched.slice(0, maxMemories);
  const warnings: string[] = [];
  if (!existingDocs.length) warnings.push('No source docs were found. Resume pack is memory-only and may be stale.');
  if (quality.sourceCoverage < 0.5 && opts.entries.length > 5) warnings.push('Low source coverage: many memories lack evidence paths.');
  if (quality.stale > Math.max(5, opts.entries.length * 0.3)) warnings.push('Many memories are older than 30 days. Verify against current files before acting.');
  if (quality.duplicates.length) warnings.push(`Possible duplicate memory clusters: ${quality.duplicates.length}.`);

  const packBase = {
    generatedAt: nowDate.toISOString(),
    projectDir: path.resolve(opts.projectDir),
    projectName: opts.projectName,
    projectId: opts.projectId,
    disclaimer: 'Use this after context compaction, account/model switches, or a fresh agent session. It is rebuilt from visible project files and stored memories; it does not read or infer hidden model context.',
    stats: {
      docCount: existingDocs.length,
      memoryCount: opts.entries.length,
      avgQualityScore: quality.avgScore,
      sourceCoverage: quality.sourceCoverage,
      staleCount: quality.stale,
      duplicateClusterCount: quality.duplicates.length,
    },
    warnings,
    suggestedRecallQueries: DEFAULT_RECALL_QUERIES,
    blockers,
    topMemories,
    sourceDocs: existingDocs,
  };

  return {
    ...packBase,
    markdown: buildResumeMarkdown(packBase),
  };
}

export async function buildContextSeedPack(opts: {
  projectDir: string;
  sourceFiles?: string[];
  queries?: string[];
  maxMemories?: number;
}): Promise<ContextSeedPack> {
  const projectDir = path.resolve(opts.projectDir);
  const sourceFiles = opts.sourceFiles ?? DEFAULT_SOURCE_FILES;
  const queries = opts.queries ?? DEFAULT_RECALL_QUERIES;
  const maxMemories = opts.maxMemories ?? 12;
  const projectExists = fs.existsSync(projectDir);
  const projectName = path.basename(projectDir);
  const generatedAt = new Date().toISOString();
  const warnings: string[] = [];

  if (!projectExists) warnings.push(`Project directory does not exist: ${projectDir}`);

  const sources = sourceFiles.map(file => readSource(projectDir, file));
  if (!sources.some(s => s.exists)) warnings.push('No continuity source files were found for this project.');

  const brain = GlobalBrain.getInstance();
  await brain.init();
  const projectId = GlobalBrain.projectIdFor(projectDir);
  const memoriesById = new Map<string, BrainTimelineEvent>();

  for (const query of queries) {
    const keywords = query.split(/\s+/).filter(Boolean);
    const projectMatches = brain.recall({ projectId, keywords, limit: maxMemories });
    const matches = projectMatches.length ? projectMatches : brain.recall({ keywords, limit: Math.ceil(maxMemories / 2) });
    for (const entry of matches) {
      memoriesById.set(entry.id, entry);
      if (memoriesById.size >= maxMemories) break;
    }
    if (memoriesById.size >= maxMemories) break;
  }

  const memories = Array.from(memoriesById.values()).slice(0, maxMemories);
  if (!memories.length) warnings.push('No Shadow Brain memories matched the continuity seed queries.');

  const basePack = {
    generatedAt,
    projectDir,
    projectName,
    projectExists,
    note: 'Use this compact continuity seed before work starts, after context compaction, or before handing the project to another agent.',
    sources,
    memories,
    warnings,
  };

  return {
    ...basePack,
    markdown: buildMarkdown(basePack),
  };
}
