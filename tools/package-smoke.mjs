import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';

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
assert(pack.files.some(file => file.path === `docs/launch/RELEASE_NOTES_v${expected.version}.md`));
const bundledNames = ['shadow-workflow', 'shadow-implement', 'shadow-debug', 'shadow-review', 'shadow-research', 'shadow-release'];
for (const name of bundledNames) assert(pack.files.some(file => file.path === `skills/${name}/SKILL.md`));
assert(pack.files.some(file => file.path === 'docs/assets/context-flow-v7.2.png'));
assert(pack.files.some(file => file.path === 'docs/WORKSPACE.md'));
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

// Exercise the real packaged CLI from a different cwd and all native layouts.
const project = path.join(sandbox, 'project');
fs.mkdirSync(project);
const originalInstructions = '# Project\r\n\r\nPreserve this user guidance: \u03bb.\r\n';
fs.writeFileSync(path.join(project, 'AGENTS.md'), originalInstructions);
const catalog = JSON.parse(runNode([cli, 'skills', 'list', '--json']));
assert.deepEqual(catalog.map(item => item.name).sort(), [...bundledNames].sort());
assert.match(runNode([cli, 'skills', 'show', 'shadow-debug']), /diagnos/i);
const preview = JSON.parse(runNode([cli, 'skills', 'install', project, '--target', 'all', '--json']));
assert(preview.files.some(file => file.relativePath === '.dsh/skills/shadow-debug/SKILL.md'));
assert.deepEqual(fs.readdirSync(project), ['AGENTS.md'], 'preview must not write directories or metadata');
const install = JSON.parse(runNode([cli, 'skills', 'install', project, '--target', 'all', '--apply', '--json']));
assert(install.created.length >= 24);
assert(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8').startsWith(originalInstructions));
for (const skillRoot of ['.agents/skills', '.claude/skills', '.opencode/skills', '.dsh/skills']) {
  for (const name of bundledNames) assert.equal(
    fs.readFileSync(path.join(project, skillRoot, name, 'SKILL.md'), 'utf8'),
    fs.readFileSync(path.join(installed, 'skills', name, 'SKILL.md'), 'utf8'),
  );
}
const second = JSON.parse(runNode([cli, 'skills', 'install', project, '--target', 'all', '--apply', '--json']));
assert.equal(second.created.length + second.updated.length, 0, 'installation must be idempotent');
const customized = path.join(project, '.agents/skills/shadow-debug/SKILL.md');
fs.appendFileSync(customized, '\nLocal user edit.\n');
const changedBytes = fs.readFileSync(customized);
const conflicts = JSON.parse(runNode([cli, 'skills', 'install', project, '--target', 'all', '--json'], 1));
assert(conflicts.files.some(file => file.relativePath === '.agents/skills/shadow-debug/SKILL.md' && file.action === 'conflict'));
assert.deepEqual(fs.readFileSync(customized), changedBytes);
const simple = JSON.parse(runNode([cli, 'workflow', 'analyze', 'Fix the grammar in this sentence: she go home', '--json']));
assert.equal(simple.mode, 'direct');
assert.deepEqual(simple.skills, []);
const planning = JSON.parse(runNode([cli, 'workflow', 'analyze', 'Plan a storage migration; do not edit files', '--json']));
assert.equal(planning.mode, 'plan-only');
assert(!planning.steps.some(step => ['implement', 'fix', 'release'].includes(step.id)));
const requestFile = path.join(sandbox, 'request.txt');
fs.writeFileSync(requestFile, 'Review this change and report findings');
const review = JSON.parse(runNode([cli, 'workflow', 'analyze', '--request-file', requestFile, '--type', 'review', '--json']));
assert.equal(review.taskType, 'review');
assert(!review.steps.some(step => step.id === 'fix'));
const workflowProbe = path.join(consumer, 'workflow-probe.mjs');
fs.writeFileSync(workflowProbe, `import assert from 'node:assert/strict';
import { analyzeTask, listBundledSkills, getBundledSkill, listWorkflowTargets, planSkillInstall } from '@theihtisham/agent-shadow-brain';
assert.equal(listBundledSkills().length, 6);
assert.match(getBundledSkill('shadow-workflow').content, /scope/i);
assert.equal(listWorkflowTargets().find(t => t.target === 'deepseek-harness').skillRoot, '.dsh/skills');
assert.equal(analyzeTask('Explain the result').mode, 'direct');
assert(planSkillInstall({ projectDir: ${JSON.stringify(project)}, targets: ['codex'] }).files.some(f => f.action === 'conflict'));
`);
runNode([workflowProbe]);
const context = JSON.parse(runNode([cli, 'context-pack', 'durable storage', '--project-id', 'fixture', '--db', db, '--token-budget', '250', '--json']));
assert.equal(context.enabled, true);
assert.equal(context.entries.length, 1);
assert.equal(context.entries[0].projectId, 'fixture');
assert(context.budget.usedChars <= context.budget.maxChars);
assert(context.budget.estimatedTokens <= 250);
const featureFile = path.join(sandbox, 'flags.json');
const defaults = JSON.parse(runNode([cli, 'features', 'list', '--settings', featureFile]));
assert.equal(defaults.features.crossProjectContext, false);
assert.equal(defaults.definitions.length, 4);
assert(!fs.existsSync(featureFile), 'listing default settings must not create a file');
const disabled = JSON.parse(runNode([cli, 'features', 'set', 'contextAssembly', 'off', '--settings', featureFile]));
assert.equal(disabled.features.contextAssembly, false);
const noContext = JSON.parse(runNode([cli, 'context-pack', 'durable storage', '--project-id', 'fixture', '--db', invalid, '--settings', featureFile, '--json']));
assert.equal(noContext.enabled, false, 'disabled assembly must bypass the invalid memory store');
const contextProbe = path.join(consumer, 'context-probe.mjs');
fs.writeFileSync(contextProbe, `import assert from 'node:assert/strict';
import { FeatureSettingsStore, assembleContext } from '@theihtisham/agent-shadow-brain';
const features = new FeatureSettingsStore({filePath: ${JSON.stringify(featureFile)}}).get().features;
const pack = assembleContext({recallScored() { throw new Error('Disabled context must not read memories'); }}, {projectId:'fixture', features});
assert.equal(pack.enabled, false);
`);
runNode([contextProbe]);
const { WORKSPACE_HTML } = await import(pathToFileURL(path.join(installed, 'dist/dashboard/workspace-html.js')).href);
assert(WORKSPACE_HTML.includes('Memory relationships'));
for (const [, script] of WORKSPACE_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script);
assert(!fs.existsSync(path.join(sandbox, 'config')), 'workflow/skills must not initialize provider configuration');
console.log(JSON.stringify({ status: 'PASS', version: manifest.version, tarball, integrity: pack.integrity, checks: ['pack allowlist', 'fresh install', 'library import', 'CLI version/help', 'durable write', 'storage health', 'explained recall', 'corrupt-store preservation', 'configuration isolation', 'six packaged skills', 'all four client layouts', 'preview without writes', 'instruction preservation', 'idempotent install', 'local-edit conflict', 'workflow CLI/file/library', 'scoped context CLI/library', 'persistent feature controls', 'disabled memory-read bypass', 'workspace scripts and artwork'] }, null, 2));
