import type { IncomingMessage, ServerResponse } from 'node:http';
import { getGlobalBrain, type GlobalBrain } from '../brain/global-brain.js';
import { getBrainBus } from '../brain/brain-bus.js';
import { assembleContext } from '../brain/context-assembly.js';
import { FEATURE_DEFINITIONS, getFeatureSettings, type FeatureSettingsStore } from '../brain/feature-settings.js';
import { memoryAnnotationsFor, memoryState, type MemoryAnnotationsStore, type MemoryAnnotationSnapshot } from '../brain/memory-annotations.js';
import { normalizeMemorySources } from '../brain/memory-sources.js';
import { inspectClientIntegrations } from '../brain/client-integrations.js';
import { activityJournalFor, type ActivityJournal } from '../brain/activity-journal.js';
import { reportAgentActivity } from '../brain/activity-reporting.js';
import type { AgentTool, BrainTimelineEvent, ScoredGlobalEntry } from '../types.js';

const INVENTORY_LIMIT = 2500;
type Memory = BrainTimelineEvent | ScoredGlobalEntry;

export interface WorkspaceDependencies {
  brain?: GlobalBrain;
  settings?: FeatureSettingsStore;
  annotations?: MemoryAnnotationsStore;
  projectDir?: string;
  journal?: ActivityJournal;
  demo?: boolean;
}

function sources(entry: Memory): string[] {
  return normalizeMemorySources(entry.metadata, { limit: 8, maxChars: 500 });
}

function date(value: unknown): string | null {
  const time = value instanceof Date ? value.getTime() : typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function summary(entry: Memory, annotations?: MemoryAnnotationSnapshot) {
  const confidence = 'confidence' in entry ? entry.confidence : undefined;
  const matched = confidence?.explanation?.matchedKeywords ?? [];
  const refs = sources(entry);
  return {
    id: entry.id, title: entry.content.split(/\r?\n/, 1)[0].slice(0, 130), snippet: entry.content.slice(0, 1600),
    category: entry.category, agent: entry.agentTool, project: entry.projectId, projectName: entry.projectName,
    source: refs[0] ?? '', sources: refs, updatedAt: date(entry.createdAt), score: confidence?.score,
    reasons: confidence ? [matched.length ? 'Matches: ' + matched.join(', ') : 'Ranked by importance, age, and recorded use.'] : [],
    effectiveState: annotations ? memoryState(annotations, entry.projectId, entry.id) : 'active',
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
    const writes = ['memory-review', 'memory-link', 'memory-unlink'];
    if (!['GET', 'POST'].includes(method) || (method === 'POST' && !['context', 'features', 'activity-report', ...writes].includes(route))) return send({ error: 'Method not allowed.' }, 405);
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
    if (route === 'telemetry') {
      const flags = settings.get().features;
      const common = { checkedAt: new Date().toISOString(), liveEnabled: flags.liveActivity, recordingEnabled: flags.activityRecording, demo: dependencies.demo === true };
      if (!flags.liveActivity) return send({ ...common, events: [], journalId: null, revision: 0, oldestSequence: null, latestSequence: 0,
        nextAfterSequence: 0, cursor: 0, hasMore: false, gap: false, reset: false, retainedCount: 0, droppedCount: 0 });
      const qs = url.searchParams;
      const cursor = qs.get('cursor');
      const journal = dependencies.journal ?? activityJournalFor(dependencies.brain ?? getGlobalBrain());
      const page = journal.read({ afterSequence: cursor === null ? undefined : bounded(cursor, 0, Number.MAX_SAFE_INTEGER, 0),
        journalId: query(qs, 'journalId'), projectId: query(qs, 'project'), limit: bounded(qs.get('limit'), 200, 200) });
      return send({ ...common, ...page, cursor: page.nextAfterSequence });
    }
    if (route === 'activity-report') {
      if (method !== 'POST') return send({ error: 'Use POST to report activity.' }, 405);
      const input = await body(req);
      return send(await reportAgentActivity(dependencies.brain ?? getGlobalBrain(), settings, input, dependencies.journal));
    }
    if (!['overview', 'memories', 'graph', 'context', 'memory', 'integrations', ...writes].includes(route)) return send({ error: 'Not found.' }, 404);
    if (route === 'context' && method !== 'POST') return send({ error: 'Use POST for context assembly.' }, 405);
    if (writes.includes(route) && method !== 'POST') return send({ error: 'Use POST for memory changes.' }, 405);

    const mutationInput = writes.includes(route) ? await body(req) : undefined;
    if (mutationInput) {
      if (!Number.isSafeInteger(mutationInput.expectedRevision) || Number(mutationInput.expectedRevision) < 0) throw new TypeError('A current expectedRevision is required.');
      const allowed = route === 'memory-review' ? ['projectId', 'memoryId', 'state', 'note', 'expectedRevision'] :
        route === 'memory-link' ? ['projectId', 'fromId', 'toId', 'type', 'note', 'expectedRevision'] : ['projectId', 'memoryId', 'linkId', 'expectedRevision'];
      if (Object.keys(mutationInput).some(key => !allowed.includes(key))) throw new TypeError('Unknown memory change field.');
    }

    const brain = dependencies.brain ?? getGlobalBrain();
    if (route === 'integrations') return send(inspectClientIntegrations({ projectDir: dependencies.projectDir, brain }));
    const annotationStore = dependencies.annotations ?? memoryAnnotationsFor(brain);
    const refresh = async () => {
      await brain.init();
      if (writes.includes(route)) brain.refresh();
      else await brain.sync();
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
        features: flags, annotations: flags.contextAssembly ? annotationStore.get() : undefined });
      return send(pack);
    }

    await refresh();
    const annotations = annotationStore.get();
    const qs = url.searchParams;
    const requestedProject = query(qs, 'project');
    if (route === 'memory') {
      const id = query(qs, 'id');
      if (!id || !requestedProject) throw new TypeError('Memory ID and project are required.');
      const memory = brain.getEntry(id);
      if (!memory || memory.projectId !== requestedProject) return send({ error: 'Memory not found in the selected project.' }, 404);
      const endpoint = (memoryId: string) => {
        const value = brain.getEntry(memoryId);
        return value?.projectId === requestedProject ? value : undefined;
      };
      const links = annotations.links.filter(link => link.projectId === requestedProject && [link.fromId, link.toId].includes(id))
        .map(link => ({ ...link, fromTitle: endpoint(link.fromId)?.content.slice(0, 130) ?? 'Unavailable memory',
          toTitle: endpoint(link.toId)?.content.slice(0, 130) ?? 'Unavailable memory',
          orphaned: !endpoint(link.fromId) || !endpoint(link.toId) }));
      const history = annotations.history.filter(event => event.projectId === requestedProject &&
        ((event.command.kind === 'review' && event.command.memoryId === id) ||
          (event.command.kind === 'link' && [event.command.fromId, event.command.toId].includes(id)) ||
          (event.relation && [event.relation.fromId, event.relation.toId].includes(id))));
      const review = annotations.reviews[id]?.projectId === requestedProject ? annotations.reviews[id] : null;
      return send({ memory: { ...summary(memory, annotations), content: memory.content, importance: memory.importance, createdAt: date(memory.createdAt) },
        review, effectiveState: memoryState(annotations, requestedProject, id), links, revision: annotations.revision, history,
        warnings: links.some(link => link.orphaned) ? ['A linked memory is no longer available. Recorded supersession remains until explicitly removed.'] : [] });
    }
    if (writes.includes(route)) {
      const input = mutationInput!;
      let command: unknown;
      if (route === 'memory-review') command = { kind: 'review', projectId: input.projectId, memoryId: input.memoryId, state: input.state, ...(input.note !== undefined ? { note: input.note } : {}) };
      else if (route === 'memory-link') command = { kind: 'link', projectId: input.projectId, fromId: input.fromId, toId: input.toId, type: input.type, ...(input.note !== undefined ? { note: input.note } : {}) };
      else {
        const memory = typeof input.memoryId === 'string' ? brain.getEntry(input.memoryId) : undefined;
        const link = annotations.links.find(item => item.id === input.linkId && item.projectId === input.projectId && [item.fromId, item.toId].includes(String(input.memoryId)));
        if (!memory || memory.projectId !== input.projectId || !link) return send({ error: 'Relationship not found in the selected memory and project.' }, 404);
        command = { kind: 'unlink', linkId: input.linkId };
      }
      const committed = await annotationStore.update(command, input.expectedRevision as number);
      return send({ revision: committed.revision, updatedAt: committed.updatedAt });
    }
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
      const scoped = inventory.filter(entry => !requestedProject || entry.projectId === requestedProject);
      const quality = { total: scoped.length, sourceBacked: 0, active: 0, contested: 0, archived: 0, superseded: 0, reviewed: 0 };
      for (const entry of scoped) {
        quality[memoryState(annotations, entry.projectId, entry.id)]++;
        if (sources(entry).length) quality.sourceBacked++;
        if (annotations.reviews[entry.id]?.projectId === entry.projectId) quality.reviewed++;
      }
      return send({ version: '7.1.3', totals: { projects: projects.length, memories: brain.getStats().totalEntries, agents: facets.agents.length },
        projects, ...activity(settings.get().features.liveActivity), storageHealth: brain.getStorageHealth(),
        features: settings.get().features, recentMemories: scoped.slice(0, 5).map(entry => summary(entry, annotations)), truncated: inventoryTruncated,
        quality, scope: { projectId: requestedProject ?? null, basis: 'recent-inventory' },
        inventoryLimit: INVENTORY_LIMIT });
    }
    const projectId = query(qs, 'project');
    const category = query(qs, 'category');
    const agentTool = query(qs, 'agent') as AgentTool | undefined;
    const search = query(qs, 'q');
    let entries: Memory[] = search ? brain.recallScored({ projectId, category, agentTool, keywords: search.split(/\s+/), limit: INVENTORY_LIMIT })
      : inventory.filter(entry => (!projectId || entry.projectId === projectId) && (!category || entry.category === category) && (!agentTool || entry.agentTool === agentTool));
    const stateFilter = query(qs, 'state');
    if (stateFilter && stateFilter !== 'all') {
      if (!['active', 'archived', 'contested', 'superseded'].includes(stateFilter)) throw new TypeError('Unknown memory state.');
      entries = entries.filter(entry => memoryState(annotations, entry.projectId, entry.id) === stateFilter);
    }
    if (route === 'memories') {
      const limit = bounded(qs.get('limit'), 30, 100);
      const offset = bounded(qs.get('offset'), 0, INVENTORY_LIMIT, 0);
      return send({ items: entries.slice(offset, offset + limit).map(entry => summary(entry, annotations)), total: entries.length, facets, truncated: inventoryTruncated, inventoryLimit: INVENTORY_LIMIT });
    }
    const limit = bounded(qs.get('limit'), 100, 180);
    const nodes: Array<Record<string, unknown>> = [];
    const edges: Array<{ id?: string; source: string; target: string; kind: string; note?: string }> = [];
    const selectedId = query(qs, 'memory');
    const selected = selectedId ? brain.getEntry(selectedId) : undefined;
    const shown = entries.slice(0, limit);
    if (selected && (!projectId || selected.projectId === projectId) && !shown.some(entry => entry.id === selected.id)) {
      if (shown.length >= limit) shown.pop();
      shown.unshift(selected);
    }
    const usedProjects = new Set<string>();
    const usedAgents = new Set<string>();
    for (const entry of shown) {
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
      const detail = summary(entry, annotations);
      nodes.push({ id: memoryNode, kind: 'memory', label: detail.title, project: entry.projectId, category: entry.category,
        memoryId: entry.id, effectiveState: detail.effectiveState, snippet: detail.snippet, source: detail.source, agent: entry.agentTool, updatedAt: detail.updatedAt });
      edges.push({ source: projectNode, target: memoryNode, kind: 'belongs-to' }, { source: agentNode, target: memoryNode, kind: 'recorded-by' });
    }
    const shownById = new Map(shown.map(entry => [entry.id, entry.projectId]));
    for (const link of annotations.links) {
      if (shownById.get(link.fromId) !== link.projectId || shownById.get(link.toId) !== link.projectId) continue;
      edges.push({ id: link.id, source: 'memory:' + link.fromId, target: 'memory:' + link.toId, kind: link.type, note: link.note });
    }
    return send({ nodes, edges, truncated: entries.length > limit || inventoryTruncated, shownMemories: shown.length, totalMemories: entries.length, facets });
  } catch (error) {
    const code = (error as { code?: string }).code;
    send({ error: error instanceof Error ? error.message : String(error), ...(code ? { code } : {}) },
      code === 'FEATURE_SETTINGS_CONFLICT' || code === 'ANNOTATIONS_CONFLICT' ? 409 : code === 'ANNOTATIONS_NOT_FOUND' ? 404 :
        code === 'FEATURE_SETTINGS_INVALID_PATCH' || code === 'ANNOTATIONS_INVALID_COMMAND' || code === 'ACTIVITY_JOURNAL_INVALID_EVENT' ||
          code === 'ACTIVITY_JOURNAL_INVALID_CURSOR' || error instanceof TypeError || error instanceof RangeError ? 400 : 500);
  }
}
