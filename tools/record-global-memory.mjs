#!/usr/bin/env node
import path from 'node:path';
import { getGlobalBrain } from '../dist/brain/global-brain.js';

function readArg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function readFlag(name) {
  return process.argv.includes(name);
}

function splitList(value) {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

const projectDir = path.resolve(readArg('--project-dir', process.cwd()));
const projectName = readArg('--project-name', path.basename(projectDir));
const agentTool = readArg('--agent', 'codex');
const category = readArg('--category', 'learning');
const content = readArg('--content');
const importance = Number.parseFloat(readArg('--importance', '0.75'));
const tags = splitList(readArg('--tags', ''));
const sources = splitList(readArg('--sources', ''));
const seedId = readArg('--seed-id', '');

if (!content) {
  console.error('Missing --content "memory text"');
  process.exit(2);
}

const brain = getGlobalBrain();
await brain.init();

try {
  const projectId = brain.registerProject(projectDir, projectName);
  brain.registerAgent(agentTool);

  if (seedId) {
    const existing = brain.recall({ keywords: [seedId], category, limit: 1 });
    if (existing.length && !readFlag('--force')) {
      console.log(JSON.stringify({ skipped: true, seedId, existingId: existing[0].id }, null, 2));
      process.exit(0);
    }
  }

  const id = brain.writeSync({
    projectId,
    projectName,
    agentTool,
    category,
    content: seedId ? `[seed:${seedId}] ${content}` : content,
    importance: Number.isFinite(importance) ? importance : 0.75,
    metadata: {
      seedId: seedId || undefined,
      tags,
      sources,
      recordedBy: 'tools/record-global-memory.mjs',
      recordedAt: new Date().toISOString(),
    },
  });

  await brain.sync();
  console.log(JSON.stringify({ id, projectId, projectName, category, tags, sources }, null, 2));
} finally {
  await brain.shutdown();
}
