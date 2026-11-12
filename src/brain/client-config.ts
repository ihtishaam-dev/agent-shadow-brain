import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { WORKFLOW_TARGETS, type WorkflowTarget } from './workflow-skills.js';

export interface ClientConfigRecipe {
  target: WorkflowTarget; format: 'json' | 'toml' | 'yaml'; filename: string;
  content: string; notes: string[];
}
export interface MemoryLaunchOptions { dbPath?: string; projectId?: string }
export function memoryLaunchCommand(projectDir?: string, options: MemoryLaunchOptions = {}) {
  if (projectDir !== undefined && (typeof projectDir !== 'string' || !projectDir.trim() || /[\u0000-\u001f\u007f]/.test(projectDir))) {
    throw new TypeError('Project directory must be nonempty text without control characters.');
  }
  if (options.dbPath !== undefined && (typeof options.dbPath !== 'string' || !options.dbPath.trim() || /[\u0000-\u001f\u007f]/.test(options.dbPath))) throw new TypeError('Invalid memory-store path.');
  if (options.projectId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(options.projectId)) throw new TypeError('Invalid project identifier.');
  return { command: process.execPath, args: [fileURLToPath(new URL('../cli.js', import.meta.url)), 'mcp',
    ...(projectDir ? [path.resolve(projectDir)] : []), '--stdio',
    ...(options.dbPath ? ['--db', path.resolve(options.dbPath)] : []), ...(options.projectId ? ['--project-id', options.projectId] : [])] };
}
/** Render a recipe only. Never read or modify a client configuration file. */
export function buildClientConfig(target: string, projectDir?: string, options: MemoryLaunchOptions = {}): ClientConfigRecipe {
  if (!Object.hasOwn(WORKFLOW_TARGETS, target)) throw new TypeError('Choose codex, claude-code, opencode, deepseek-harness, or portable.');
  const launch = memoryLaunchCommand(projectDir, options);
  const common = ['Merge this entry with existing settings; this command does not write configuration.',
    'The executable paths belong to this installation. Regenerate the recipe after moving Node.js or the package.',
    'Restart or reconnect the client, then confirm tools are listed. A recipe is not proof of a native client connection.',
    ...(options.dbPath ? ['This recipe pins an explicit memory store; use the matching project workspace to inspect its knowledge and activity.'] : [])];
  if (target === 'codex') return { target, format: 'toml', filename: '.codex/config.toml',
    content: '[mcp_servers.shadow_brain]\ncommand = ' + JSON.stringify(launch.command) + '\nargs = ' + JSON.stringify(launch.args) + '\n', notes: common };
  if (target === 'opencode') return { target, format: 'json', filename: 'opencode.json',
    content: JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { servers: { shadow_brain: { type: 'local', command: [launch.command, ...launch.args] } } } }, null, 2),
    notes: [...common, 'OpenCode V2 uses mcp.servers; older V1 installations use a different shape.'] };
  if (target === 'deepseek-harness') return { target, format: 'yaml', filename: 'Harness MCP client plugin entry',
    content: '- id: shadow-brain\n  name: "@deepseek-ai/dsh-mcp-client"\n  config:\n    serverName: shadow_brain\n    transport: stdio\n    command: ' + JSON.stringify(launch.command) + '\n    args: ' + JSON.stringify(launch.args) + '\n',
    notes: [...common, 'Enable the MCP client plugin in your selected Harness profile. Its documented bridge supports tools and resources; MCP prompt templates are unsupported.'] };
  return { target: target as WorkflowTarget, format: 'json', filename: target === 'claude-code' ? '.mcp.json' : 'MCP client settings',
    content: JSON.stringify({ mcpServers: { shadow_brain: launch } }, null, 2), notes: [...common,
      ...(target === 'portable' ? ['The mcpServers wrapper is common but not universal; consult your host configuration schema.'] : [])] };
}
