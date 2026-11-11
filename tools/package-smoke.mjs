import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// Test the packed artifact in a fresh consumer project, without touching user stores.
const root = fileURLToPath(new URL('../', import.meta.url));
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-brain-package-'));
const consumer = path.join(sandbox, 'consumer');
fs.mkdirSync(consumer);
const expected = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert(process.env.npm_execpath, 'Run with npm run test:package');
const npm = args => {
  // npm 12 forwards its run-script permission through the environment, but
  // rejects that option on nested local installs. Lifecycle scripts stay off.
  const npmEnv = { ...process.env };
  delete npmEnv.npm_config_allow_scripts;
  delete npmEnv.NPM_CONFIG_ALLOW_SCRIPTS;
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: root, encoding: 'utf8', timeout: 120_000, env: npmEnv,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
};
const packOutput = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', sandbox]));
const pack = Array.isArray(packOutput) ? packOutput[0] : Object.values(packOutput)[0];
const tarball = path.join(sandbox, pack.filename);
assert(pack.files.some(file => file.path === 'dist/brain/global-brain.js'));
assert(pack.files.some(file => file.path === 'docs/launch/RELEASE_NOTES_v7.0.0.md'));
assert(!pack.files.some(file => /(^|\/)(tests|node_modules|work|outputs|\.git|\.env|\.npmrc)(\/|$)/.test(file.path)));
fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
npm(['install', '--prefix', consumer, '--ignore-scripts', '--no-audit', '--no-fund', tarball]);
const installed = path.join(consumer, 'node_modules', '@theihtisham', 'agent-shadow-brain');
const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
assert.equal(manifest.version, expected.version);
assert.equal(manifest.scripts.postinstall, undefined);

// Redirect default OS home lookups before importing any package code, without
// altering HOME/USERPROFILE or accessing any real provider configuration.
const isolatedHome = path.join(sandbox, 'home');
fs.mkdirSync(isolatedHome);
const preload = path.join(sandbox, 'isolate.mjs');
fs.writeFileSync(preload, `import os from 'node:os';\nimport { syncBuiltinESMExports } from 'node:module';\nos.homedir = () => ${JSON.stringify(isolatedHome)};\nsyncBuiltinESMExports();\n`);
const runNode = (args, status = 0) => {
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, ...args], {
    cwd: consumer, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, SHADOW_BRAIN_CONFIG_DIR: path.join(sandbox, 'config') },
  });
  assert.equal(result.status, status, result.stderr || result.stdout);
  return result.stdout;
};
const cli = path.join(installed, 'dist', 'cli.js');
assert.equal(runNode([cli, '--version']).trim(), expected.version);
assert.match(runNode([cli, '--help']), /storage-health/);
assert(!fs.existsSync(path.join(sandbox, 'config')), 'help/version must not load or create configuration');
const db = path.join(sandbox, 'global.json');
const probe = path.join(consumer, 'probe.mjs');
fs.writeFileSync(probe, `import assert from 'node:assert/strict';
import { getGlobalBrain } from '@theihtisham/agent-shadow-brain';
const brain = getGlobalBrain({ dbPath: ${JSON.stringify(db)}, syncIntervalMs: 60000 });
await brain.init();
brain.writeSync({ projectId: 'fixture', projectName: 'Fixture', agentTool: 'codex', category: 'lesson', content: 'Verify durable storage before publishing', importance: 0.8, metadata: {} });
assert.equal(brain.getStorageHealth().status, 'pending');
await brain.sync();
assert.equal(brain.getStorageHealth().status, 'healthy');
await brain.shutdown();
`);
runNode([probe]);
const before = fs.readFileSync(db);
const health = JSON.parse(runNode([cli, 'storage-health', '--db', db, '--json']));
assert.equal(health.status, 'healthy');
assert.deepEqual(fs.readFileSync(db), before, 'health command must preserve store bytes');
const recalls = JSON.parse(runNode([cli, 'recall-explain', 'durable storage', '--db', db]));
assert.equal(recalls.length, 1);
assert(recalls[0].confidence.explanation.matchedKeywords.includes('durable'));
assert.deepEqual(fs.readFileSync(db), before, 'recall must preserve store bytes');
const invalid = path.join(sandbox, 'invalid.json');
fs.writeFileSync(invalid, '{invalid');
const failure = JSON.parse(runNode([cli, 'storage-health', '--db', invalid, '--json'], 1));
assert.equal(failure.status, 'error');
assert.equal(fs.readFileSync(invalid, 'utf8'), '{invalid');
assert(!fs.existsSync(path.join(sandbox, 'config')), 'diagnostics must not load provider configuration');
console.log(JSON.stringify({ status: 'PASS', version: manifest.version, tarball, integrity: pack.integrity, checks: ['pack allowlist', 'fresh install', 'library import', 'CLI version/help', 'durable write', 'storage health', 'explained recall', 'corrupt-store preservation', 'configuration isolation'] }, null, 2));
