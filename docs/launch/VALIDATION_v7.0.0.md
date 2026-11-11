# 7.0.0 local release validation

Validated on 2026-11-11 using Windows, Node v24.15.0, and npm 12.0.2.

| Gate | Result |
| --- | --- |
| TypeScript build | PASS |
| TypeScript lint/type check | PASS |
| Full Vitest suite | PASS: 192 tests in 19 files |
| Focused storage/recall suite | PASS: 22 tests |
| Actual process concurrency | PASS: four Node processes; all 40 acknowledged unique IDs survive reopening |
| Persistence failure and retry | PASS: old bytes preserved; failed write acknowledged false; retry commits once |
| Invalid/future/unreadable store handling | PASS: explicit errors; original data preserved |
| Read-only lifecycle | PASS: existing store bytes and modification time preserved |
| Independent Astra built-output review | PASS: no blocking correctness issue found |
| npm dependency audit | 0 vulnerabilities at validation time, down from 14 in the baseline |
| Real package consumer smoke test | PASS: pack/install, library API, version/help, durable save, health, recall explanations, corrupt-store preservation, configuration isolation |
| Dashboard activity text regression | PASS: hostile synthetic HTML is escaped |

Test inputs and databases were synthetic and isolated from personal memory and provider configuration. Provider API calls and interactive dashboard visual behavior were not exercised. Existing code-age tests emit expected Git messages for synthetic directories without repositories; assertions pass.

CI is configured for Windows and Linux on Node 22, 24, and 26. Local results do not imply those remote combinations passed; inspect the corresponding GitHub Actions run. Publication status and released artifact hashes are recorded on the matching GitHub release after publication.
