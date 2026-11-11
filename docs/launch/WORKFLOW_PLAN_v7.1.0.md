# Agent Shadow Brain 7.1.0 workflow and portable skills plan

Prepared 2026-11-11. Status: implementation plan; completion and publication evidence will be recorded separately.

## Outcome

Give supported coding agents a small, discoverable set of task workflows: understand the request, choose the relevant guidance, plan only when useful, perform the authorized work, verify the result, and report the outcome concisely. Simple requests should stay simple. The package supplies instructions and advisory routing; the host agent performs the work using its available tools and permissions.

Build on 7.0.0's reviewed storage and recall improvements. Public-registry processing was pending when this follow-up began, and the coordinating agent subsequently verified npm 7.0.0 availability. Keep the verified 7.0.0 artifact/tag and this new feature release distinct; 7.1.0 publication remains a separate gate.

Roles: Astra owns architecture, acceptance criteria, and independent review. GPT 6.1 SoL owns the new workflow/installer modules and focused tests. The coordinating agent owns skill content, CLI/MCP/public exports, packaging, documentation, validation, and publication. These execution roles are not new product model integrations.

The skill design follows the session's `skill-creator` guidance: preserve intent, avoid unrelated work, keep discovery descriptions precise, disclose detail only when relevant, and test meaningful behavior rather than matching canned prose. The instructions must not demand hidden reasoning transcripts; useful plans summarize actions, decisions, and verification.

## Release scope

1. Six bundled skills: one small shared workflow and five focused modes.
2. A pure advisory task router that returns a bounded workflow with explicit reasons and limitations.
3. A per-project installer with a preview by default and explicit application.
4. Host-specific discoverable skill directories for Codex, Claude Code, OpenCode, and DeepSeek Harness; a portable option for other compatible agents.
5. A small managed section in project instruction files to point relevant tasks to the bundled workflow while preserving user content.
6. CLI, MCP, and library access to workflow guidance and catalog information.
7. Installation-preservation tests, realistic routing scenarios, skill validation, and exact-package checks.

Exclude remote model calls, API-provider setup, browser automation, credential access, modifications to user-global agent settings, background agents, automatic publication, and claims of guaranteed autonomous execution. Do not turn every request into a plan document, test suite, audit, or broad refactor.

## Discovery and compatibility

| Target | Project skill root | Integration claim |
| --- | --- | --- |
| Codex | `.agents/skills/<name>/SKILL.md` | Documented discoverable skill layout; host chooses relevant skills. |
| Claude Code | `.claude/skills/<name>/SKILL.md` | Documented project skill layout; point the project `CLAUDE.md` managed section to it. |
| OpenCode | `.opencode/skills/<name>/SKILL.md` | Documented native layout; compatible roots also exist, but do not duplicate installs unnecessarily. |
| DeepSeek Harness | `.dsh/skills/<name>/SKILL.md` | Documented project filesystem-provider root; provider/registry/tool support must be enabled in the host. |
| Portable | `.agents/skills/<name>/SKILL.md` | Files usable by agents supporting this convention; no universal native integration guarantee. |

DeepSeek's official filesystem provider documents `.dsh/skills` before `.agents/skills`, one directory level of skill bundles, required `name`/`description`, and on-demand body loading. Installing files does not enable missing host plugins or prove a running session loaded them. Do not edit Cordis/plugin configurations. Source: [DeepSeek Harness filesystem skill provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/skill/skill-filesystem/README.md).

The coordinating agent has verified the other host discovery paths against their official documentation. Record those primary links in product documentation. Distinguish three states throughout: files installed; layout/frontmatter validated; host runtime loading actually observed. Claim the last only after an explicit supported test, without inspecting private profiles or authentication data.

Use `AGENTS.md` for the managed pointer in targets whose instruction-file convention supports it; use `CLAUDE.md` for Claude Code. The coordinating agent also verified DeepSeek Harness's project-context instructions against its [official context package documentation](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/context/README.md). A generic `AGENTS.md` pointer is not evidence that every other host automatically reads it. The native skills themselves remain the portable artifact.

## Skill catalog and boundaries

| Skill | Applies when | Concrete guidance | Does not automatically authorize |
| --- | --- | --- | --- |
| `shadow-workflow` | A substantive implementation, diagnosis, review, research, or release request needs workflow selection. | Extract outcome and constraints; identify mode; load only relevant guidance; scale planning/verification; report actual result. | Expanded scope, unrelated configuration, or external mutations. |
| `shadow-implement` | User asks to build or modify functionality. | Inspect relevant context, identify acceptance behavior, make scoped changes, verify affected behavior. | Redesigning unrelated systems or adopting a different stack. |
| `shadow-debug` | User reports a concrete failure or regression. | Reproduce or gather evidence, isolate cause, make a focused fix, test the original failure. | Broad rewrites, speculative security work, or pretending an unobserved retry passed. |
| `shadow-review` | User asks for review/audit of specified work. | Inspect the requested scope, prioritize actionable findings, cite evidence and limits. | Editing reviewed files merely because a fix seems useful. |
| `shadow-research` | Current/niche facts or source-based comparison is the requested output. | Consult relevant available sources, separate facts from inference, cite claims, answer the actual decision. | Contacting others, signing up, purchasing, or turning research into implementation. |
| `shadow-release` | User explicitly requests packaging, deployment, publishing, or release preparation. | Verify the concrete artifact, check existing authorization and destination, execute authorized publication, verify remote state separately. | Publishing when the user asked only for a plan or preparation. |

Keep each skill self-contained and concise; no arbitrary word-count padding. The core skill should not repeat every focused workflow. References are justified only by useful conditional detail. Frontmatter descriptions should discriminate between modes; avoid descriptions that attract unrelated questions. Preserve ordinary automatic discovery rather than marking all skills explicit-only. Names use lowercase kebab-case and match their folder.

Do not embed secrets, user-specific project memories, real account identifiers, or examples that silently impose universal preferences. No skill should promise that it can execute tools absent from its host. Missing required capability means complete independent useful work and explain the exact remaining limit.

## Advisory router contract

Create `src/brain/task-workflow.ts` with no filesystem access, network calls, provider configuration, memory writes, subprocesses, or task execution.

Proposed public API, to be finalized consistently between implementation and callers:

```ts
type TaskType = 'direct' | 'implement' | 'debug' | 'review' | 'research' | 'release';
interface TaskWorkflowOptions {
  mode?: 'auto' | 'plan-only' | 'execute';
  taskType?: 'auto' | Exclude<TaskType, 'direct'>;
  complexity?: 'auto' | 'simple' | 'complex';
}
interface TaskWorkflow {
  taskType: TaskType;
  mode: 'direct' | 'plan-only' | 'plan-then-execute';
  skills: string[];
  steps: Array<{ id: string; title: string; completion: string }>;
  reasons: string[];
  requiresAuthorization: string[];
  limitations: string[];
}
function analyzeTask(request: string, options?: TaskWorkflowOptions): TaskWorkflow;
```

`requiresAuthorization` identifies side-effect categories whose authorization the host must check against the existing conversation. It is not an instruction to ask again when permission is already explicit. The router cannot determine all prior authorization from one request string, and never grants authority on behalf of the user.

Treat the function as an explainable heuristic, not a universal semantic classifier. Explicit mode/type/complexity options make the behavior controllable. Free-text planning-only or review-only requests should conservatively avoid execution recommendations where recognized; document language/negation limitations rather than claiming exhaustive natural-language understanding. Unknown/ambiguous requests should remain bounded and expose the assumption. No external model call should be needed for this feature.

Simple transformations, direct questions, tiny edits, and explanations get direct handling: no mandatory plan artifact, no six-skill chain, and no unrelated verification. Substantive work normally chooses the core skill and one focused skill. Multi-part requests may justify additional skills, but selection must be tied to the actual task rather than loading the whole catalog.

For complex implementation, the suggested sequence is inspect the relevant context, summarize a useful plan, implement, verify affected behavior, then report the concrete outcome and remaining limitation. For planning-only, stop after the requested plan; for review-only, produce findings; for research-only, deliver the evidence-based answer. Never infer publication authority from the word “release” occurring in a log, example, or negated instruction.

### Routing acceptance scenarios

- “Translate this sentence” and “What does this function do?” stay direct with no project mutation or plan artifact.
- “Fix the failing parser test” chooses debug with reproduction/fix/regression verification.
- “Build a new import flow across API and UI” chooses implement with planning and acceptance checks.
- “Review this PR without changing anything” chooses review and preserves the no-edit scope.
- “Plan the migration; do not execute” ends at planning.
- “Research which API supports this feature” chooses research and source verification, not provider configuration.
- “Prepare a release checklist but do not publish” creates preparation guidance without treating the request as publication authority.
- “Publish the tested package to the repository and npm” selects release; existing explicit authorization is honored.
- Explicit valid overrides, empty input, unsupported option values, very long requests, ambiguous requests, and requests in other languages behave predictably or report the documented limit.

Tests must assert these meaningful distinctions. Avoid tests that merely reproduce the classifier's regexes or exact heading text.

## Safe installer contract

Create `src/brain/workflow-skills.ts`. Load a fixed allowlisted bundled catalog from the installed package's `skills/` directory. Skill names and target names come from this catalog; never interpolate unchecked user strings into filesystem paths.

Proposed interfaces:

```ts
type WorkflowTarget = 'codex' | 'claude-code' | 'opencode' | 'deepseek-harness' | 'portable';
function listBundledSkills(): BundledSkill[];
function planSkillInstall(options: {
  projectDir: string;
  targets: WorkflowTarget[];
  skills?: string[];
}): SkillInstallPlan;
function applySkillInstall(plan: SkillInstallPlan): SkillInstallResult;
```

The concrete plan should identify the canonical project root, requested targets/skills, every relative destination, action (`create`, `update`, `unchanged`, or `conflict`), before/after hashes, and the reason. The default CLI operation returns this preview; only `--apply` writes. Applying is already authorized when the caller expressly selected `--apply`; do not add a routine second approval prompt.

### Preservation invariants

1. Only the requested project and allowlisted skill/instruction/receipt paths may be touched. Never inspect global browser/profile/configuration/credential stores or infer installed tools by scanning them.
2. Reject path traversal and unsupported skill/target IDs. Canonicalize the project root and check each existing ancestor. Refuse symlink/junction destinations that escape the root; the simplest safe policy is to refuse symlinked managed paths. Include Windows case/path rules.
3. A preview performs no writes, including no hidden receipt, directory creation, backup, or config initialization.
4. Existing identical bundled files are unchanged. Existing differing unowned files are conflicts, not overwritten. Track prior managed hashes in a small project-local receipt if upgrade support is implemented; user-modified managed content becomes a conflict rather than being silently replaced.
5. Before application, revalidate the filesystem and compare every recorded precondition/hash. A file edited since preview invalidates the plan. Do not blindly trust an externally mutated serialized plan: validate its destination allowlist and derive owned contents from the bundled catalog.
6. Preserve all bytes outside a uniquely delimited managed block in `AGENTS.md`/`CLAUDE.md`, including existing line endings. Duplicate, reversed, or incomplete markers are conflicts. Replace only the owned block; do not rewrite the whole document from a template.
7. Avoid duplicate `.agents` destinations when both Codex and portable targets are selected. Keep catalog files identical across intended targets and prevent duplicate managed blocks.
8. Preflight every planned operation before writing. For filesystem failures partway through an apply, either roll back files this invocation changed using captured original bytes or report precise partial results with a safe retry path. Never claim all-or-nothing behavior unless it is implemented and tested.
9. Use unique sibling temporary files and atomic replacement where appropriate. Exclusive create prevents a file that appeared after preflight from being overwritten. A concurrent editor's newer bytes must not be silently discarded during rollback.
10. Installation must not invoke hooks, execute generated skill commands, auto-start agents, modify provider settings, call models, or install global tools.

The managed instruction block should point to the core workflow for relevant tasks and explain scoped selection, direct handling of simple requests, authorized execution, and proportionate verification in a few lines. It must defer to the user's instructions and existing project rules; avoid claiming highest priority or requiring every task to read six files.

### Installer tests

- All target mappings and selected subsets produce expected files; DeepSeek uses `.dsh/skills` and one-level bundles.
- Dry-run leaves an empty or existing fixture tree byte-for-byte unchanged.
- Reapplying an identical installation is idempotent.
- Existing user skill files, custom instructions, Unicode, and CRLF content are preserved.
- Edited managed files, stale preview hashes, duplicate/broken delimiters, and unexpected destination creation cause conflicts.
- Unknown target/skill, traversal, symlink/junction ancestors, and root escapes are rejected before writes.
- Simulated write/rename failure exercises the documented rollback or partial-result contract.
- A selected subset remains a subset; no background scan or unrelated agent files are created.
- Test only synthetic temporary projects. Do not install into this user's real agent profiles as a test.

## Integration and packaging

The coordinating agent will expose the stable module contract through the CLI, MCP where relevant, and public library exports. Suggested CLI surfaces: `workflow <request>` with explicit type/mode options; `skills list`; `skills install <project> --target ...` with preview default and `--apply` for execution. A workflow command returns advice, not an execution-complete claim. An MCP workflow tool returns the same structure; keep filesystem installation out of a read-only MCP capability unless its side effects are explicit.

Include `skills/**/SKILL.md` in the npm allowlist and verify module-relative catalog resolution after installation in a fresh consumer directory. Do not depend on repository cwd or source-only paths. Version the catalog/receipt sufficiently to support a future safe upgrade. Retain 7.0.0's build/runtime/Node guarantees and regression suite.

Use the skill-creator validator on the six bundled skills. Separately review descriptions and behavior against the scenarios above. Validator success proves frontmatter/structure, not host effectiveness. Root/Astra review must check for accidental permission expansion, compulsory extra work, unnecessary universal planning, claims to tools not present, and unclear host compatibility.

The exact tarball smoke test must list all six skills through the public API/CLI, route representative tasks, preview an install with no mutations, apply to synthetic projects for supported mappings, confirm idempotence and preserved custom content, and import public types/functions. Do not merely assert that skill filenames appear in the package manifest.

## Release and evidence gates

1. **Plan and contracts:** scope, native discovery references, module interfaces, and ownership agreed.
2. **Meaningful behavior:** pure routing scenarios and installer preservation/failure tests pass; skill frontmatter is valid.
3. **Independent review:** Astra reviews actual skill text and implementation with realistic examples; fix substantive misrouting or unsafe installation before release.
4. **Regression verification:** build, lint, the full inherited/new test suite, and dependency audit pass with recorded counts/runtime.
5. **Exact package:** install the packed artifact into a fresh consumer; verify skill discovery paths, public exports, CLI workflow, safe installation, and prior memory commands.
6. **Source and publication:** commit/push/tag the reviewed source; publish the tested 7.1.0 artifact to the authorized npm package; verify public version/integrity/dist-tag separately from command success. Do not overwrite or relabel the 7.0.0 artifact.
7. **Honest outcome:** report skills shipped, host layouts validated, host runtimes actually tested, checks passed, publication verified, and remaining limits separately.

## Completion checklist

### Independent skill behavior review

Astra read all six authored skills and evaluated their application to four concrete requests. This is an independent scenario evaluation of the instructions, with an actual isolated bugfix exercise; it is not a claim that four external agent applications were launched or tested.

| Scenario and raw request | Resulting behavior | Outcome |
| --- | --- | --- |
| Simple wording: “Correct the grammar: The parser do not accept empty rows.” | Respond directly: “The parser does not accept empty rows.” No plan file, repository scan, research, memory write, or added test. | Meets the direct-response requirement. |
| Planning-only: “Plan a database migration across the API, worker, and admin UI. Do not change files or run the migration.” | Deliver an ordered plan covering compatibility/read-write transition, staged implementation, verification, rollout and rollback. Stop after the requested planning deliverable; no source edits, dependency installs, or migration execution. | Honors the explicit boundary despite complex implementation vocabulary. |
| Bugfix: “Port zero is replaced with 3000. Fix the reported function and verify that an absent port still defaults.” | Use the supplied synthetic function and two meaningful tests. Reproduction failed with `3000 !== 0`; replace the truthiness fallback with a nullish fallback; rerun the original test plus absent/explicit-port behavior. | Actual fixture execution: baseline 1 pass/1 fail, after fix 2 pass/0 fail. Stop without unrelated refactoring. |
| Authorized release: “The reviewed package is ready. Publish this exact tarball to the named registry/repository and verify it.” | Check the exact artifact and destination, use existing authenticated tooling, publish under the already explicit authorization, then verify public version and integrity. Do not ask the same generic permission again; if upload is processing, inspect state instead of republishing. | Instruction walkthrough preserves existing authorization and separates accepted upload from verified availability. No real publication was performed by this review scenario. |

The bugfix fixture is isolated under `work/audit/workflow-forward`; it does not modify package runtime or user projects. The command executed was `node --test work/audit/workflow-forward/port.test.mjs` before and after the one-line correction. This exercises the intended reproduce/fix/verify behavior rather than asserting a skill's wording or counting headings.

Two small review corrections were implemented and reviewed: `shadow-debug` now explicitly honors diagnosis-only requests when invoked without the core skill, and the core's optional focused-skill references are qualified by availability. The installer generates its managed pointer from the selected subset, without referencing an uninstalled core skill.

### Independent installer verification

Astra inspected the fixed target/catalog allowlists, root containment, symlink/hardlink checks, ownership receipt validation, precondition checks, bounded managed sections, unique temporary files, exclusive installer lock, and rollback guards. The independent script `work/audit/v71-installer-review.mjs` passed against synthetic local projects on Windows/Node 24.15.0:

- Dry-run preserved the fixture tree and existing instruction bytes.
- A `shadow-debug` subset installed to Codex and DeepSeek native paths without adding the other five skills or a dangling core pointer.
- Original CRLF instruction content was preserved; repeat application reported no creates/updates and no new backup.
- Stale and tampered plans were rejected without discarding newly added user instructions or writing outside the intended destinations.
- A locally customized managed skill became a conflict and remained intact.
- A Windows junction in the destination path was rejected; the outside fixture remained empty.
- Injecting an instruction-update failure preserved the original instruction bytes, removed this attempt's newly created skill, left no receipt, and released the installer lock.
- Injecting a later manifest-create failure after a simulated concurrent instruction edit preserved the newer user bytes and explicitly reported the unresolved path instead of overwriting it during rollback.

No blocking installer finding arose from this review. Complete new-suite verification, exact packed-artifact tests, and publication remain separate gates. Concurrent external editors and abrupt process termination are not made transactional by these checks; documentation now distinguishes caught-error rollback from a terminated process that may leave a partial installation.

Router review identified concrete scope errors in the initial implementation: analysis-only requests suggested a fix; a review asking to explain “the fix” was treated as permission to edit; instructional “How do I deploy” questions suggested deployment; and rewriting a service across API/UI was mistaken for a trivial text transformation. These were reproduced by executing the pure module and corrected with contrastive regression tests.

Astra independently reran the same inputs against the corrected module: analysis-only returned reproduction/diagnosis without a fix; review-plus-explanation returned review/findings only; deployment instructions returned a direct answer workflow; rewriting the service returned planning/inspection/implementation/verification; and rewriting a sentence remained direct. The coordinating agent reported 28 passing router/MCP tests. Astra accepts the skill behavior, installer, and bounded advisory router with no remaining blocking finding. The documented English-cue/host-interpretation limitation remains; this is not a claim of universal natural-language classification or autonomous task execution. Full-suite and exact-package verification remain separate coordinating-agent gates.

- [x] Six concise skills authored and behavior-reviewed; frontmatter validation is tracked by the coordinating agent.
- [x] Router respects the tested direct, planning-only, review-only, implementation, research, and release distinctions.
- [x] Installer dry-run, containment, conflict, idempotence, and failure behavior independently verified.
- [x] Codex, Claude Code, OpenCode, DeepSeek Harness, and portable layout claims accurately documented.
- [x] Managed project instruction sections preserve user content and do not expand authorization.
- [x] Public module, CLI/MCP, and packed-catalog paths verified.
- [x] Astra behavior/implementation review completed.
- [x] Full tests/build/lint/audit and exact artifact checks recorded.
- [ ] GitHub and npm 7.1.0 independently verified after publication.
- [x] Runtime integration limits and any unobserved host loading explicitly reported.

### Coordinating-agent release gate

The final local suite passed **235 tests in 22 files**. TypeScript build and lint passed, all six skill frontmatter validators passed, and npm audit reported zero advisories. A fresh consumer installed the exact 7.1.0 tarball and passed library, CLI, MCP-source tests, all four native skill layouts, preview/no-write behavior, instruction preservation, repeat-install idempotence, local-edit conflicts, and existing memory diagnostics. MCP behavior is covered by the source suite; the packed consumer verifies CLI and public-library paths.

Tested tarball integrity: `sha512-txFUzpvjS+0xFm2VUPM+eMsXuGQd0AvROHdV9/YLJ9Bsz2vvS7jhwv4CjL0pXP3z7Ta3pYtEJB4GCEcSkXo+Xg==`.

Remote CI and publication evidence are recorded separately in `RELEASE_REPORT_v7.1.0.md`. Native host session loading was not observed; compatibility means documented layouts plus validated files/installation, subject to each host's enabled discovery support.
