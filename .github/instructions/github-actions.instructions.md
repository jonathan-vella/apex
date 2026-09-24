---
applyTo: ".github/workflows/*.yml,.github/workflows/*.yaml"
description: "Project-specific standards for GitHub Actions workflows in this repository"
---

# GitHub Actions Workflow Standards

Standards for creating and maintaining CI/CD workflows in this repository.
For general GitHub Actions best practices, rely on
[GitHub Actions documentation](https://docs.github.com/en/actions).

## Project Conventions

### Runner and Node.js

- **Runner**: `ubuntu-latest` for all jobs
- **Node.js**: Version `24` with `npm` caching — **never use `20` or older** (Node.js 20 reached EOL April 2026)
- **Dependencies**: `npm ci` (not `npm install`); reuse the composite
  `./.github/actions/setup-node-repo` action instead of repeating setup steps

### Permissions and Triggers

- Set `permissions` at workflow level (least privilege); default `contents: read`
- Scope triggers with `paths:` and include `workflow_dispatch` for on-demand runs
- Add `concurrency` (`${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`)

### Action Versions

- Pin to **major version tags** (e.g., `@v7`), never `@main` or `@latest`
- Current versions:

| Action                            | Version |
| --------------------------------- | ------- |
| `actions/checkout`                | `@v7`   |
| `actions/setup-node`              | `@v7`   |
| `actions/setup-python`            | `@v7`   |
| `actions/upload-artifact`         | `@v7`   |
| `actions/download-artifact`       | `@v8`   |
| `actions/cache`                   | `@v4`   |
| `actions/github-script`           | `@v8`   |
| `peter-evans/create-pull-request` | `@v8`   |

## Existing Workflows

| Workflow                        | Purpose                                          | Trigger                     |
| ------------------------------- | ------------------------------------------------ | --------------------------- |
| `ci.yml`                        | Required PR check: lint + all Node.js validators | PR + push to main/feature   |
| `consumer-template-checks.yml` | Validate inactive consumer workflows | Template changes + manual |
| `upstream-skill-drift.yml` | Keep one issue with upstream azure-skills drift | Weekly schedule + manual |

Documentation build, link checks and Pages publishing belong to `jonathan-vella/apex-docs`.
Governance, IaC and weekly maintenance sources live under `.github/consumer-workflows/`;
their operational jobs run only in eligible consumer repositories, not APEX or the accelerator.

## Validation Scripts

Workflows run these project validators:

| Script                            | Purpose                           |
| --------------------------------- | --------------------------------- |
| `validate-artifacts.mjs`          | Artifact H2 heading compliance    |
| `validate-agents.mjs`             | Agent YAML frontmatter validation |
| `validate-skills.mjs`             | Skill format validation           |
| `validate-no-deprecated-refs.mjs` | Deprecated reference detection    |
| `validate-vscode-config.mjs`      | VS Code configuration validation  |
| `check-docs-freshness.mjs`        | Documentation freshness checks    |

## Security

- Use OIDC for Azure authentication (no long-lived secrets)
- Action version bumps come from `.github/dependabot.yml`; update the table above with them
- Never print secrets or tokens in workflow logs
- Reuse the validator scripts above instead of duplicating validation logic in YAML
