# 7.0.0 release checklist

## Build and behavior

- Confirm package.json, lockfile root, CLI, update checker, MCP metadata, dashboard, README, and release notes agree on 7.0.0.
- Run `npm ci --ignore-scripts` from a clean checkout, then `npm run verify` and `npm run lint`.
- Verify independent-process writes survive, queued success follows persistence, failed changes remain retryable, external deletions are preserved, and invalid stores remain byte-for-byte unchanged.
- Verify unrelated agent notes cannot boost corroboration and every score is finite and explained.
- Run `npm audit --audit-level=high`; record counts with the validation date.
- Run `npm run test:package`; it packs the build, installs into a fresh temporary consumer, imports the public API, tests both new CLI commands, and verifies configuration isolation.

## Publish the reviewed artifact

- Keep the original 6.3.0 tarball and exact source commit available for rollback comparison.
- Review `npm pack --dry-run --json` and allowlisted contents. Exclude personal state, node_modules, tests, temporary outputs, and configuration files.
- Commit the reviewed source and lockfile; push without rewriting existing remote history.
- Pack once, compute SHA-512/integrity, and publish that exact tarball with `npm publish <tarball> --access public --ignore-scripts` after local npm login by its owner.
- If npm requests browser authentication or a second factor, the user completes it directly. Never put authentication material into scripts, output, or chat.
- Verify registry 7.0.0 and `latest`, package integrity, and a fresh downloaded tarball. Publish the matching GitHub tag/release and attach the verified package.
- Confirm remote CI separately. Do not describe unrun OS/runtime combinations as tested.

## Rollback

Use the preserved pre-upgrade store backup and install the previous package version if required. Stop all writers before restoring data. Published npm versions cannot be overwritten; release a corrective patch rather than silently replacing 7.0.0. Do not unpublish or move the latest tag without an explicit rollback decision.
