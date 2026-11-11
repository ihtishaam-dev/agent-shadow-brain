# Agent Shadow Brain 7.0.0

Release date: 2026-11-11. Development used Astra for planning/review and GPT-6.1 SoL for core implementation. These are development roles, not newly bundled AI model services.

## What changed

Concurrent agents now serialize memory commits and merge their pending additions, access changes, and registrations with the latest valid disk snapshot. Successful queued-write acknowledgements follow persistence. Failed changes remain pending for retry. Corrupt or future-schema stores produce explicit errors while preserving the original bytes.

Scored recall ranks the full matching pool, reports matched keywords and supporting agent identities, uses creation-age recency, and handles malformed numeric values without emitting NaN. Corroboration requires matching normalized content in the same project and category. Repeated text from different agent identities is a heuristic; it does not establish independent fact checking.

New CLI commands:

```sh
shadow-brain storage-health --json
shadow-brain storage-health --db ./global.json --json
shadow-brain recall-explain "release verification" --limit 5
```

The MCP `global_storage_health` tool exposes the active process's pending operations and latest storage error without starting or flushing a store. Existing `global_recall_scored` results include explanations. The library entry point exports GlobalBrain and associated types.

Installation no longer runs automatic agent setup. CLI help, version, storage-health, and recall-explain do not load provider settings. Dashboard activity rows escape memory text. Diagnostic output no longer prints key fragments. Dependencies are updated and promotional automation is manual-only.

## Compatibility and migration

- Supported runtimes: Node 22.12+ within 22.x, 24.x, or 26+.
- Back up the store and stop older writers before upgrade. The new protocol cannot coordinate with an old writer that ignores its lock.
- Store schema remains version 1. Invalid stores must be repaired or restored explicitly; automatic reset is removed.
- `writeSync` stages an in-memory change. Use `await sync()` for persistence. A queued `write()` resolves after synchronization. A false result means queue rejection or failed persistence; accepted failed operations remain retryable.
- Recalls use the current process snapshot; a sync refreshes external changes. There is no instantaneous cross-process notification guarantee.
- Lock waits are bounded (default five seconds, configurable with `lockTimeoutMs`). Locks are never removed merely because they are old. After an interrupted process, inspect the writer and store before manually removing an abandoned `.lock` file.
- Atomic replacement protects against partial JSON visibility. This release does not claim power-loss durability on every filesystem or safe coordination on all network filesystems.
- Scores are heuristic rankings. Revisit application-specific `minConfidence` thresholds.
- New health timestamps refer to the current process, not a persisted lifetime history.
- Dependency major upgrades can affect applications importing re-exported Zod APIs; consult the upstream Zod 4 and simple-git 4 migration notes.

## Source provenance

The original repository URL returned 404 during this upgrade. The source was recovered from public fork `shadrackohemeng/agent-shadow-brain` at commit `bec756e19647a11cad570f8ae3c363792de84856`, exactly matching npm 6.3.0's `gitHead`. The downloaded 6.3.0 tarball is retained separately as the comparison baseline. Original MIT licensing and history are preserved.

## Validation

The release gate requires type-check/build, full tests, cross-process storage regressions, npm audit, fresh-consumer tarball installation, CLI/library smoke checks, package-content review, and Astra review. Remote CI results and publication status are recorded separately; prepared artifacts are not evidence of publication.

Upstream references: [Vitest migration](https://main.vitest.dev/guide/migration/), [simple-git changelog](https://github.com/steveukx/git-js/blob/main/simple-git/CHANGELOG.md), [Zod migration](https://zod.dev/v4/changelog).
