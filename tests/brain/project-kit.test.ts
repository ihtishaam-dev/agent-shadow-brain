import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyProjectSkill, inspectProject, planProjectSkill, projectLocalPath, projectRoot } from '../../src/brain/project-kit.js';

let root: string;
const task = { requirement: 'Trace checkout retry decisions.', target: 'codex', name: 'checkout-retry', knowledge: 'Replay fixtures exercise one charge.' } as const;

beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'asb-project-kit-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

function file(name: string, content: string): void {
  const filename = path.join(root, name);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
}

describe('project kit inspection and skills', () => {
  it('observes allowlisted manifest keys and marker names without exposing arbitrary values or descending into protected directories', () => {
    file('package.json', JSON.stringify({
      packageManager: 'pnpm@fictional-version', dependencies: { react: 'private-version-placeholder', 'unrecognized-dependency': 'opaque' },
      scripts: { test: 'script-body-sentinel', build: 'other-body-sentinel', release: 'ignored-body-sentinel' },
      custom: 'private-project-config-sentinel',
    }));
    file('pnpm-lock.yaml', 'lock-value-sentinel');
    file('.env', 'unreadable-content-sentinel');
    file('README.md', 'readme-content-sentinel');
    file('credentials/package.json', '{"dependencies":{"vue":"hidden"}}');
    file('node_modules/pkg/package.json', '{"dependencies":{"next":"hidden"}}');
    file('apps/worker/composer.json', '{"require":{"laravel/framework":"version"},"scripts":{"test":"ignore-body"}}');
    file('ProjectSettings/ProjectVersion.txt', 'version-sentinel');
    file('assets/example.blend', 'x'.repeat(70_000));
    const profile = inspectProject(root);
    expect(profile).toMatchObject({ schemaVersion: 1, projectName: path.basename(root),
      stack: ['Blender', 'Laravel', 'Node.js', 'PHP', 'React', 'Unity'], packageManagers: ['Composer', 'pnpm'] });
    expect(profile.checks).toEqual(expect.arrayContaining([
      { label: 'Test', command: 'pnpm run test', source: 'package.json' },
      { label: 'Build', command: 'pnpm run build', source: 'package.json' },
      { label: 'Test', command: 'composer run-script test', source: 'apps/worker/composer.json' },
    ]));
    expect(JSON.stringify(profile)).not.toMatch(/sentinel|fictional-version|unrecognized-dependency|private-version-placeholder|node_modules|credentials/);
  });

  it('bounds the tree and reports oversized JSON manifests without interpreting them', () => {
    file('package.json', JSON.stringify({ dependencies: { react: 'x'.repeat(65_536) } }));
    file('a/b/c/pyproject.toml', '');
    const bounded = inspectProject(root);
    expect(bounded.stack).not.toContain('Python');
    expect(bounded.stack).not.toContain('React');
    expect(bounded.coverage.truncated).toBe(true);
    expect(bounded.warnings.join(' ')).toMatch(/bounded JSON file/);
    for (let index = 0; index < 505; index++) file('empty-' + index, '');
    expect(inspectProject(root).coverage).toEqual({ entries: 500, limit: 500, truncated: true });
  });

  it('previews only the chosen project skill, verifies a stable root-bound plan, and updates unchanged ownership', async () => {
    file('package.json', '{"scripts":{"test":"test-body-sentinel"}}');
    file('AGENTS.md', 'authored repository instruction');
    const planned = planProjectSkill(root, task);
    expect(planProjectSkill(root, task).planHash).toBe(planned.planHash);
    expect(planned.files[0]).toMatchObject({ status: 'create', relativePath: '.agents/skills/checkout-retry/SKILL.md' });
    expect(planned.files[0].content).toContain('Replay fixtures exercise one charge.');
    expect(planned.files[0].content).toContain('npm run test');
    expect(planned.files[0].content).not.toContain('test-body-sentinel');
    expect(fs.existsSync(path.join(root, '.agents'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.shadow-brain'))).toBe(false);
    expect(await applyProjectSkill(root, task, planned.planHash)).toMatchObject({ files: [{ status: 'created' }] });
    const next = planProjectSkill(root, task);
    expect(next.files[0].status).toBe('unchanged');
    expect(await applyProjectSkill(root, task, next.planHash)).toMatchObject({ files: [{ status: 'unchanged' }] });
    const updated = { ...task, knowledge: 'Verify both the successful and cancelled attempts.' };
    const updatePlan = planProjectSkill(root, updated);
    expect(updatePlan.files[0].status).toBe('update');
    expect(await applyProjectSkill(root, updated, updatePlan.planHash)).toMatchObject({ files: [{ status: 'updated' }] });
    expect(fs.readFileSync(path.join(root, updatePlan.files[0].relativePath), 'utf8')).toBe(updatePlan.files[0].content);
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toBe('authored repository instruction');
  });

  it('rejects stale requests, existing unowned bytes and subsequent user edits', async () => {
    const previous = planProjectSkill(root, task);
    file('package.json', '{"scripts":{"test":"different check"}}');
    await expect(applyProjectSkill(root, task, previous.planHash)).rejects.toMatchObject({ code: 'PROJECT_KIT_STALE_PLAN' });
    expect(fs.existsSync(path.join(root, '.shadow-brain'))).toBe(false);
    const unowned = { ...task, name: 'unowned' };
    const unownedPath = planProjectSkill(root, unowned).files[0].relativePath;
    file(unownedPath, 'existing skill bytes');
    const conflict = planProjectSkill(root, unowned);
    expect(conflict.files[0]).toMatchObject({ status: 'conflict' });
    expect(conflict.files[0].existingHash).toBeUndefined();
    await expect(applyProjectSkill(root, unowned, conflict.planHash)).rejects.toMatchObject({ code: 'PROJECT_KIT_CONFLICT' });
    expect(fs.readFileSync(path.join(root, unownedPath), 'utf8')).toBe('existing skill bytes');
    const owned = planProjectSkill(root, task);
    await applyProjectSkill(root, task, owned.planHash);
    file(owned.files[0].relativePath, 'user edited this skill');
    await expect(applyProjectSkill(root, task, owned.planHash)).rejects.toMatchObject({ code: 'PROJECT_KIT_CONFLICT' });
    expect(fs.readFileSync(path.join(root, owned.files[0].relativePath), 'utf8')).toBe('user edited this skill');
  });

  it('rejects unsafe roots, traversal, linked skill destinations, and incompatible target names', async () => {
    expect(() => projectRoot(path.parse(root).root)).toThrow(/outside/);
    expect(() => projectRoot(os.homedir())).toThrow(/outside/);
    expect(() => projectLocalPath(root, '../outside.json')).toThrow(/project-relative/);
    expect(() => planProjectSkill(root, { ...task, name: 'con' })).toThrow(/Skill name/);
    expect(() => planProjectSkill(root, { ...task, target: 'generic' as never })).toThrow(/supported skill target/);
    const outside = path.join(root, 'other');
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(root, '.agents'), 'junction');
    expect(() => projectRoot(path.join(root, '.agents'))).toThrow();
    const plan = planProjectSkill(root, task);
    expect(plan.files[0].status).toBe('conflict');
    await expect(applyProjectSkill(root, task, plan.planHash)).rejects.toMatchObject({ code: 'PROJECT_KIT_CONFLICT' });
    expect(fs.readdirSync(outside)).toEqual([]);
  });
});
