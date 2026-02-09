# Pull Request Templates

Templates for structuring PR descriptions.

## Standard PR Template

```markdown
## Summary

Brief description of what this PR does and why.

## Changes

- Change 1
- Change 2
- Change 3

## Testing

Describe how to test these changes:

1. Step 1
2. Step 2
3. Expected result

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Checklist

- [ ] Tests pass locally
- [ ] Code follows project style guidelines
- [ ] Documentation updated (if needed)
- [ ] No sensitive data exposed
```

## Feature PR Template

```markdown
## Summary

Adds [feature name] to enable [capability].

**Related Issue**: Closes #XXX

## Changes

### Added

- New component/module for X
- API endpoint for Y

### Modified

- Updated Z to support new feature

## Testing

### Manual Testing

1. Navigate to [location]
2. Perform [action]
3. Verify [expected result]

### Automated Tests

- [ ] Unit tests added for new functions
- [ ] Integration tests updated

## Documentation

- [ ] README updated
- [ ] API docs updated
- [ ] Inline code comments added

## Checklist

- [ ] Tests pass
- [ ] No breaking changes (or documented)
- [ ] Reviewed for security implications
```

## Bug Fix PR Template

```markdown
## Summary

Fixes [brief description of bug].

**Related Issue**: Fixes #XXX

## Root Cause

Explain what was causing the bug.

## Solution

Describe the fix and why this approach was chosen.

## Changes

- File1: Description of change
- File2: Description of change

## Testing

### Reproduction Steps (Before Fix)

1. Step to reproduce
2. Observe bug

### Verification (After Fix)

1. Same steps
2. Bug no longer occurs

## Regression Risk

- [ ] Low - isolated change
- [ ] Medium - affects related functionality
- [ ] High - core system change

## Checklist

- [ ] Bug can no longer be reproduced
- [ ] No new bugs introduced
- [ ] Tests added to prevent regression
```

## Documentation PR Template

```markdown
## Summary

Updates documentation for [topic].

## Changes

- Added/updated section on X
- Fixed outdated information about Y
- Improved clarity of Z

## Review Notes

Please verify:

- [ ] Technical accuracy
- [ ] Grammar and spelling
- [ ] Links work correctly
- [ ] Code examples are valid

## Checklist

- [ ] Markdown renders correctly
- [ ] No broken links
- [ ] Follows documentation style guide
```

## Dependency Update Template

```markdown
## Summary

Updates [package name] from vX.X.X to vY.Y.Y.

## Motivation

- Security vulnerability fix (CVE-XXXX)
- Bug fix required for [reason]
- New feature needed: [feature]

## Changes

- Updated package.json / requirements.txt
- Updated lock file

## Breaking Changes

<!-- List any breaking changes or "None" -->

## Testing

- [ ] Build succeeds
- [ ] All tests pass
- [ ] Application starts correctly
- [ ] Key functionality verified

## Changelog

Link to package changelog: [CHANGELOG](url)
```

## Merge Commit Message Templates

### Squash Merge (Default)

```
<type>: <description> (#PR_NUMBER)

<optional body with details>
```

Examples:

```
feat: Add user authentication (#123)
fix: Resolve memory leak in worker pool (#456)
docs: Update API reference for v2 endpoints (#789)
```

### Conventional Commit Types

| Type       | Description                               |
| ---------- | ----------------------------------------- |
| `feat`     | New feature                               |
| `fix`      | Bug fix                                   |
| `docs`     | Documentation only                        |
| `style`    | Formatting, no code change                |
| `refactor` | Code change that neither fixes nor adds   |
| `perf`     | Performance improvement                   |
| `test`     | Adding or updating tests                  |
| `chore`    | Maintenance tasks, dependencies           |
| `ci`       | CI/CD changes                             |
| `build`    | Build system changes                      |
