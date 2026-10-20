<!-- ref:branch-strategy-v1 -->

# Branch Naming and Scope Strategy

Rules for branch naming conventions and file-scope enforcement.
The same [naming validator](../../../../tools/scripts/validate-branch-naming.sh) and
[scope validator](../../../../tools/scripts/validate-branch-scope.sh) run locally and in CI.

## Approved Prefixes

### Domain-Scoped (restricted to their file domain)

| Prefix          | Allowed File Paths                                      |
| --------------- | ------------------------------------------------------- |
| `docs/`         | `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `GLOSSARY.md` |
| `agents/`       | `.github/agents/`, `tools/registry/agent-registry.json` |
| `skills/`       | `.github/skills/`                                       |
| `infra/`        | `infra/`                                                |
| `scripts/`      | `tools/scripts/`, `package.json`                         |
| `instructions/` | `.github/instructions/`                                 |

### Cross-Cutting (any files allowed)

`feat/`, `fix/`, `chore/`, `ci/`, `refactor/`, `perf/`, `test/`, `build/`, `revert/`

Automation branches use `dependabot/` or `automation/`; they are exempt from domain scope.
Use `scripts/`, not `tools/scripts/`, as the branch prefix.
The validators skip `main` and detached `HEAD` for non-publishing contexts;
the Git operation procedure still refuses commits/pushes there and on the repository default branch.

## Branch Creation

```bash
# Cross-cutting (any files)
git checkout -b feat/my-new-feature
git checkout -b fix/session-state-bug

# Domain-scoped (restricted to specific paths)
git checkout -b docs/update-workflow-guide
git checkout -b agents/improve-orchestrator
git checkout -b skills/add-terraform-patterns
git checkout -b infra/add-private-endpoints
```

## Validation Commands

```bash
# Check branch name locally
bash tools/scripts/validate-branch-naming.sh

# Check file scope locally
bash tools/scripts/validate-branch-scope.sh

# CI or explicit target comparison
bash tools/scripts/validate-branch-naming.sh "<branch>"
bash tools/scripts/validate-branch-scope.sh "<branch>" "origin/<base>"
```

Scope checks compare committed changes with `origin/main` by default and fail when
the base or diff is unavailable. They do not inspect uncommitted/staged files;
before committing, also validate the approved staged paths against the domain table.
Scope violations fail locally and in CI; no previous-commit fallback silently passes.

## Agent Workflow

Before committing or creating a PR, agents MUST:

1. **Read the current branch name**: `git rev-parse --abbrev-ref HEAD`
2. **Validate the prefix** matches an approved prefix from the table above
3. **If domain-scoped**, verify changed files are within the allowed paths
4. **If invalid**, stop and propose an authorized rename or split:
   - Rename: `git branch -m <old> feat/<descriptive-name>`
   - Or split into two branches (one per domain)

## Scope Violation Recovery

If a domain-scoped branch needs to touch files outside its scope:

1. Rename to a cross-cutting prefix: `git branch -m docs/my-work feat/my-work`
2. Or split into two branches — one per domain
3. Never force files into the wrong branch scope

## Enforcement Layers

| Layer  | Mechanism                         | When                  |
| ------ | --------------------------------- | --------------------- |
| Local  | lefthook pre-push hook            | Before every push     |
| CI     | `branch-enforcement.yml` workflow | On every PR to `main` |
| Server | GitHub Rulesets (optional)        | Branch creation time  |
