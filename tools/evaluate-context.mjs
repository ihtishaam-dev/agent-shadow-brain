#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { assembleContext } from '../dist/brain/context-assembly.js';
import { GlobalBrain } from '../dist/brain/global-brain.js';

const { values } = parseArgs({ options: {
  json: { type: 'string' }, markdown: { type: 'string' }, help: { type: 'boolean', short: 'h' },
} });
if (values.help) {
  process.stdout.write('Build first with npm run build.\n'
    + 'Run node tools/evaluate-context.mjs [--json report.json] [--markdown report.md].\n'
    + 'With no output options, prints JSON. Uses the bundled synthetic fixtures.\n');
  process.exit(0);
}

const fixturePath = 'tests/fixtures/context-evaluation-v7.1.4.json';
const [fixture, manifest] = await Promise.all([fixturePath, 'package.json'].map(async name =>
  JSON.parse(await readFile(new URL('../' + name, import.meta.url), 'utf8'))));
const rankCutoff = 5;
const rankTime = Date.parse(fixture.rankingTime);
const profiles = ['legacy', 'adaptive'];
const boundCheck = 'measures full render within declared limits';

function renderEntries(example) {
  return example.entries.flatMap(row => Array.from({ length: row.copies ?? 1 }, (_, index) => {
    const projectId = row.projectId ?? 'alpha';
    return {
      id: row.copies ? row.id + '-' + String(index + 1).padStart(3, '0') : row.id,
      projectId, projectName: 'Synthetic ' + projectId,
      category: row.category ?? 'lesson', agentTool: row.agentTool ?? 'codex', importance: row.importance ?? 0.7,
      content: (row.contentPrefix?.text.repeat(row.contentPrefix.count) ?? '') + row.content
        + (row.contentSuffix?.text.repeat(row.contentSuffix.count) ?? ''),
      metadata: row.metadata ?? {}, createdAt: fixture.entryTime, lastAccessed: fixture.entryTime, accessCount: 0,
    };
  }));
}

function renderAnnotations(example) {
  if (!example.reviews && !example.links) return undefined;
  return {
    schemaVersion: 1, revision: 1, updatedAt: fixture.entryTime, history: [],
    reviews: Object.fromEntries(Object.entries(example.reviews ?? {}).map(([id, state]) => [
      id, { projectId: 'alpha', state, note: '', updatedAt: fixture.entryTime },
    ])),
    links: (example.links ?? []).map(link => ({ projectId: 'alpha', note: '', createdAt: fixture.entryTime, ...link })),
  };
}

function rankMetrics(ids, relevant) {
  if (!relevant.length) return null;
  const result = ids.slice(0, rankCutoff);
  const rank = result.findIndex(id => relevant.includes(id)) + 1;
  const retrievedRelevant = relevant.filter(id => result.includes(id)).length;
  return { retrievedRelevant, recall: retrievedRelevant / relevant.length,
    firstRelevantRank: rank || null, reciprocalRank: rank ? 1 / rank : 0 };
}

function assess(example, pack, profile, elapsedMs, unchanged) {
  const selected = pack.entries.map(entry => entry.id);
  const candidates = pack.retrieval?.candidates;
  const match = (id) => pack.entries.find(entry => entry.id === id);
  const diagnostic = (id) => candidates?.find(item => item.id === id);
  const checks = [];
  const check = (name, pass) => checks.push({ name, passed: !!pass });
  const missingRelevant = example.relevant.filter(id => !selected.includes(id));
  const includedForbidden = example.forbidden.filter(id => selected.includes(id));
  const serialized = JSON.stringify(pack);
  const scopeChecked = !!(example.hiddenIds?.length || example.hiddenText?.length);
  const leakedIds = (example.hiddenIds ?? []).filter(id => serialized.includes(JSON.stringify(id)));
  const leakedText = (example.hiddenText ?? []).filter(text => serialized.includes(text));

  check('includes relevant IDs', missingRelevant.length === 0);
  check('excludes forbidden IDs', includedForbidden.length === 0);
  if (scopeChecked) check('keeps foreign ID, title, content, and source out of the response', !leakedIds.length && !leakedText.length);
  check(boundCheck, pack.budget.usedChars === pack.markdown.length
    && pack.markdown.length <= pack.budget.maxChars && pack.budget.estimatedTokens <= pack.budget.tokenBudget);
  check('leaves fixture store unchanged', unchanged);
  if (profile === 'adaptive') {
    check('reports adaptive decisions for the assembled context', pack.retrieval?.profile === profile
      && JSON.stringify(candidates.filter(item => item.decision === 'selected').map(item => item.id)) === JSON.stringify(selected));
  }
  if (example.first) check('ranks expected record first', selected[0] === example.first);
  if (example.expectedCount !== undefined) check('returns expected context count', selected.length === example.expectedCount);
  if (example.passage) check('shows expected passage in the excerpt', match(example.passage.id)?.excerpt.includes(example.passage.includes));
  if (example.markdownIncludes) check('renders the expected warning', pack.markdown.includes(example.markdownIncludes));
  if (example.reference) check('preserves reference and original memory ID', match(example.reference.id)?.sourceReferences.some(ref =>
    ref.source === example.reference.source && ref.memoryId === example.reference.memoryId));
  if (profile === 'adaptive') {
    if (example.matchedField) check('explains the matched evidence field', diagnostic(example.matchedField.id)?.matchedFields.includes(example.matchedField.field));
    if (example.path) check('preserves the original recorded graph path', diagnostic(example.path.id)?.paths.some(link =>
      link.relationId === example.path.relationId && link.seedId === example.path.seedId));
    if (example.requiresUnicodeBudget) {
      check('uses the Unicode and code estimate on actual rendered bytes', pack.budget.estimator === 'unicode-code-heuristic'
        && pack.budget.usedBytes === Buffer.byteLength(pack.markdown) && pack.budget.estimatedTokens > Math.ceil(pack.markdown.length / 4));
    }
  }
  if (example.includeCrossProject) {
    check('labels both project origins', pack.scope === 'cross-project' && pack.markdown.includes('Synthetic alpha')
      && pack.markdown.includes('Synthetic beta'));
  }
  return {
    passed: checks.every(result => result.passed), selected, missingRelevant, includedForbidden, scopeChecked, leakedIds, leakedText, checks,
    contextAtK: rankMetrics(selected, example.relevant),
    candidateAtK: candidates ? rankMetrics(candidates.filter(item => item.reason !== 'duplicate').map(item => item.id), example.relevant) : null,
    abstained: example.relevant.length === 0 ? selected.length === 0 : null,
    budget: pack.budget, elapsedMs: Math.round(elapsedMs * 1000) / 1000,
  };
}

async function evaluate(example, index) {
  const root = path.resolve(os.tmpdir());
  const dir = await mkdtemp(path.join(root, 'asb-context-evaluation-'));
  const dbPath = path.join(dir, 'global.json');
  const brain = GlobalBrain.getInstance({ dbPath, syncIntervalMs: 60_000 });
  const realNow = Date.now;
  try {
    const entries = renderEntries(example);
    const bytes = JSON.stringify({ schemaVersion: 1, entries, projects: [], agents: [] });
    await writeFile(dbPath, bytes, 'utf8');
    await brain.init();
    const options = {
      projectId: 'alpha', query: example.query, annotations: renderAnnotations(example),
      tokenBudget: example.tokenBudget ?? 2000, includeCrossProject: example.includeCrossProject === true,
      features: { contextAssembly: true, crossProjectContext: example.crossProjectSetting === true },
    };
    const outcomes = {};
    // Keep clock-dependent scores fixed and alternate the profile order.
    const order = index % 2 === 0 ? profiles : [...profiles].reverse();
    for (const profile of order) {
      Date.now = () => rankTime;
      const start = performance.now();
      const pack = assembleContext(brain, { ...options, profile });
      const elapsedMs = performance.now() - start;
      Date.now = realNow;
      outcomes[profile] = assess(example, pack, profile, elapsedMs, await readFile(dbPath, 'utf8') === bytes);
    }
    return {
      id: example.id, name: example.name, query: example.query, records: entries.length, corpusBytes: Buffer.byteLength(bytes),
      relevantIds: example.relevant, forbiddenIds: example.forbidden, order, legacyControl: example.legacyShouldPass === true,
      legacy: outcomes.legacy, adaptive: outcomes.adaptive,
    };
  } finally {
    Date.now = realNow;
    await brain.shutdown();
    if (path.dirname(dir) === root && path.basename(dir).startsWith('asb-context-evaluation-')) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function summarize(cases, profile) {
  const outcomes = cases.map(row => row[profile]);
  const labeled = outcomes.filter(row => row.contextAtK);
  const elapsed = outcomes.map(row => row.elapsedMs).sort((a, b) => a - b);
  const center = Math.floor(elapsed.length / 2);
  const average = (key) => labeled.reduce((sum, item) => sum + item.contextAtK[key], 0) / labeled.length;
  return {
    casesPassed: outcomes.filter(row => row.passed).length, labeledCases: labeled.length,
    meanContextRecallAtK: average('recall'), meanContextReciprocalRankAtK: average('reciprocalRank'),
    abstentions: outcomes.filter(row => row.abstained === true).length,
    scopeChecks: outcomes.filter(row => row.scopeChecked).length,
    scopeLeaks: outcomes.filter(row => row.leakedIds.length || row.leakedText.length).length,
    budgetViolations: outcomes.filter(row => row.checks.some(check => check.name === boundCheck && !check.passed)).length,
    elapsedMs: { min: elapsed[0], median: elapsed.length % 2 ? elapsed[center] : (elapsed[center - 1] + elapsed[center]) / 2, max: elapsed.at(-1) },
  };
}

function renderMarkdown(report) {
  const result = (outcome) => outcome.passed ? 'Pass' : outcome.checks.filter(check => !check.passed).map(check => check.name).join(', ');
  const lines = [
    '# Agent Shadow Brain ' + report.packageVersion + ' context evaluation',
    '',
    'Paired runs used the same author-generated corpus and options for each case. Each profile assembled context from the compiled package after its isolated JSON store had loaded.',
    '',
    '| Profile | Cases passed | Context recall@' + rankCutoff + ' | Context MRR@' + rankCutoff + ' | Scope leaks | Budget violations | Median assembly |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const profile of profiles) {
    const row = report.summary[profile];
    lines.push('| ' + [profile, row.casesPassed + ' / ' + report.cases.length, row.meanContextRecallAtK.toFixed(3),
      row.meanContextReciprocalRankAtK.toFixed(3), row.scopeLeaks + ' / ' + row.scopeChecks, row.budgetViolations, row.elapsedMs.median.toFixed(3) + ' ms'].join(' | ') + ' |');
  }
  lines.push('', '| Fixture | Records | Legacy checks | Adaptive checks |', '| --- | ---: | --- | --- |');
  for (const row of report.cases) lines.push('| ' + [row.name, row.records, result(row.legacy), result(row.adaptive)].join(' | ') + ' |');
  lines.push('', 'Runtime used ' + report.runtime.node + ' on ' + report.runtime.platform + '/' + report.runtime.arch + '. Each case has one warm-store assembly measurement per profile. The first profile alternates by case.',
    '', 'Recall and reciprocal rank use the first ' + rankCutoff + ' selected context entries and explicit relevant IDs. The no-evidence case is evaluated as abstention. Candidate explanations and the new estimate method are checked only where the adaptive profile provides them.',
    '', ...report.limitations.map(item => '- ' + item), '',
    'Run npm run build followed by node tools/evaluate-context.mjs to reproduce the paired JSON results.', '');
  return lines.join('\n');
}

const cases = [];
for (const [index, example] of fixture.cases.entries()) cases.push(await evaluate(example, index));
const report = {
  schemaVersion: 1, packageVersion: manifest.version, generatedAt: new Date().toISOString(), rankingTime: fixture.rankingTime,
  runtime: { node: process.version, platform: process.platform, arch: process.arch, timing: 'warm in-memory assembly; one run per case and profile; alternating order' },
  fixture: fixturePath, rankCutoff,
  limitations: [
    'The author-generated fixtures target named behaviors and do not measure model answer quality or competitor performance.',
    'Token counts are profile-specific estimates and may differ from a receiving model’s tokenizer.',
    'Timing covers context assembly after loading each store and excludes initialization, packaging, UI, and model calls.',
    'Lexical variants and recorded links do not provide general semantic paraphrase retrieval or factual verification.',
  ],
  summary: Object.fromEntries(profiles.map(profile => [profile, summarize(cases, profile)])),
  legacyControlFailures: cases.filter(row => row.legacyControl && !row.legacy.passed).map(row => row.id),
  adaptiveFailures: cases.filter(row => !row.adaptive.passed).map(row => row.id),
  cases,
};
const json = JSON.stringify(report, null, 2) + '\n';
if (!values.json && !values.markdown) process.stdout.write(json);
if (values.json) await writeFile(path.resolve(values.json), json, 'utf8');
if (values.markdown) await writeFile(path.resolve(values.markdown), renderMarkdown(report), 'utf8');
for (const [label, failures] of [['Adaptive context checks', report.adaptiveFailures], ['Legacy control checks', report.legacyControlFailures]]) {
  if (!failures.length) continue;
  process.stderr.write(label + ' failed for ' + failures.join(', ') + '.\n');
  process.exitCode = 1;
}
