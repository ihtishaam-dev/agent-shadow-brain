import { Command } from 'commander';
import { CLIENT_CAPABILITIES, inspectClientIntegrations } from './brain/client-integrations.js';
import { buildClientConfig, memoryLaunchCommand } from './brain/client-config.js';

export function registerIntegrationCommands(program: Command): void {
  const clients = program.command('clients').description('Inspect supported client capabilities without accessing client profiles');
  clients.command('list').description('List documented integration capabilities').action(() => console.log(JSON.stringify(CLIENT_CAPABILITIES, null, 2)));
  clients.command('inspect').argument('[project-dir]', 'Project skill directory to inspect', process.cwd())
    .description('Check only selected project skill files and emit sanitized diagnostics')
    .action((projectDir: string) => console.log(JSON.stringify(inspectClientIntegrations({ projectDir }), null, 2)));
  clients.command('config').description('Print a local stdio command and arguments for your MCP client; does not edit configuration')
    .option('--target <client>', 'Generate a native-format recipe for codex, claude-code, opencode, deepseek-harness, or portable')
    .option('--project <directory>', 'Pin the MCP launch to an explicit project directory')
    .option('--db <path>', 'Pin the recipe to an explicit memory store')
    .option('--project-id <id>', 'Pin telemetry to this project identifier')
    .action((opts) => console.log(JSON.stringify(opts.target ? buildClientConfig(opts.target, opts.project, { dbPath: opts.db, projectId: opts.projectId }) : memoryLaunchCommand(opts.project, { dbPath: opts.db, projectId: opts.projectId }), null, 2)));
}
