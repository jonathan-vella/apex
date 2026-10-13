# Terraform Validation

Validation steps for Terraform deployments.

## Prerequisites

- Working directory is the project's IaC folder, `infra/terraform/{project}/` (never the repository root)
- `./main.tf` exists
- State backend accessible

## Validation Steps

### 1. Terraform Installation

Verify Terraform is installed:

```bash
terraform version
```

**If not installed:** See https://developer.hashicorp.com/terraform/install

### 2. Azure CLI Installation

Verify Azure CLI is installed:

```bash
az version
```

**If not installed:**

```
mcp_azure-mcp_extension_cli_install(cli-type: "az")
```

### 3. Authentication

```bash
az account show
```

**If not logged in:**

```bash
az login
az account set --subscription <subscription-id>
```

### 4. Initialize

```bash
cd infra/terraform/{project}
terraform init
```

### 5. Format Check

```bash
terraform fmt -check -recursive
```

**Fix if needed:**

```bash
terraform fmt -recursive
```

### 6. Validate Syntax

```bash
terraform validate
```

### 7. Plan Preview

```bash
terraform plan -out=tfplan
```

### 8. State Backend

Verify state is accessible:

```bash
terraform state list
```

### 9. Azure Policy Validation

See [Policy Validation Guide](../../policy-validation.md) for instructions on retrieving and validating Azure policies for your subscription.

### 10. Template Variables (azd + Terraform)

azd substitutes `${VAR}` references in `main.tfvars.json`, but not Go-style
`{{ .Env.* }}` templates. Unresolved templates reach Terraform as literal strings
and cause failed deployments and state conflicts. Scan for them:

```bash
grep -n '{{ *\.Env\.' main.tfvars.json && echo "FAIL: Go-style template variables found" || echo "PASS"
```

On `FAIL`, report the file and lines. The IaC owner replaces `{{ .Env.VAR }}`
with `${VAR}`, or passes extra values as `TF_VAR_*` environment variables
(`azd env set TF_VAR_environment_name "$(azd env get-value AZURE_ENV_NAME)"`), and
confirms `variables.tf` declares every variable. Re-run validation afterwards.

## References

- [Error handling](./errors.md)

## Next

Return results to **apex-azure-validate**. Validation-only stops;
deployment continuation follows its workflow and approval rules.
