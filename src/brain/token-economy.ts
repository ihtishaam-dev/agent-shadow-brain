// src/brain/token-economy.ts — Cross-agent token spend tracker + cost predictor
// v6.0.0 — Hive Mind Edition
//
// Tracks token usage across every connected agent. Predicts monthly spend,
// identifies savings opportunities (e.g., calls that could run on cheaper
// models), and exposes a simple "you saved $X" number for README badges.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import {
  AgentTool,
  TokenEconomyBucket,
  TokenEconomyStats,
  TokenSpendRecord,
} from '../types.js';

function brainHomeDir(): string {
  return process.env.SHADOW_BRAIN_HOME || process.env.HOME || os.homedir();
}

function spendPath(): string {
  return path.join(brainHomeDir(), '.shadow-brain', 'token-spend.jsonl');
}

function statsPath(): string {
  return path.join(brainHomeDir(), '.shadow-brain', 'token-economy.json');
}

function emptyBucket(): TokenEconomyBucket {
  return { spendUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0 };
}

function addSpendBucket(
  target: Record<string, TokenEconomyBucket>,
  key: string,
  record: TokenSpendRecord,
): void {
  const bucket = target[key] ?? emptyBucket();
  bucket.spendUsd += record.estimatedCostUsd;
  bucket.calls++;
  bucket.inputTokens = (bucket.inputTokens ?? 0) + record.inputTokens;
  bucket.outputTokens = (bucket.outputTokens ?? 0) + record.outputTokens;
  if (!bucket.lastSeen || record.timestamp.getTime() > new Date(bucket.lastSeen).getTime()) {
    bucket.lastSeen = record.timestamp;
  }
  target[key] = bucket;
}

function roundBuckets<T extends Record<string, TokenEconomyBucket>>(buckets: T): T {
  for (const bucket of Object.values(buckets)) {
    bucket.spendUsd = +bucket.spendUsd.toFixed(6);
  }
  return buckets;
}

// Per-1M-tokens USD pricing (rough, for projection only)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
  'gpt-5.4': { input: 10, output: 30 },
  'gpt-5.4-codex': { input: 10, output: 30 },
  'glm-5.1': { input: 0.5, output: 2 },
  'minimax-m2.7': { input: 0.6, output: 2.4 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'deepseek-671b': { input: 0, output: 0 }, // local/free
  'qwen2.5-coder:7b': { input: 0, output: 0 }, // local
  'local': { input: 0, output: 0 },
};

interface PersistShape {
  schemaVersion: 1;
  monthlyProjectionUsd: number;
  savingsOpportunitiesUsd: number;
  lastRecalculated: string;
}

export class TokenEconomy {
  private records: TokenSpendRecord[] = [];
  private savingsOpportunitiesUsd: number = 0;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const spendFile = spendPath();
    const statsFile = statsPath();
    fs.mkdirSync(path.dirname(spendFile), { recursive: true });

    if (fs.existsSync(spendFile)) {
      try {
        const raw = fs.readFileSync(spendFile, 'utf-8');
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue;
          const r = JSON.parse(line) as TokenSpendRecord;
          if (this.isValidRecord(r)) {
            this.records.push({ ...r, timestamp: new Date(r.timestamp) });
          }
        }
      } catch {
        /* skip */
      }
    }

    if (fs.existsSync(statsFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(statsFile, 'utf-8')) as PersistShape;
        this.savingsOpportunitiesUsd = parsed.savingsOpportunitiesUsd ?? 0;
      } catch {
        /* skip */
      }
    }

    this.initialized = true;
  }

  /** Record a token spend event. */
  async record(input: {
    agentTool: AgentTool;
    model: string;
    provider?: string;
    inputTokens: number;
    outputTokens: number;
    taskCategory?: string;
  }): Promise<TokenSpendRecord> {
    await this.init();
    const model = input.model || 'local';
    const pricing = MODEL_PRICING[model] ?? { input: 1, output: 3 };
    const cost =
      (input.inputTokens * pricing.input + input.outputTokens * pricing.output) / 1_000_000;

    const record: TokenSpendRecord = {
      id: `spend-${crypto.randomBytes(6).toString('hex')}`,
      agentTool: input.agentTool,
      model,
      provider: input.provider,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: +cost.toFixed(6),
      taskCategory: input.taskCategory ?? 'general',
      timestamp: new Date(),
    };

    this.records.push(record);
    try {
      fs.appendFileSync(spendPath(), JSON.stringify(record) + '\n');
    } catch {
      /* non-fatal */
    }
    return record;
  }

  /** Report aggregate spend + projections + savings opportunities. */
  async report(): Promise<TokenEconomyStats> {
    await this.init();
    const byAgent: TokenEconomyStats['byAgent'] = {};
    const byModel: TokenEconomyStats['byModel'] = {};
    const byCategory: TokenEconomyStats['byCategory'] = {};
    const recentByAgent: TokenEconomyStats['recentByAgent'] = {};
    const recentByModel: TokenEconomyStats['recentByModel'] = {};
    const recentByCategory: TokenEconomyStats['recentByCategory'] = {};

    let totalSpend = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let lastRecord: TokenSpendRecord | null = null;
    const recentWindowDays = 7;
    const weekAgo = Date.now() - recentWindowDays * 24 * 60 * 60 * 1000;

    for (const r of this.records) {
      totalSpend += r.estimatedCostUsd;
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;

      if (!lastRecord || r.timestamp.getTime() > lastRecord.timestamp.getTime()) {
        lastRecord = r;
      }

      addSpendBucket(byAgent, r.agentTool, r);
      addSpendBucket(byModel, r.model, r);
      addSpendBucket(byCategory, r.taskCategory, r);

      if (r.timestamp.getTime() >= weekAgo) {
        addSpendBucket(recentByAgent, r.agentTool, r);
        addSpendBucket(recentByModel, r.model, r);
        addSpendBucket(recentByCategory, r.taskCategory, r);
      }
    }

    // Project monthly spend from last 7 days
    const recent = this.records.filter(r => r.timestamp.getTime() >= weekAgo);
    const weeklySpend = recent.reduce((acc, r) => acc + r.estimatedCostUsd, 0);
    const monthlyProjectionUsd = +(weeklySpend * (30 / 7)).toFixed(2);

    const { savings, suggestions } = this.computeSavings(recent);
    this.savingsOpportunitiesUsd = savings;
    await this.persistStats(monthlyProjectionUsd, savings);

    return {
      totalSpendUsd: +totalSpend.toFixed(4),
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      byAgent: roundBuckets(byAgent),
      byModel: roundBuckets(byModel),
      byCategory: roundBuckets(byCategory),
      recentWindowDays,
      recentSpendUsd: +weeklySpend.toFixed(4),
      recentByAgent: roundBuckets(recentByAgent),
      recentByModel: roundBuckets(recentByModel),
      recentByCategory: roundBuckets(recentByCategory),
      lastRecord,
      monthlyProjectionUsd,
      savingsOpportunitiesUsd: +savings.toFixed(2),
      suggestions,
    };
  }

  /** Total saved by routing to cheaper models (returned as tweetable USD). */
  getSavingsUsd(): number {
    return +this.savingsOpportunitiesUsd.toFixed(2);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private computeSavings(records: TokenSpendRecord[]): { savings: number; suggestions: string[] } {
    const suggestions: string[] = [];
    let savings = 0;

    // Opus calls that could pass with Haiku (heuristic: small tasks = general/category)
    const opusCalls = records.filter(r => r.model.includes('opus'));
    if (opusCalls.length) {
      const opusSpend = opusCalls.reduce((acc, r) => acc + r.estimatedCostUsd, 0);
      const haikuPricing = MODEL_PRICING['claude-haiku-4-5'];
      const opusPricing = MODEL_PRICING['claude-opus-4-7'];
      const ratio = (haikuPricing.input + haikuPricing.output) / (opusPricing.input + opusPricing.output);
      const potentialSave = opusSpend * (1 - ratio) * 0.43; // assume 43% are Haiku-able
      savings += potentialSave;
      suggestions.push(`~43% of Opus calls ($${opusSpend.toFixed(2)}) could route to Haiku → ~$${potentialSave.toFixed(2)} saved.`);
    }

    // Calls >1500 tokens → consider MiniMax/GLM
    const bigCalls = records.filter(r => r.inputTokens > 1500 && r.model.includes('gpt'));
    if (bigCalls.length) {
      const bigSpend = bigCalls.reduce((acc, r) => acc + r.estimatedCostUsd, 0);
      const potentialSave = bigSpend * 0.35;
      savings += potentialSave;
      suggestions.push(`${bigCalls.length} GPT calls exceed 1500 input tokens — route large-context to MiniMax/GLM for ~$${potentialSave.toFixed(2)} saved.`);
    }

    // Redundant calls (identical input within 1h) → cache
    const cacheable = this.detectRedundantCalls(records);
    if (cacheable.savings > 0) {
      savings += cacheable.savings;
      suggestions.push(`${cacheable.count} redundant calls detected — Shadow Brain cache could save ~$${cacheable.savings.toFixed(2)}.`);
    }

    if (!suggestions.length) suggestions.push('No obvious routing wins. Running lean already.');

    return { savings, suggestions };
  }

  private detectRedundantCalls(records: TokenSpendRecord[]): { count: number; savings: number } {
    // Simple approximation: calls within 60 min on same agent+category+model
    const buckets = new Map<string, TokenSpendRecord[]>();
    for (const r of records) {
      const key = `${r.agentTool}::${r.model}::${r.taskCategory}`;
      const list = buckets.get(key) ?? [];
      list.push(r);
      buckets.set(key, list);
    }
    let redundant = 0;
    let savings = 0;
    for (const list of buckets.values()) {
      list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 1; i < list.length; i++) {
        const gap = list[i].timestamp.getTime() - list[i - 1].timestamp.getTime();
        if (gap < 60 * 60 * 1000) {
          redundant++;
          savings += list[i].estimatedCostUsd * 0.4;
        }
      }
    }
    return { count: redundant, savings };
  }

  private async persistStats(monthly: number, savings: number): Promise<void> {
    try {
      const shape: PersistShape = {
        schemaVersion: 1,
        monthlyProjectionUsd: monthly,
        savingsOpportunitiesUsd: savings,
        lastRecalculated: new Date().toISOString(),
      };
      const file = statsPath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(shape, null, 2));
      fs.renameSync(tmp, file);
    } catch {
      /* non-fatal */
    }
  }

  private isValidRecord(record: Partial<TokenSpendRecord>): record is TokenSpendRecord {
    return Boolean(
      record &&
      typeof record.agentTool === 'string' &&
      typeof record.model === 'string' &&
      Number.isFinite(record.inputTokens) &&
      Number.isFinite(record.outputTokens) &&
      Number.isFinite(record.estimatedCostUsd) &&
      record.timestamp,
    );
  }
}

let _instance: TokenEconomy | null = null;

export function getTokenEconomy(): TokenEconomy {
  if (!_instance) _instance = new TokenEconomy();
  return _instance;
}

export function resetTokenEconomyForTests(): void {
  _instance = null;
}
