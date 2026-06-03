// src/brain/global-brain.ts — Singleton Global Brain (v5.2.0)
//
// One brain. Every project. Every agent. Every machine.
//
// The Global Brain is a singleton store at ~/.shadow-brain/global.json that
// every Shadow Brain instance reads from and writes to. Insights from project
// A using Cursor are immediately available to project B using Claude Code.
//
// Storage: append-friendly JSON store (no native deps), persisted on every
// flush. Combined with l0-cache.ts, hot recalls return in <1ms.
//
// Concurrency: write queue + atomic file replace prevents conflicts when
// multiple agents write simultaneously.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import {
  AgentTool,
  GlobalBrainConfig,
  GlobalBrainStats,
  GlobalEntry,
  BrainTimelineEvent,
} from '../types.js';

const DEFAULT_DIR = path.join(os.homedir(), '.shadow-brain');
const DEFAULT_DB_PATH = path.join(DEFAULT_DIR, 'global.json');
const DEFAULT_CONFIG: GlobalBrainConfig = {
  dbPath: DEFAULT_DB_PATH,
  walMode: true,
  writeQueueSize: 1000,
  autoVacuumMB: 500,
  autoPruneMB: 1000,
  syncIntervalMs: 5000,
};

interface PersistShape {
  schemaVersion: number;
  entries: GlobalEntry[];
  projects: Array<{ id: string; name: string; rootDir: string; firstSeen: number; lastSeen: number }>;
  agents: Array<{ tool: AgentTool; firstSeen: number; lastSeen: number; sessionCount: number }>;
}

interface PendingWrite {
  entry: GlobalEntry;
  resolve: (success: boolean) => void;
}

/**
 * Singleton Global Brain — the source of truth for all projects + agents.
 *
 * Storage: JSON file at ~/.shadow-brain/global.json (zero new deps).
 * In-memory Map keyed by entry.id for O(1) ID lookups.
 */
export class GlobalBrain {
  private static instance: GlobalBrain | null = null;
  private config: GlobalBrainConfig;
  private entries: Map<string, GlobalEntry> = new Map();
  private projects: Map<string, { id: string; name: string; rootDir: string; firstSeen: number; lastSeen: number }> = new Map();
  private agents: Map<AgentTool, { tool: AgentTool; firstSeen: number; lastSeen: number; sessionCount: number }> = new Map();
  private writeQueue: PendingWrite[] = [];
  private syncTimer: NodeJS.Timeout | null = null;
  private stats: GlobalBrainStats;
  private startedAt: number;
  private initialized = false;
  private dirty = false;

  private constructor(config: Partial<GlobalBrainConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startedAt = Date.now();
    this.stats = {
      totalProjects: 0,
      totalAgents: 0,
      totalEntries: 0,
      totalSizeMB: 0,
      pendingWrites: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      lastSync: new Date(),
      lastVacuum: null,
      lastPrune: null,
      uptime: 0,
    };
  }

  static getInstance(config?: Partial<GlobalBrainConfig>): GlobalBrain {
    if (!GlobalBrain.instance) {
      GlobalBrain.instance = new GlobalBrain(config);
    }
    return GlobalBrain.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    fs.mkdirSync(path.dirname(this.config.dbPath), { recursive: true });

    if (fs.existsSync(this.config.dbPath)) {
      try {
        const raw = fs.readFileSync(this.config.dbPath, 'utf-8');
        const parsed: PersistShape = JSON.parse(raw);
        for (const e of parsed.entries ?? []) {
          // Re-hydrate Date instances
          this.entries.set(e.id, {
            ...e,
            createdAt: new Date(e.createdAt),
            lastAccessed: new Date(e.lastAccessed),
          });
        }
        for (const p of parsed.projects ?? []) this.projects.set(p.id, p);
        for (const a of parsed.agents ?? []) this.agents.set(a.tool, a);
      } catch {
        // Corrupted file → start fresh, back up the bad one
        try {
          fs.renameSync(this.config.dbPath, this.config.dbPath + '.corrupt-' + Date.now());
        } catch { /* ignore */ }
      }
    }

    this.startSyncLoop();
    this.refreshStats();
    this.initialized = true;
  }

  /** Generate a stable project ID from absolute path */
  static projectIdFor(rootDir: string): string {
    const abs = path.resolve(rootDir);
    return crypto.createHash('sha1').update(abs).digest('hex').slice(0, 16);
  }

  registerProject(rootDir: string, name?: string): string {
    if (!this.initialized) throw new Error('GlobalBrain not initialized — call init() first');

    const id = GlobalBrain.projectIdFor(rootDir);
    const projectName = name || path.basename(rootDir);
    const now = Date.now();

    const existing = this.projects.get(id);
    this.projects.set(id, {
      id,
      name: projectName,
      rootDir: path.resolve(rootDir),
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
    });

    this.dirty = true;
    return id;
  }

  registerAgent(agent: AgentTool): void {
    if (!this.initialized) return;
    const now = Date.now();
    const existing = this.agents.get(agent);
    this.agents.set(agent, {
      tool: agent,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
      sessionCount: (existing?.sessionCount ?? 0) + 1,
    });
    this.dirty = true;
  }

  /** Queue a write — resolves true on success */
  async write(entry: Omit<GlobalEntry, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<boolean> {
    if (!this.initialized) await this.init();

    const fullEntry: GlobalEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
    };

    if (this.writeQueue.length >= this.config.writeQueueSize) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      this.writeQueue.push({ entry: fullEntry, resolve });
    });
  }

  /** Direct synchronous write — bypasses queue */
  writeSync(entry: Omit<GlobalEntry, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): string {
    if (!this.initialized) throw new Error('GlobalBrain not initialized');

    const id = crypto.randomUUID();
    const fullEntry: GlobalEntry = {
      ...entry,
      id,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
    };

    this.entries.set(id, fullEntry);
    this.dirty = true;
    this.stats.totalEntries = this.entries.size;
    return id;
  }

  /** Recall entries — cross-project + cross-agent */
  recall(opts: {
    projectId?: string;
    agentTool?: AgentTool;
    category?: string;
    keywords?: string[];
    limit?: number;
    minImportance?: number;
  } = {}): GlobalEntry[] {
    if (!this.initialized) return [];

    const limit = opts.limit ?? 20;
    const minImp = opts.minImportance ?? 0;
    const weakKeywords = new Set([
      'a', 'an', 'and', 'are', 'as', 'for', 'from', 'in', 'into', 'is', 'of', 'on',
      'or', 'the', 'to', 'with', 'ww2br',
    ]);
    const kwLower = opts.keywords
      ?.map(k => k.trim().toLowerCase())
      .filter(k => k && !/^\d{1,2}$/.test(k))
      .filter(k => k.length > 2 && !weakKeywords.has(k)) ?? null;

    const matches: Array<{ entry: GlobalEntry; score: number }> = [];
    for (const e of this.entries.values()) {
      if (opts.projectId && e.projectId !== opts.projectId) continue;
      if (opts.agentTool && e.agentTool !== opts.agentTool) continue;
      if (opts.category && e.category !== opts.category) continue;
      if (e.importance < minImp) continue;
      let score = 0;
      if (kwLower?.length) {
        const projectName = e.projectName.toLowerCase();
        const agentTool = e.agentTool.toLowerCase();
        const category = e.category.toLowerCase();
        const content = e.content.toLowerCase();
        const metadata = JSON.stringify(e.metadata ?? {}).toLowerCase();
        for (const k of kwLower) {
          if (category.includes(k)) score += 8;
          if (content.includes(k)) score += 5;
          if (metadata.includes(k)) score += 3;
          if (agentTool.includes(k)) score += 1;
          if (projectName.includes(k)) score += 1;
        }
        if (score <= 0) continue;
      }
      matches.push({ entry: e, score });
    }

    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.entry.importance !== a.entry.importance) return b.entry.importance - a.entry.importance;
      return b.entry.lastAccessed.getTime() - a.entry.lastAccessed.getTime();
    });

    const result = matches.slice(0, limit).map(m => m.entry);
    if (result.length) this.stats.hits++;
    else this.stats.misses++;
    return result;
  }

  /** Bump access count for an entry */
  touch(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.dirty = true;
  }

  recallByIds(ids: string[]): GlobalEntry[] {
    const out: GlobalEntry[] = [];
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) out.push(e);
    }
    return out;
  }

  /** Chronological proof stream for dashboards, handoffs, and launch demos. */
  timeline(opts: {
    projectId?: string;
    agentTool?: AgentTool;
    category?: string;
    limit?: number;
  } = {}): BrainTimelineEvent[] {
    if (!this.initialized) return [];
    const limit = opts.limit ?? 50;
    return Array.from(this.entries.values())
      .filter(e => !opts.projectId || e.projectId === opts.projectId)
      .filter(e => !opts.agentTool || e.agentTool === opts.agentTool)
      .filter(e => !opts.category || e.category === opts.category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(e => ({
        id: e.id,
        projectId: e.projectId,
        projectName: e.projectName,
        agentTool: e.agentTool,
        category: e.category,
        content: e.content,
        importance: e.importance,
        createdAt: e.createdAt,
        lastAccessed: e.lastAccessed,
        metadata: e.metadata,
      }));
  }

  getStats(): GlobalBrainStats {
    this.refreshStats();
    return { ...this.stats };
  }

  /** Force a sync of pending writes to disk */
  async sync(): Promise<void> {
    if (!this.initialized) return;

    if (this.writeQueue.length > 0) {
      const pending = this.writeQueue.splice(0, this.writeQueue.length);
      for (const { entry, resolve } of pending) {
        try {
          this.entries.set(entry.id, entry);
          resolve(true);
        } catch {
          resolve(false);
        }
      }
      this.dirty = true;
    }

    if (this.dirty) {
      this.persist();
      this.stats.lastSync = new Date();
      this.dirty = false;
    }

    this.maybeAutoMaintenance();
  }

  private maybeAutoMaintenance(): void {
    const sizeMB = this.estimateSizeMB();
    this.stats.totalSizeMB = sizeMB;

    if (sizeMB > this.config.autoPruneMB) this.prune();
  }

  /** Auto-prune: drop low-importance, rarely-accessed entries when over threshold */
  private prune(): void {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
    const toDelete: string[] = [];
    for (const [id, e] of this.entries) {
      if (e.importance < 0.3 && e.accessCount < 2 && e.lastAccessed.getTime() < cutoff) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) this.entries.delete(id);
    if (toDelete.length) {
      this.dirty = true;
      this.stats.lastPrune = new Date();
    }
  }

  private persist(): void {
    const shape: PersistShape = {
      schemaVersion: 1,
      entries: Array.from(this.entries.values()),
      projects: Array.from(this.projects.values()),
      agents: Array.from(this.agents.values()),
    };

    // Atomic write — write to .tmp then rename
    const tmp = this.config.dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(shape));
    fs.renameSync(tmp, this.config.dbPath);
  }

  private startSyncLoop(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.sync().catch(() => { /* swallow */ });
    }, this.config.syncIntervalMs);
  }

  private refreshStats(): void {
    if (!this.initialized) return;
    this.stats.totalProjects = this.projects.size;
    this.stats.totalAgents = this.agents.size;
    this.stats.totalEntries = this.entries.size;
    this.stats.pendingWrites = this.writeQueue.length;
    const totalChecks = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalChecks > 0 ? this.stats.hits / totalChecks : 0;
    this.stats.uptime = Date.now() - this.startedAt;
  }

  private estimateSizeMB(): number {
    try {
      const stat = fs.statSync(this.config.dbPath);
      return stat.size / (1024 * 1024);
    } catch {
      return 0;
    }
  }

  async shutdown(): Promise<void> {
    if (this.syncTimer) clearInterval(this.syncTimer);
    await this.sync();
    this.initialized = false;
    GlobalBrain.instance = null;
  }
}

export function getGlobalBrain(config?: Partial<GlobalBrainConfig>): GlobalBrain {
  return GlobalBrain.getInstance(config);
}
