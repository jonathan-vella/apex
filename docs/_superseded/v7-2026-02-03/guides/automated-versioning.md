# Automated Versioning Guide

This repository uses automated versioning based on [Conventional Commits](https://www.conventionalcommits.org/).

## How It Works

The `.github/workflows/version-bump.yml` workflow automatically:

1. ✅ **Analyzes commit messages** since the last version tag
2. ✅ **Determines version bump type** (major, minor, or patch)
3. ✅ **Updates VERSION.md** with new version number and date
4. ✅ **Updates CHANGELOG.md** with categorized changes
5. ✅ **Creates a Pull Request** with the version bump
6. 👤 **Requires manual review and merge** of the version bump PR
7. 📝 **After merge, GitHub Release is automatically created**

## Commit Message Format

Use the following format for your commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types and Version Bumps

| Commit Type                                       | Version Bump      | Example                              |
| ------------------------------------------------- | ----------------- | ------------------------------------ |
| `feat:`                                           | **Minor** (1.X.0) | `feat: add challenge 7`              |
| `fix:`                                            | **Patch** (1.0.X) | `fix: correct timing in agenda`      |
| `feat!:` or `BREAKING CHANGE:`                    | **Major** (X.0.0) | `feat!: redesign workshop structure` |
| `docs:`, `chore:`, `style:`, `refactor:`, `test:` | **No bump**       | `docs: update README`                |

### Examples

**Adding a new feature (minor bump):**

```bash
git commit -m "feat: add bonus challenge for advanced participants"
```

**Fixing a bug (patch bump):**

```bash
git commit -m "fix: correct challenge 3 duration from 40 to 45 minutes"
```

**Breaking change (major bump):**

```bash
git commit -m "feat!: restructure workshop from 6 to 8 challenges

BREAKING CHANGE: All existing challenge numbers have shifted"
```

**Documentation update (no bump):**

```bash
git commit -m "docs: update facilitator guide with new tips"
```

## Scopes (Optional)

You can add scopes to provide more context:

| Scope         | Description           | Example                                          |
| ------------- | --------------------- | ------------------------------------------------ |
| `hackathon`   | Hackathon materials   | `fix(hackathon): correct curveball timing`       |
| `facilitator` | Facilitator guides    | `feat(facilitator): add troubleshooting section` |
| `participant` | Participant materials | `docs(participant): update pre-work checklist`   |
| `scoring`     | Scoring system        | `feat(scoring): add automated leaderboard`       |
| `agent`       | Custom agents         | `feat(agent): add validation agent`              |
| `workflow`    | CI/CD workflows       | `fix(workflow): update auto-version trigger`     |

## Testing Commits Locally

Before pushing, verify your commit message is valid:

```bash
# Install dependencies (if not already done)
npm install

# Commitlint will run automatically via lefthook on commit
git commit -m "feat: your message here"
```

If the commit message doesn't follow the convention, it will be rejected.

## Manual Version Override

If you need to manually bump the version:

```bash
# Update VERSION.md and CHANGELOG.md manually
# Then commit with [skip ci] to prevent workflow from running
git commit -m "chore(release): bump version to 2.0.0 [skip ci]"
git tag -a v2.0.0 -m "Release v2.0.0"
git push origin main --tags
```

## Workflow Triggers

The version-bump workflow runs on:

- ✅ Push to `main` branch
- ❌ Ignores changes to `VERSION.md`, `CHANGELOG.md`, and `package.json`
- ❌ Skips if commit message starts with `chore(release):`

**What happens after workflow runs:**

1. Workflow creates a PR with version bump (e.g., `release/v1.2.0`)
2. PR requires approval and passing checks (markdown-lint)
3. Merge the PR using **squash and merge**
4. After merge, the `create-release.yml` workflow automatically:
   - Creates a git tag (e.g., `v1.2.0`)
   - Creates a GitHub Release with auto-generated notes

**Fully automated release flow:**
Once you merge the version bump PR, the release is created automatically—no manual steps required.

## Checking Version Status

View current version:

```bash
cat VERSION.md
```

View recent changes:

```bash
cat CHANGELOG.md | head -n 50
```

View all version tags:

```bash
git tag -l
```

View specific version:

```bash
git show v1.0.0
```

## Troubleshooting

### Workflow didn't run

- Check that your commit is on the `main` branch
- Verify commit message follows conventional commits format
- Check workflow logs in GitHub Actions tab

### Wrong version bump

- Review your commit message type (`feat:` vs `fix:`)
- If already pushed, manually correct and tag with `[skip ci]`

### Merge conflicts

- Pull latest changes before committing
- Resolve conflicts in VERSION.md and CHANGELOG.md
- Commit with `chore: resolve merge conflicts [skip ci]`

## References

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
