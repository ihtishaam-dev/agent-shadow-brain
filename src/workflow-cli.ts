import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeTask, TaskWorkflowOptions } from './brain/task-workflow.js';
import { applySkillInstall, getBundledSkill, listBundledSkills, listWorkflowTargets, planSkillInstall, WorkflowTarget } from './brain/workflow-skills.js';

const TARGETS: WorkflowTarget[] = listWorkflowTargets().map(item => item.target);

function targets(value: string): WorkflowTarget[] {
  if (value === 'all') return TARGETS.filter(target => target !== 'portable');
  const selected = [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
  if (!selected.length || selected.some(target => !TARGETS.includes(target as WorkflowTarget))) {
    throw new Error(`Choose targets: ${TARGETS.join(', ')}, or all.`);
  }
  return selected as WorkflowTarget[];
}

export function registerWorkflowCommands(program: Command): void {
  const skills = new Command('skills').description('Inspect and install bundled task skills into a chosen project');
  skills.command('list').description('List bundled skill names and triggers')
    .option('--json', 'Print JSON')
    .action((opts: { json?: boolean }) => {
      const list = listBundledSkills();
      if (opts.json) console.log(JSON.stringify(list, null, 2));
      else for (const skill of list) console.log(`${skill.name}\n  ${skill.description}`);
    });
  skills.command('show').description('Read one bundled skill')
    .argument('<name>', 'Bundled skill name')
    .action((name: string) => console.log(getBundledSkill(name).content));
  skills.command('targets').description('Show supported project skill installation targets')
    .action(() => console.log(JSON.stringify(listWorkflowTargets(), null, 2)));
  skills.command('install').description('Preview project skill installation; add --apply to write the reviewed files')
    .argument('[project]', 'Existing project directory', process.cwd())
    .option('--target <targets>', 'Comma-separated client targets, or all', 'portable')
    .option('--skills <names>', 'Comma-separated bundled skill names (default: all)')
    .option('--apply', 'Apply the generated plan after preflight checks')
    .option('--json', 'Print the plan or applied result as JSON')
    .action((project: string, opts: { target: string; skills?: string; apply?: boolean; json?: boolean }) => {
      const plan = planSkillInstall({
        projectDir: path.resolve(project), targets: targets(opts.target),
        skills: opts.skills?.split(',').map(value => value.trim()).filter(Boolean),
      });
      if (opts.apply) {
        const result = applySkillInstall(plan);
        if (opts.json) console.log(JSON.stringify(result, null, 2));
        else {
          console.log(`Installed project skills: ${result.created.length} created, ${result.updated.length} updated, ${result.unchanged.length} unchanged.\n${result.projectDir}\nClient discovery depends on its enabled skill support; restart or reload if needed.`);
          for (const warning of plan.warnings) console.log(`Note: ${warning}`);
          if (result.backupDir) console.log(`Backups: ${result.backupDir}`);
        }
      } else {
        if (opts.json) console.log(JSON.stringify(plan, null, 2));
        else {
          console.log(`Preview only: ${plan.projectDir}`);
          for (const file of plan.files) console.log(`${file.action.padEnd(9)} ${file.relativePath}${file.reason ? ` — ${file.reason}` : ''}`);
          for (const warning of plan.warnings) console.log(`Note: ${warning}`);
          console.log('Run again with --apply to install.');
        }
        if (plan.files.some(file => file.action === 'conflict')) process.exitCode = 1;
      }
    });
  program.addCommand(skills);

  const workflow = new Command('workflow').description('Suggest a proportionate task workflow without executing or saving the request');
  workflow.command('analyze').description('Classify a request and suggest relevant skills and completion checks')
    .argument('[request]', 'Task request text')
    .option('--request-file <path>', 'Read request text from a UTF-8 file instead')
    .option('--mode <mode>', 'auto, plan-only, or execute', 'auto')
    .option('--type <type>', 'auto, implement, debug, review, research, or release', 'auto')
    .option('--complexity <level>', 'auto, simple, or complex', 'auto')
    .option('--json', 'Print the full structured workflow')
    .action((request: string | undefined, opts: { requestFile?: string; mode: string; type: string; complexity: string; json?: boolean }) => {
      if (!!request === !!opts.requestFile) throw new Error('Supply a request argument or --request-file, but not both.');
      if (opts.requestFile && fs.statSync(opts.requestFile).size > 64 * 1024) throw new Error('Request file must be no larger than 64 KiB.');
      const text = opts.requestFile ? fs.readFileSync(opts.requestFile, 'utf8') : request!;
      const result = analyzeTask(text, { mode: opts.mode, taskType: opts.type, complexity: opts.complexity } as TaskWorkflowOptions);
      if (opts.json) console.log(JSON.stringify(result, null, 2));
      else {
        console.log(`Task: ${result.taskType}\nWorkflow: ${result.mode}\nSkills: ${result.skills.join(', ') || 'none needed'}`);
        for (const step of result.steps) console.log(`- ${step.title}\n  Done when: ${step.completion}`);
        for (const note of result.requiresAuthorization) console.log(`Authorization: ${note}`);
        console.log('Advisory only: the host agent interprets the request and executes authorized work.');
      }
    });
  program.addCommand(workflow);
}
