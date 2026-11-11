import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { CLIENT_CAPABILITIES, inspectClientIntegrations } from './brain/client-integrations.js';

export function registerIntegrationCommands(program: Command): void {
  const clients = program.command('clients').description('Inspect supported client capabilities without accessing client profiles');
  clients.command('list').description('List documented integration capabilities').action(() => console.log(JSON.stringify(CLIENT_CAPABILITIES, null, 2)));
  clients.command('inspect').argument('[project-dir]', 'Project skill directory to inspect', process.cwd())
    .description('Check only selected project skill files and emit sanitized diagnostics')
    .action((projectDir: string) => console.log(JSON.stringify(inspectClientIntegrations({ projectDir }), null, 2)));
  clients.command('config').description('Print a local stdio command and arguments for your MCP client; does not edit configuration')
    .action(() => console.log(JSON.stringify({ command: process.execPath,
      args: [fileURLToPath(new URL('./cli.js', import.meta.url)), 'mcp', '--stdio'],
    }, null, 2)));
}
