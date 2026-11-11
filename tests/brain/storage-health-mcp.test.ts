import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MCPServer } from '../../src/brain/mcp-server.js';
import { getGlobalBrain } from '../../src/brain/global-brain.js';

afterEach(async () => { await getGlobalBrain().shutdown(); });

describe('global_storage_health MCP tool', () => {
  it('is discoverable and reports pending changes without saving them', async () => {
    const dbPath = path.join(os.homedir(), 'mcp-health.json');
    const brain = getGlobalBrain({ dbPath, syncIntervalMs: 600_000 });
    await brain.init();
    brain.writeSync({ projectId: 'fixture', projectName: 'Fixture', agentTool: 'codex', category: 'lesson', content: 'A synthetic test memory.', importance: 0.5, metadata: {} });
    const server = new MCPServer({}, { authToken: '' });
    const listed: any = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(listed.result.tools.some((tool: any) => tool.name === 'global_storage_health')).toBe(true);
    const reply: any = await server.handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'global_storage_health', arguments: {} } });
    const report = JSON.parse(reply.result.content[0].text);
    expect(report.status).toBe('pending');
    expect(report.pendingOperations).toBeGreaterThan(0);
    expect(report.lastError).toBeNull();
    expect(fs.existsSync(dbPath)).toBe(false);
  });
});
