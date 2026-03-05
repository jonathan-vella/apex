<a id="top"></a>

# Branch Ruleset Configuration

> [Current Version](../VERSION.md) | Configuration guide for GitHub branch protection on `main`

## Overview

This document provides the exact `gh api` commands to configure branch
rulesets for the `azure-agentic-infraops` repository. These rules
enforce quality gates before merging to `main`.
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Required Status Checks

The following CI jobs must pass before a PR can merge:

| Job Name                     | Workflow File                 | Purpose                                              |
| ---------------------------- | ----------------------------- | ---------------------------------------------------- |
| `lint`                     | `lint.yml`                    | Markdown, JSON, template lint  |
| `Validate Agents & Skills` | `agent-validation.yml`        | Agent frontmatter, skills, MCP |
| `policy-compliance-check`  | `policy-compliance-check.yml` | Governance guardrail integrity |
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Configuration via `gh api`

> The live ruleset is **`Main Branch Protection`** (ID `12080985`).
> Use `PUT` to update it in place — this preserves all existing rules.

### Update Existing Ruleset (PowerShell)

```powershell
@'
{
  "name": "Main Branch Protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "exclude": [], "include": ["refs/heads/main"] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "required_reviewers": [],
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    { "type": "required_linear_history" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "lint" },
          { "context": "Validate Agents & Skills" },
          { "context": "policy-compliance-check" }
        ]
      }
    }
  ],
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ]
}
'@ | gh api `
  --method PUT `
  -H "Accept: application/vnd.github+json" `
  /repos/jonathan-vella/azure-agentic-infraops/rulesets/12080985 `
  --input -
```

### Update Existing Ruleset (bash/Linux)

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/jonathan-vella/azure-agentic-infraops/rulesets/12080985 \
  --input - <<'EOF'
{
  "name": "Main Branch Protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "exclude": [], "include": ["refs/heads/main"] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "required_reviewers": [],
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    { "type": "required_linear_history" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "lint" },
          { "context": "Validate Agents & Skills" },
          { "context": "policy-compliance-check" }
        ]
      }
    }
  ],
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ]
}
EOF
```
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Configuration via GitHub UI

1. Go to **Settings > Rules > Rulesets** → open **Main Branch Protection**
2. Under **Require status checks to pass** → add the missing checks:
   - `Validate Agents & Skills`
   - `policy-compliance-check`
3. Click **Save changes**
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Verification

After configuring, verify with:

```powershell
gh api /repos/jonathan-vella/azure-agentic-infraops/rulesets/12080985 `
  -q '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'
```

Expected output:

```text
lint
Validate Agents & Skills
policy-compliance-check
```

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
