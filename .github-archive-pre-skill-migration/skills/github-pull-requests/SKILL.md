---
name: github-pull-requests
description: >
  Manage GitHub pull requests using MCP tools. Use this skill when users want to
  create PRs, review code, merge branches, request reviews, update PR details,
  or check PR status. Triggers on requests like "create a PR", "merge this branch",
  "request a review", "update the PR description", "check PR status", or any
  pull request lifecycle task.
---

# GitHub Pull Requests

Manage GitHub pull requests using the GitHub MCP server tools.

## Available MCP Tools

| Tool                                 | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `mcp_github_create_pull_request`     | Create new pull requests             |
| `mcp_github_merge_pull_request`      | Merge pull requests                  |
| `mcp_github_update_pull_request`     | Update PR title, body, reviewers     |
| `mcp_github_update_pull_request_branch` | Sync PR branch with base          |
| `mcp_github_pull_request_review_write` | Create/submit/delete reviews       |
| `mcp_github_request_copilot_review`  | Request GitHub Copilot code review   |
| `mcp_github_search_pull_requests`    | Search PRs with GitHub search syntax |
| `mcp_github_list_pull_requests`      | List PRs in a repository             |

## Workflow

1. **Determine action**: Create, merge, review, or query?
2. **Gather context**: Get repo info, branch names, existing PRs
3. **Structure content**: Use templates from [references/templates.md](references/templates.md)
4. **Execute**: Call the appropriate MCP tool
5. **Confirm**: Report the PR URL and status to user

## Creating Pull Requests

### Required Parameters

```yaml
owner: repository owner (org or user)
repo: repository name
title: clear, descriptive title
head: branch containing changes (source)
base: branch to merge into (target, usually 'main')
```

### Optional Parameters

```yaml
body: PR description (markdown)
draft: true/false (create as draft)
maintainer_can_modify: true/false
```

### Title Guidelines

- Use conventional commit style when appropriate: `feat:`, `fix:`, `docs:`
- Be specific about the change
- Keep under 72 characters
- Examples:
  - `feat: Add dark mode support`
  - `fix(auth): Resolve SSO login failure`
  - `docs: Update API reference for v2`

### Body Structure

Use the PR template from [references/templates.md](references/templates.md). Key sections:

- **Summary**: What changed and why
- **Changes**: Bullet list of modifications
- **Testing**: How to verify the changes
- **Checklist**: Pre-merge verification items

## Merging Pull Requests

### Required Parameters

```yaml
owner: repository owner
repo: repository name
pullNumber: PR number (integer)
```

### Optional Parameters

```yaml
merge_method: "squash" | "merge" | "rebase"
commit_title: custom merge commit title
commit_message: custom merge commit message
```

### Merge Methods

| Method   | Use Case                                      |
| -------- | --------------------------------------------- |
| `squash` | Clean history, combine all commits into one   |
| `merge`  | Preserve full commit history                  |
| `rebase` | Linear history without merge commits          |

**Default**: Use `squash` unless the user specifies otherwise.

## Reviewing Pull Requests

### Creating a Review

Use `mcp_github_pull_request_review_write` with `method: "create"`:

```yaml
owner: repository owner
repo: repository name
pullNumber: PR number
event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
body: review comment text
```

### Review Events

| Event             | Use When                                    |
| ----------------- | ------------------------------------------- |
| `APPROVE`         | Changes look good, ready to merge           |
| `REQUEST_CHANGES` | Issues must be addressed before merge       |
| `COMMENT`         | Feedback without explicit approval/blocking |

### Request Copilot Review

For automated code review feedback:

```yaml
owner: repository owner
repo: repository name
pullNumber: PR number
```

## Updating Pull Requests

Use `mcp_github_update_pull_request` to modify:

```yaml
owner: repository owner
repo: repository name
pullNumber: PR number (required)
# Optional - only include fields to change:
title: new title
body: new description
state: "open" | "closed"
base: new base branch
draft: true/false (mark as draft or ready)
reviewers: ["username1", "username2"]
```

## Searching Pull Requests

Use `mcp_github_search_pull_requests` with GitHub search syntax:

### Common Search Queries

| Goal                          | Query                                    |
| ----------------------------- | ---------------------------------------- |
| Open PRs in repo              | `repo:owner/repo is:open`                |
| PRs by author                 | `author:username`                        |
| PRs needing review            | `review:required`                        |
| Draft PRs                     | `draft:true`                             |
| PRs with label                | `label:bug`                              |
| Recently updated              | `updated:>2024-01-01`                    |
| PRs mentioning text           | `"search term" in:title,body`            |

## Examples

### Example 1: Create a PR

**User**: "Create a PR from my feature branch to main"

**Action**: Call `mcp_github_create_pull_request`:

```json
{
  "owner": "jonathan-vella",
  "repo": "azure-agentic-infraops",
  "title": "feat: Add dark mode support",
  "head": "feature/dark-mode",
  "base": "main",
  "body": "## Summary\nAdds dark mode theme support.\n\n## Changes\n..."
}
```

### Example 2: Merge with Squash

**User**: "Merge PR #70 using squash"

**Action**: Call `mcp_github_merge_pull_request`:

```json
{
  "owner": "jonathan-vella",
  "repo": "azure-agentic-infraops",
  "pullNumber": 70,
  "merge_method": "squash",
  "commit_title": "feat: Add dark mode support (#70)"
}
```

### Example 3: Request Changes

**User**: "Request changes on PR #42 - needs more tests"

**Action**: Call `mcp_github_pull_request_review_write`:

```json
{
  "owner": "jonathan-vella",
  "repo": "azure-agentic-infraops",
  "pullNumber": 42,
  "method": "create",
  "event": "REQUEST_CHANGES",
  "body": "This PR needs additional test coverage before merging.\n\n..."
}
```

### Example 4: Update PR to Ready

**User**: "Mark PR #55 as ready for review and add reviewers"

**Action**: Call `mcp_github_update_pull_request`:

```json
{
  "owner": "jonathan-vella",
  "repo": "azure-agentic-infraops",
  "pullNumber": 55,
  "draft": false,
  "reviewers": ["teammate1", "teammate2"]
}
```

## Branch Management

### Create Branch First

Before creating a PR, ensure the branch exists using `mcp_github_create_branch`:

```yaml
owner: repository owner
repo: repository name
branch: new branch name
from_branch: source branch (optional, defaults to default branch)
```

### Update Branch with Base

To sync a PR branch with the latest changes from base:

```yaml
owner: repository owner
repo: repository name
pullNumber: PR number
```

## Tips

- Always check if a PR already exists for the branch before creating
- Use `squash` merge for cleaner history on feature branches
- Request Copilot review for quick automated feedback before human review
- Include issue references in PR body: `Closes #123` or `Fixes #456`
- For draft PRs, set `draft: true` to indicate work-in-progress
- After merging, the source branch can be deleted via GitHub UI

## Common Labels for PRs

| Label            | Use For                              |
| ---------------- | ------------------------------------ |
| `ready-for-review` | PR is ready for code review        |
| `work-in-progress` | Still being worked on              |
| `needs-tests`    | Missing test coverage                |
| `breaking-change`| Contains breaking API changes        |
| `documentation`  | Documentation updates                |
| `dependencies`   | Dependency updates                   |
