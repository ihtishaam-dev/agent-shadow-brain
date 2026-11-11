---
name: shadow-release
description: Prepare and verify a requested package or application release, including artifact contents and destination checks. Publish only when the user's request or existing authorization includes publication.
---

# Release a verified artifact

Identify the release target, version, source revision, existing authorization, and relevant project release instructions. Complete required build and behavior checks before publishing. Keep local validation, remote CI, packaging, and live publication as distinct evidence.

Inspect the distributable contents and exclude personal state, credentials, temporary files, and development dependencies. Test the actual artifact in a clean consumer or representative destination when packaging can affect behavior. Record its integrity or revision so the reviewed artifact can be matched to the release.

Use the already authorized destination and authenticated tooling. Do not inspect credential stores or ask the user to send private authentication values. If the service requires interactive authentication, let the user complete it directly and resume the same release. Do not repeat irreversible publication while a prior attempt is still processing; inspect remote state first.

After publishing, verify the destination's version or revision and artifact integrity. Treat an accepted upload, queued build, or processing notice as pending until the artifact is actually available. Preserve rollback information; do not silently unpublish, overwrite a released version, or rewrite existing history.

Report the release link, relevant validation, and any remaining availability limitation concisely. Do not create promotional posts, messages, recurring jobs, or unrelated announcements unless requested.
