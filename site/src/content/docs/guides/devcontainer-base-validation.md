---
title: "Dev Container Base Validation"
description: "Compare candidate Ubuntu base images on native amd64 and arm64 runners before promotion"
sidebar:
  order: 9
---

Use the Dev Container Base Validation workflow to test a new Ubuntu base image without granting the workflow write
access or merging the change. The workflow builds the current baseline and candidate on native amd64 and arm64 GitHub
runners, then publishes one fail-closed verdict.

## Safety Boundaries

The validation workflow is intentionally constrained:

- It uses `contents: read` and receives no secrets.
- It never authenticates to Azure, deploys resources, pushes container images, or modifies `main`.
- Pull request runs accept changes only from branches in this repository; forked pull requests are skipped.
- A human must review and merge the draft pull request. The workflow never enables auto-merge or bypasses branch
  protection.
- Both native CPU architectures are required. There is no emulation fallback.

:::caution
A `PASS` verdict establishes compatibility with the checks in this repository. It does not replace human review of the
base-image release notes or the draft pull request.
:::

## Pull Request Validation

A pull request that changes the dev container or its validation harness starts the workflow automatically. The matrix
compares:

| Variant | Container base | Runner architecture |
| --- | --- | --- |
| Baseline | Base image from the pull request's target commit | amd64 |
| Candidate | Base image from the pull request branch | amd64 |
| Baseline | Base image from the pull request's target commit | arm64 |
| Candidate | Base image from the pull request branch | arm64 |

The host runner remains Ubuntu 24.04. The candidate Ubuntu version is the operating system inside the dev container.
This separation tests the same container boundary contributors use locally.

Each matrix leg creates an untracked, repo-relative validation config. The tracked
`.devcontainer/devcontainer.json` is never rewritten by a workflow step.

## Manual Validation

After the workflow exists on `main`, dispatch it for future base-image evaluations:

```bash
gh workflow run validate-devcontainer-base.yml \
  --ref main \
  -f candidate_image=mcr.microsoft.com/devcontainers/base:ubuntu26.04 \
  -f candidate_os=26.04
```

Use the base image's expected `/etc/os-release` `VERSION_ID` for `candidate_os`. The workflow verifies that the image
manifest advertises both `linux/amd64` and `linux/arm64` before starting container builds.

## Validation Coverage

Each container run checks:

- The observed Ubuntu version and CPU architecture.
- Completion of the dev container lifecycle, including a repeated `post-start` idempotency smoke test.
- All tools reported by the setup script, including Azure CLI, Bicep, PowerShell, Python, Node.js, Terraform, TFLint,
  Deno, k6, gitleaks, azd, and the in-repo MCP servers.
- Repository formatting, hooks, linting, unit tests, infrastructure validation, and documentation build through existing
  npm scripts.
- Minimal Bicep compilation and Terraform provider initialization/validation.
- No-auth Azure Retail Prices searches for virtual machine and storage pricing.
- A non-empty Azure architecture diagram rendered through Graphviz and the Python `diagrams` package.

Logs and machine-readable verdicts are uploaded as workflow artifacts for every matrix leg that reaches the validation
script.

## Interpret the Verdict

| Verdict | Meaning | Action |
| --- | --- | --- |
| `PASS` | Both baselines and both candidates passed, with no candidate-only setup warnings | Review the draft PR |
| `BLOCKED` | A result is missing, a baseline is unhealthy, a candidate check failed, or a new warning appeared | Inspect artifacts and do not promote |

A blocked result is categorized as `compatibility`, `network`, `runner`, `harness`, or `unknown`. Network and runner
failures may be retried once. A repeated infrastructure failure remains blocked but is not automatically labeled as an
Ubuntu incompatibility.

## Troubleshoot a Blocked Run

1. Open the comparison job summary and identify the affected variant and architecture.
2. Download the consolidated verdict and the matching matrix artifact.
3. Read `post-create.log` and the individual check log named in `verdict.json`.
4. Retry once only when the failure category is `network` or `runner`.
5. For a verified compatibility issue, make the smallest fix that preserves the baseline and rerun the pull request.
6. Leave the pull request in draft until a complete `PASS` result is available.

## Related

- [Dev Container Hygiene](../devcontainer-hygiene/) — maintain a focused contributor environment
- [Validation & Linting](../../reference/validation-reference/) — understand repository validation commands
- [Troubleshooting](../troubleshooting/) — diagnose local and workflow failures
