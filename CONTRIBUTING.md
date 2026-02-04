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
   - Bicep patterns and templates
   - Azure Verified Module usage examples
   - Security and compliance guidance

## 📋 Contribution Guidelines

### Before You Start

1. **Check existing issues** - Someone might already be working on it
2. **Open an issue** - Discuss your idea before investing time

### Branching and PRs (Canonical)

This repo uses a protected `main` branch.
Contributions land via pull requests with required checks and review.

- Workflow details: [Development Workflow Guide](docs/workflow.md)
- Agent workflow details: [Agent Workflow Reference](docs/workflow.md)

### Code Standards

**Bicep:**

```bicep
// Use consistent naming conventions
// Include parameter descriptions
// Add output values
// Follow Azure naming best practices
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

# Check links (docs/ only; excludes docs/_superseded)
npm run lint:links

# Auto-fix issues
npm run lint:md:fix
```

## 🚀 Contribution Process

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR-USERNAME/azure-agentic-infraops.git
cd azure-agentic-infraops
git remote add upstream https://github.com/jonathan-vella/azure-agentic-infraops.git
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 3. Make Your Changes

- Follow the guidelines above
- Test any Bicep changes with `bicep build` and `bicep lint`
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

## 📝 Pull Request Checklist

Before submitting:

- [ ] Code follows repository standards
- [ ] Documentation updated if needed
- [ ] Markdown files pass linting (`npm run lint:md`)
- [ ] Docs links pass checks (`npm run lint:links`)
- [ ] No hardcoded secrets or subscription IDs
- [ ] Links work correctly

## 🤝 Community Standards

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- No harassment or discrimination

### Getting Help

- **Questions**: GitHub Discussions
- **Issues**: GitHub Issues

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for helping improve the Azure infrastructure workflow!** 🚀
