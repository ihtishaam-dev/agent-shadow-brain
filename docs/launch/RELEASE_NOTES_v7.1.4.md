# Agent Shadow Brain 7.1.4

November 12, 2026

Version 7.1.4 adds **Project Kit**, **Context Lab**, an attention queue for saved memories, focused graph navigation, and recorded replay. A project can keep its own knowledge, generate a task-specific skill, and use reported outcomes to adjust later context retrieval. The new workflow runs locally without a model provider.

## Upgrade and open the workspace

```bash
npm install -g @theihtisham/agent-shadow-brain@7.1.4
shadow-brain --version
shadow-brain demo workspace --port 0
```

Install the explicit version. The 7.1.x release line follows 7.2.0 in release history, and semantic version ordering still places 7.2.0 above 7.1.4. Check the displayed version after installation. [Quickstart](../QUICKSTART.md)

Open the **Workspace** and **Live view** addresses printed by the demo. They use temporary synthetic project memory and scripted local MCP calls. Use `--no-activity` to keep the initial activity snapshot. The older bare `shadow-brain demo` command remains available.

## Start Project Kit

```bash
shadow-brain project workspace . --port 0
shadow-brain project inspect .
shadow-brain project skill . --requirement "Verify checkout retry behavior" --target codex
shadow-brain project config . --target codex
```

Open the project-local workspace to inspect recognized manifests, save supplied knowledge, and draft a skill from a requirement and project notes. The preview lists the generated `SKILL.md` and its plan hash. Apply that preview to write the selected client skill and ownership receipt. Existing unowned files and changed managed files are surfaced as conflicts. The existing shared memory dashboard remains available with `shadow-brain dash . --no-analysis`. [Project Kit](../PROJECT_KIT.md)

After a memory is used in actual work, record the observed outcome with a rating and reason. A later adaptive request for a similar task can show a signed **Project task feedback** contribution on an eligible lexical match. Reports retain user or agent attribution. The project can pause their influence or remove an individual report. This setting belongs to the project feedback store. [Reported outcome guide](../LEARNING.md)

## Context and memory review

- **Context Lab** chooses Adaptive initially. Open candidate decisions to see matched terms, score contributions, recorded sources, and any linked evidence path. **Compare profiles** runs both profiles against the same scoped request and shows shared and different selections. Copy or download the assembled Markdown after reviewing the evidence.
- **Adaptive retrieval** uses lexical matching with code and path variants, groups exact normalized duplicates before applying the candidate cap, and includes passages near matched terms. It can follow one hop through recorded supporting and related links. Contradictions stay visible as cautions.
- **Attention queue** lists review hints for contested records, recorded contradictions, unavailable link endpoints, duplicate records, missing source references, and older active records. The underlying health report scans up to 5,000 recent records in scope.
- **Memory inspector and graph** show saved text, recorded sources, manual status, revision history, and typed link endpoints. Focus on one memory's recorded links, review it, and rebuild the brief to check the result.

Recorded references and ranking contributions help inspect the output. Confirm important facts against your project evidence. The shared assembler keeps the output within its character cap and estimates tokens for the rendered Markdown. [Context Lab guide](../CONTEXT_LAB.md)

## Client and command access

```bash
shadow-brain context-pack "Trace retryBudgetPolicy" --project . --profile adaptive --token-budget 1200 --json
shadow-brain memory-health --project . --limit 20
shadow-brain clients config --target codex --project .
shadow-brain mcp . --stdio
```

Standalone MCP exposes 12 memory and workflow tools, including the new `memory_inspect` and `memory_health`. The project-local MCP recipe exposes 17 tools by adding project inspection, knowledge, skill preview and apply, and reported feedback. Both profiles list two resources, one project-memory URI template, and two user-selected prompts.

| Surface | Entries |
| --- | --- |
| Resources | `shadow-brain://guide` and `shadow-brain://skills` |
| Resource template | `shadow-brain://projects/{projectId}/memories/{memoryId}` |
| Prompts | `shadow-task` and `shadow-handoff` |
| Client recipes | Codex, Claude Code, OpenCode, DeepSeek Harness, and a portable example |
| Project-local tools | `project_inspect`, `project_knowledge`, `project_skill_preview`, `project_skill_apply`, and `project_feedback` |

Recipes print configuration snippets for the local installation. The host's MCP capabilities determine whether its interface exposes tools, resources, and prompts. The documented DeepSeek Harness bridge supports tools and resources. All six workflow skills are bundled. The workflow and research skills now explain when to retrieve scoped context and how to check recorded evidence. [Client integrations](../INTEGRATIONS.md) · [Workflow skills](../WORKFLOW_INTEGRATION.md)

## Live operations

Select a recorded session or event and filter by provenance or transport. **Replay loaded events** opens the current journal slice. Use **Play**, the event slider, or the previous and next controls, then **Return to live**. The view shows retained range and gap information when applicable. Timings refer to measured calls, while phase reports reflect what the host submitted. [Showcase](../SHOWCASE.md)

## Compatibility and evidence

The memory and annotation schemas remain at version 1. Existing CLI, SDK, and MCP context callers retain Legacy when they omit the profile. The five global runtime controls and the existing automatic briefing path remain available. Cross-project context still requires the persisted feature and request opt-in. Previous advanced modules and the normal dashboard's `/advanced` view retain their established entry points.

The compiled adaptive implementation passed 14 of 14 author-generated diagnostic cases. Legacy passed 6 of those cases. Both profiles passed the no-evidence control, the tested project boundary, and rendered-budget checks. The reports include selected IDs, failed checks, fixture sizes, and measured local assembly times. [Evaluation report](../evaluation/CONTEXT_EVALUATION_v7.1.4.md) · [Raw results](../evaluation/CONTEXT_EVALUATION_v7.1.4.json)

Run `npm run build` followed by `npm run test:context-eval` from a source checkout to reproduce the paired cases.

[Research and acceptance plan](RESEARCH_AND_PLAN_v7.1.4.md) · [Component guide](../COMPONENTS.md) · [Changelog](../../CHANGELOG.md)
