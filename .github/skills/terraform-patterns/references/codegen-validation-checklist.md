<!-- ref:codegen-validation-checklist-terraform-v1 -->

# Terraform CodeGen Validation Checklist

Verify ALL items before marking Step 5 complete.

## Preflight & Governance

- [ ] Preflight check saved to `04-preflight-check.md`
- [ ] Governance compliance map complete — all Deny policies satisfied

## AVM & Code Structure

- [ ] AVM-TF modules used for all available resources
- [ ] `project_name` is a required variable with no default value
- [ ] Zero hardcoded project-specific values (see `iac-terraform-best-practices.instructions.md`)

## Security Baseline

- [ ] Security baseline applied (TLS 1.2, HTTPS, managed identity)

## Deployment Artifacts

- [ ] Bootstrap + deploy scripts generated (bash + PS)
- [ ] `05-implementation-reference.md` saved
- [ ] Budget resource with forecast alerts (80/100/120%) and anomaly detection

## Review Gates

- [ ] `terraform-validate-subagent` PASS + APPROVED
- [ ] Adversarial review completed (pass 2 conditional on pass 1 severity; pass 3 conditional on pass 2 must_fix)
