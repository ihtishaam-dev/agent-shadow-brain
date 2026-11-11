# Connect a coding client

Agent Shadow Brain supplies six project skills and a local MCP service. Install the skills for workflow guidance, configure MCP for memory and context tools, or use both.

## Install and preview

Run these commands from the project root. Replace `CLIENT_TARGET` with `codex`, `claude-code`, `opencode`, or `deepseek-harness`.

```bash
npm install -g @theihtisham/agent-shadow-brain@7.1.3
shadow-brain skills install . --target CLIENT_TARGET
shadow-brain skills install . --target CLIENT_TARGET --apply
shadow-brain clients inspect .
```

The first skill command previews the files. Apply after checking the preview. The inspection reports which project skill files are present. Check discovery in the client after it reloads the project. [Skill install details](WORKFLOW_INTEGRATION.md)

## Get the MCP launch command

```bash
shadow-brain clients config
```

Use the returned `command` as `NODE_EXECUTABLE` and the first `args` item as `SHADOW_BRAIN_CLI` in the examples below. Keep `mcp` and `--stdio` as separate arguments. Absolute paths help when a client runs outside the shell where you installed the package.

### Codex

The skills target installs to `.agents/skills`. Register the stdio server and check that it appears in Codex's list.

```bash
codex mcp add shadow-brain -- "NODE_EXECUTABLE" "SHADOW_BRAIN_CLI" mcp --stdio
codex mcp list
```

[Codex MCP setup](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) · [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills)

### Claude Code

The skills target installs to `.claude/skills`. From the project root, add a local-scoped server and check it with `claude mcp list` or `/mcp` inside Claude Code.

```bash
claude mcp add --transport stdio --scope local shadow-brain -- "NODE_EXECUTABLE" "SHADOW_BRAIN_CLI" mcp --stdio
claude mcp list
```

[Claude Code MCP setup](https://code.claude.com/docs/en/mcp) · [Claude Code skills](https://code.claude.com/docs/en/skills)

### OpenCode

The skills target installs to `.opencode/skills`. With OpenCode V2, add the local command from the project root. For an older OpenCode build, use its interactive `opencode mcp add` flow and enter the same local command and arguments.

```bash
opencode mcp add shadow-brain -- "NODE_EXECUTABLE" "SHADOW_BRAIN_CLI" mcp --stdio
opencode mcp list
```

[OpenCode MCP setup](https://opencode.ai/docs/mcp-servers/) · [OpenCode skills](https://opencode.ai/docs/skills/) · [Interactive CLI reference](https://docs.dev.opencode.ai/docs/cli/#mcp)

### DeepSeek Harness

Install the skills at the repository root so the filesystem skill provider can discover `.dsh/skills`. Enable the filesystem skill provider and skill tools in the host. For MCP, add a local stdio server through your profile's MCP settings where available. In a Cordis composition, use a separate client entry in the intended scope.

```yaml
- id: shadow-brain-mcp
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: shadow-brain
    transport: stdio
    command: 'NODE_EXECUTABLE'
    args: ['SHADOW_BRAIN_CLI', 'mcp', '--stdio']
```

[DeepSeek Harness MCP client](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md) · [Filesystem skill provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/skill/skill-filesystem/README.md)

## Check a tool call

From a connected session, ask the client to list the Shadow Brain skills with `workflow_skills`, or build a brief with `context_pack` using the selected project ID. A successful call confirms the connection. With recording enabled, a measured call appears in the local `/live` view. The explicit `activity_report` tool adds host-reported metadata to the journal.

The stdio service uses the local memory store. To use a separate store, append `--db` and an absolute file path to the server arguments. Add `--settings` and an absolute settings path if needed. [Workspace and activity guide](WORKSPACE.md) · [Troubleshooting](TROUBLESHOOTING.md)
