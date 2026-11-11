// src/brain/memory-graph.ts — Memory Constellation graph (v6.2.0)
//
// Builds an interactive-ready graph of the brain ITSELF: memories linked to the
// projects they belong to, the agents that wrote them, the tags that describe
// them, and to each other via shared tags. Node importance is scored with
// PageRank blended with each memory's own importance, so the most central
// knowledge floats to the top — the signature "memory graph" view that modern
// memory tools are known for, built from data the brain already holds.
//
// Zero new dependencies. Pure in-memory derivation from the global brain.

import type { GlobalEntry } from '../types.js';
import { getGlobalBrain } from './global-brain.js';
import { normalizeMemorySources } from './memory-sources.js';

export type MemoryGraphNodeType = 'memory' | 'project' | 'agent' | 'tag';
export type MemoryGraphEdgeType = 'belongs' | 'wrote' | 'tagged' | 'related';

export interface MemoryGraphNode {
  id: string;            // prefixed id: mem:.. / proj:.. / agent:.. / tag:..
  label: string;
  type: MemoryGraphNodeType;
  group: string;         // clustering hint (projectId for memories, type otherwise)
  score: number;         // 0-1 blended importance (drives node size)
  size: number;          // suggested render radius
  pagerank: number;      // 0-1 normalized PageRank
  degree: number;        // connection count
  meta?: Record<string, unknown>;
}

export interface MemoryGraphEdge {
  source: string;
  target: string;
  weight: number;
  type: MemoryGraphEdgeType;
}

export interface MemoryGraphStats {
  memories: number;
  projects: number;
  agents: number;
  tags: number;
  edges: number;
  totalConsidered: number;
  droppedNodes: number;
}

export interface MemoryGraphSnapshot {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  stats: MemoryGraphStats;
  projectScoped: boolean;
  generatedAt: Date;
}

export interface MemoryGraphBuildOptions {
  projectId?: string;
  limit?: number;          // max entries to pull from the brain (default 400)
  minImportance?: number;
  maxNodes?: number;       // render cap (default 180)
  maxRelatedPerNode?: number; // cap memory<->memory edges per node (default 6)
}

function boundedInteger(n: number | undefined, fallback: number, lo: number, hi: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.trunc(n))) : fallback;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export class MemoryGraph {
  /** Build a constellation snapshot from the current global brain. */
  async build(opts: MemoryGraphBuildOptions = {}): Promise<MemoryGraphSnapshot> {
    const limit = boundedInteger(opts.limit, 400, 1, 2000);
    const maxNodes = boundedInteger(opts.maxNodes, 180, 20, 600);
    const maxRelated = boundedInteger(opts.maxRelatedPerNode, 6, 1, 20);
    const minImportance = opts.minImportance ?? 0;

    const brain = getGlobalBrain();
    await brain.init();
    const projectScoped = !!opts.projectId;
    const entries = brain.recall({ projectId: opts.projectId, minImportance, limit });

    if (!entries.length) {
      return {
        nodes: [], edges: [],
        stats: { memories: 0, projects: 0, agents: 0, tags: 0, edges: 0, totalConsidered: 0, droppedNodes: 0 },
        projectScoped, generatedAt: new Date(),
      };
    }

    const nodes = new Map<string, MemoryGraphNode>();
    const edges: MemoryGraphEdge[] = [];
    const edgeSeen = new Set<string>();

    const ensure = (id: string, label: string, type: MemoryGraphNodeType, group: string, meta?: Record<string, unknown>) => {
      let n = nodes.get(id);
      if (!n) { n = { id, label, type, group, score: 0, size: 8, pagerank: 0, degree: 0, meta }; nodes.set(id, n); }
      return n;
    };
    const addEdge = (source: string, target: string, weight: number, type: MemoryGraphEdgeType) => {
      if (source === target) return;
      const key = source < target ? source + '|' + target + '|' + type : target + '|' + source + '|' + type;
      if (edgeSeen.has(key)) return;
      edgeSeen.add(key);
      edges.push({ source, target, weight, type });
      const a = nodes.get(source); if (a) a.degree++;
      const b = nodes.get(target); if (b) b.degree++;
    };

    const tagsOf = (e: GlobalEntry): string[] => {
      const raw = (e.metadata as Record<string, unknown>)?.tags;
      if (Array.isArray(raw)) return raw.map(t => String(t).trim().toLowerCase()).filter(Boolean);
      if (typeof raw === 'string') return raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      return [];
    };
    // ── Build typed nodes + structural edges ────────────────────────────────
    const memTags = new Map<string, Set<string>>();
    for (const e of entries) {
      const memId = 'mem:' + e.id;
      ensure(memId, (e.content || e.category || 'memory').slice(0, 48), 'memory', e.projectId || 'global', {
        content: String(e.content || '').slice(0, 600),
        projectName: e.projectName,
        agentTool: e.agentTool,
        category: e.category,
        importance: e.importance,
        sources: normalizeMemorySources(e.metadata),
        tags: tagsOf(e),
        createdAt: e.createdAt,
      });

      if (e.projectId) {
        const projId = 'proj:' + e.projectId;
        ensure(projId, e.projectName || e.projectId, 'project', 'project', { projectId: e.projectId });
        addEdge(memId, projId, 1, 'belongs');
      }
      if (e.agentTool) {
        const agId = 'agent:' + e.agentTool;
        ensure(agId, String(e.agentTool), 'agent', 'agent', { agentTool: e.agentTool });
        addEdge(memId, agId, 1, 'wrote');
      }
      const tags = tagsOf(e);
      memTags.set(memId, new Set(tags));
      for (const t of tags) {
        const tagId = 'tag:' + t;
        ensure(tagId, '#' + t, 'tag', 'tag', { tag: t });
        addEdge(memId, tagId, 1, 'tagged');
      }
    }

    // ── memory <-> memory relatedness via shared tags ───────────────────────
    const memIds = [...memTags.keys()];
    for (let i = 0; i < memIds.length; i++) {
      const a = memIds[i]; const ta = memTags.get(a)!;
      if (!ta.size) continue;
      const related: Array<{ id: string; w: number }> = [];
      for (let j = i + 1; j < memIds.length; j++) {
        const b = memIds[j]; const tb = memTags.get(b)!;
        if (!tb.size) continue;
        let shared = 0;
        for (const t of ta) if (tb.has(t)) shared++;
        if (shared > 0) related.push({ id: b, w: shared });
      }
      related.sort((x, y) => y.w - x.w);
      for (const r of related.slice(0, maxRelated)) addEdge(a, r.id, r.w, 'related');
    }

    // ── PageRank over an undirected view of the graph ───────────────────────
    const ids = [...nodes.keys()];
    const adj = new Map<string, Array<{ to: string; w: number }>>();
    for (const id of ids) adj.set(id, []);
    for (const e of edges) {
      adj.get(e.source)!.push({ to: e.target, w: e.weight });
      adj.get(e.target)!.push({ to: e.source, w: e.weight });
    }
    const pr = this.pageRank(ids, adj);
    let maxPr = 0;
    for (const v of pr.values()) if (v > maxPr) maxPr = v;
    maxPr = maxPr || 1;

    // ── Score + size ────────────────────────────────────────────────────────
    for (const n of nodes.values()) {
      const prNorm = (pr.get(n.id) ?? 0) / maxPr;
      n.pagerank = prNorm;
      const importanceComponent = n.type === 'memory' ? Number(n.meta?.importance ?? 0.5) : prNorm;
      n.score = clamp(0.6 * prNorm + 0.4 * importanceComponent, 0, 1);
      n.size = 7 + n.score * 23;
    }

    // ── Cap nodes for render perf: MEMORIES FIRST, then only the hubs that
    //    connect to a surviving memory. A brain with many tags can otherwise
    //    fill the whole budget with hub nodes and leave zero memories — which
    //    also strips every edge, since all structural edges touch a memory.
    const totalConsidered = nodes.size;
    let kept = [...nodes.values()];
    if (kept.length > maxNodes) {
      const mems = kept.filter(n => n.type === 'memory').sort((a, b) => b.score - a.score);
      // Reserve the bulk of the budget for memories so the graph is memory-centric.
      const memBudget = Math.max(1, Math.min(mems.length, Math.floor(maxNodes * 0.7)));
      const keptMems = mems.slice(0, memBudget);
      const keptMemIds = new Set(keptMems.map(m => m.id));

      // Keep only hub nodes (project/agent/tag) that connect to a kept memory.
      const hubConnected = new Set<string>();
      for (const e of edges) {
        const srcMem = e.source.startsWith('mem:');
        const tgtMem = e.target.startsWith('mem:');
        if (srcMem && !tgtMem && keptMemIds.has(e.source)) hubConnected.add(e.target);
        if (tgtMem && !srcMem && keptMemIds.has(e.target)) hubConnected.add(e.source);
      }
      let hubs = kept.filter(n => n.type !== 'memory' && hubConnected.has(n.id)).sort((a, b) => b.score - a.score);

      let combined = [...keptMems, ...hubs];
      if (combined.length > maxNodes) {
        // Over budget: trim the least-central hubs (memories are the point).
        const overflow = combined.length - maxNodes;
        hubs = hubs.slice(0, Math.max(0, hubs.length - overflow));
        combined = [...keptMems, ...hubs];
      }
      if (combined.length > maxNodes) combined = combined.sort((a, b) => b.score - a.score).slice(0, maxNodes);
      kept = combined;
    }
    const keptIds = new Set(kept.map(n => n.id));
    const keptEdges = edges.filter(e => keptIds.has(e.source) && keptIds.has(e.target));

    // Recompute degree against kept edges so the UI shows accurate counts.
    const degree = new Map<string, number>();
    for (const e of keptEdges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    for (const n of kept) n.degree = degree.get(n.id) ?? 0;

    const count = (t: MemoryGraphNodeType) => kept.filter(n => n.type === t).length;
    return {
      nodes: kept.sort((a, b) => b.score - a.score),
      edges: keptEdges,
      stats: {
        memories: count('memory'),
        projects: count('project'),
        agents: count('agent'),
        tags: count('tag'),
        edges: keptEdges.length,
        totalConsidered,
        droppedNodes: totalConsidered - kept.length,
      },
      projectScoped,
      generatedAt: new Date(),
    };
  }

  /** Standard PageRank with dangling-node handling. damping 0.85, eps 1e-4. */
  private pageRank(
    ids: string[],
    adj: Map<string, Array<{ to: string; w: number }>>,
    damping = 0.85,
    maxIter = 100,
    eps = 1e-4,
  ): Map<string, number> {
    const N = ids.length;
    const rank = new Map<string, number>();
    if (N === 0) return rank;
    for (const id of ids) rank.set(id, 1 / N);

    const outSum = new Map<string, number>();
    for (const id of ids) outSum.set(id, (adj.get(id) ?? []).reduce((s, e) => s + e.w, 0));

    for (let iter = 0; iter < maxIter; iter++) {
      let dangling = 0;
      for (const id of ids) if ((outSum.get(id) ?? 0) === 0) dangling += rank.get(id) ?? 0;

      const next = new Map<string, number>();
      const base = (1 - damping) / N + (damping * dangling) / N;
      for (const id of ids) next.set(id, base);

      for (const id of ids) {
        const os = outSum.get(id) ?? 0;
        if (os === 0) continue;
        const r = rank.get(id) ?? 0;
        for (const e of adj.get(id) ?? []) {
          next.set(e.to, (next.get(e.to) ?? 0) + damping * r * (e.w / os));
        }
      }

      let diff = 0;
      for (const id of ids) diff += Math.abs((next.get(id) ?? 0) - (rank.get(id) ?? 0));
      for (const id of ids) rank.set(id, next.get(id) ?? 0);
      if (diff < eps) break;
    }
    return rank;
  }
}

let _instance: MemoryGraph | null = null;
export function getMemoryGraph(): MemoryGraph {
  if (!_instance) _instance = new MemoryGraph();
  return _instance;
}
export function resetMemoryGraphForTests(): void { _instance = null; }
