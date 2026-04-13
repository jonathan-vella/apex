<!-- ref:branch-strategy-v1 -->

# Branch Naming and Scope Strategy

Rules for branch naming conventions and file-scope enforcement.
Validated by `scripts/validate-branch-naming.sh` and `scripts/validate-branch-scope.sh`.

## Approved Prefixes

### Domain-Scoped (restricted to their file domain)

| Prefix          | Allowed File Paths                                      |
| --------------- | ------------------------------------------------------- |
| `docs/`         | `site/`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md` |
| `agents/`       | `.github/agents/`, `.github/agent-registry.json`        |
| `skills/`       | `.github/skills/`, `.github/skill-affinity.json`        |
| `infra/`        | `infra/`                                                |
| `scripts/`      | `scripts/`, `package.json`                              |
| `instructions/` | `.github/instructions/`                                 |

### Cross-Cutting (any files allowed)

`feat/`, `fix/`, `chore/`, `ci/`, `refactor/`, `perf/`, `test/`, `build/`, `revert/`

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
bash scripts/validate-branch-naming.sh

# Check file scope locally
bash scripts/validate-branch-scope.sh
```

## Agent Workflow

Before committing or creating a PR, agents MUST:

1. **Read the current branch name**: `git rev-parse --abbrev-ref HEAD`
2. **Validate the prefix** matches an approved prefix from the table above
3. **If domain-scoped**, verify changed files are within the allowed paths
4. **If invalid**, warn the user and suggest:
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
