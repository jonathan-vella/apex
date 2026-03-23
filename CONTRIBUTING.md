<a id="top"></a>

# Contributing to Agentic InfraOps

Thank you for your interest in contributing! Agentic InfraOps revolutionizes how IT Pros build
Azure environments through coordinated AI agents.

This file is the quick contributor entrypoint.
The canonical, detailed contributor workflow (branch protection, PR flow, automation, versioning) is:

- [Development Workflow Guide](docs/workflow.md)

## 🎯 What We're Looking For

### High-Priority Contributions

1. **Agent Improvements**
   - Enhancements to existing agents (`.github/agents/*.agent.md`)
   - Better prompts and handoff patterns
   - Additional validation checks

2. **Documentation**
   - Workflow improvements (`docs/workflow.md`)
   - Better examples and use cases
   - Troubleshooting guides

3. **Best Practices**
   - Bicep and Terraform patterns and templates
   - Azure Verified Module usage examples (Bicep and AVM-TF)
   - Security and compliance guidance
   <div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## 📋 Contribution Guidelines

### Before You Start

1. **Check existing issues** - Someone might already be working on it
2. **Open an issue** - Discuss your idea before investing time

### Branching and PRs (Canonical)

This repo uses a protected `main` branch.
Contributions land via pull requests with required checks and review.

- Workflow details: [Development Workflow Guide](docs/workflow.md)
- Agent workflow details: [Agent Workflow Reference](docs/workflow.md)

#### Branch Naming Convention

All branches must use an approved prefix that indicates the change domain.
This is enforced by lefthook pre-push hooks and
GitHub Actions CI.

| Prefix          | Scope                                                        | Example                         |
| --------------- | ------------------------------------------------------------ | ------------------------------- |
| `docs/`         | Documentation (`docs/`, `site/`, `README.md`)                | `docs/update-workflow-guide`    |
| `agents/`       | Agent definitions (`.github/agents/`, `agent-registry.json`) | `agents/improve-conductor`      |
| `skills/`       | Skill files (`.github/skills/`, `skill-affinity.json`)       | `skills/add-tf-patterns`        |
| `infra/`        | Infrastructure code (`infra/bicep/`, `infra/terraform/`)     | `infra/add-private-endpoints`   |
| `scripts/`      | Validation scripts (`scripts/`, `package.json`)              | `scripts/fix-h2-sync`           |
| `instructions/` | Instruction files (`.github/instructions/`)                  | `instructions/update-bicep`     |
| `fix/`          | Bug fixes (cross-cutting, any files)                         | `fix/session-state-schema`      |
| `feat/`         | New features (cross-cutting, any files)                      | `feat/azure-skills-integration` |
| `chore/`        | Maintenance, deps, tooling (cross-cutting)                   | `chore/update-lefthook`         |
| `ci/`           | CI/CD workflows (cross-cutting)                              | `ci/add-branch-enforcement`     |
| `refactor/`     | Code refactoring (cross-cutting)                             | `refactor/simplify-handoffs`    |
| `perf/`         | Performance improvements (cross-cutting)                     | `perf/faster-validation`        |
| `test/`         | Test additions/updates (cross-cutting)                       | `test/add-e2e-terraform`        |
| `build/`        | Build system changes (cross-cutting)                         | `build/update-node-deps`        |
| `revert/`       | Reverting previous changes (cross-cutting)                   | `revert/broken-lint-rule`       |

#### Branch Scope Enforcement

**Domain-scoped branches** (`docs/`, `agents/`, `skills/`, `infra/`,
`scripts/`, `instructions/`) are restricted to modifying files within
their domain. This prevents accidental cross-cutting changes in
narrow-scope branches.

**Cross-cutting branches** (`feat/`, `fix/`, `chore/`, `ci/`, `refactor/`,
`perf/`, `test/`, `build/`, `revert/`) may modify any files.

| Domain Prefix   | Allowed File Paths                                               |
| --------------- | ---------------------------------------------------------------- |
| `docs/`         | `docs/`, `site/`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md` |
| `agents/`       | `.github/agents/`, `.github/agent-registry.json`                 |
| `skills/`       | `.github/skills/`, `.github/skill-affinity.json`                 |
| `infra/`        | `infra/`                                                         |
| `scripts/`      | `scripts/`, `package.json`                                       |
| `instructions/` | `.github/instructions/`                                          |

!!! tip "Fixing a scope violation"

    If your `docs/` branch needs to edit a script, either rename the branch
    to `feat/` (cross-cutting) or split the work into two branches.

#### Enforcement Mechanisms

Branch naming and scope are enforced at three levels:

1. **Local (lefthook pre-push)** — instant feedback before push via
   `scripts/validate-branch-naming.sh` and `scripts/validate-branch-scope.sh`
2. **CI (GitHub Actions)** — the `branch-enforcement.yml` workflow validates
   naming and scope on every PR to `main`
3. **GitHub Rulesets** — optional server-side enforcement configured in
   repository Settings → Rules → Rulesets

### Code Standards

**Bicep:**

```bicep
// Use consistent naming conventions
// Include parameter descriptions
// Add output values
// Follow Azure naming best practices
```

**Terraform:**

```hcl
# Use consistent naming conventions (CAF)
# Variables in variables.tf with descriptions and validation
# Outputs in outputs.tf
# AVM-TF modules preferred over raw resources
# Provider pinned to ~> 4.0 (AzureRM)
```

### Documentation Standards

- Use clear, concise language
- Include code examples
- Document prerequisites
- Use Mermaid for diagrams

### Markdown Linting

This repository uses [markdownlint](https://github.com/DavidAnson/markdownlint) for consistent formatting.

**Running the linter:**

```bash
# Check for issues
npm run lint:md

# Check links (docs/ only)
npm run lint:links

# Auto-fix issues
npm run lint:md:fix
```

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## 🚀 Contribution Process

### 1. Fork & Clone

> **Note:** For **using** Agentic InfraOps, create your own repo from the
> [Accelerator template](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator)
> instead. The instructions below are for contributing back to this upstream project.

```bash
git clone https://github.com/YOUR-USERNAME/azure-agentic-infraops.git
cd azure-agentic-infraops
git remote add upstream https://github.com/jonathan-vella/azure-agentic-infraops.git
```

### 2. Create a Branch

Use an approved prefix (see [Branch Naming Convention](#branch-naming-convention) above):

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-description
# or domain-scoped:
git checkout -b docs/update-workflow-guide
```

### 3. Make Your Changes

- Follow the guidelines above
- Test any Bicep changes with `bicep build` and `bicep lint`
- Test any Terraform changes with `terraform fmt -check`, `terraform validate`, and `npm run validate:terraform`
- Validate markdown and links with `npm run lint:md` and `npm run lint:links`

For the full local-to-PR flow, see:

- [Development Workflow Guide](docs/workflow.md)

### 4. Commit & Push

```bash
git add .
git commit -m "feat: add diagram generator improvements"
git push origin feature/your-feature-name
```

Note: commit message format is enforced by hooks and CI.

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## 📝 Commit Message Format (Required)

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) with automated enforcement.
Commit messages are validated by commitlint before each commit.

### Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Description                             | Version Bump  |
| ---------- | --------------------------------------- | ------------- |
| `feat`     | New feature                             | Minor (1.x.0) |
| `fix`      | Bug fix                                 | Patch (1.0.x) |
| `docs`     | Documentation only changes              | None          |
| `style`    | Code style (formatting, semicolons)     | None          |
| `refactor` | Code refactoring (no functional change) | None          |
| `perf`     | Performance improvements                | None          |
| `test`     | Adding or updating tests                | None          |
| `build`    | Build system or dependencies            | None          |
| `ci`       | CI/CD configuration                     | None          |
| `chore`    | Maintenance tasks                       | None          |
| `revert`   | Reverting a previous commit             | None          |

### Breaking Changes

For breaking changes, add `!` after the type or include `BREAKING CHANGE:` in the footer:

```bash
# Breaking change indicator
git commit -m "feat!: redesign agent workflow architecture"

# Or with footer
git commit -m "feat: new output structure

BREAKING CHANGE: agent outputs now go to agent-output/ folder"
```

Breaking changes trigger a **major version bump** (x.0.0).

### Examples

```bash
# Feature (minor version bump)
git commit -m "feat: add terraform validation agent"
git commit -m "feat(bicep): add diagnostic settings module"

# Bug fix (patch version bump)
git commit -m "fix: correct resource naming in Key Vault module"
git commit -m "fix(docs): update broken quickstart links"

# No version bump
git commit -m "docs: update workflow documentation"
git commit -m "chore: update dev container configuration"
git commit -m "refactor: simplify agent handoff logic"
```

### Validation

Commits are automatically validated by the commit-msg hook. If your commit message
doesn't follow the format, you'll see a helpful error with examples.

### 5. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Fill out the PR template
4. Link related issues
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## 📝 Pull Request Checklist

Before submitting:

- [ ] Code follows repository standards
- [ ] Documentation updated if needed
- [ ] Markdown files pass linting (`npm run lint:md`)
- [ ] Docs links pass checks (`npm run lint:links`)
- [ ] Bicep templates validate (`bicep build` + `bicep lint`) if applicable
- [ ] Terraform configs validate (`terraform validate` + `terraform fmt -check`) if applicable
- [ ] No hardcoded secrets or subscription IDs
- [ ] Links work correctly
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## 🤝 Community Standards

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- No harassment or discrimination

### Getting Help

- **Questions**: GitHub Discussions
- **Issues**: GitHub Issues
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">

**Thank you for helping improve the Azure infrastructure workflow!** 🚀

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
