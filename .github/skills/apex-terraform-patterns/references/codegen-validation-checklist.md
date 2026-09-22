<!-- ref:codegen-validation-checklist-terraform-v1 -->

# Terraform CodeGen Validation Checklist

Verify ALL items before marking Step 5 complete.

## Preflight & Governance

- [ ] Preflight check saved to `04-preflight-check.md`
- [ ] Governance compliance map complete — all Deny policies satisfied

## AVM & Code Structure

- [ ] AVM-TF modules used for all available resources
- [ ] Module versions match exact semver pins in the approved plan/contract; no implicit upgrades
- [ ] One root random suffix is passed to children; effective policy tag keys, casing and values are preserved
- [ ] `project_name` is a required variable with no default value
- [ ] Zero hardcoded project-specific values (see `iac-terraform-best-practices.instructions.md`)

## Security Baseline

- [ ] Security baseline applied (TLS 1.2, HTTPS, managed identity)

## Deployment Artifacts

- [ ] Bootstrap templates provided where required, but never executed during CodeGen or validation-only
- [ ] Deployment entrypoint matches the approved plan; legacy deploy scripts only for existing consumers
- [ ] Shared-state phase conditions are cumulative, preserving earlier resource addresses and resources
- [ ] `05-implementation-reference.md` saved
- [ ] Budget, notifications, Action Group routing and anomaly detection satisfy the canonical cost-monitoring contract

## Review Gates

- [ ] Required Terraform validation passed; a validator PASS does not grant deployment approval
- [ ] Adversarial code review is skipped by default
- [ ] Opt in only for `decisions.review_depth == "deep"` or explicit user request/invocation of `10-Challenger`
- [ ] When opted in, follow the current graph and review protocol and resolve blocking findings
- [ ] Request a human handoff if a required reviewer is unavailable; never fabricate approval
- [ ] Complete `05-implementation-reference.md` and the handoff even when optional review is skipped
