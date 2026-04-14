<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Validate (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Triggers

- Check if app is ready to deploy
- Validate azure.yaml or Bicep
- Run preflight checks
- Troubleshoot deployment errors

## Rules

1. Run after azure-prepare, before azure-deploy
2. All checks must pass—do not deploy with failures
3. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)

## Steps

| #   | Action                                                                                                   | Reference                                         |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | **Load Plan** — Read `infra/{iac}/{project}/.azure/plan.md` for recipe and configuration. If missing → run azure-prepare first | `infra/{iac}/{project}/.azure/plan.md`                                  |
| 2   | **Run Validation** — Execute recipe-specific validation commands                                         | [recipes/README.md](references/recipes/README.md) |
| 3   | **Build Verification** — Build the project and fix any errors before proceeding                          | See recipe                                        |
| 4   | **Record Proof** — Populate **Section 7: Validation Proof** with commands run and results                | `infra/{iac}/{project}/.azure/plan.md`                                  |

> _See SKILL.md for full content._

## APEX-Specific References

- [InfraOps Preflight Validation](references/infraops-preflight.md) — CLI auth checks, known issues, governance-to-code mapping, stop rules
  > If any validation failed, fix the issues and re-run azure-validate before proceeding.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference | When to Load |
| --------- | ------------ |
| `references/global-rules.md` | Global Rules |
| `references/infraops-preflight.md` | Infraops Preflight |

> _See SKILL.md for full content._
