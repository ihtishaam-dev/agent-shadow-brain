// src/adapters/index.ts — Export all adapters + factory

import { AgentAdapter, AgentTool } from '../types.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { KiloCodeAdapter } from './kilo-code.js';
import { ClineAdapter } from './cline.js';
import { OpenCodeAdapter } from './opencode.js';
import { CodexAdapter } from './codex.js';
import { RooCodeAdapter } from './roo-code.js';
import { AiderAdapter } from './aider.js';
import { CursorAdapter } from './cursor.js';
import { WindsurfAdapter } from './windsurf.js';
import { CopilotAdapter } from './copilot.js';

/** File adapters are distinct from clients that connect through MCP and skills. */
export const ALL_ADAPTERS: Record<Exclude<AgentTool, 'deepseek-harness' | 'user'>, () => AgentAdapter> = {
  'claude-code': () => new ClaudeCodeAdapter(),
  'kilo-code': () => new KiloCodeAdapter(),
  'cline': () => new ClineAdapter(),
  'opencode': () => new OpenCodeAdapter(),
  'codex': () => new CodexAdapter(),
  'roo-code': () => new RooCodeAdapter(),
  'aider': () => new AiderAdapter(),
  'cursor': () => new CursorAdapter(),
  'windsurf': () => new WindsurfAdapter(),
  'copilot': () => new CopilotAdapter(),
};

export function createAdapter(tool: AgentTool): AgentAdapter {
  if (!Object.hasOwn(ALL_ADAPTERS, tool)) throw new Error(`No native file adapter for ${tool}. Use its MCP or project-skill integration.`);
  const factory = ALL_ADAPTERS[tool as keyof typeof ALL_ADAPTERS];
  return factory();
}

export async function detectRunningAgents(projectDir: string): Promise<AgentAdapter[]> {
  const detected: AgentAdapter[] = [];

  for (const [tool, factory] of Object.entries(ALL_ADAPTERS)) {
    const adapter = factory();
    (adapter as any).projectDir = projectDir;
    try {
      if (await adapter.detect()) {
        detected.push(adapter);
      }
    } catch { /* skip failures */ }
  }

  return detected;
}

export {
  ClaudeCodeAdapter,
  KiloCodeAdapter,
  ClineAdapter,
  OpenCodeAdapter,
  CodexAdapter,
  RooCodeAdapter,
  AiderAdapter,
  CursorAdapter,
  WindsurfAdapter,
  CopilotAdapter,
};
