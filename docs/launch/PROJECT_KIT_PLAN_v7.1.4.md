# Project Kit: local knowledge and requirement-specific skills

Added to the 7.1.4 scope on 2026-11-12 following the user's request. Status: implementation in progress. This extends the [research and acceptance plan](RESEARCH_AND_PLAN_v7.1.4.md); it does not change the earlier compatibility requirements.

## Intended behavior

A user opens a chosen project, sees what Shadow Brain can observe about its stack, records knowledge they want an agent to remember, and creates a focused skill for that project's requirement. The knowledge, skill, and settings stay inside that project. The same local memory becomes available in Context Lab and through the project's generated MCP launch recipe.

The workflow is **select project → inspect observed stack → record explicit knowledge → describe requirement → preview skill → apply locally → use local context**. Workspace detection and skill drafting are deterministic and do not require a model provider. “Observed stack” means bounded manifest and directory evidence; it does not mean the program has semantically understood all source code or validated the user's requirement.

## Storage and entry point

Use an additive project-workspace entry point, proposed as `shadow-brain project workspace <directory>`. It serves the existing workspace UI with explicit dependencies pointing at `<project>/.shadow-brain/project-memory.json`. Annotations, settings, activity, and the generated-skill receipt remain in that project's `.shadow-brain` directory. The final CLI spelling must be verified and reflected in the quickstart.

The existing global-backed `dash` and context defaults remain compatible. Do not silently merge or migrate global memories into a project store. An independent explicit `GlobalBrain` instance may be used for the project service; the existing singleton behavior stays intact. A project workspace shuts down its server and flushes its own writes, but **does not delete the persistent project directory or knowledge**. Temporary demo cleanup is a separate code path.

Project recipes must pass the actual local database path with `--db`; setting the MCP process's working directory alone does not select a local store. A new MCP process launched from the recipe must recall a newly saved project note. Generic process-wide BrainBus activity must not leak events from another store into a project-local workspace; use its local journal or an explicit store-specific activity dependency.

## Project inspection

The scanner accepts one existing, explicit project root. It rejects drive roots, home/global agent configuration roots, linked ancestors, and invalid paths. All reads stay beneath that root. Inspection is read-only and returns structured evidence and limitations.

Initial bounds:

- A deterministic relative directory view with a fixed entry count and depth, initially 500 entries and depth 3.
- A fixed manifest allowlist with regular single-link files, initially at most 64 KiB per inspected manifest.
- Exclude dependency caches, version-control internals, generated outputs, environment files, authentication/configuration stores, and linked paths before recursion or content reads.
- Extract known dependency names, known script names, manifest types, and package-manager evidence. Do not expose dependency URL/version values, script bodies, arbitrary metadata, or source-file contents.
- Read no browser data, provider settings, credential stores, or model configuration. Fetch no remote source and execute no discovered script.

A package manifest can support an observation such as “React dependency declared.” It does not establish that every page uses React or that a command succeeds. Ambiguous package managers, missing manifests, unsupported formats, and scan truncation remain visible. A generic project can still receive a requirement-specific skill, with unknown stack details left explicit.

Suggested profile shape:

```ts
interface ProjectProfile {
  schemaVersion: 1;
  projectId: string;
  projectName: string;
  root: string;
  observedAt: string;
  stack: string[];
  packageManagers: string[];
  evidence: Array<{ path: string; kind: string; signals: string[] }>;
  checks: Array<{ label: string; command: string; source: string }>;
  coverage: { entries: number; limit: number; truncated: boolean };
  warnings: string[];
}
```

The worker may refine field names before callers are committed. All interfaces should consume one shared implementation rather than duplicate stack inference.

## Explicit knowledge

Accept bounded user text, a title, an optional category, and an optional recorded reference. A useful initial content bound is 8,000 characters and a source-reference bound is 500. Save the title and supplied content with the canonical project identity in the project's memory store; acknowledge success only after persistence succeeds.

Record metadata such as `origin: project-kit-user` and `inputKind: explicit-knowledge`. Only populate source references when the user supplies an actual reference. Do not manufacture a citation that inflates source-coverage counts. The user-provided knowledge is not independently verified, and source targets are not fetched.

New knowledge must be immediately inspectable in Memories, eligible for scoped Context Lab retrieval, persistent after restart, and visible to the project's MCP recipe. Do not add knowledge automatically from environment files, personal profiles, conversation history, or unrelated projects.

## Generated skills

The service takes an explicit requirement, the observed profile, the chosen client target, an optional name, and optional explicit knowledge. It generates one concise, self-contained `SKILL.md` unless a concrete need justifies additional resources. The required `name` and `description` frontmatter is valid and safely encoded. The description names a narrow task and project context so unrelated tasks do not select it.

The body includes the actual requirement, relevant user knowledge, observed stack evidence, local implementation considerations, and available validation guidance. It must not fabricate commands or evidence, install dependencies, run code, claim tests passed, grant extra permissions, or override the user's current project instructions. Generated guidance should be proportionate to the task rather than turning every request into an elaborate process.

Reuse existing client targets and project skill locations:

| Target | Project-local destination |
| --- | --- |
| `codex` | `.agents/skills/<name>/SKILL.md` |
| `claude-code` | `.claude/skills/<name>/SKILL.md` |
| `opencode` | `.opencode/skills/<name>/SKILL.md` |
| `deepseek-harness` | `.dsh/skills/<name>/SKILL.md` |
| `portable` | `.agents/skills/<name>/SKILL.md` |

Names contain lowercase letters, numbers, and hyphens and stay under 64 characters. A generated default name should be stable for the project and requirement. No generated skill is installed in a home/global skills directory. Do not silently edit `AGENTS.md`, client profiles, provider settings, or authentication files. Skill-file presence is not proof that a host loaded it.

## Preview, apply, and ownership

Preview returns the exact output path and content, observed evidence, conflicts, and a stable plan hash. It creates no directories or files. The UI makes these inspectable before the user applies the local skill.

The hash binds the selected root, target, requirement, explicit knowledge, generated bytes, relevant observed profile, and existing-file state. Exclude observation timestamps and other volatile display fields. Recompute the plan before apply; do not trust a client-supplied arbitrary file path or content object.

Use a dedicated project-local ownership receipt, separate from the bundled workflow installer. Apply verifies root/destination ancestors, rejects links and unexpected file types, and writes only planned generated paths. An unowned existing skill conflicts. An owned skill changed by the user conflicts. An unchanged owned skill can be updated or reported unchanged. Stale plans fail without overwriting recent work. Use bounded locking and atomic replacement; report any partial-write failure accurately.

Suggested public service operations:

```ts
inspectProject(root)
planProjectSkill(root, { requirement, target, name?, knowledge? })
applyProjectSkill(root, request, expectedPlanHash)
```

HTTP routes operate on the server's pinned root; they do not accept arbitrary filesystem roots from the browser. Knowledge input and skill apply are explicit write actions, separately labeled from inspection and preview. The coordinating agent owns the final route and CLI names.

## Acceptance gates

1. Inspect JavaScript/TypeScript, PHP or another supported stack, ambiguous manifests, and an unknown project without inventing missing facts. Verify deterministic output apart from observation time.
2. Prove directory/manifest bounds, excluded paths, symlink/hardlink rejection, and refusal of home/global roots using synthetic fixtures. Secret-like values in disallowed fields must never appear in returned profiles or generated skills.
3. Verify requirement and explicit knowledge materially change the generated skill. Verify valid frontmatter, bounded text, focused description, correct client root, and no unrelated file changes.
4. Preview produces no filesystem writes. Repeated apply is idempotent. Edited/unowned files and stale plan hashes conflict. Apply never writes outside the selected root.
5. Save explicit knowledge, retrieve it through Context Lab, restart the project workspace, and retrieve it again. Launch a fresh MCP process using the generated local-store recipe and verify the same committed memory.
6. Place a foreign sentinel in another synthetic store and process-wide activity source. Verify the project workspace's memories, context, health, activity, and skill generation do not expose it.
7. Complete the visible inspect→knowledge→skill preview→apply→context workflow on desktop and mobile. Verify error, conflict, empty, and unknown-stack states.
8. Run inherited regression tests and exact packed-artifact CLI/server tests. Preserve the older global dashboard, bundled skill installer, demo action, and memory schema.

The final README needs a project-local onboarding example and an actual screenshot of this workflow. It must distinguish persistent project knowledge from the disposable synthetic demo and explicitly describe the limits of deterministic workspace detection.

The later [project learning addendum](PROJECT_LEARNING_PLAN_v7.1.4.md) adds attributed memory outcomes and reversible task-relevant retrieval influence to this same local workspace. Its acceptance gates are additional; a successful skill installation alone does not verify the learning loop.
