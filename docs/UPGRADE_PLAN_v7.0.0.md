# Agent Shadow Brain upgrade plan

Prepared: 2026-11-11. Baseline inspected: published `@theihtisham/agent-shadow-brain@6.3.0`. Target release: 7.0.0. This is an implementation and release plan, not a completion claim.

## Objective and roles

Make the existing shared memory layer dependable when multiple agents write, and make recalled memory scores reflect the evidence actually available. Preserve local-first operation, existing CLI/API/MCP entry points, and existing JSON memories.

Astra serves as architecture and review lead: choose scope, establish invariants, inspect failure cases, and review the release evidence. GPT 6.1 SoL serves as implementation lead: recover or locate the authoritative checkout, implement the approved scope, run verification, and publish the exact reviewed artifact. These are execution roles for this work; they do not imply adding model-provider integrations to the product.

Release theme: **Reliable shared memory and explainable recall**. Initial planning targeted 6.4.0; implementation discovery justifies **7.0.0** instead. Patched dependency majors require a higher Node baseline, installation no longer runs automatic setup, and unreadable/corrupt stores now fail visibly instead of silently resetting. These compatibility changes deserve a major version. Confirm 7.0.0 remains unpublished immediately before release.

## Evidence from the published package

The package advertises a shared source of truth across projects and agents. Its `GlobalBrain` currently loads a JSON snapshot once and writes the whole snapshot back on every dirty sync. The publication includes compiled JavaScript and declarations; inspected source maps refer to TypeScript paths but do not embed source contents. The repository URL in package metadata was not accessible during the initial source search.

Source recovery update: the parent agent recovered the exact published npm `gitHead`, `bec756e19647a11cad570f8ae3c363792de84856`, from public fork `shadrackohemeng/agent-shadow-brain`. Full source is checked out under `work/agent-shadow-brain` (initial working branch `upgrade/6.4.0`, release target subsequently revised to 7.0.0). This preserves actual source/history and removes the need to reconstruct TypeScript from the distribution. Initial publication checks found the recorded GitHub upstream inaccessible and npm reporting `ENEEDAUTH`. The coordinating agent subsequently reported successful npm authentication after the user logged in manually; no credentials were requested in chat or inspected by this reviewer. The coordinating agent verified the current GitHub account as `ihtishaam-dev` through `gh api user` and announced `ihtishaam-dev/agent-shadow-brain` as the destination for the user-authorized GitHub upload because the original owner/repository was unavailable. Repository creation and remote publication remain pending until verified; this is the intended current-account destination, not a claim that the original remote was recovered.

Baseline verification update from the coordinating agent: TypeScript build passed; 171 of 172 baseline tests passed, with the remaining test tied to a fixed June date and failing against the current November date. Make its clock deterministic. Dependency audit reported 14 advisories (4 critical, 7 high, 3 moderate). The coordinating agent is upgrading the affected direct/development dependencies and will record the final audit after verification. Planned Node support is `^22.12.0 || ^24.0.0 || >=26.0.0`; the final manifest and CI must agree, and only actually tested versions may be claimed as verified.

Implementation review update: the coordinating agent reported the migrated dependency audit at zero advisories and the corrected baseline at 172 passing tests. Astra reviewed the rewritten GlobalBrain lock, merge, acknowledgement, read-refresh, and scoring paths and found no blocker in the initial static pass. The independent built-output probe `work/audit/v7-independent-review.mjs` passed: simultaneous instance additions; external-read refresh; summed access deltas; queued writes arriving during a held-lock wait; preserved malformed-store bytes; false acknowledgement on failure; exactly-once retry; and unchanged bytes/modification time after a read-only lifecycle. All review fixtures were synthetic and explicitly located beneath `work/audit/fixtures`. Actual multiprocess contention tests, full final suite, exact tarball checks, and publication verification remain separate release gates.

Core review gate update: SoL reported all 22 focused storage/scoring tests passing. Astra inspected the test implementation, including four actual Node processes synchronized after initialization, 40 exact unique acknowledged IDs, and restart verification. The failure tests cover EPERM with preserved previous bytes, retry, old live locks, late queued operations, corrupt/future/unreadable stores, and read-only refresh. Astra accepted the core implementation with no blocking finding. Full final suite, exact release tarball, remote CI, and publication are still independently verified by the coordinating agent. These results do not claim crash-recovery automation, coordination with old v6 writers, power-loss guarantees, network-filesystem safety, or a full codebase security audit.

Final local release-gate evidence, reported by the coordinating agent: all **192 tests across 19 files passed**; build and lint passed; `npm audit` reported **zero vulnerabilities**; and a packed-artifact fresh-consumer installation passed library import, CLI version/help, durable write, storage-health, explained recall, corrupt-store preservation, package-content, and configuration-isolation checks. The dashboard tooltip now states that the score is heuristic rather than a probability of truth, and identifies creation-age recency and matching-content agent reports. No additional test rerun was needed for this documentation-only update. Local engineering/review gates are complete. Remote GitHub creation/push/tag, registry publication/integrity, dist-tag verification, and remote CI remain pending verification by the coordinating agent.

Three deterministic probes were executed against the published `global-brain.js`, using newly created stores only under `work/audit/fixtures`. They imported only the inspected global-brain module and its in-process bus dependency. They did not run package setup, attach hooks, read the user's memory store, or inspect private credentials.

| Priority | Finding | Evidence | User impact |
| --- | --- | --- | --- |
| P0 | A writer replaces other agents' memories | Two independent instances initialized before either write each added a different entry. After both synced, disk contained one entry, not two. | The core cross-agent promise can silently lose memory. |
| P0 | A queued write reports success before disk commit | Making the fixture destination temporarily unwritable caused `sync()` to throw `EPERM`, while `write()` still resolved `true`. | Agents can report durable learning that was never saved. |
| P1 | Unrelated agents inflate apparent corroboration | A target memory scored 0.595/medium. Two unrelated entries in other projects but the same category raised it to 0.695/high. | The dashboard and agents may overtrust uncorroborated facts. |
| P1 | Relevance is constant for every query match | `computeConfidence()` assigns 0.9 whenever meaningful keywords were supplied, independent of how many matched or where. | Weak matches can outrank relevant memories through unrelated popularity signals. |
| P1 | Persistence uses one shared temporary filename | `persist()` writes `dbPath + '.tmp'` without an interprocess lock. | Concurrent processes can race on both the database and temporary file. |
| P1 | Store read failures are treated as corruption | Broad initialization catch attempts to rename the store and continue with an empty brain. | Permission or transient read failures can become silent resets. |
| P2 | Numeric and date inputs lack defensive normalization | Non-finite importance, negative counts, and invalid dates can propagate to scoring; raw limits are sliced directly. | Scored results can disappear or serialize invalid values unexpectedly. |
| P2 | Package/runtime claims need reconciliation | Node engine declares >=18 while dependencies may require newer Node; auto-setup prints v5.2.0 and the README includes stale/broken image references and an unrelated Trendshift badge. | Installation and release identity may differ from documentation. |

Reproduction: `node work/audit/published-global-brain-probe.mjs`. Its fixture data is synthetic. Keep this baseline evidence separate from the final implementation tests.

## Scope for the release

Ship these together because they establish one contract: a memory accepted as saved survives cooperating writers, and its ranking is explained honestly.

1. Preserve concurrent writes, registrations, and access updates through a bounded, explicit interprocess commit protocol.
2. Acknowledge queued writes only after successful persistence; preserve failed pending operations for an explicit retry contract.
3. Distinguish unreadable, malformed, and unsupported stores. Never silently replace an unreadable or newer-schema store with an empty one.
4. Compute relevance from normalized query matches; remove category-wide diversity as a claim of factual agreement.
5. Normalize malformed legacy ranking fields without modifying the source file merely because it was read.
6. Expose accurate scoring language and additive explanations through existing consumers; keep old response fields available.
7. Add meaningful failure and concurrent-process tests, package verification, release notes, and a reproducible release manifest.

Defer feature breadth: autonomous publishing, new remote providers, cloud sync, vector database migration, model training, new agent swarms, and a dashboard redesign. None solves the reproduced failures. Do not claim a full security audit of the entire large existing feature surface from this bounded review.

## Phase 0 — Establish source provenance and a safe baseline

- Locate the authoritative working tree and inspect its local instructions and git state. Preserve all unrelated user work.
- Verify the intended upstream and package identity with public metadata or the connected GitHub capability. A 404 does not establish whether the repository is deleted, renamed, private, or simply inaccessible.
- Do not read `.npmrc`, credential files, browser stores, authentication secrets, or unrelated home-directory files to solve access issues.
- If original source cannot be found, clearly label a reconstruction from the public npm artifact and document its limitations. Do not fabricate commit history, tests, or absent source contents. A source reconstruction requires sufficient buildable coverage and provenance before release; an unpacked `dist` directory alone is not equivalent to a maintainable source checkout.
- Record the npm tarball integrity, installed version, source commit when available, and initial dirty state. Install dependencies with lifecycle scripts disabled in the isolated checkout. Run no global installation, hook attachment, setup, auto-update, or user's default brain initialization.
- Run an isolated baseline build/test where the source permits it. Record existing failures independently of new regressions.

Gate A: buildable source is identified; the three published failures are captured; the intended publication destination is verified or explicitly recorded as an external blocker. Engineering work can continue while publication access is unresolved.

### Implementation ownership and shared contracts

SoL owns `src/brain/global-brain.ts`, relevant `src/types.ts` additions, and focused storage/scoring tests. The coordinating agent owns test isolation, package/release configuration, CLI/MCP integration, documentation, and publication. Astra reviews both the storage invariants and final evidence.

Expose `GlobalBrain.getStorageHealth()` with this additive shape so integrations can proceed independently:

```ts
interface GlobalBrainStorageHealth {
  status: 'healthy' | 'pending' | 'error';
  dbPath: string;
  initialized: boolean;
  pendingOperations: number;
  lastSuccessfulSync: string | null;
  lastError: { code: string; message: string; at: string } | null;
}
```

Use ISO timestamps; return a copy, never mutable internal state. `status: 'error'` takes precedence when the last attempted commit failed and has not subsequently succeeded; an uninitialized store is distinguishable through `initialized`. Keep diagnostic messages free of memory contents. A configurable optional `lockTimeoutMs` may default to 5000 ms. The health command must not inspect credentials, attach integrations, or initialize unrelated services. Reads may inspect only the explicitly selected brain store; tests always select synthetic fixture paths.

## Phase 1 — Define and implement memory commit invariants

### Required invariants

- An acknowledged asynchronous write exists in the committed store after restart.
- Every distinct acknowledged write from cooperating processes survives subsequent commits.
- The database is always either the previous valid JSON or the next valid JSON; readers never observe a partially written payload.
- Read/parse/permission failure cannot cause a commit based on an assumed empty store.
- The process never removes another live writer's lock or temporary file.
- Shutdown clears its timer even when flush fails, and reports flush failure to callers.
- A long-lived reader refreshes external committed changes on an explicit/periodic sync, even when it has nothing to write. This refresh is read-only; cross-process visibility is bounded by the configured refresh interval, not claimed to be instantaneous.
- `writeSync()` retains its existing immediate ID-return behavior; documentation explicitly says it stages an in-memory change until `sync()`/shutdown commits. Do not falsely relabel it as durable synchronous I/O.

### Recommended architecture

Keep the existing JSON format for compatibility, but replace full-snapshot overwrite with a pending-operation commit path. Track additions, project/agent registrations, access-count increments, and explicit deletions separately from the loaded snapshot. The operation queue should preserve the IDs generated when callers originally wrote, so retries are idempotent.

Acquire an exclusive filesystem lock adjacent to the configured database using an atomic filesystem operation. Use bounded asynchronous retry and a clear timeout error, not indefinite busy-waiting. Release only a lock whose ownership token matches the current writer. Do not infer that an old timestamp alone proves the owner is dead: if recovery is implemented, test liveness and race conditions conservatively; a bounded error is safer than stealing a live lock.

While holding the lock, read and validate the latest disk snapshot. Apply this writer's pending operations to that snapshot and preserve unfamiliar fields wherever compatible. Add new entry IDs once; apply access increments as deltas; merge registration timestamps monotonically. A stale writer must not reintroduce an entry explicitly deleted by another writer. If prune semantics cannot be made correct within this release, narrowly defer automatic pruning during concurrent commit and document that choice rather than merge whole stale maps.

Write a unique sibling temporary file opened exclusively, flush the file where supported, and atomically replace the database. Use `try/finally` to close handles and clean up only this writer's files. Account for Windows rename errors without deleting the last valid destination first. Avoid promising full power-loss durability unless filesystem/directory flush behavior is tested on the supported platforms.

Only after successful replacement: resolve accepted queued writes `true`, update in-memory state from the committed merged snapshot, clear committed operations, set last-sync status, and publish durable-commit events if introduced. On failure: report the error, keep operations retryable, and never claim successful persistence. Choose and document whether the original `write()` promise resolves `false` immediately while operations remain queued, or stays pending until a later successful retry; tests and callers must agree.

Treat a missing file as a new store only on the specific missing-file error. Validate top-level shape and schema before merging. A corrupt-store backup/recovery workflow must preserve the original bytes and be explicit. Unsupported future schemas fail closed. Avoid introducing automatic destructive migration.

### Tests that matter

- Two stale instances, both flush orders, then reopen: both entries survive.
- A read-only instance syncs after another writer commits: recall sees the externally committed entry without rewriting the store.
- Multiple actual Node processes synchronize on a barrier and write many distinct entries: exact expected ID set survives, JSON parses, no duplicate IDs.
- A writer registers a project while another adds a memory: both survive.
- Two writers touch the same entry: access increments are merged correctly and timestamps do not move backward.
- A stale writer commits after a prune/delete: deleted entries are not resurrected.
- Forced write/rename failure: no true acknowledgement, prior valid DB remains intact, retry commits exactly once.
- Held lock: bounded timeout, no stolen lock, no deletion of another writer's temp file.
- Malformed JSON, permission failure, unsupported schema: error is visible, original bytes are preserved.
- Shutdown with pending writes and shutdown under error: promise/timer behavior is deterministic.

Gate B: these tests pass against temporary databases; the published loss and false-acknowledgement probes are corrected; reviewer inspects lock ownership and failure cleanup.

## Phase 2 — Make recall relevance and trust signals honest

Create one shared keyword normalization path for matching and scoring. Normalize case and whitespace, remove duplicates and documented stop words, and distinguish an empty meaningful query from a real query. Do not use one normalization rule in `recall()` and another in `recallScored()`.

Compute relevance from actual matched query terms and field contributions. Content/category evidence should dominate a match on project name alone. Keep scores finite and within [0,1], and retain stable deterministic ties. Apply metadata/project/agent filters before computing the candidate universe. Evaluate the complete bounded filtered candidate set rather than allowing an arbitrary pre-score top-60 cutoff to exclude the best scored result; document any explicit safety cap.

Remove the current claim that different agents writing anything in a category constitute corroboration. A conservative compatible repair is to keep the `signals.corroboration` field at zero unless explicit corroboration evidence is defined and validated. If implementing a duplicate-fact heuristic, restrict it to the same project and normalized factual content, count distinct agent identities, and label it independent reports rather than proof of truth. Copied text and fabricated agent labels are not verified independent evidence.

Do not equate last access with source freshness. Preserve the existing recency field for compatibility but clarify its meaning, or use creation/explicit verification time with a documented change. Access popularity is a ranking aid, not factual validation. Unknown or invalid timestamps must have conservative finite handling; negative/non-finite importance and access counts must not create NaN or inflate trust.

Retain the `confidence.score`, `level`, and `signals` shape. Add optional explanation/matched-term fields only if consumers need them. Describe the value as a heuristic recall score, not a calibrated probability that a statement is true. High scores never supersede source verification or project instructions.

Tests: one of several query terms versus all terms; category-only versus content matches; unrelated same-category entries in other projects; duplicate keywords; stop-word-only query; mixed casing; malformed legacy dates/counts; fractional/negative/non-finite limits and thresholds; deterministic tie ordering; score filtering; project isolation; queries large enough to expose the old candidate cutoff.

Gate C: unrelated memories no longer change a target's corroboration score; stronger query matches rank appropriately; every emitted score/signal is finite; response compatibility is preserved.

## Phase 3 — Integrate existing surfaces and document behavior

- Route MCP and dashboard recall through the same options validation and scoring behavior. The current `global_recall_scored` MCP tool already exists; extend it instead of creating duplicate tools.
- Preserve existing endpoint names and flags even where names are project-specific. A generic alias is additive if worthwhile, not a reason to break clients.
- Make any cross-project fallback explicit in the response and visible in the interface. Existing dashboard code already shows a fallback warning; preserve this behavior.
- Update dashboard score labels/tooltips and type comments to avoid implying factual corroboration or calibrated truth confidence.
- If exposing storage health, report last successful commit, pending count, and last failure without dumping memory content or filesystem secrets.
- Audit changed UI interpolation for escaping. A static audit already found activity-log `innerHTML` interpolation of event details; either fix this small directly related unsafe rendering path with a malicious-text regression fixture, or disclose it as a separately tracked pre-existing issue. Do not execute untrusted markup in a real user browser.
- Resolve version strings in changed release surfaces and include valid npm-facing images or remove broken references. Remove the unrelated Trendshift badge rather than implying unrelated popularity.
- Reconcile the declared Node minimum with dependency engines and test matrix. Raising it is a compatibility decision that must be explicit, not a silent metadata edit.

Gate D: API/MCP fixture tests exercise real changed handlers where practical; package CLI/API smoke tests use isolated temporary homes/stores after inspecting startup paths; docs accurately describe persistence, ranking, limitations, and install behavior. Browser UI is not used without the user's request under the user's privacy instructions; static rendering tests are not reported as visual browser acceptance.

## Phase 4 — Verify the exact distributable

Run TypeScript checking/build, focused regression tests, then the available full suite. Record commands, runtime versions, counts, failures, and exit codes. Investigate new failures; preserve a clear separation between pre-existing failures and this change. Do not describe a partial or skipped suite as a full pass.

Create the actual npm tarball with lifecycle scripts disabled where required. Inspect its file manifest: source maps/declarations align, entry points and CLI shebangs exist, no fixture stores, logs, private state, test artifacts, or credentials are included. Test installation and imports from this exact tarball in a fresh sandbox. Inspect postinstall behavior before executing it; it must not mutate the user's environment during verification.

Run the concurrent-writer and restart probe against the installed packed output, not only TypeScript test imports. Confirm package version, runtime-visible version, and release documentation agree. Validate the minimum supported Node version or clearly state which versions were actually exercised.

Produce a release manifest containing source commit, version, artifact filename, SHA-256/SHA-512 or npm integrity, test summary, and known limitations. Retain the previously published tarball and git checkpoint for rollback reference; do not touch the user's live memory store.

Gate E: the exact artifact intended for publication passes isolated verification and the review lead approves the concrete diff and evidence.

## Phase 5 — GitHub and npm release

The user has requested upload to GitHub and npm; no extra generic confirmation is needed for that authorized destination. Publishing still requires a verified repository and usable authenticated capability. Use connected tools or an already configured publishing command without opening or printing credential stores. Never request a token, password, recovery code, or OTP to be pasted into chat. If authentication is unavailable or interactive approval is required, identify that precise external blocker after completing the reviewable local work.

1. Confirm version availability and verified upstream target; avoid overwriting existing immutable npm versions or unrelated repository history.
2. Commit the reviewed source and documentation; push the intended branch/tag through the authorized capability. Confirm the remote commit matches the reviewed local commit.
3. Publish the exact tested tarball at the chosen version/tag. Do not rebuild different bytes after verification without repeating package checks.
4. Read public registry metadata and fetch the published tarball to verify version and integrity. Smoke-test the public artifact in a new isolated directory.
5. Verify GitHub visibility, release/tag identity, npm version/dist-tag, and installation separately. A successful local build is not proof of a GitHub push or npm publication.
6. Report actual outcomes with links and any external blockers. If one destination succeeds and the other fails, say so explicitly and retain the artifact for a controlled retry.

Rollback: restore a prior known-good version through the appropriate distribution tag or publish a corrective version; do not assume deleting a public version is safe or allowed. Keep old-schema reading compatible so rollback does not require destructive memory conversion. Document that downgrade to older writers reintroduces their lack of locking; do not promise concurrent safety with old and new writer versions mixed.

## Follow-on roadmap after this release

1. Evidence lifecycle: explicit source references, verification timestamps, superseded/conflicting memories, source-change detection, and transparent review queues.
2. Storage evolution: benchmark real memory sizes and contention, then consider a transactional store behind an adapter with tested export/rollback. Do not rewrite storage solely for fashion.
3. Retrieval evaluation: held-out realistic queries with relevance judgments and ablation comparisons. Measure retrieval utility separately from factual correctness; report results instead of claiming intelligence gains without evidence.
4. Safer integration management: idempotent attach/detach, config backups, previewable mutations, and platform-specific compatibility checks.
5. Dashboard and network boundary audit: escaping, request methods, origin checks, loopback defaults, and optional offline asset bundling. This requires a separate defined audit scope.
6. Operational clarity: health reports, explicit persistence errors, schema compatibility reports, and measured recall/commit latency under load.

## Release completion checklist

- [x] Authoritative source/provenance and intended current-account repository destination established; remote creation/push is a separate gate.
- [x] Memory-loss and false-success regressions repaired and tested with real processes.
- [x] Lock, corruption, schema, and retry failure paths reviewed.
- [x] Recall scores use actual relevance and conservative corroboration.
- [x] Existing clients and existing JSON stores remain supported as documented.
- [x] Changed dashboard output is escaped and labels are accurate.
- [x] Build, relevant tests, and packed-artifact checks recorded.
- [ ] Release artifact, source commit, and integrity recorded.
- [ ] GitHub remote commit/tag verified, or precise external blocker reported.
- [ ] npm public version/integrity verified, or precise external blocker reported.
- [ ] Final response distinguishes implemented, tested, uploaded, and externally verified outcomes.
