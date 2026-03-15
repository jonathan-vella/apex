<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# IaC Common Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Deployment Strategies

### Phased Deployment (recommended for >5 resources)

| Phase      | Resources                             | Gate          |
| ---------- | ------------------------------------- | ------------- |
| Foundation | Resource group, networking, Key Vault | User approval |
| Security   | Identity, RBAC, certificates          | User approval |

> _See SKILL.md for full content._

## Reference Index

| Reference                     | Location                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| Preflight validation          | `azure-validate/references/infraops-preflight.md`          |
| CLI auth validation procedure | `azure-defaults/references/azure-cli-auth-validation.md`   |
| Policy effect decision tree   | `azure-defaults/references/policy-effect-decision-tree.md` |
| IaC policy compliance         | `instructions/iac-policy-compliance.instructions.md`       |

> _See SKILL.md for full content._

## Circuit Breaker

Deploy agents MUST read `references/circuit-breaker.md` before starting
any deployment. It defines:

- **Failure taxonomy**: 6 categories (build, validation, deployment, empty, timeout, auth)
- **Anomaly patterns**: detection thresholds for repetitive failures
- **Stopping rule**: 3 consecutive same-type failures → halt + escalate

> _See SKILL.md for full content._
