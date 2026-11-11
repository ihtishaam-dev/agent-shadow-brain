# Quickstart

Agent Shadow Brain 7.1.3 supports Node.js 22.12 or later in the 22.x line, 24.x, or 26 and later.

## Install and open the workspace

```bash
npm install -g @theihtisham/agent-shadow-brain@7.1.3
shadow-brain --version
```

You can also install the verified [GitHub release tarball](https://github.com/ihtishaam-dev/agent-shadow-brain/releases/download/v7.1.3/theihtisham-agent-shadow-brain-7.1.3.tgz).

From your project directory, start the dashboard.

```bash
shadow-brain dash . --no-analysis
```

Open the address printed by the CLI. The default is `http://127.0.0.1:7341`. Use `--port` to choose a different port or `--no-open` to open the address yourself. The workspace shows saved memories as they become available. Select **Live** to view recorded sessions and tool calls. [Workspace guide](WORKSPACE.md)

## Build a context pack

In another terminal at the project root, assemble context for a task.

```bash
shadow-brain context-pack "import retry behavior" --project . --token-budget 1200 --json
```

The JSON includes the selected memories, recorded sources, and exclusion reasons. In the dashboard, **Context** provides the same workflow and a copyable preview. A project needs saved memories for the pack to include them.

## Save a first memory in a scratch project

Create an empty scratch directory, enter it, and install the library for this example.

```bash
npm init -y
npm install @theihtisham/agent-shadow-brain@7.1.3
```

Create `retry-notes.md` with this decision. Retried imports should reuse the same request ID so a timeout cannot create a duplicate import.

Save the following as `first-memory.mjs`. It writes one example record to `.shadow-brain/quickstart.json` in this directory.

```js
import { resolve } from 'node:path';
import { GlobalBrain } from '@theihtisham/agent-shadow-brain';

const brain = new GlobalBrain({ dbPath: resolve('.shadow-brain/quickstart.json') });
await brain.init();

try {
  const projectName = 'Import retry example';
  const projectId = brain.registerProject(process.cwd(), projectName);
  const id = brain.writeSync({
    projectId,
    projectName,
    agentTool: 'codex',
    category: 'decision',
    content: 'Retried imports should reuse the same request ID to prevent duplicates.',
    importance: 0.8,
    metadata: { sources: ['retry-notes.md'] },
  });
  await brain.sync();
  console.log(id);
} finally {
  await brain.shutdown();
}
```

Run it and ask for context from that same memory file.

```bash
node first-memory.mjs
shadow-brain context-pack "import retry request ID" --project . --db .shadow-brain/quickstart.json --token-budget 600 --json
```

The result includes the example decision and its recorded source. Use the CLI or library to inspect the scratch memory file, and use the dashboard for the default workspace store.

## Connect an MCP client

```bash
shadow-brain clients config
```

Add the printed executable and arguments to your client’s MCP settings. They launch `shadow-brain mcp --stdio`. Use the `context_pack` tool for task context and `workflow_skills` for bundled guidance. To use a custom memory store, append `--db` and its absolute path to the arguments. [Client setup guide](INTEGRATIONS.md)

## Add project skills

Choose your client’s target and preview the installation. Apply it when the listed project files are the ones you want.

```bash
shadow-brain skills list
shadow-brain skills install . --target codex
shadow-brain skills install . --target codex --apply
```

The other targets are `claude-code`, `opencode`, `deepseek-harness`, and `portable`. [Client layouts and skill discovery](WORKFLOW_INTEGRATION.md#choose-a-client-and-install)

[Documentation index](README.md) · [Project README](../README.md)
