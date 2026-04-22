---
title: "Contributing"
description: "How to contribute to APEX"
---

APEX is an open-source project that welcomes contributions from the community.
Whether you improve an agent prompt, add an infrastructure pattern, fix a bug,
or improve the docs, your work helps the entire Azure platform engineering
community.

:::note[Using APEX vs. contributing to it]
To **use** APEX for your own projects, start from the
[Accelerator template][accelerator].
The guide below is for contributing changes **back to this upstream repo**.
:::

## Where to contribute

| Area                        | What to change                       | Branch prefix             |
| --------------------------- | ------------------------------------ | ------------------------- |
| Agent prompts and handoffs  | `.github/agents/*.agent.md`          | `agents/`                 |
| Skills and domain knowledge | `.github/skills/*/SKILL.md`          | `skills/`                 |
| Bicep or Terraform patterns | `infra/bicep/` or `infra/terraform/` | `infra/`                  |
| Validation scripts          | `tools/scripts/*.mjs`, `package.json`      | `tools/scripts/`                |
| Published documentation     | `site/src/content/docs/`             | `docs/`                   |
| Cross-cutting improvements  | Any files                            | `feat/`, `fix/`, `chore/` |

## Before you start

1. **Search open issues** — someone may already be working on the same thing.
2. **Open an issue first** for non-trivial changes so the idea can be discussed
   before you invest time.

## Step-by-step contribution flow

### 1. Fork and clone

```bash
git clone https://github.com/YOUR-USERNAME/azure-agentic-infraops.git
cd azure-agentic-infraops
git remote add upstream \
  https://github.com/jonathan-vella/azure-agentic-infraops.git
```

### 2. Create a branch

Pick the prefix that matches your change domain:

```bash
# Cross-cutting feature
git checkout -b feat/add-redis-caching-pattern

# Domain-scoped documentation fix
git checkout -b docs/fix-quickstart-links

# Bug fix
git checkout -b fix/session-state-schema
```

:::tip[Branch scope enforcement]
Domain-scoped prefixes (`docs/`, `agents/`, `skills/`, `infra/`,
`tools/scripts/`, `instructions/`) restrict which files you can touch. If your
change spans multiple domains, use a cross-cutting prefix like `feat/`
or `fix/` instead.
:::

### 3. Make your changes

Install dependencies and run the dev container (or install locally):

```bash
npm install          # Node.js validators and linting
pip install -r requirements.txt  # Python tooling (optional)
```

Follow these guidelines while working:

- **Bicep** — Azure Verified Modules first, CAF naming, `uniqueString()`
  suffix pattern
- **Terraform** — AVM-TF modules, provider pinned to `~> 4.0`, variables
  in `variables.tf` with descriptions
- **Markdown** — 120-character line limit, fenced code blocks with language
  tags, no bare URLs
- **Agents and skills** — YAML frontmatter required, follow existing
  patterns in `.github/agents/` and `.github/skills/`

### 4. Validate locally

Run the checks that CI will run on your PR:

```bash
# Full validation suite
npm run validate:all

# Individual checks
npm run lint:md                    # Markdown linting
bicep build infra/bicep/*/main.bicep   # Bicep (if applicable)
terraform fmt -check -recursive infra/terraform/  # Terraform (if applicable)
```

### 5. Commit with a conventional message

This repo enforces [Conventional Commits][conventional-commits].
The commit-msg hook validates your message automatically.

```bash
git commit -m "feat(bicep): add diagnostic settings module"
```

Common types: `feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, `test`.
Add `!` after the type for breaking changes (e.g., `feat!: new output format`).

### 6. Push and open a pull request

```bash
git push origin feat/add-redis-caching-pattern
```

Then open a PR against `main` on GitHub. The following checks run
automatically:

| Check                      | What it validates                      |
| -------------------------- | -------------------------------------- |
| `ci`                       | Markdown lint + all Node.js validators |
| `Branch Naming Convention` | Prefix matches approved list           |
| `Branch Scope Check`       | Files stay within the branch domain    |
| Copilot Code Review        | Advisory AI review on the diff         |

All required checks must pass before merge. A code-owner review from
a maintainer is also required.

## PR checklist

Before requesting review, confirm:

- [ ] Changes follow the coding and naming conventions above
- [ ] `npm run validate:all` passes locally
- [ ] Bicep/Terraform templates validate if you touched `infra/`
- [ ] No hardcoded secrets, subscription IDs, or tenant IDs
- [ ] Documentation updated if you changed user-facing behavior

## Commit message reference

| Type       | When to use                                | Version bump |
| ---------- | ------------------------------------------ | ------------ |
| `feat`     | New feature or capability                  | Minor        |
| `fix`      | Bug fix                                    | Patch        |
| `docs`     | Documentation only                         | None         |
| `refactor` | Code restructuring without behavior change | None         |
| `chore`    | Maintenance, dependency updates            | None         |
| `ci`       | CI/CD workflow changes                     | None         |
| `test`     | Adding or updating tests                   | None         |
| `perf`     | Performance improvement                    | None         |
| `build`    | Build system changes                       | None         |
| `revert`   | Reverting a previous commit                | None         |

## Getting help

- **Questions** — [GitHub Discussions][discussions]
- **Bugs and feature requests** — [GitHub Issues][issues]
- **Full development workflow** — [Workflow guide](../../concepts/workflow/)

## Code of conduct

Be respectful and inclusive. Welcome newcomers. Focus on constructive
feedback. No harassment or discrimination.

By contributing, you agree that your contributions will be licensed under
the [MIT License][license].

[accelerator]: https://github.com/jonathan-vella/azure-agentic-infraops-accelerator
[conventional-commits]: https://www.conventionalcommits.org/
[discussions]: https://github.com/jonathan-vella/azure-agentic-infraops/discussions
[issues]: https://github.com/jonathan-vella/azure-agentic-infraops/issues
[license]: https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/LICENSE
