import type { IncomingMessage, ServerResponse } from 'node:http';
import { getGlobalBrain, type GlobalBrain } from '../brain/global-brain.js';
import { getBrainBus } from '../brain/brain-bus.js';
import { assembleContext } from '../brain/context-assembly.js';
import { FEATURE_DEFINITIONS, getFeatureSettings, type FeatureSettingsStore } from '../brain/feature-settings.js';
import type { AgentTool, BrainTimelineEvent, ScoredGlobalEntry } from '../types.js';

const INVENTORY_LIMIT = 2500;
type Memory = BrainTimelineEvent | ScoredGlobalEntry;

export interface WorkspaceDependencies {
  brain?: GlobalBrain;
  settings?: FeatureSettingsStore;
}

function sources(entry: Memory): string[] {
  const metadata = entry.metadata ?? {};
  const candidates: unknown[] = [metadata.source, metadata.sourceFile, metadata.filePath, ...(Array.isArray(metadata.sources) ? metadata.sources : [])];
  return [...new Set(candidates.filter((item): item is string => typeof item === 'string' && !!item.trim()))].slice(0, 8);
}

function date(value: unknown): string | null {
  const time = value instanceof Date ? value.getTime() : typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function summary(entry: Memory) {
  const confidence = 'confidence' in entry ? entry.confidence : undefined;
  const matched = confidence?.explanation?.matchedKeywords ?? [];
  const refs = sources(entry);
  return {
    id: entry.id, title: entry.content.split(/\r?\n/, 1)[0].slice(0, 130), snippet: entry.content.slice(0, 1600),
    category: entry.category, agent: entry.agentTool, project: entry.projectId, projectName: entry.projectName,
    source: refs[0] ?? '', sources: refs, updatedAt: date(entry.createdAt), score: confidence?.score,
    reasons: confidence ? [matched.length ? 'Matches: ' + matched.join(', ') : 'Ranked by importance, age, and recorded use.'] : [],
  };
}

function bounded(value: string | null, fallback: number, max: number, min = 1): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new TypeError('Invalid pagination or graph limit.');
  return Number(value);
}

function query(qs: URLSearchParams, name: string): string | undefined {
  const value = qs.get(name)?.trim();
  if (value && value.length > 1000) throw new TypeError('Filter is too long.');
  return value || undefined;
}

function activity(enabled: boolean, limit = 30) {
  return {
    enabled,
    activity: enabled ? getBrainBus().recent(500).sort((a, b) => b.ts - a.ts).slice(0, limit).map(event => ({
      id: event.id, type: event.type, label: event.detail, agent: event.source,
      project: String(event.meta?.projectName ?? event.meta?.projectId ?? ''), timestamp: date(event.ts),
    })) : [],
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new TypeError('Send application/json.');
  if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host && req.headers.origin !== 'https://' + req.headers.host) {
    throw new TypeError('Cross-origin changes are not accepted.');
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new TypeError('Request body exceeds 64 KiB.');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new TypeError('Send valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Send a JSON object.');
  return value as Record<string, unknown>;
}

function settingsResponse(store: FeatureSettingsStore) {
  return { ...store.get(), definitions: FEATURE_DEFINITIONS };
}

/** The workspace API reads only the memory store and dedicated feature settings. */
export async function handleWorkspaceRequest(req: IncomingMessage, res: ServerResponse, dependencies: WorkspaceDependencies = {}): Promise<void> {
  const send = (data: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = url.pathname.slice('/api/workspace/'.length);
    const method = req.method ?? 'GET';
    if (!['GET', 'POST'].includes(method) || (method === 'POST' && !['context', 'features'].includes(route))) return send({ error: 'Method not allowed.' }, 405);
    const settings = dependencies.settings ?? getFeatureSettings();
    if (route === 'features') {
      if (method === 'POST') {
        const input = await body(req);
        if (Object.keys(input).some(key => !['patch', 'expectedRevision'].includes(key))) throw new TypeError('Unknown settings request field.');
        if (input.expectedRevision !== undefined && (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0)) throw new TypeError('Invalid settings revision.');
        await settings.update(input.patch, input.expectedRevision as number | undefined);
      }
      return send(settingsResponse(settings));
    }
    if (route === 'activity') return send(activity(settings.get().features.liveActivity));
    if (!['overview', 'memories', 'graph', 'context'].includes(route)) return send({ error: 'Not found.' }, 404);
    if (route === 'context' && method !== 'POST') return send({ error: 'Use POST for context assembly.' }, 405);

    const brain = dependencies.brain ?? getGlobalBrain();
    const refresh = async () => {
      await brain.init();
      await brain.sync();
      if (brain.getStorageHealth().lastError) throw new Error('The memory store could not be read. Check storage health.');
    };
    if (route === 'context') {
      const input = await body(req);
      if (Object.keys(input).some(key => !['projectId', 'query', 'tokenBudget', 'includeCrossProject'].includes(key))) throw new TypeError('Unknown context request field.');
      if (typeof input.projectId !== 'string' || !input.projectId.trim()) throw new TypeError('Choose a project.');
      if (input.query !== undefined && typeof input.query !== 'string') throw new TypeError('Task must be text.');
      if (input.includeCrossProject !== undefined && typeof input.includeCrossProject !== 'boolean') throw new TypeError('Cross-project choice must be boolean.');
      if (input.tokenBudget !== undefined && (!Number.isSafeInteger(input.tokenBudget) || Number(input.tokenBudget) < 0 || Number(input.tokenBudget) > 12000)) throw new TypeError('Token budget must be an integer from 0 to 12000.');
      const flags = settings.get().features;
      if (flags.contextAssembly) await refresh();
      const pack = assembleContext(brain, { projectId: input.projectId, query: input.query as string | undefined,
        tokenBudget: input.tokenBudget as number | undefined, includeCrossProject: input.includeCrossProject as boolean | undefined,
        features: flags });
      return send(pack);
    }

    await refresh();
    const inventory = brain.timeline({ limit: INVENTORY_LIMIT });
    const projectMap = new Map<string, { id: string; name: string; memories: number; updatedAt: string | null }>();
    for (const entry of inventory) {
      const project = projectMap.get(entry.projectId) ?? { id: entry.projectId, name: entry.projectName || entry.projectId, memories: 0, updatedAt: date(entry.createdAt) };
      project.memories++;
      projectMap.set(entry.projectId, project);
    }
    const projects = [...projectMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const facets = { projects, categories: [...new Set(inventory.map(entry => entry.category))].sort(), agents: [...new Set(inventory.map(entry => entry.agentTool))].sort() };
    const inventoryTruncated = brain.getStats().totalEntries > inventory.length;
    if (route === 'overview') {
      return send({ version: '7.2.0', totals: { projects: projects.length, memories: brain.getStats().totalEntries, agents: facets.agents.length },
        projects, ...activity(settings.get().features.liveActivity), storageHealth: brain.getStorageHealth(),
        features: settings.get().features, recentMemories: inventory.slice(0, 5).map(summary), truncated: inventoryTruncated,
        inventoryLimit: INVENTORY_LIMIT });
    }
    const qs = url.searchParams;
    const projectId = query(qs, 'project');
    const category = query(qs, 'category');
    const agentTool = query(qs, 'agent') as AgentTool | undefined;
    const search = query(qs, 'q');
    const entries: Memory[] = search ? brain.recallScored({ projectId, category, agentTool, keywords: search.split(/\s+/), limit: INVENTORY_LIMIT })
      : inventory.filter(entry => (!projectId || entry.projectId === projectId) && (!category || entry.category === category) && (!agentTool || entry.agentTool === agentTool));
    if (route === 'memories') {
      const limit = bounded(qs.get('limit'), 30, 100);
      const offset = bounded(qs.get('offset'), 0, INVENTORY_LIMIT, 0);
      return send({ items: entries.slice(offset, offset + limit).map(summary), total: entries.length, facets, truncated: inventoryTruncated, inventoryLimit: INVENTORY_LIMIT });
    }
    const limit = bounded(qs.get('limit'), 100, 180);
    const nodes: Array<Record<string, unknown>> = [];
    const edges: Array<{ source: string; target: string; kind: string }> = [];
    const usedProjects = new Set<string>();
    const usedAgents = new Set<string>();
    for (const entry of entries.slice(0, limit)) {
      const projectNode = 'project:' + entry.projectId;
      const agentNode = 'agent:' + entry.agentTool;
      const memoryNode = 'memory:' + entry.id;
      if (!usedProjects.has(projectNode)) {
        usedProjects.add(projectNode);
        nodes.push({ id: projectNode, kind: 'project', label: entry.projectName || entry.projectId, project: entry.projectId });
      }
      if (!usedAgents.has(agentNode)) {
        usedAgents.add(agentNode);
        nodes.push({ id: agentNode, kind: 'agent', label: entry.agentTool });
      }
      const detail = summary(entry);
      nodes.push({ id: memoryNode, kind: 'memory', label: detail.title, project: entry.projectId, category: entry.category,
        snippet: detail.snippet, source: detail.source, agent: entry.agentTool, updatedAt: detail.updatedAt });
      edges.push({ source: projectNode, target: memoryNode, kind: 'belongs-to' }, { source: agentNode, target: memoryNode, kind: 'recorded-by' });
    }
    return send({ nodes, edges, truncated: entries.length > limit || inventoryTruncated, shownMemories: Math.min(entries.length, limit), totalMemories: entries.length, facets });
  } catch (error) {
    const code = (error as { code?: string }).code;
    send({ error: error instanceof Error ? error.message : String(error), ...(code ? { code } : {}) }, code === 'FEATURE_SETTINGS_CONFLICT' ? 409 : code === 'FEATURE_SETTINGS_INVALID_PATCH' || error instanceof TypeError || error instanceof RangeError ? 400 : 500);
  }
}
