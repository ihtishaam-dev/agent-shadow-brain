# Agent Shadow Brain 7.1.4: research, architecture, and acceptance plan

Prepared **2026-11-12**. Research lead: Astra. Implementation: GPT-6.1 SoL workers and coordinating agent. Status at preparation: architecture agreed; implementation and verification in progress. This document is a plan and a record of research, not proof that its acceptance gates have passed.

Scope update: the user's later request adds **Project Kit**, with persistent project-local knowledge, observed workspace profiles, and requirement-specific local skills. Its storage, preview/apply, and acceptance contracts are in the [Project Kit addendum](PROJECT_KIT_PLAN_v7.1.4.md). This work must pass its own gates before the combined release is accepted.

A subsequent request adds **project learning from reported outcomes**: attributed, reversible feedback can make a bounded change to relevant adaptive retrieval. Its state, scoring limits, UI requirements, and acceptance gates are in the [Project learning addendum](PROJECT_LEARNING_PLAN_v7.1.4.md). This is persistent retrieval feedback, not model training or automatic truth verification.

## Release thesis

Make a complete local workflow visible and reliable: **inspect memory → review evidence → curate → build task context → compare retrieval → hand off to an agent → inspect recorded activity**. Improve the retrieval engine, the interfaces agents actually use, and the graphical workspace together.

The defensible product position is an inspectable, provider-independent memory workbench for coding agents, with explicit project boundaries, recorded evidence paths, review controls, and reproducible evaluation. It is not a new foundation model, a replacement for an enterprise vector database, or a claim to outperform every memory product. Graphs, multiple-client support, and compact context are established features elsewhere; they cannot honestly be advertised as unique.

Version 7.1.4 preserves the existing memory schema and interfaces. The new adaptive retrieval profile is explicit, so established consumers can retain legacy ranking. The workspace foregrounds adaptive retrieval and a comparison against the legacy profile. Documentation must explain that distinction.

## 1. What the current source establishes

The starting checkout identifies package version 7.1.3. Its documented and inspected active path includes:

| Component | Existing behavior to preserve | 7.1.4 direction |
| --- | --- | --- |
| `GlobalBrain` | Schema-version-1 local JSON memory, atomic persistence, lock/merge handling, recall, timeline, storage health | Add a bounded raw scoped read path if needed; preserve legacy recall behavior and storage compatibility |
| Context assembly | Project filtering, feature checks, exact rendered-character cap, estimated tokens, duplicate provenance, exclusions | Add a separate adaptive strategy with transparent retrieval diagnostics |
| Memory annotations | Active/archived/contested reviews; related/supports/contradicts/supersedes links; revision checks and audit history | Reuse the same authoritative store in retrieval, health, graph, and review actions |
| Default workspace | Overview, memories, graph, context, activity, integrations, controls, memory inspector | Add attention triage, Context Lab, useful relationship views, and stronger connections between screens |
| Live portal | Durable bounded metadata journal, session/tool views, measured versus reported provenance, cursor/gap handling | Add deliberate navigation and bounded replay of recorded events; keep provenance visible |
| MCP stdio | Provider-independent local tools and explicit activity reporting | Add bounded inspection/health tools, resources, and user-selected task/handoff prompts |
| Skills/client support | Six workflow skills, client-specific project layouts, integration diagnostics | Supply current configuration recipes and precise capability limitations |
| CLI and library | Context, curation, activity, skills, adapters, advanced modules | Add new options and exports without removing established commands |
| Advanced interface/modules | A broad retained set of existing analyzers, workflows, watchers, adapters, and experiments | Retain access and accurately distinguish these from the verified new workflow |

Relevant source: `src/brain/global-brain.ts`, `context-assembly.ts`, `memory-annotations.ts`, `activity-journal.ts`, `mcp-server.ts`, `subconscious.ts`, and `src/dashboard/workspace-api.ts`. The prior release reports 325 passing tests; the coordinating agent is rerunning the baseline rather than treating that historical count as current proof.

### Concrete retrieval problems

Source inspection and isolated synthetic probes identify actionable weaknesses:

1. Legacy matching uses substrings. A query for `java` can match `JavaScript`; serialized arbitrary metadata can also produce a hit that is not a memory claim.
2. A record may match a technical term late in its content, while its leading 800-character excerpt omits that term.
3. The 200-candidate cap is applied before duplicate collapse. A large group of repeated high-ranking records can crowd out a distinct useful lesson.
4. The score blends match, age, importance, usage, and other-agent copies. It is a ranking heuristic, not a calibrated likelihood that a statement is true.
5. Recorded links are displayed, but the active context path does not use a conservative, explainable expansion step to find linked evidence.
6. Characters divided by four is only an estimate of model tokens, particularly weak for code and non-English text.
7. Some read-only context paths call `sync()`, which can commit pending operations. Their replacement should refresh the read view without turning inspection into an implicit write.

The older continuity and handoff modules do not all use the current curated pack path. Preserve them, identify their operational differences, and do not imply that this release has silently migrated every historical module.

## 2. Current primary-source research

All sources in this section were accessed **2026-11-12**. Documentation describes the publisher's product; we did not run competitors, inspect private accounts, or independently reproduce their benchmark claims. Mutable documentation can change after this date.

### Mem0

Current **Mem0 Platform** documentation describes native entity connections combined with vector and BM25 signals in one retrieval score. The graph is built into the platform; connections follow shared entities, rather than typed semantic predicates. Its documentation explicitly replaces the earlier external graph-store integration. Therefore, saying that current Mem0 Platform always requires Neo4j would be stale. This is a platform finding, not a universal statement about every open-source version. The relevant lesson is combining retrieval evidence, while keeping our recorded relation types and component explanations explicit. [Mem0 Graph Memory](https://docs.mem0.ai/platform/features/graph-memory)

### Letta

Current Letta documentation describes MemFS, a Git-backed memory filesystem shared across an agent's conversations. It also describes memory maintenance and background dreaming. The older V1 SDK documentation still explains editable in-context memory blocks and retrievable conversation history, but marks that SDK as legacy. Compare the correct generation rather than presenting an old API as the whole current product. The useful lesson is memory lifecycle management; our release implements human-visible review and attention triage without claiming autonomous consolidation. [Current memory and dreaming](https://docs.letta.com/configuration/memory) · [Legacy V1 stateful-agent model](https://docs.letta.com/v1-sdk/concepts/stateful-agents)

### Zep / Graphiti

Graphiti documents temporal facts with validity windows, source episodes, and semantic/keyword/graph retrieval. Its open-source framework requires a supported graph backend and model services or compatible local models for its ingestion architecture. It distinguishes the framework from managed Zep and warns that its reference servers are not production deployments. This is substantially richer temporal modeling than our manually recorded supersession links. Our opportunity is a smaller deployment and inspectable coding-memory workflow, not an unsupported claim of equivalent temporal reasoning. [Graphiti official repository](https://github.com/getzep/graphiti)

### Qdrant and retrieval infrastructure

Qdrant's Query API supports multi-stage retrieval with dense, sparse, and BM25 paths and subsequent fusion or rescoring. Its multitenancy guidance separately discusses retrieval filters and the population used for scoring statistics. These are infrastructure capabilities; they do not by themselves establish a coding-agent review workflow. The important lesson is to scope both candidates and ranking statistics, and to describe the actual retrieval stages. Adding a vector database is deferred until a measured need justifies the operational cost. [Hybrid queries](https://qdrant.tech/documentation/search/hybrid-queries/) · [Multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/)

### MCP reference memory server

The official reference memory server is a local persistent graph of entities, observations, and directed relations with create/read/update/delete tools. That establishes that a local graph over MCP is not itself a differentiator. Shadow Brain should instead make project isolation, curation, context budgets, evidence inspection, and evaluation work together. A capability absent from that README is not proof that no extension or competing implementation provides it. [Official memory-server source and documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)

### Claude-Mem

The current official repository describes multiple coding-agent integrations, hook-based capture, an observer, SQLite/keyword and Chroma semantic search, and a local viewer. Its MCP workflow progressively narrows from an index to a timeline to selected full observations. It explicitly distinguishes per-record size ratios from measured end-to-end savings. Do not claim that Claude-Mem is Claude-only or that progressive disclosure is novel here. The lesson is purposeful capture and staged inspection; our local metadata journal should remain explicit about what was measured or reported. [Claude-Mem official repository](https://github.com/thedotmack/claude-mem) · [Progressive disclosure](https://docs.claude-mem.ai/progressive-disclosure)

### Retrieval and evaluation references

Lucene's BM25 reference documents term-frequency saturation and document-length normalization. We can implement a small, transparent BM25-style ranker without adding Lucene; matching its broad formula does not mean reproducing Lucene's indexing or performance. [Lucene BM25Similarity](https://lucene.apache.org/core/10_5_2/core/org/apache/lucene/search/similarities/BM25Similarity.html)

LongMemEval separates information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention. That supports evaluating distinct failure classes instead of publishing one vague memory-accuracy number. Our small deterministic coding fixtures are diagnostic regression evidence, not a LongMemEval result. [LongMemEval paper](https://arxiv.org/abs/2410.10813)

### Positioning that the evidence supports

| Claim | Acceptable wording | Evidence required |
| --- | --- | --- |
| Local operation | The new retrieval, review, context, and inspection path works without model-provider calls | Isolated runtime/package tests with no provider configuration |
| Explainability | Inspect matched fields, score components, exclusions, source references, and recorded link paths | API output plus visible UI behavior |
| Better retrieval | Adaptive retrieval improves named diagnostic cases against the retained legacy profile | Paired fixtures with exact inputs, relevant IDs, outputs, and failures |
| Memory quality | The attention queue exposes missing references, unreviewed records, recorded disputes, duplicates, and broken links | Counter/queue tests; no invented trust score |
| Cross-agent use | Supported clients can use the documented MCP/skill integration | Protocol tests and dated client recipes; actual-client proof listed separately |
| Competitive value | A compact, inspectable local workflow with conservative scope and review controls | Demonstrated product workflow and dated comparison |

Avoid “best memory system,” “100% accuracy,” “hallucination-free,” universal latency claims, automatic factual verification, and competitor-relative percentages without a reproducible controlled study.

## 3. Cohesive release scope

### A. Adaptive context retrieval

Add `profile: 'adaptive'` to the shared context assembler. Keep the omitted/`legacy` profile compatible. The adaptive path uses:

- Unicode-aware words and technical identifier/path variants; only explicitly allowed metadata fields participate in matching.
- BM25-style lexical relevance with small documented exact-match/phrase/field signals. Scope document statistics to the eligible project corpus.
- Review-state and supersession filtering before ranking and graph expansion.
- Exact normalized duplicate collapse before the candidate cap; preserve originating memory IDs and bounded source provenance.
- Query-centered excerpts that show why a result matched, with safe Unicode truncation and a strict rendered-character bound.
- Conservative one-hop expansion through recorded `supports` and `related` links. A path is evidence of a recorded relationship, not proof that a claim is true. No automatic entity inference.
- A bounded explanation report whose candidate decisions correspond to the actual assembled result.

Contradictions remain visible cautions. Archived, contested, and superseded records cannot re-enter through a relation. An absent replacement does not silently reactivate its superseded predecessor. A relation never grants access to another project. Empty queries use a documented fallback, and unmatched queries do not invent semantic matches.

Initial bounds: 200 diagnostic candidates; at most two expanded neighbors per seed and 16 expanded records overall; one hop; titles up to 130 characters and four source references per candidate. The implementation scans the eligible corpus, searching up to 128,000 characters per record. Ranking work therefore grows with the corpus; the existing store pruning threshold is not a strict input-size limit. Any truncation must be visible, deterministic, and tested. Preserve exact character budgeting; label Unicode/code token estimates as estimates.

### B. Context Lab and evidence graph

The main context screen explicitly selects adaptive retrieval. A comparison action runs adaptive and legacy against the same scoped read snapshot, query, and character/token request. Show selected-ID additions/removals, exact characters, estimate method, and the reasons for changes. A better-looking score is not proof of a better answer.

Add a retrieval-stage graphic, readable candidate inspection, and recorded-path details. Keep selected/omitted states distinguishable without color alone. Link a candidate to the existing memory inspector, then make rebuilding context straightforward after review. Copyable output is a bounded reference/handoff pack, not a command that bypasses project instructions.

The graph must distinguish membership/agent connections from manually recorded memory relations. The selected-memory relation lens should help inspect a concrete decision; it must not suggest that geometric proximity is a verified semantic connection.

### C. Memory health and review workflow

Provide a read-only health report over a bounded inventory, initially capped at 5,000 records. MCP requires an explicit project; the local workspace may also inspect its clearly selected **All projects** inventory. Return source/review counts and a bounded priority queue for missing sources, age beyond a disclosed 90-day threshold, duplicate groups, contested/contradictory records, and orphaned relations. Report the scan cap and truncation. An unreviewed-only record contributes to review coverage without necessarily becoming a queue item.

These are attention signals. An old memory can remain correct, an unreviewed memory can be useful, and a source reference can be wrong. Do not combine the signals into a numerical truth/health grade. Reuse revision-safe review/link actions; no automatic deletion or consolidation. The coordinating agent owns the final route schema and keeps UI types aligned.

### D. Agent interfaces and handoffs

Expose the shared adaptive profile through CLI, HTTP, and `context_pack`. Add read-only `memory_health` and `memory_inspect` tools with explicit project scope. Add static guide/skill resources and a narrowly parsed project-memory URI template; a resource URI must never become an arbitrary local-file read.

Add user-selected `shadow-task` and `shadow-handoff` prompts containing bounded reference context and instructions to verify important evidence. Declare only implemented MCP capabilities. Resources and prompts are different protocol surfaces; a client may support one but not the other. MCP resources are application-controlled, while prompts are user-selected interactions. [MCP resources specification](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) · [MCP prompts specification](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts)

Provide copyable configuration recipes for Codex, Claude Code, current OpenCode, DeepSeek Harness, and generic compatible clients. Never inspect or rewrite personal client configuration to generate them. Support/file presence/recent activity/confirmed client connection must remain separate labels. DeepSeek Harness's current official MCP bridge supports tools/resources but says prompt templates are unsupported; document that limitation. [DeepSeek Harness MCP client](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)

### E. Live graphical system

Preserve measured MCP timing versus explicit host-report provenance. Add session/event navigation, understandable time windows, and replay controls over the loaded journal slice. Replay must say that it is replaying recorded events, with its available range and gap/truncation state. Keep pause, reduced motion, keyboard controls, and an accessible list alternative. Animation must correspond to a recorded event; it must not imply inferred thinking or background work.

### F. Documentation and component map

Rewrite the README around the actual workflow, with an image for each major step: install/connect, inspect memory, review/link, compare context, copy a handoff, inspect live activity. Use screenshots from the delivered build and clearly identify synthetic demo records. Concept artwork must be labeled as conceptual rather than presented as runtime proof.

Include an architecture diagram, component guide, feature/control semantics, client capability matrix, competitive comparison, package limits, and upgrade notes. Separate active verified core paths from retained advanced modules. Keep detailed material linked rather than crowding the quickstart. Recheck every command, image, link, release URL, and package claim against the final artifact.

### G. Isolated first-run demonstration

Add `shadow-brain demo workspace` as a reproducible onboarding path, preserving the older `demo` action separately. It serves the real workspace and Live portal on loopback using a newly created synthetic memory/settings/annotations/journal directory. It may generate scripted local MCP calls measured by the server, with explicit synthetic labels; these are not real connected coding-agent sessions. Both interfaces must display a demo banner. Startup must not load provider configuration, inspect client profiles, or touch the real memory store. Shutdown must stop timers and services before cleaning only the verified temporary directory. Include a static/no-activity option if practical, and test the delivered package's demo startup and isolation.

## 4. Shared contracts and ownership

### Context contract

```ts
interface ContextAssemblyOptions {
  // Existing fields remain.
  profile?: 'legacy' | 'adaptive';
  expandRelated?: boolean; // Adaptive default: true. Legacy behavior unchanged.
}

interface ContextRetrievalReport {
  profile: 'adaptive';
  scanned: number;
  candidateCount: number;
  candidateLimit: number;
  truncated: boolean;
  stages: Array<{ id: string; label: string; count: number }>;
  candidates: Array<{
    id: string;
    projectId: string;
    title: string;
    rank: number;
    score: number; // Ranking signal, not probability of truth.
    signals: Array<{ label: string; value: number }>;
    matchedTerms: string[];
    matchedFields: Array<'content' | 'category' | 'source' | 'tag'>;
    decision: 'selected' | 'excluded';
    reason: 'selected' | 'budget' | 'limit' | 'duplicate' | 'candidate-limit';
    sources: string[];
    paths: Array<{
      seedId: string;
      relationId: string;
      relationType: 'supports' | 'related';
      fromId: string;
      toId: string;
    }>;
  }>;
}
```

`ContextPack.retrieval` is additive and present for adaptive requests, including disabled results. Existing inactive exclusions remain in `ContextPack.excluded`. Adaptive budget metadata may add `estimator: 'unicode-code-heuristic'` and `usedBytes`; the legacy budget shape remains intact. Disabled context returns before memory retrieval and annotation reads. All diagnostics obey the same project scope as the content.

| Owner | Files/responsibility |
| --- | --- |
| Astra | This research/architecture plan, independent source review, final evidence review |
| Core worker | Adaptive retrieval module, context assembler, minimal raw-read/type additions, focused core tests |
| UI worker | `workspace-html.ts` and `live-workspace-html.ts`; new visual workflows and interaction states |
| Coordinating agent | HTTP API/server, CLI, MCP, client integration recipes, library exports, evaluation harness, package/version, documentation/assets, end-to-end and release verification |

Coordinate schema changes before editing shared callers. Keep the existing schema-version-1 store and annotations store. No new runtime dependency is required for lexical scoring, diagnostics, charts, or bounded traversal.

## 5. Evaluation design

Use synthetic stores in an explicit temporary directory. Do not read the maintainer's real memory, browser state, credentials, or personal provider configuration. Each case records its corpus, query, project, expected relevant IDs, profile, budget, returned IDs, exclusions, and rendered output. Freeze timestamps where age affects ranking.

### Required diagnostic cases

| Case | Assertion |
| --- | --- |
| `java` versus `JavaScript` | Exact technical term survives without a substring-only result taking precedence |
| Arbitrary metadata boolean/key | A field name in irrelevant serialized metadata is not treated as a memory fact |
| Identifier variants | Supported camel/snake/path variants find the intended coding record; behavior is documented |
| Late exact term | The selected excerpt visibly contains the matching passage |
| Duplicate saturation | More than 200 repeated records cannot eliminate a distinct eligible lesson before deduplication |
| Rare versus common term | Lexical components behave consistently with the documented scoped formula |
| Recorded support/related path | A bounded eligible neighbor is returned with its exact recorded path |
| Contradiction | Caution remains visible and does not become positive corroboration |
| Archived/contested/superseded | Every retrieval stage excludes inactive records; missing replacements stay superseded |
| Scope attack | Other-project text, titles, sources, paths, counts, and diagnostics remain absent unless both opt-ins permit scope expansion |
| Empty/no-match query | Documented fallback/empty result, no fabricated semantic match |
| Tight and zero budgets | Complete rendered pack respects exact character bounds, including headings and references |
| Unicode/code text | No broken surrogate sequences; estimator is disclosed and not presented as an exact tokenizer |
| Disabled controls | Disabled context does not initialize/read memory; recording and visibility still have separate effects |
| External refresh | Read paths observe committed changes without committing unrelated pending writes |

Report retrieval recall at a fixed K and reciprocal rank only when relevant-ID labels are explicit. Record context-level inclusion and source retention separately from candidate ranking. For no-answer cases, report abstention separately. Count project leaks and bound violations directly. These are executable invariants, not a universal accuracy percentage.

Run paired legacy/adaptive cases with the same corpus and scope. Publish every case, including regressions and ties. Report sample counts and fixture names; do not extrapolate to production coding performance, user time saved, or competitors. A small fixture designed to expose a known bug is useful regression evidence but is not an unbiased benchmark.

For cost/performance, report actual input record count, corpus bytes, platform/Node version, cold/warm status, elapsed time distributions, and peak memory only if measured. Do not convert character reduction into provider billing or token savings without the relevant tokenizer and pricing basis. Keep runtime timing assertions generous enough for CI; enforce data/loop bounds rather than arbitrary millisecond claims.

## 6. Acceptance and release gates

1. **Baseline and compatibility:** rerun inherited tests; preserve schema, commands, adapters, curation, live journal, controls, and legacy context contracts. Add no silent migration.
2. **Core correctness:** all named diagnostic invariants pass; candidate report agrees with the actual pack; no hidden provider/file fetches; no source-target dereferencing.
3. **Interface integration:** real HTTP tests validate inputs, scope, stale revisions, comparison snapshot, feature gates, and no-write inspection. MCP framing/initialization/list/read/get/tool behavior and capability declarations pass real stdio tests.
4. **Graphical acceptance:** view actual desktop and mobile screens; complete inspect→review→rebuild→copy flow; compare profiles; inspect recorded paths; operate Live pause/replay. Verify keyboard, reduced motion, contrast/readability, empty/error states, hostile text, and no overflow. Verify results after reload, not only local UI state.
5. **Package:** build, lint, full tests, dry pack, and exact tarball smoke test in a fresh consumer. Verify public exports and CLI/MCP from the packed artifact. Keep package growth measured and explain any large asset increase.
6. **Documentation:** final screenshots reflect the delivered build; synthetic data is labeled; client recipes match dated official docs; component claims reflect implemented paths; every release link/version is correct. State that package semver order and npm `latest` may differ because 7.2.0 predates the requested 7.1.3/7.1.4 release line.
7. **GitHub:** inspect final diff, commit/tag the exact accepted source, push through the previously authorized release workflow, observe CI completion, and verify the public release/assets. Prepared work is not published work.
8. **npm:** publish the exact tested tarball under standing authorization; the user completes account/2FA steps privately if required. Verify exact registry version, integrity/tarball content, dist-tag, and a fresh install. Do not report publication complete until registry and install proof exist.

The coordinating agent handles release authorization; this research subtask does not publish. Automated approval failures or account barriers must be reported accurately. Never inspect token stores, cookies, browser history, saved logins, or private credentials.

## 7. Explicitly deferred

- Automatic entity extraction, embeddings, an LLM reranker, or a hosted provider requirement.
- Autonomous memory rewriting, consolidation, truth adjudication, or removal of old records.
- A database migration, unlimited graph traversal, cloud/team synchronization, or multi-user authorization service.
- A claim that manually recorded supersession is equivalent to Graphiti's temporal model.
- A claim that all retained legacy analyzers/workflows now execute through the new curated path.
- New provider authentication, personal client configuration changes, or access to user session history.
- Competitor-relative accuracy, latency, cost, and coding-success claims without controlled measurements.

These remain possible future work after the new workflow supplies evidence about its real limitations. The immediate release should earn its claims through the finished artifact, useful interactions, and reproducible tests.
