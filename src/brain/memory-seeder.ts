import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { AgentTool, GlobalBrainConfig, GlobalEntry } from '../types.js';
import { GlobalBrain, getGlobalBrain } from './global-brain.js';

export type SeedApprovalMode = 'user' | 'agent' | 'dual';
export type SeedDraftStatus = 'draft' | 'approved' | 'seeded' | 'rejected';
export type SeedApprover = AgentTool | 'user';

export interface MemorySeedApproval {
  by: SeedApprover;
  at: string;
  note?: string;
}

export interface MemorySeedDraft {
  id: string;
  topic: string;
  objective: string;
  projectDir: string;
  projectId: string;
  projectName: string;
  category: string;
  tags: string[];
  importance: number;
  researchAgent: AgentTool;
  approverAgent: SeedApprover;
  approvalMode: SeedApprovalMode;
  requiredApprovals: SeedApprover[];
  approvals: MemorySeedApproval[];
  content: string;
  sources: string[];
  supportingMemoryIds: string[];
  status: SeedDraftStatus;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectedBy?: SeedApprover;
  rejectionReason?: string;
  seededAt?: string;
  seededBy?: SeedApprover;
  seededMemoryId?: string;
}

export interface CreateMemorySeedDraftInput {
  topic: string;
  objective?: string;
  projectDir?: string;
  category?: string;
  tags?: string[] | string;
  importance?: number;
  researchAgent?: AgentTool | string;
  approverAgent?: SeedApprover | string;
  approvalMode?: SeedApprovalMode | string;
  sources?: string[] | string;
  content?: string;
}

export interface MemorySeederOptions {
  storePath?: string;
  brain?: GlobalBrain;
  brainConfig?: Partial<GlobalBrainConfig>;
}

interface PersistShape {
  schemaVersion: number;
  drafts: MemorySeedDraft[];
}

const AGENT_TOOLS: AgentTool[] = [
  'claude-code',
  'kilo-code',
  'cline',
  'opencode',
  'codex',
  'roo-code',
  'aider',
  'cursor',
  'windsurf',
  'copilot',
];

function defaultStorePath(): string {
  return path.join(os.homedir(), '.shadow-brain', 'memory-seed-drafts.json');
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map(v => v.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[\n,;|]/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
}

function normalizeAgent(value: unknown, fallback: AgentTool): AgentTool {
  const raw = String(value || '').trim().toLowerCase();
  return (AGENT_TOOLS as string[]).includes(raw) ? raw as AgentTool : fallback;
}

function normalizeApprover(value: unknown, fallback: SeedApprover): SeedApprover {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'user') return 'user';
  return (AGENT_TOOLS as string[]).includes(raw) ? raw as AgentTool : fallback;
}

function normalizeApprovalMode(value: unknown): SeedApprovalMode {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'agent' || raw === 'dual') return raw;
  return 'user';
}

function clampImportance(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.74;
  return Math.max(0.05, Math.min(1, n));
}

function buildKeywords(topic: string, objective: string, tags: string[]): string[] {
  return unique([...topic.split(/\s+/), ...objective.split(/\s+/), ...tags])
    .map(v => v.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
    .filter(v => v.length > 2)
    .slice(0, 16);
}

function requiredApprovals(mode: SeedApprovalMode, approverAgent: SeedApprover, researchAgent: AgentTool): SeedApprover[] {
  if (mode === 'agent') return [approverAgent === 'user' ? researchAgent : approverAgent];
  if (mode === 'dual') return unique(['user', approverAgent === 'user' ? researchAgent : approverAgent]) as SeedApprover[];
  return ['user'];
}

function approvalComplete(draft: MemorySeedDraft): boolean {
  const approved = new Set(draft.approvals.map(a => a.by));
  return draft.requiredApprovals.every(a => approved.has(a));
}

function safeProjectName(projectDir: string): string {
  const normalized = path.resolve(projectDir || process.cwd());
  return path.basename(normalized) || normalized;
}

function extractSourcesFromMemory(entries: GlobalEntry[]): string[] {
  const sources: string[] = [];
  for (const entry of entries) {
    const raw = entry.metadata?.sources;
    if (Array.isArray(raw)) {
      for (const s of raw) sources.push(String(s));
    }
  }
  return sources;
}

function existingProjectSources(projectDir: string): string[] {
  const candidates = [
    'README.md',
    'CHANGELOG.md',
    'AGENTS.md',
    'package.json',
    'docs/ROADMAP.md',
    'docs/ROADMAP-v7.md',
    'docs/launch/RELEASE_NOTES_v6.0.3.md',
  ];
  return candidates.filter(rel => fs.existsSync(path.join(projectDir, rel)));
}

function formatDraftContent(input: {
  draftId: string;
  topic: string;
  objective: string;
  projectName: string;
  researchAgent: AgentTool;
  approverAgent: SeedApprover;
  approvalMode: SeedApprovalMode;
  researchNotes?: string;
  sources: string[];
  supportingEntries: GlobalEntry[];
}): string {
  const memoryLines = input.supportingEntries.slice(0, 5).map((entry, index) => {
    const content = entry.content.replace(/\s+/g, ' ').trim().slice(0, 220);
    return `${index + 1}. ${entry.category} via ${entry.agentTool}: ${content}`;
  });
  const sourceLines = input.sources.slice(0, 10).map((source, index) => `${index + 1}. ${source}`);
  return [
    `[seed-draft:${input.draftId}] ${input.topic}`,
    '',
    `Project: ${input.projectName}`,
    `Objective: ${input.objective || 'Capture verified, reusable knowledge for future agents.'}`,
    `Research agent: ${input.researchAgent}`,
    `Approval gate: ${input.approvalMode} (${input.approverAgent})`,
    '',
    'Research notes:',
    input.researchNotes?.trim() || 'No free-form research note was provided. This draft is built from project files and existing source-backed memories.',
    '',
    'Supporting memories:',
    memoryLines.length ? memoryLines.join('\n') : 'None found yet. Treat this as a source-backed draft that needs human or agent review before seeding.',
    '',
    'Evidence sources:',
    sourceLines.length ? sourceLines.join('\n') : 'No sources recorded.',
    '',
    'Use policy:',
    'Recall this memory before related work, then verify current project files again before acting on it.',
  ].join('\n');
}

export class MemorySeeder {
  private storePath: string;
  private brain?: GlobalBrain;
  private brainConfig?: Partial<GlobalBrainConfig>;
  private drafts: MemorySeedDraft[] = [];
  private initialized = false;

  constructor(options: MemorySeederOptions = {}) {
    this.storePath = options.storePath ?? defaultStorePath();
    this.brain = options.brain;
    this.brainConfig = options.brainConfig;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    if (fs.existsSync(this.storePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf-8')) as PersistShape;
        this.drafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];
      } catch {
        fs.renameSync(this.storePath, `${this.storePath}.corrupt-${Date.now()}`);
        this.drafts = [];
      }
    }
    this.initialized = true;
  }

  list(limit = 30): MemorySeedDraft[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 30;
    return [...this.drafts]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, safeLimit);
  }

  async createDraft(input: CreateMemorySeedDraftInput): Promise<MemorySeedDraft> {
    await this.init();
    const topic = String(input.topic || '').trim();
    if (!topic) throw new Error('Seed topic is required.');

    const projectDir = path.resolve(String(input.projectDir || process.cwd()));
    const projectName = safeProjectName(projectDir);
    const projectId = GlobalBrain.projectIdFor(projectDir);
    const objective = String(input.objective || '').trim();
    const category = String(input.category || 'project.research').trim() || 'project.research';
    const tags = unique(normalizeList(input.tags));
    const researchAgent = normalizeAgent(input.researchAgent, 'codex');
    const approverAgent = normalizeApprover(input.approverAgent, 'user');
    const approvalMode = normalizeApprovalMode(input.approvalMode);
    const importance = clampImportance(input.importance);
    const keywords = buildKeywords(topic, objective, tags);

    const brain = await this.getBrain(projectDir, projectName);
    let supportingEntries = brain.recall({ projectId, keywords, minImportance: 0, limit: 8 });
    if (!supportingEntries.length) {
      supportingEntries = brain.recall({ keywords, minImportance: 0, limit: 8 });
    }

    const sources = unique([
      ...normalizeList(input.sources),
      ...existingProjectSources(projectDir),
      ...extractSourcesFromMemory(supportingEntries),
    ]);
    const warnings: string[] = [];
    if (!fs.existsSync(projectDir)) warnings.push(`Project path does not exist: ${projectDir}`);
    if (!sources.length) warnings.push('No evidence sources were recorded. Add sources before relying on this memory.');
    if (!supportingEntries.length) warnings.push('No supporting brain memories matched this topic yet.');

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const draft: MemorySeedDraft = {
      id,
      topic,
      objective,
      projectDir,
      projectId,
      projectName,
      category,
      tags,
      importance,
      researchAgent,
      approverAgent,
      approvalMode,
      requiredApprovals: requiredApprovals(approvalMode, approverAgent, researchAgent),
      approvals: [],
      content: formatDraftContent({
        draftId: id,
        topic,
        objective,
        projectName,
        researchAgent,
        approverAgent,
        approvalMode,
        researchNotes: input.content,
        sources,
        supportingEntries,
      }),
      sources,
      supportingMemoryIds: supportingEntries.map(e => e.id),
      status: 'draft',
      warnings,
      createdAt: now,
      updatedAt: now,
    };

    this.drafts.unshift(draft);
    this.persist();
    return draft;
  }

  async approve(id: string, approvedBy: SeedApprover = 'user', note?: string): Promise<MemorySeedDraft> {
    await this.init();
    const draft = this.requireDraft(id);
    if (draft.status === 'rejected') throw new Error('Rejected seed drafts cannot be approved.');
    if (draft.status === 'seeded') return draft;

    const approver = normalizeApprover(approvedBy, 'user');
    if (!draft.approvals.some(a => a.by === approver)) {
      draft.approvals.push({ by: approver, at: new Date().toISOString(), note });
    }
    if (approvalComplete(draft)) {
      draft.status = 'approved';
      draft.approvedAt = new Date().toISOString();
    }
    draft.updatedAt = new Date().toISOString();
    this.persist();
    return draft;
  }

  async reject(id: string, rejectedBy: SeedApprover = 'user', reason = ''): Promise<MemorySeedDraft> {
    await this.init();
    const draft = this.requireDraft(id);
    if (draft.status === 'seeded') throw new Error('Seeded memory drafts cannot be rejected.');
    draft.status = 'rejected';
    draft.rejectedBy = normalizeApprover(rejectedBy, 'user');
    draft.rejectionReason = reason;
    draft.rejectedAt = new Date().toISOString();
    draft.updatedAt = draft.rejectedAt;
    this.persist();
    return draft;
  }

  async seed(id: string, seededBy: SeedApprover = 'user'): Promise<MemorySeedDraft> {
    await this.init();
    const draft = this.requireDraft(id);
    if (draft.status !== 'approved') {
      throw new Error('Seed draft must be approved before it can be written to the global brain.');
    }

    const brain = await this.getBrain(draft.projectDir, draft.projectName);
    const agentTool = normalizeAgent(seededBy, draft.researchAgent);
    const seededMemoryId = brain.writeSync({
      projectId: draft.projectId,
      projectName: draft.projectName,
      agentTool,
      category: draft.category,
      content: draft.content,
      importance: draft.importance,
      metadata: {
        tags: draft.tags,
        sources: draft.sources,
        seedDraftId: draft.id,
        seedTopic: draft.topic,
        seedApprovalMode: draft.approvalMode,
        researchAgent: draft.researchAgent,
        approverAgent: draft.approverAgent,
        approvals: draft.approvals,
        supportingMemoryIds: draft.supportingMemoryIds,
      },
    });
    await brain.sync();

    draft.status = 'seeded';
    draft.seededAt = new Date().toISOString();
    draft.seededBy = seededBy;
    draft.seededMemoryId = seededMemoryId;
    draft.updatedAt = draft.seededAt;
    this.persist();
    return draft;
  }

  private async getBrain(projectDir: string, projectName: string): Promise<GlobalBrain> {
    const brain = this.brain ?? getGlobalBrain(this.brainConfig);
    await brain.init();
    brain.registerProject(projectDir, projectName);
    return brain;
  }

  private requireDraft(id: string): MemorySeedDraft {
    const draft = this.drafts.find(d => d.id === id);
    if (!draft) throw new Error(`Seed draft not found: ${id}`);
    return draft;
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const shape: PersistShape = { schemaVersion: 1, drafts: this.drafts };
    const tmp = `${this.storePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(shape, null, 2), 'utf-8');
    fs.renameSync(tmp, this.storePath);
  }
}

let singleton: MemorySeeder | null = null;

export function getMemorySeeder(options?: MemorySeederOptions): MemorySeeder {
  if (!singleton || options) singleton = new MemorySeeder(options);
  return singleton;
}

export function resetMemorySeeder(): void {
  singleton = null;
}
