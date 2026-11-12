# Workspace showcase

The images show the 7.1.4 workspace with synthetic projects, memory records, reviews, and links. The Project Kit images use a separate persistent synthetic project. The live views use scripted local MCP calls. Displayed phases come from explicit reports, and durations come from measured calls in that demo.

```bash
shadow-brain demo workspace --port 0
```

Open the printed **Workspace** or **Live view** address. Use `--no-activity` for a fixed initial journal snapshot.

## Project Kit

In a project-local workspace, inspect observed stack markers and declared checks. Save a knowledge record and use it when drafting a skill for the selected client.

![Project Kit showing observed stack evidence and local knowledge controls](assets/7.1.4-project-kit.png)

Review the generated `SKILL.md` and its destination before applying it. The preview includes the user-supplied requirement and available checks.

![Generated project skill preview with the target path and Markdown](assets/7.1.4-project-skill-preview.png)

### Reported memory outcomes

Record an observed result with a task, rating, reason, and optional references. The saved card shows the reporter and gives the user a way to remove the report. The switch controls whether later adaptive retrieval can use the reports.

![Project Kit with a user-reported useful outcome and an influence toggle](assets/7.1.4-learning.png)

The next matching task shows the report's signed contribution alongside the other ranking signals.

![Context Lab showing a positive Project task feedback contribution and user attribution](assets/7.1.4-outcome-ranking.png)

## Overview and attention queue

Choose the project scope, review source coverage, and open a record from the attention queue. The queue flags conditions that merit inspection, including contested records and missing references.

![Overview and the project memory attention queue](assets/7.1.4-overview.png)

## Context Lab

Assemble a brief, check its estimated tokens and rendered characters, then expand a candidate to see matched fields, ranking contributions, or a recorded link path.

![Context Lab with task settings, brief metrics, and retrieval stages](assets/7.1.4-context-lab.png)

### Compare profiles

Compare the same task and scope with Adaptive and Legacy. The result lists which memories each profile adds and shows their estimated usage.

![Adaptive and legacy comparison for the same task](assets/7.1.4-comparison.png)

## Memory review and graph

Inspect a saved record, its recorded references, and manual review controls. A review change is recorded in revision history.

![Memory inspector with saved content, references, and review controls](assets/7.1.4-memory-review.png)

Select an edge or focus the recorded relationships around one memory. The workspace distinguishes these relations from project membership and recording-agent links.

![Focused graph showing recorded memory links and the inspector](assets/7.1.4-graph.png)

## Integrations and features

Read the documented capabilities and generate a setup example for the client. A project skill-file check and a live client handshake provide different evidence.

![Integration cards and local diagnostics](assets/7.1.4-integrations.png)

Choose when context, session briefings, and activity are available. The workspace keeps activity visibility and journal recording as separate controls.

![The five runtime feature controls](assets/7.1.4-features.png)

## Live operations and recorded replay

Select a session or event to inspect the available history. The session network, timeline, and charts distinguish measured tool activity from explicit host reports.

![Live operations with the session network and measured timing](assets/7.1.4-live.png)

Replay navigates the loaded journal slice. Move to an event with the slider or step controls and return to the live stream when finished.

![Journal replay controls over recorded events](assets/7.1.4-replay.png)

![Animated capture of scripted local MCP activity and replay](assets/live-v7.1.4.gif)

## Mobile layout

Use the workspace on a narrow viewport to inspect the same saved records and context.

![Workspace at a mobile viewport](assets/7.1.4-mobile.png)

[Project Kit guide](PROJECT_KIT.md) · [Context Lab guide](CONTEXT_LAB.md) · [Workspace guide](WORKSPACE.md) · [Client integrations](INTEGRATIONS.md)
