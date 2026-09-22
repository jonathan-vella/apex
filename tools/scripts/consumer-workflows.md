# Consumer Workflow Ownership

APEX maintains consumer workflow sources in
[.github/consumer-workflows](../../.github/consumer-workflows/), outside GitHub Actions discovery.
Product CI validates these templates; it does not collect Azure governance data or run consumer maintenance.
The accelerator distributes active copies, but their job guards prevent operational execution there.

## Consumer Activation

Consumer IaC checks run on relevant pull requests and pushes. Weekly maintenance refreshes AVM indexes,
module versions and Azure deprecation data, and checks the Azure MCP release. It does not depend on the APEX site.

Governance is disabled unless `GOVERNANCE_BASELINE_ENABLED` is exactly `true`.
Before enabling it, configure `GOVERNANCE_MG_ID` and the Azure OIDC secrets used by the template.
Disabled jobs cannot authenticate or collect data. Refreshed governance data stays in the consumer repository.
All generated change PRs require human review; no template enables auto-merge.

## Reviewed Updates

```bash
npm run sync:workflows -- --dry-run
npm run sync:workflows -- --apply --ref <reviewed-commit-sha>
```

The updater resolves a single APEX commit and downloads only allowlisted consumer templates.
Preview is the default. All downloads and conflict checks complete before writes begin.
The provenance file `.github/consumer-workflows-state.json` records source and installed hashes.
Keep that file with the installed workflows and exclude it from upstream content replacement.

A modified or unrecognized local file blocks the whole update. Review and reconcile it manually;
the updater never assumes permission to overwrite it. Identical existing templates can be adopted.
Retired files are reported, not removed. Review removals and dependent checks in a PR.
The ordinary content sync still excludes active workflow files.

Consumer refresh data is seeded initially and then consumer-owned. Shared tooling and schemas remain
upstream-owned; workflow updates and data-schema migrations require compatible reviewed changes.

## Automated Verification

```bash
node --test tools/tests/scripts/test_consumer_workflows.mjs
```

These tests execute GitHub Actions expressions for repository identity and governance opt-in,
check invoked commands and local actions, and exercise updater failures and preservation in temporary directories.
They are included in `test:tool-contracts` and therefore in the existing CI validator suite.
No Azure login, GitHub mutation or consumer deployment is performed by these tests.
