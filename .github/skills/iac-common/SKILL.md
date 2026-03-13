---
name: iac-common
description: "Shared IaC deploy patterns for Bicep and Terraform deploy agents: deployment strategies, circuit breaker, known deploy issues. For preflight validation (auth, governance, stop rules), see azure-validate. USE FOR: Phased deployment, circuit breaker, deploy-specific known issues. DO NOT USE FOR: Preflight validation (use azure-validate), code generation (use azure-bicep-patterns or terraform-patterns)."
---

# IaC Common Skill

Shared deployment patterns used by both Bicep and Terraform deploy agents
(07b, 07t) and review subagents.

> **Preflight validation** (CLI auth, governance mapping, stop rules, known issues)
> has moved to the **azure-validate** skill. See `azure-validate/references/infraops-preflight.md`.

---

## Deployment Strategies

### Phased Deployment (recommended for >5 resources)

| Phase      | Resources                             | Gate          |
| ---------- | ------------------------------------- | ------------- |
| Foundation | Resource group, networking, Key Vault | User approval |
| Security   | Identity, RBAC, certificates          | User approval |
| Data       | Storage, databases, messaging         | User approval |
| Compute    | App Service, Functions, containers    | User approval |
| Edge       | CDN, Front Door, DNS                  | User approval |

- **Bicep**: Pass `-Phase {name}` to `deploy.ps1`
- **Terraform**: Pass `-var deployment_phase={name}` to plan/apply

### Single Deployment (only for <5 resources, dev/test)

Deploy everything in one operation. Still requires user approval.

---

## Reference Index

| Reference                     | Location                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| Preflight validation          | `azure-validate/references/infraops-preflight.md`             |
| CLI auth validation procedure | `azure-defaults/references/azure-cli-auth-validation.md`      |
| Policy effect decision tree   | `azure-defaults/references/policy-effect-decision-tree.md`    |
| Bicep policy compliance       | `instructions/bicep-policy-compliance.instructions.md`        |
| Terraform policy compliance   | `instructions/terraform-policy-compliance.instructions.md`    |
| Bootstrap backend templates   | `terraform-patterns/references/bootstrap-backend-template.md` |
| Deploy script templates       | `terraform-patterns/references/deploy-script-template.md`     |
| Circuit breaker               | `references/circuit-breaker.md`                               |

## Circuit Breaker

Deploy agents MUST read `references/circuit-breaker.md` before starting
any deployment. It defines:

- **Failure taxonomy**: 6 categories (build, validation, deployment, empty, timeout, auth)
- **Anomaly patterns**: detection thresholds for repetitive failures
- **Stopping rule**: 3 consecutive same-type failures → halt + escalate
- **Escalation protocol**: write to session state, notify user, wait for guidance
