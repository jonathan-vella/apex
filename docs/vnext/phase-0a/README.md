# APEX vNext Phase 0A

> [Current Version](../../../VERSION.md) | Approved decisions and candidate evidence for the v1 behavioral baseline.

## Status

The Phase 0A decisions were approved by `@jonathan-vella` on 2026-07-13. Local evidence was captured from clean commit
`5cccbf4b` on `feat/apex-vnext-rewrite`; the full validation suite passes after fixing the Python and documentation-site
bootstrap defects.

| Deliverable | State | Evidence |
| --- | --- | --- |
| Failed baseline classification | Complete | [Baseline manifest](baseline-evidence.json) |
| Successful baseline transcript | Verified from clean source commit | [Successful transcript](evidence/baseline-success-2026-07-13.log) |
| Behavior compatibility matrix | Approved | [Compatibility matrix](v1-behavior-compatibility.md) |
| Golden scenarios | Verified from clean source commit | [Scenario registry](v1-golden-scenarios.json) and [transcript](evidence/golden-scenarios-2026-07-13.log) |
| Known-defects ledger | Approved; `DEF-003` through `DEF-006` accepted as v1 limitations | [Known defects](v1-known-defects.md) |
| v1 maintenance policy | Approved | [Maintenance policy](v1-maintenance-policy.md) |

## Freeze Gate

The local approval and clean-evidence gates are complete. The v1 baseline tag remains forbidden until:

- The exact pull-request head passes required CI.
- Phase 0B feasibility and Phase 0C architecture gates complete.

No v1 baseline tag or long-lived `vnext` branch should be created before Phase 0C. The final v1 mainline release tag
remains reserved for Phase 12 cutover.

## Evidence Integrity

The baseline manifest records the base commit, candidate patch identity, plan hash, tool versions, commands, exit
codes, transcript paths, and SHA-256 hashes. The hash identifies accidental evidence changes; it is not a signature
or protection against a malicious repository writer.

The failed and successful transcripts are intentionally stored without identifier sanitization. They contain no
credentials or secret values.
