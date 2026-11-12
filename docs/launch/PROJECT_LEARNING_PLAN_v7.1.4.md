# Project learning from reported outcomes

Architecture decision, 2026-11-12. Added after the user's request that Shadow Brain learn from its work and improve relevant memory. Implementation and acceptance are in progress. This extends the [release plan](RESEARCH_AND_PLAN_v7.1.4.md) and [Project Kit](PROJECT_KIT_PLAN_v7.1.4.md).

## What learning means here

The project keeps useful knowledge, records how a saved memory helped or failed on a concrete task, and makes a small, inspectable adjustment when that memory already matches a similar future task. A user can remove a report or disable its ranking influence. The loop is **retrieve → do work → observe outcome → report evidence → adjust relevant future retrieval → inspect or reverse**.

This is persistent retrieval feedback. It does not train model weights, verify the truth of a memory, autonomously improve source code, or prove a model became more capable. A successful tool invocation, a copied context pack, retrieval rank, and an agent's confidence do not establish a successful task. The interface must call feedback a **reported outcome** and retain whether the user or an agent supplied it.

Automatic background consolidation is already an established design elsewhere: Letta documents background agents that review conversations and update its Git-backed memory. Shadow Brain's chosen release scope is a provider-free local feedback mechanism with explicit attribution and bounded ranking influence; no superiority claim follows from that difference. [Letta memory and dreaming, accessed 2026-11-12](https://docs.letta.com/configuration/memory/).

The distinction between retrieval improvement and downstream answer quality matters. LongMemEval separates indexing, retrieval, and reading and tests multiple long-term memory abilities. The acceptance tests below establish deterministic feedback behavior and isolation; they are not a LongMemEval result or evidence of improved general task accuracy. [LongMemEval, revised 2025-03-04, accessed 2026-11-12](https://arxiv.org/abs/2410.10813).

## Local state and explicit operations

Store feedback in `<project>/.shadow-brain/memory-feedback.json`, alongside that project's memory. The file is optional. It has its own revision and enabled flag; it does not add a sixth global feature toggle or modify the base memory schema. The project-local controls remain separate from the existing global workflow.

The shared service is `ProjectFeedbackStore(root, brain)`, with `get()` and `update(command, expectedRevision, reporter)`. All callers use that service. Writes are revision-checked and atomic under a local lock. Corrupt or unsafe files must fail visibly without being overwritten. The store must belong to the canonical project root and database.

Each record includes a stable ID, canonical project and memory IDs, task text, rating, reason, evidence references, reporter, and created/updated timestamps. Ratings are `useful`, `not-useful`, or `incorrect`. The rating is a report, not an authoritative review state.

Bounds: at most 500 records and 2 MiB serialized data; task at most 1,000 characters; mandatory reason at most 600; at most three evidence references of 180 characters each. References are labels and are never fetched. Inputs reject unsupported fields and unsafe control characters.

An upsert replaces the existing report for the same memory, normalized task, and reporter. Repeating the same praise does not create additional votes. At 500 records, a new distinct report is rejected; existing reports can still be updated, and a user can remove records to make room. Removing one record is explicit. Disabling influence preserves the records and removes their effect. No silent age expiry is introduced in this release; report timestamps stay visible for review.

The server assigns attribution: portal and CLI writes are user reports; MCP writes are agent reports. A client cannot elevate an agent report by submitting a `reporter` field. Each mutation resolves the memory and enforces the project before saving.

| Interface | Operation |
| --- | --- |
| Project portal HTTP | GET `project-feedback`; POST record/remove/enable with the current revision |
| Project CLI | `project feedback list`, `record`, `remove`, and `set` |
| Project-local MCP | `project_feedback` with `kind: list` or `record`; agent attribution assigned by the server |
| Global/default MCP | Project feedback tool unavailable |

The MCP write description instructs the host to report only observed work and evidence, never success inferred from memory retrieval or tool completion. Users retain removal and enable/disable controls in the portal and CLI. Generated local skills may describe this optional feedback step, while respecting current user and project instructions.

## Retrieval contract

Only an adaptive context request with an explicit project-local feedback snapshot may use the feedback. Legacy ranking and the default global path remain unchanged.

Apply influence after scope and review eligibility and only to candidates with a direct lexical match. Feedback cannot introduce a zero-hit record, revive archived/contested/superseded records, expand the project boundary, turn a graph-only neighbor into a direct match, create a source citation, or remove a caution. Empty-query browsing receives no effect.

Compare normalized substantive query and reported-task terms. Remove generic task verbs; require at least one shared term and Jaccard similarity of at least 0.34. For the same normalized task, prefer the user's report when both user and agent reports exist; an agent report cannot silently displace a human correction. Consider up to three newest distinct relevant-task reports for the candidate after resolving that attribution preference. This deliberately conservative lexical gate does not provide semantic task equivalence.

For each selected report, multiply its rating value by task similarity and attribution weight. Rating values are +0.08 for useful, −0.04 for not-useful, and −0.12 for incorrect; attribution weights are 1 for user and 0.5 for agent. Average the contributions and clamp the result to [−0.12, +0.08]. Add that adjustment to the base ranking score with a lower bound of zero. These constants are design limits, not empirically optimized accuracy estimates.

The mean and ceiling limit repeated reporting influence; attribution reduces, but does not eliminate, the risk of mistaken agent self-assessment. This is not a tamper-resistant trust system. Distinct fabricated reports still cannot be treated as independent verification.

Show the signed `Project task feedback` contribution in candidate explanations, including negative values. Where the response exposes report IDs and reporter kinds, retain only bounded relevant records. Do not hide a negative adjustment because the existing diagnostics previously expected only positive signals. An incorrect report is a prompt for a human to inspect or curate the memory, not an automatic deletion or change of review state.

## Acceptance gates

1. Record, read, update, remove, disable, and re-enable feedback across restart. Preserve other sidecars and base memory bytes for feedback-only mutations.
2. Reject stale revisions, malformed fields, wrong-project or missing memory IDs, unsafe paths, and serialized bounds without partial changes.
3. Repeating the same memory/task/reporter upserts rather than accumulates. A 501st distinct record fails without dropping an older record; an existing upsert still succeeds at the cap. User/agent attribution cannot be spoofed through HTTP or MCP, and a newer agent report cannot replace the same task's human signal.
4. Useful feedback changes only an already matching adaptive candidate by the bounded amount. A negative report produces a visible signed adjustment. Unrelated tasks and empty queries have no effect.
5. Archived, contested, superseded, zero-hit, graph-only, and foreign-project records remain ineligible for feedback promotion. Legacy output remains unchanged.
6. Disable and remove restore the baseline score/selection with otherwise identical input. Sources, caution flags, and recorded relationship paths remain intact.
7. Demonstrate feedback recorded through the local portal, influence in Context Lab and a fresh project-local MCP process, and the same outcome after restart. Verify MCP writes are agent reports, not user reports.
8. Show the control, outcome attribution, reason, references, timestamps, conflict state, removal, and negative diagnostics in the actual desktop/mobile UI. Keep the terminology consistent in screenshots and documentation.

The release evidence report must record actual outcomes of these gates. No fixed improvement percentage, universal accuracy claim, or automatic truth score is authorized by this plan.
