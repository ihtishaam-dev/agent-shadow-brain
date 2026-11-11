# Agent Shadow Brain 7.2.0 intelligence, controls, and interface plan

Prepared 2026-11-11. Status: implementation and local acceptance complete; commit/CI/publication remain separate release gates.

## Intended outcome

Make the product easier to understand and more useful in real agent sessions: assemble relevant memory within a clear context budget, explain what was included or skipped, provide controls that change actual behavior, and give the default dashboard a clear, responsive visual interface. Rewrite the README in concise, natural language and add original AI-generated artwork that belongs to this product.

“Better intelligence” in this release means better context selection, source visibility, scope handling, and execution controls. It does not mean changing model weights, promising perfect reasoning, or claiming model/provider capabilities the package does not implement. Show improvements with repeatable examples and measured output rather than promotional claims.

The existing 7.1.0 source/tag and six passing CI jobs are the implementation baseline. The coordinating agent has independently verified that 7.1.0 is fully published on npm. Preserve previous release artifacts and tag identities; 7.2.0 publication remains a separate pending gate.

Roles: Astra owns architecture, acceptance criteria, and independent review. GPT 6.1 SoL owns backend context/settings changes and focused tests. The coordinating agent owns the new dashboard, server/CLI/MCP integrations, README, generated artwork, package/release work, and final visual/runtime verification. Do not edit private profiles or provider settings while developing these features.

## Findings motivating this release

- `src/dashboard/server.ts` exposes `/api/v6/features-config`, but this endpoint only reads/writes an arbitrary boolean map in `features.json`; it does not prove that those switches govern the corresponding modules. A saved toggle alone is not a working feature control.
- `SubconsciousEngine.generateBriefing()` checks its cache before checking whether briefings are enabled. A cached briefing can therefore be returned after the feature is disabled.
- That cache key includes project and agent but omits the current task. Two distinct tasks can receive the same recent briefing.
- Similar-task recall in the existing briefing is not project-scoped. Some older resume/seed routes also fall back globally. The new context path must not silently mix projects.
- Existing briefing estimates use characters divided by four and are described too strongly as a hard token cap. Exact model token counts are unavailable without the corresponding tokenizer.
- The default dashboard is a large advanced interface. A focused new entry screen can serve common tasks while retaining the established advanced surface through an explicit link.

Astra independently reproduced four briefing defects against the built 7.1.0 module using a new explicit synthetic store: disabling the engine still returned cached text; changing the task reused the same cached session; a default Project A briefing included Project B's similar-work content; and a requested estimated-token budget of 1 produced an estimate of 45. The baseline script is `work/audit/v71-briefing-baseline.mjs`. It did not use the user's memory store, provider configuration, or credentials. These observations provide concrete before/after acceptance evidence for 7.2.0.

Implementation review update: rerunning that same probe against the newly built 7.2.0 candidate changed all four results as intended: disabled output became empty; changed tasks no longer reused the same session; default project context no longer included the other project; and the tiny-budget output estimate became 0. Independent `work/audit/v72-settings-context-review.mjs` checks also passed for no-write settings defaults, concurrent patch preservation, revision conflicts, strict patch validation, corrupt-store preservation, disabled-before-recall, project diagnostic isolation, full rendered size bounds, later smaller candidates, duplicate/empty explanations, and explicit cross-project opt-in. These are synthetic backend checks, not a claim of final UI or publication completion.

Backend review update: SoL reported 21 passing focused tests. Review corrections preserve directly relevant old lessons in task-specific briefings, retain bounded source references and originating memory IDs when deduplicating, and maintain `getSubconscious(config)`'s existing configuration-update behavior. The new workspace API validates requests before initialization, returns disabled context without reading the brain, validates numeric budgets, and decodes buffered UTF-8 requests safely across chunk boundaries. Astra accepts the backend implementation subject to the final inherited-suite/package gates. Final UI behavior, live-activity integration, visuals, and publication remain separately verified.

Integration source-review update: the context CLI now resolves settings beside an explicit custom database unless an explicit settings path is supplied. The advanced dashboard's old preference-only feature grid has been replaced by a link to the four real runtime controls. The new overview discloses sampled project/agent counts and preserves a visible stale-data error when refreshing fails. The generated context-flow illustration has been visually reviewed: its labels are readable and accurately describe the conceptual flow; it is not a dashboard screenshot. End-to-end UI and publication evidence is still required.

Desktop visual and runtime update: Astra viewed the actual synthetic-fixture overview, graph, context, and features screenshots under `output/playwright/` and found no substantive visual blocker. The graph displays 38 nodes and 62 recorded membership/agent connections within the canvas alongside the selected source inspector; its legend does not imply inferred semantic links. Context visibly shows 338 of 350 estimated tokens, selected-project scope, five included memories, and recorded references. The coordinating agent verified two excluded candidates and merged duplicate references, then switched context assembly off, reloaded, verified frontend/backend disabled behavior, and restored it. Six real HTTP API tests and one actual WebSocket activity-gating test pass. Mobile, dark theme, reduced motion, empty/error flows, the complete regression suite, and exact artifact checks remain pending at this checkpoint.

Final local acceptance update: the coordinating agent reports the complete local verification passing with 263 tests in 26 files and 20 checks against a packed artifact installed into a fresh consumer. Browser probes passed keyboard graph interaction, reduced motion, a 390-pixel viewport without horizontal overflow and with a usable list view, empty states, errors/retry, hostile text rendered as text, and live activity switching; no page errors or external requests were observed. The final README and release guide accurately separate the conceptual illustration from synthetic-data runtime screenshots and describe estimated tokens, scope, provenance, and actual control behavior. Astra's final source/release review found no blocking issue; `git diff --check` passed with only line-ending conversion notices. The saved overview screenshot predates a corrected activity ordering and remains an illustrative synthetic snapshot. GitHub CI and npm 7.2.0 publication have not been claimed complete here.

## Cohesive scope

1. One tested context assembler with project scope, query relevance, normalized deduplication, visible provenance, and an exact rendered-character budget.
2. Integration into actual session briefings and a shared API/CLI/MCP context-inspection surface, avoiding a disconnected dashboard demonstration.
3. A dedicated validated feature-settings store and four precisely described controls that gate runtime behavior.
4. A new default dashboard with an understandable hierarchy: overview, context, memories, activity, and settings. Preserve access to the existing advanced dashboard.
5. A concise README with original generated artwork, accurate screenshots if obtained, and clear install/use steps.
6. Failure-path, scope, settings, integration, package, and visual verification.

Defer new model providers, vector-database migration, autonomous training, cross-machine synchronization, global credential/profile changes, and a rewrite of every legacy module. Do not expose dozens of switches whose runtime semantics have not been implemented and tested.

## Backend contract

### Feature settings

Create a dedicated `feature-settings.ts` module. Use a separate application-owned `feature-settings.json` rather than provider configuration or the old unvalidated feature map. Construction accepts an explicit path for tests and isolated consumers; the normal application uses its documented Shadow Brain directory. Reads do not create files or directories.

The stable settings shape should include a schema version, monotonically increasing revision, and an allowlisted feature object:

```ts
interface FeatureSettings {
  schemaVersion: 1;
  revision: number;
  features: {
    contextAssembly: boolean;
    crossProjectContext: boolean;
    automaticBriefing: boolean;
    liveActivity: boolean;
  };
}
// Defaults: true, false, true, true respectively.
```

Agreed API: `new FeatureSettingsStore({ filePath?, lockTimeoutMs? })`, synchronous `get()` and `isEnabled(id)`, and asynchronous `update(patch, expectedRevision?)`. The returned snapshot also includes `updatedAt: string | null`. The optional revision parameter is recommended for stale UI conflict handling and must be coordinated with callers if included. An update validates field names and boolean values, takes a bounded exclusive lock, rereads the latest settings, merges the allowed patch, increments revision, and atomically replaces the file. A stale explicit revision returns a conflict; it must not overwrite another user's recent setting. Read/parse/schema failures remain visible and preserve bytes. Unknown keys, nested arbitrary objects, prototype keys, and coercions such as the string `"false"` are rejected.

Missing settings use documented defaults without writing a file. Do not silently interpret an unreadable or corrupt file as defaults and then overwrite it. Keep failed updates visible to the caller. Avoid introducing dependencies for this small validated store.

### Controls and their actual effects

| Control | Meaning | Required execution point |
| --- | --- | --- |
| Context assembly | Build the new compact memory context. | Disabled requests return a structured disabled result before recall; no hidden fallback to another assembler. |
| Cross-project context | Permit explicit inclusion of other projects in the new context/briefing path. | Default off. Both this setting and a caller's explicit opt-in are required; candidates are labeled by originating project. |
| Automatic briefing | Generate session-start briefings through `SubconsciousEngine`. | Check before cache lookup or brain initialization; disabling must immediately prevent a cached briefing from escaping. |
| Dashboard live activity | Show/stream activity in the dashboard. | Gate the event stream, connection backlog, and activity endpoint. Label the scope accurately: this is not a master switch for memory persistence or every internal log. |

An enabled preference is permission for that feature to operate when called, not proof that it is currently active. Distinguish enabled, disabled, unavailable, and failed states where relevant. Changes should apply to the next relevant operation without requiring an undisclosed restart. If a specific consumer requires a restart, display it explicitly and test that contract.

Do not add a new-memory-write switch or automatic-pruning switch merely for breadth in this release. Those require separate semantics for previously accepted writes, retention, and all existing writers. The four controls above have direct user value and a bounded testable effect.

### Context assembly

Create a read-only assembler with an injectable recall dependency. It must not scan project documents, credentials, browser state, provider files, or network sources. Source references come from the selected memory's existing metadata; carrying a reference is not a claim that its target was reverified.

Agreed integration contract, with additive diagnostic fields allowed:

```ts
function assembleContext(
  brain: Pick<GlobalBrain, 'recallScored'>,
  options: {
    projectId: string;
    query?: string;
    maxChars?: number;
    maxEntries?: number;
    tokenBudget?: number;
    includeCrossProject?: boolean;
    features?: Pick<FeatureSettings['features'], 'contextAssembly' | 'crossProjectContext'>;
  },
): ContextPack;

interface ContextPack {
  enabled: boolean;
  projectId: string;
  scope: 'project' | 'cross-project';
  queryKeywords: string[];
  markdown: string;
  budget: { tokenBudget: number; maxChars: number; usedChars: number; estimatedTokens: number };
  entries: Array<{
    id: string;
    projectId: string;
    projectName: string;
    agentTool: string;
    category: string;
    excerpt: string;
    score: number;
    sources: string[];
    matchedKeywords: string[];
    duplicateIds: string[];
  }>;
  excluded: Array<{ id: string; reason: 'duplicate' | 'budget' | 'limit' | 'empty' | 'lookback' }>;
  warnings: string[];
}
```

`maxChars` is the exact bound for the returned `markdown`, including headings, labels, references, separators, and explanatory boilerplate. `budget.usedChars` uses the same documented string-length measure as the bound. `estimatedTokens` may use a documented rough heuristic, but must not be presented as an exact model-token count or guaranteed token-window fit. Validate finite integer limits and use sensible upper bounds; an explicitly accepted zero budget must produce empty context. A tiny budget must return a valid empty/short result rather than exceed the limit with its own header. If candidates are capped at 200 and output at 30, disclose the evaluated-candidate cap instead of implying that every memory in the store was compared.

Use the existing explained recall score, filter by the requested project by default, and select deterministically. No project match means an honest empty result. Cross-project retrieval requires both the persisted feature setting and explicit request intent; do not silently broaden scope because a query returned zero matches.

Normalize case and whitespace for exact-content deduplication within each project; do not merge different facts based only on similar wording. Preserve the strongest or deterministically preferred representative. Limit count and rendered size, and identify eligible memories skipped for duplication, size, or count. An oversized top result must not prevent later smaller useful results from fitting. Avoid arbitrary mid-sentence clipping that conceals an important condition; either include the whole chosen representation or label an intentional excerpt.

Show why each memory was selected: relevant query terms, score components or meaningful ranking explanation, project identity, source references, and any freshness limitation available in the data. Do not turn author importance, popularity, duplicated text, or a source filename into proof of truth. Default diagnostics must not expose other projects' memory contents or IDs merely to explain why strict scoping was applied.

The rendered memory block should be framed as fallible reference material. Preserve the user's/project's instructions over imperative text that may exist inside a memory. This is context preparation, not authority delegation to retrieved text.

### Session-briefing integration

Fix the existing disabled-before-cache ordering and cross-task cache reuse. Either remove the short-lived cache where its complexity is not justified, or include normalized task, project, agent, relevant configuration, and settings revision in its identity. Rechecking enablement before every cache lookup is mandatory. A settings change must not return stale behavior through cached content.

Use the new assembler for the memory content actually handed to a session, with the requested project/task and budget. Preserve the public briefing shape where practical; adapt selected memories into the established sections without reintroducing duplicate context or bypassing the final rendered budget. Do not swallow storage errors and claim a valid empty or current briefing. Report the relevant failure or an explicit degraded result.

Respect agent allowlists and the existing `enabled` configuration in addition to the new feature setting. Tests must exercise the real `generateBriefing()` path, not only the standalone assembler. Keep legacy resume endpoints separate unless deliberately routed through the same engine; document their scope rather than silently claiming every older surface has changed.

## Shared integration surfaces

The coordinating agent should expose the same backend functions through new clearly named routes and CLI/MCP commands. Avoid copying ranking, budget, or settings validation into the UI.

- GET settings returns current values/revision. A state-changing method updates a validated patch and returns the committed values/revision.
- Context request accepts project identity, query, budget, count, and explicit cross-project opt-in. It returns the structured selection plus copyable text.
- Settings conflicts, disabled features, invalid inputs, and storage errors have distinct structured responses. Do not turn every result into HTTP 200 plus an indistinct toast.
- New state-changing dashboard endpoints enforce method and same-origin expectations; existing broad legacy endpoints are not evidence of permission to bypass checks on new controls.
- MCP remains explicit about read-only context assembly versus settings mutation. Do not hide a settings write in an inspection tool.
- Retain existing public API compatibility where practical and include additive exports/types. Default paths must remain isolated in test fixtures.

## Dashboard direction and functional acceptance

The coordinating agent is using the applicable product/design guidance. The new default should help someone answer: what does the brain know, what will be given to my agent, and what is enabled?

Use a clear hierarchy and a small navigation set. Overview shows actual counts/status and the primary context action. Context provides the query, selected project, size control, selected memories, reasons/skipped counts, and a copy action. Memories provides useful filtering and empty states. Activity shows live delivery state and a disabled explanation. Settings uses plain-language switches with accurate descriptions and committed state. Keep the old advanced interface reachable at a stable explicit route.

Avoid dense technical terminology in primary flows. Write “Build context,” “Selected memories,” “Why this was included,” “Nothing matched this project,” and similarly concrete language. A toggle should describe its effect, not an internal module name. Do not imply a local process is connected to Claude/Codex/DeepSeek merely because a configured label exists.

Every visible control needs real behavior or a clearly disabled state. Settings save must handle success, validation/conflict, and network failure without leaving a misleading checked state. Context loading, empty results, disabled assembly, failed storage, and oversized limits require distinct usable states. Copy should copy the exact returned context and show success/failure.

Use stable responsive layout, keyboard-accessible controls, visible focus, descriptive labels, sufficient contrast, reduced-motion support, and deliberate motion rather than continuous decoration. New content must be safely escaped/rendered as text. The new dashboard should operate without optional third-party CDN scripts where practical; do not load new remote assets just to decorate a local product.

Verify actual UI behavior against synthetic fixtures at desktop and narrow viewport sizes. Confirm default and advanced routes, all navigation, context assembly, copy behavior, settings persistence after reload, disabled runtime effects, activity suppression, error states, and no console errors. Browser interaction is authorized by the user's requested graphical web UI, but remain confined to the explicitly opened local test dashboard; never inspect histories, cookies, authentication stores, or unrelated tabs.

## README and original artwork

Create original AI images for this product using the image-generation skill/tool; do not relabel stock images or other projects' branding. The user's updated direction is informative visuals: explain how project memory becomes selected context, how evidence/scope/budget fit together, and what the controls change. Favor a clear product-specific context-flow illustration over decorative technology artwork or illegible generated text. The working UI should include useful memory/context visualization and purposeful animation with reduced-motion support. Save originals/optimized delivery assets in the repository's documented image path and package only what is needed for a working published README.

Use artwork to make the project recognizable, and real screenshots to demonstrate real UI when available. Mark a conceptual illustration as an illustration; do not present it as a working dashboard screenshot or fabricate runtime evidence within an image.

Rewrite the README around a short product explanation, the core use case, quick start, a compact visual demonstration, meaningful controls, compatibility, and links to detailed docs. Preserve accurate installation/runtime requirements and scope limits. Remove repetitive marketing, unsupported intelligence claims, and stale screenshots/links. Natural writing means concrete sentences and useful detail, not concealed authorship or claims that a human wrote it.

Check image rendering and relative links in both the repository and the packed npm context. Keep alt text useful. Verify generated images visually before inclusion and avoid unnecessary file size.

## Required verification

### Context tests

- Project isolation with matching entries in another project; no automatic fallback and no out-of-scope diagnostic leakage.
- Explicit cross-project opt-in with the feature both on and off, showing originating project for every included item.
- Query relevance, deterministic order/ties, exact normalized duplicates, distinct facts, and source/matched-term explanations.
- Full rendered character bound, tiny limits, long headers/source strings, oversized first candidate followed by a smaller useful candidate, entry count, empty results, and invalid numeric inputs.
- Disabled context returns before invoking recall; assembly does not mutate memory or scan files.
- Non-ASCII text reports exact characters consistently and labels token counts as estimates.

### Settings and integration tests

- No-write default read; strict unknown-field/type validation; malformed/newer-schema preservation.
- Atomic update, revision conflict, concurrent patches, failed write preserving the old file, and bounded lock behavior.
- Toggle off automatic briefing after a prior cached result: no briefing returned and no unnecessary initialization.
- Same project/agent but different tasks: no stale cross-task cache result.
- Config/agent allowlists plus persistent settings interact correctly; new context powers actual briefing output within the stated budget.
- Live activity disabled: no new WebSocket events, no backlog, and no activity endpoint leakage; reenabling uses the documented delivery behavior.
- UI settings persisted state matches the engine after refresh; error/conflict responses do not falsely report a change.

### Release gates

1. Plan, flag semantics, and backend contracts agreed before implementation.
2. Focused backend tests and independent Astra review pass.
3. Full build/lint/regression suite and dependency audit pass with recorded counts.
4. New UI visually and functionally checked using synthetic local state; legacy advanced route remains reachable.
5. README/images render, links work, and claims match verified behavior.
6. Exact packed artifact includes the new modules/UI/assets and passes fresh-consumer API/CLI checks; prior memory/workflow commands still work.
7. GitHub source/tag and npm 7.2.0 version/integrity/dist-tag are verified independently after publication. Accepted/processing statuses stay pending until confirmed.

## Completion checklist

- [x] Context scope, deduplication, explanations, and budget implemented and tested.
- [x] Four feature settings persist safely and gate their actual execution paths.
- [x] Automatic-briefing cache/scope issues corrected through the real entry point.
- [x] CLI/API/MCP integrations use the same backend contract.
- [x] New default dashboard is usable, responsive, accessible, and functionally verified.
- [x] Advanced dashboard remains reachable.
- [x] Original generated artwork and concise README reviewed and rendered.
- [x] Astra backend/integration review completed.
- [x] Local verification and exact-package checks recorded: 263 tests in 26 files; 20 fresh-consumer package checks. See coordinating-agent verification logs for build/lint/audit command evidence.
- [ ] GitHub/npm 7.2.0 publication independently verified.
