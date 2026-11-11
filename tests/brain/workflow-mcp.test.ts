import { describe, expect, it } from 'vitest';
import { MCPServer } from '../../src/brain/mcp-server.js';

function call(server: MCPServer, name: string, args: Record<string, unknown>) {
  return server.handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }) as Promise<any>;
}

describe('workflow guidance through MCP', () => {
  it('advertises and returns the bundled catalog and full selected skill', async () => {
    const server = new MCPServer({}, { authToken: '' });
    const listing: any = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(listing.result.tools.map((tool: any) => tool.name)).toEqual(expect.arrayContaining(['workflow_analyze', 'workflow_skills']));
    const catalog = JSON.parse((await call(server, 'workflow_skills', {})).result.content[0].text);
    expect(catalog).toHaveLength(6);
    const skill = JSON.parse((await call(server, 'workflow_skills', { name: 'shadow-debug' })).result.content[0].text);
    expect(skill.name).toBe('shadow-debug');
    expect(skill.content).toMatch(/diagnos/i);
  });

  it('preserves plan-only scope and rejects invalid runtime arguments', async () => {
    const server = new MCPServer({}, { authToken: '' });
    const reply = await call(server, 'workflow_analyze', { request: 'Plan a storage migration; do not change code', mode: 'execute' });
    const workflow = JSON.parse(reply.result.content[0].text);
    expect(workflow.mode).toBe('plan-only');
    expect(workflow.requiresAuthorization).toEqual([]);
    expect(workflow.steps.some((step: any) => ['fix', 'implement', 'release'].includes(step.id))).toBe(false);
    for (const [name, args] of [
      ['workflow_analyze', { request: 7 }],
      ['workflow_analyze', { request: 'Fix this bug', complexity: 'unbounded' }],
      ['workflow_skills', { name: '../private' }],
      ['workflow_skills', { name: [] }],
    ] as Array<[string, Record<string, unknown>]>) {
      const failure = await call(server, name, args);
      expect(failure.error).toBeDefined();
    }
  });
});
