# Branch Ruleset Configuration

> [Current Version](../VERSION.md) | Configuration guide for GitHub branch protection on `main`

## Overview

This document provides the exact `gh api` commands to configure branch
rulesets for the `azure-agentic-infraops` repository. These rules
enforce quality gates before merging to `main`.

## Required Status Checks

The following CI jobs must pass before a PR can merge:

| Job Name                   | Workflow File                 | Purpose                        |
| -------------------------- | ----------------------------- | ------------------------------ |
| `lint`                     | `lint.yml`                    | Markdown, JSON, template lint  |
| `Validate Agents & Skills` | `agent-validation.yml`        | Agent frontmatter, skills, MCP |
| `policy-compliance-check`  | `policy-compliance-check.yml` | Governance guardrail integrity |

## Configuration via `gh api`

### Create Branch Ruleset

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/jonathan-vella/azure-agentic-infraops/rulesets \
  -f name="main-protection" \
  -f target="branch" \
  -f enforcement="active" \
  -f 'conditions[ref_name][include][]=refs/heads/main' \
  -f 'rules[][type]=pull_request' \
  -f 'rules[0][parameters][required_approving_review_count]=1' \
  -f 'rules[0][parameters][dismiss_stale_reviews_on_push]=true' \
  -f 'rules[0][parameters][require_last_push_approval]=false' \
  -f 'rules[0][parameters][required_review_thread_resolution]=true' \
  -f 'rules[][type]=required_status_checks' \
  -f 'rules[1][parameters][strict_required_status_checks_policy]=true' \
  -f 'rules[1][parameters][required_status_checks][][context]=lint' \
  -f 'rules[1][parameters][required_status_checks][][context]=Validate Agents & Skills' \
  -f 'rules[1][parameters][required_status_checks][][context]=policy-compliance-check'
```

### Block Force-Pushes (via non-fast-forward rule)

Force-pushes are blocked by default when a ruleset with
`pull_request` rules exists. To explicitly add:

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/jonathan-vella/azure-agentic-infraops/rulesets \
  -f name="main-no-force-push" \
  -f target="branch" \
  -f enforcement="active" \
  -f 'conditions[ref_name][include][]=refs/heads/main' \
  -f 'rules[][type]=non_fast_forward'
```

## Configuration via GitHub UI

1. Go to **Settings > Rules > Rulesets > New ruleset > New branch ruleset**
2. Set **Name**: `main-protection`
3. Set **Enforcement**: Active
4. Under **Target branches**: Add `main`
5. Enable rules:
   - **Require a pull request before merging**
     - Required approvals: 1
     - Dismiss stale pull request approvals when new commits are pushed
     - Require review from Code Owners (if CODEOWNERS exists)
     - Require conversation resolution before merging
   - **Require status checks to pass before merging**
     - Require branches to be up to date before merging
     - Add checks: `lint`, `Validate Agents & Skills`, `policy-compliance-check`
   - **Block force pushes**
6. Click **Create**

## Verification

After configuring, verify with:

```bash
gh api /repos/jonathan-vella/azure-agentic-infraops/rulesets \
  --jq '.[] | {name, enforcement, rules: [.rules[].type]}'
```

Expected output should show `pull_request`, `required_status_checks`,
and `non_fast_forward` rules active on `main`.
