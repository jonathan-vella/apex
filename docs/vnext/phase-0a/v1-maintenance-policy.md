# APEX v1 Maintenance Policy

> [Current Version](../../../VERSION.md) | Draft support and critical-fix policy for the v1 maintenance line.

## Approval State

Repository owner `@jonathan-vella` approved this policy on 2026-07-13. The exact support end date cannot be published
until cutover because it is defined as 12 calendar months after the cutover date.

## Branch Lifecycle

Before cutover:

- `main` remains the v1 release line.
- vNext work remains on dedicated feature branches until Phase 0C creates the approved long-lived `vnext` branch.
- A critical v1 fix lands on `main` first and is then forward-ported to the active vNext branch when applicable.

At cutover:

- Create `v1-maintenance` from the actual v1 `main` head immediately before merging vNext.
- Tag the final v1 mainline release from that same commit.
- Publish the cutover date and the exact support end date, calculated as 12 calendar months after cutover.
- Keep the v1 install and validation path independently usable.

After cutover:

- `main` carries vNext.
- `v1-maintenance` receives only security and critical fixes until the published support end date.
- A fix affecting both lines is implemented and reviewed independently where architecture has diverged. Mechanical
  cherry-picks are allowed only when tests prove the patch is semantically identical on both lines.

## Critical-Fix Classification

A v1 issue qualifies when it causes or enables at least one of the following:

- Remote code execution, authorization bypass, credential disclosure, secret persistence, or supply-chain compromise.
- Loss or corruption of committed workflow state, deployment evidence, Terraform state, or managed Azure resources.
- Deployment outside the approved Azure target or destructive behavior outside declared ownership.
- Inability to install, run setup/doctor, validate, preview, deploy, inventory, or diagnose a previously supported path.
- A mandatory Azure or GitHub platform change that makes the supported release unusable or insecure.
- A vulnerability rated critical or high after maintainer triage, unless evidence documents why the affected path is
  unreachable in supported APEX usage.

Feature requests, model preference updates, broad refactors, visual redesign, new cloud providers, and noncritical
quality improvements do not qualify for the v1 maintenance line.

## Security Response Ownership

The default owner in `.github/CODEOWNERS` owns triage, embargo handling, release authorization, and disclosure timing.
Security reports must use a private maintainer channel or GitHub private vulnerability reporting when available; public
issues must not contain credentials, exploit details, or secret-bearing evidence.

For an accepted security issue, the owner records:

- Affected v1 and vNext versions.
- Severity and exploitability evidence.
- Fix owner and target branches.
- Required Azure, GitHub, npm, Python, or Deno coordination.
- Release and disclosure dates.
- Backport or independent-reimplementation rationale.

## Change Flow

1. Reproduce the issue on the oldest supported affected line without copying secrets into logs.
2. Add a failing characterization or regression test.
3. Implement the smallest fix on the owning release line.
4. Run that line's complete deterministic suite and any required manual Azure/client qualification.
5. Open a separately reviewed forward-port or backport for each other affected line.
6. Publish signed release artifacts, checksums, provenance, notes, and updated support information.

Changes never flow by merging the vNext branch back into `v1-maintenance`. Project event history, artifacts, and state are
not rewritten during a product rollback or maintenance release.

## End of Support

At the published support end date:

- Stop routine v1 security and critical-fix releases.
- Keep source, packages, documentation, checksums, and release tags available according to repository retention policy.
- Mark v1 documentation as unsupported and direct new work to vNext.
- Do not imply that a v1 project can be imported or resumed in vNext.

An emergency extension requires a named owner, reason, revised date, supported version set, and public notice before the
original end date.
