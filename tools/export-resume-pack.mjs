#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateContextResumePack } from '../dist/brain/context-continuity.js';
import { getGlobalBrain, GlobalBrain } from '../dist/brain/global-brain.js';

function readArg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function readFlag(name) {
  return process.argv.includes(name);
}

const projectDir = path.resolve(readArg('--project-dir', process.cwd()));
const out = readArg('--out', '');
const format = String(readArg('--format', 'markdown')).toLowerCase();
const limit = Number.parseInt(readArg('--limit', '12'), 10);
const globalFallback = readFlag('--global-fallback');

const brain = getGlobalBrain();
await brain.init();

try {
  const projectId = GlobalBrain.projectIdFor(projectDir);
  let entries = brain.recall({ projectId, minImportance: 0, limit: 500 });
  let projectScoped = true;
  if (!entries.length && globalFallback) {
    projectScoped = false;
    entries = brain.recall({ minImportance: 0, limit: 500 });
  }

  const pack = generateContextResumePack({
    projectDir,
    projectId,
    projectName: path.basename(projectDir),
    entries,
    maxMemories: Number.isFinite(limit) ? Math.max(1, Math.min(30, limit)) : 12,
  });
  const payload = format === 'json'
    ? JSON.stringify({ ...pack, projectScoped }, null, 2)
    : pack.markdown;

  if (out) {
    const outPath = path.resolve(out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, payload, 'utf-8');
    console.log(JSON.stringify({ ok: true, out: outPath, format, projectScoped, memoryCount: entries.length }, null, 2));
  } else {
    process.stdout.write(payload);
  }
} finally {
  await brain.shutdown();
}
