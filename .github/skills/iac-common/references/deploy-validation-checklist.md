<!-- ref:deploy-validation-checklist-v1 -->

# Deploy Validation Checklist

Pre- and post-deployment checks shared across Bicep and Terraform deploy agents.

## Pre-Deployment

- [ ] Azure CLI authenticated (`az account get-access-token` succeeds)
- [ ] No unresolved `<replace-with-*>` placeholders in param files (collected via `askQuestions`)
- [ ] IaC validation passes (bicep build / terraform validate)
- [ ] Preview completed and reviewed (what-if / plan)
- [ ] No unapproved destructive operations (Delete / Destroy / Replace)
- [ ] No deprecation signals in preview output
- [ ] User approval obtained before deployment

## Bicep-Specific Pre-Deployment

- [ ] `bicep build` passes with no errors
- [ ] What-if analysis completed with default output (no `--output` flag)

## Terraform-Specific Pre-Deployment

- [ ] State backend storage account verified (or bootstrapped)
- [ ] `terraform init` completed successfully
- [ ] `terraform validate` passes with no errors

## Post-Deployment

- [ ] Resources verified via Azure Resource Graph (all in `Succeeded` state)
- [ ] Key outputs captured (endpoints, IDs — secrets redacted)
- [ ] `06-deployment-summary.md` saved with correct H2 headings
- [ ] Session state updated: `steps.6.status = "complete"`
