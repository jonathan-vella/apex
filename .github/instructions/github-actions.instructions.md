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
- **Node.js**: Version `22` with `npm` caching
- **Dependencies**: `npm ci` (not `npm install`)

### Permissions

- Set `permissions` at workflow level (least privilege)
- Default: `contents: read`
- Add write permissions only when needed (e.g., `issues: write` for freshness checks)

### Triggers

- **PR validation**: Trigger on `pull_request` to `main`
- **Post-merge**: Trigger on `push` to `main`
- **Path filters**: Use `paths:` to scope workflows to relevant files
- **Manual**: Include `workflow_dispatch` for on-demand runs
- **Scheduled**: Use `schedule` with cron for periodic checks (e.g., weekly freshness)

### Action Versions

- Pin to **major version tags** (e.g., `@v4`), not `@main` or `@latest`
- Use current versions:

| Action                      | Version |
| --------------------------- | ------- |
| `actions/checkout`          | `@v4`   |
| `actions/setup-node`        | `@v4`   |
| `actions/upload-artifact`   | `@v4`   |
| `actions/download-artifact` | `@v4`   |
| `actions/cache`             | `@v4`   |

### Naming and Structure

- **Workflow file**: Descriptive kebab-case (e.g., `ci.yml`, `weekly-maintenance.yml`)
- **Workflow `name`**: Human-readable title
- **Job `name`**: Clear, concise label
- **Step `name`**: Descriptive action (e.g., "Validate agent frontmatter")
- Start with a comment block describing purpose and trigger conditions

### Concurrency

Use `concurrency` to prevent duplicate runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Existing Workflows

| Workflow                        | Purpose                                           | Trigger                     |
| ------------------------------- | ------------------------------------------------- | --------------------------- |
| `ci.yml`                        | Required PR check: lint + all Node.js validators  | PR + push to main/feature   |
| `link-check.yml`                | Broken link detection in site docs                | Changes to site/ + weekly   |
| `docs.yml`                      | Astro Starlight site deployment to Pages          | Push to main (site/)        |
| `weekly-maintenance.yml`        | AVM version audit + docs freshness checks         | Weekly (Mon 07:00) + manual |
| `azure-deprecation-tracker.yml` | Azure deprecation monitoring                      | Weekly (Mon 06:00) + manual |
| `excalidraw-svg-export.yml`     | REMOVED — Draw.io is now the default diagram tool | —                           |

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
- Use `permissions: contents: read` as the default
- Enable Dependabot for action version updates
- Never print secrets or tokens in workflow logs

## Patterns to Avoid

| Anti-Pattern                    | Solution                                   |
| ------------------------------- | ------------------------------------------ |
| Pinning to `@main` or `@latest` | Use `@v4` major version tags               |
| `npm install` in CI             | Use `npm ci` for deterministic installs    |
| Missing `permissions` block     | Always declare least-privilege permissions |
| Broad triggers (no path filter) | Scope with `paths:` to relevant files      |
| Duplicate validation logic      | Reuse existing validator scripts           |
| `actions/upload-artifact@v3`    | Use `@v4` (v3 is deprecated)               |
