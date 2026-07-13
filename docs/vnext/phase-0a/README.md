# APEX vNext Phase 0A

> [Current Version](../../../VERSION.md) | Approved decisions and candidate evidence for the v1 behavioral baseline.

## Status

The Phase 0A decisions were approved by `@jonathan-vella` on 2026-07-13. The evidence remains a pre-freeze candidate
on `feat/apex-vnext-rewrite`; the full validation suite passes after fixing the Python and documentation-site bootstrap
defects.

| Deliverable | State | Evidence |
| --- | --- | --- |
| Failed baseline classification | Complete | [Baseline manifest](baseline-evidence.json) |
| Successful baseline transcript | Complete for dirty candidate | [Successful transcript](evidence/baseline-success-2026-07-13.log) |
| Behavior compatibility matrix | Approved | [Compatibility matrix](v1-behavior-compatibility.md) |
| Golden scenarios | Verified on candidate | [Scenario registry](v1-golden-scenarios.json) and [transcript](evidence/golden-scenarios-2026-07-13.log) |
| Known-defects ledger | Approved; `DEF-003` through `DEF-006` accepted as v1 limitations | [Known defects](v1-known-defects.md) |
| v1 maintenance policy | Approved | [Maintenance policy](v1-maintenance-policy.md) |

## Freeze Gate

The v1 baseline tag remains forbidden. The approval gates are complete; the evidence gate still needs:

- A clean commit containing the bootstrap fixes and Phase 0A evidence.
- A fresh `npm run validate:all` transcript and golden-registry run from that clean commit.
- A final evidence manifest that binds the clean commit and resulting evidence hashes.

No v1 baseline tag or long-lived `vnext` branch should be created until those conditions pass. The final v1 mainline
release tag remains reserved for Phase 12 cutover.

## Evidence Integrity

The baseline manifest records the base commit, candidate patch identity, plan hash, tool versions, commands, exit
codes, transcript paths, and SHA-256 hashes. The hash identifies accidental evidence changes; it is not a signature
or protection against a malicious repository writer.

The failed and successful transcripts are intentionally stored without identifier sanitization. They contain no
credentials or secret values.
