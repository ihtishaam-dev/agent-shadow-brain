import * as fs from 'node:fs';
import * as path from 'node:path';
import { GlobalBrain } from './global-brain.js';
import { projectLocalPath, projectRoot, readProjectFile, skipProjectTreeName } from './project-kit-paths.js';

export interface ProjectProfile {
  schemaVersion: 1;
  projectId: string;
  projectName: string;
  root: string;
  observedAt: string;
  stack: string[];
  packageManagers: string[];
  evidence: Array<{ path: string; kind: 'manifest' | 'lockfile' | 'marker'; signals: string[] }>;
  checks: Array<{ label: string; command: string; source: string }>;
  coverage: { entries: number; limit: number; truncated: boolean };
  warnings: string[];
}

const ENTRY_LIMIT = 500;
const DIRECTORY_DEPTH = 3;
const MANIFEST_LIMIT = 64 * 1024;
const EVIDENCE_LIMIT = 80;
const CHECK_LIMIT = 30;
const NODE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;
type NodeManager = typeof NODE_MANAGERS[number];

const LOCKS = new Map([
  ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['composer.lock', 'Composer'], ['poetry.lock', 'Poetry'],
  ['uv.lock', 'uv'], ['pipfile.lock', 'Pipenv'], ['cargo.lock', 'Cargo'], ['go.sum', 'Go modules'],
  ['gemfile.lock', 'Bundler'], ['mix.lock', 'Mix'], ['pubspec.lock', 'Pub'],
]);
const MANIFESTS = new Map([
  ['package.json', 'Node.js'], ['composer.json', 'PHP'], ['pyproject.toml', 'Python'], ['requirements.txt', 'Python'],
  ['pipfile', 'Python'], ['go.mod', 'Go'], ['cargo.toml', 'Rust'], ['gemfile', 'Ruby'], ['mix.exs', 'Elixir'],
  ['pom.xml', 'Java'], ['build.gradle', 'Gradle'], ['build.gradle.kts', 'Gradle'], ['package.swift', 'Swift'],
  ['pubspec.yaml', 'Dart'], ['deno.json', 'Deno'], ['deno.jsonc', 'Deno'],
]);
const FRAMEWORKS = new Map([
  ['typescript', 'TypeScript'], ['react', 'React'], ['react-native', 'React Native'], ['next', 'Next.js'],
  ['vite', 'Vite'], ['vue', 'Vue'], ['nuxt', 'Nuxt'], ['svelte', 'Svelte'], ['@sveltejs/kit', 'SvelteKit'],
  ['@angular/core', 'Angular'], ['astro', 'Astro'], ['express', 'Express'], ['fastify', 'Fastify'],
  ['@nestjs/core', 'NestJS'], ['electron', 'Electron'], ['vitest', 'Vitest'], ['jest', 'Jest'],
  ['@playwright/test', 'Playwright'], ['laravel/framework', 'Laravel'], ['symfony/framework-bundle', 'Symfony'],
  ['phpunit/phpunit', 'PHPUnit'],
]);
const SCRIPTS = new Map([
  ['test', 'Test'], ['test:unit', 'Unit tests'], ['test:e2e', 'End-to-end tests'], ['lint', 'Lint'],
  ['typecheck', 'Type check'], ['type-check', 'Type check'], ['check', 'Check'], ['verify', 'Verify'], ['build', 'Build'],
]);

function evidenceFor(relative: string): ProjectProfile['evidence'][number] | undefined {
  const name = path.posix.basename(relative).toLowerCase();
  const lock = LOCKS.get(name);
  if (lock) return { path: relative, kind: 'lockfile', signals: [lock] };
  const manifest = MANIFESTS.get(name);
  if (manifest) return { path: relative, kind: 'manifest', signals: [manifest] };
  let marker: string | undefined;
  if (name === 'tsconfig.json') marker = 'TypeScript';
  else if (name === 'dockerfile' || /^compose\.ya?ml$/.test(name) || /^docker-compose\.ya?ml$/.test(name)) marker = 'Docker';
  else if (/\.(csproj|fsproj|sln|slnx)$/.test(name)) marker = '.NET';
  else if (relative.toLowerCase() === 'projectsettings/projectversion.txt') marker = 'Unity';
  else if (name.endsWith('.uproject')) marker = 'Unreal Engine';
  else if (name === 'project.godot') marker = 'Godot';
  else if (name.endsWith('.blend')) marker = 'Blender';
  return marker ? { path: relative, kind: 'marker', signals: [marker] } : undefined;
}

function walkProject(root: string, warnings: Set<string>) {
  const pending: Array<{ relative: string; depth: number }> = [{ relative: '', depth: 0 }];
  const evidence: ProjectProfile['evidence'] = [];
  let entries = 0;
  let truncated = false;
  for (const directory of pending) {
    if (entries >= ENTRY_LIMIT) { truncated = true; break; }
    try {
      const absolute = directory.relative ? projectLocalPath(root, directory.relative) : root;
      const handle = fs.opendirSync(absolute);
      try {
        for (let child = handle.readSync(); child; child = handle.readSync()) {
          if (entries === ENTRY_LIMIT) { truncated = true; break; }
          entries++;
          if (skipProjectTreeName(child.name) || child.isSymbolicLink()) continue;
          const relative = directory.relative ? directory.relative + '/' + child.name : child.name;
          if (child.isDirectory()) {
            if (directory.depth + 1 < DIRECTORY_DEPTH) pending.push({ relative, depth: directory.depth + 1 });
            else truncated = true;
          } else if (child.isFile()) {
            const item = evidenceFor(relative);
            if (!item) continue;
            try {
              const stat = fs.lstatSync(projectLocalPath(root, relative), { throwIfNoEntry: false });
              if (stat?.isFile() && stat.nlink === 1) evidence.push(item);
            } catch {
              warnings.add('Some project markers were unavailable or linked.');
            }
          }
        }
      } finally {
        handle.closeSync();
      }
    } catch {
      warnings.add('Some project directories or markers could not be safely inspected.');
    }
  }
  evidence.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (truncated) warnings.add('Inspection reached its depth or entry limit. The profile may omit deeper components.');
  if (evidence.length > EVIDENCE_LIMIT) warnings.add('Only the first 80 recognized project markers are shown.');
  return { evidence: evidence.slice(0, EVIDENCE_LIMIT), coverage: { entries, limit: ENTRY_LIMIT, truncated: truncated || evidence.length > EVIDENCE_LIMIT } };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nodeManager(value: unknown): NodeManager | undefined {
  return typeof value === 'string' ? NODE_MANAGERS.find(manager => value.startsWith(manager + '@')) : undefined;
}

function observeManifest(
  root: string, entry: ProjectProfile['evidence'][number], nearbyLocks: readonly string[],
  managers: Set<string>, checks: ProjectProfile['checks'], warnings: Set<string>,
): void {
  const filename = path.posix.basename(entry.path).toLowerCase();
  if (filename !== 'package.json' && filename !== 'composer.json') return;
  try {
    const buffer = readProjectFile(root, entry.path, MANIFEST_LIMIT);
    if (!buffer) return;
    const manifest = object(JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')));
    const node = filename === 'package.json';
    const dependencies = node ? [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies] :
      [manifest.require, manifest['require-dev']];
    for (const [name, label] of FRAMEWORKS) {
      if (dependencies.some(section => Object.hasOwn(object(section), name))) entry.signals.push(label);
    }
    const declared = node ? nodeManager(manifest.packageManager) : 'Composer';
    if (declared) {
      managers.add(declared);
      entry.signals.push(declared);
    }
    const scripts = object(manifest.scripts);
    const locked = nearbyLocks.find(manager => NODE_MANAGERS.some(known => manager === known));
    const runner = declared ?? locked ?? 'npm';
    for (const [script, label] of SCRIPTS) {
      if (!Object.hasOwn(scripts, script)) continue;
      if (node && !declared && !locked) warnings.add('Node checks without a declared or lockfile package manager use npm command syntax.');
      const command = node ? runner + ' run ' + script : 'composer run-script ' + script;
      checks.push({ label, command, source: entry.path });
    }
  } catch {
    warnings.add('A recognized JSON manifest could not be read as a regular, bounded JSON file.');
  }
}

/** Inspect one explicit project using only known marker names and allowlisted manifest fields. */
export function inspectProject(value: string): ProjectProfile {
  const root = projectRoot(value);
  const warnings = new Set<string>();
  const { evidence, coverage } = walkProject(root, warnings);
  const checks: ProjectProfile['checks'] = [];
  const stack = new Set<string>();
  const packageManagers = new Set<string>();
  const localLocks = new Map<string, string[]>();
  for (const entry of evidence) {
    if (entry.kind === 'lockfile') {
      const manager = entry.signals[0];
      const parent = path.posix.dirname(entry.path);
      localLocks.set(parent, [...localLocks.get(parent) ?? [], manager]);
      packageManagers.add(manager);
    }
  }
  for (const entry of evidence) {
    if (entry.kind === 'lockfile') continue;
    const before = entry.signals[0];
    stack.add(before);
    observeManifest(root, entry, localLocks.get(path.posix.dirname(entry.path)) ?? localLocks.get('.') ?? [], packageManagers, checks, warnings);
    for (const signal of entry.signals.slice(1)) {
      if (!packageManagers.has(signal)) stack.add(signal);
    }
  }
  if (!evidence.length) warnings.add('No recognized stack markers were found in the bounded scan.');
  if (checks.length > CHECK_LIMIT) warnings.add('Only the first 30 declared checks are shown.');
  return {
    schemaVersion: 1, projectId: GlobalBrain.projectIdFor(root), projectName: path.basename(root), root,
    observedAt: new Date().toISOString(), stack: [...stack].sort(), packageManagers: [...packageManagers].sort(),
    evidence, checks: checks.slice(0, CHECK_LIMIT), coverage, warnings: [...warnings],
  };
}
