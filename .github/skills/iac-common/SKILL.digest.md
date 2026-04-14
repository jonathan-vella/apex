<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# IaC Common Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Deployment Strategies

### azd Deployment (recommended for Bicep projects with azure.yaml)

Use `azd` when the project has an `azure.yaml` manifest:

```bash
# Create/select environment
azd env new dev
azd env set AZURE_LOCATION swedencentral

# Preview changes (replaces what-if)
azd provision --preview

# Deploy infrastructure

> _See SKILL.md for full content._

## Reference Index

| Reference                     | Location                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| Preflight validation          | `azure-validate/references/infraops-preflight.md`             |
| CLI auth validation procedure | `azure-defaults/references/azure-cli-auth-validation.md`      |
| Policy effect decision tree   | `azure-defaults/references/policy-effect-decision-tree.md`    |
| IaC policy compliance         | `.github/instructions/iac-bicep-best-practices.instructions.md` / `.github/instructions/iac-terraform-best-practices.instructions.md` |
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
```
