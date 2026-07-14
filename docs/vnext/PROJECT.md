## APEX vNext Checkpoint

- **Updated:** 2026-07-14 UTC
- **Milestone:** Project controls bootstrap
- **Integration branch:** `feat/apex-vnext-rewrite`
- **Integration pull request:** [PR #533](https://github.com/jonathan-vella/apex/pull/533), open and draft
- **Verified integration head:** `7fc27966f38a17e65d7c172fccc65451c2f46c9b`
- **Execution branch:** `feat/vnext-project-controls`
- **Execution issue:** [#536](https://github.com/jonathan-vella/apex/issues/536)
- **Execution worktree:** `/workspaces/apex-vnext-controls`
- **Execution pull request:** [PR #548](https://github.com/jonathan-vella/apex/pull/548), open and draft

## Current State

The repository project controls, execution prompts, issue intake, offline validator, labels, milestone, and seeded issues
are established from the exact integration head. Phase 0A is approved and frozen. Deterministic vNext validation,
runtime tests, validator tests, and fake-provider workflows pass. Package qualification remains incomplete because its
clean consumer install timed out and leaked a child process.

The original `/workspaces/apex` worktree is intentionally untouched and contains modified customization and lock files
plus the original untracked prompt copies. Those changes are not part of this issue branch.

## Active Blockers

- CodeQL alert #34 is an open high-severity polynomial-ReDoS finding.
- Required CI fails because lint resolves vNext generated-package imports before build output exists.
- Strict vNext site links fail; the same defect causes every devcontainer matrix leg to fail internal `validate:all`.
- Package clean-install qualification times out during consumer `npm install` and does not cancel its child process.
- GitHub Projects are inaccessible to the current token, so the planning project cannot yet be inspected or created.
- Live VS Code, GitHub approval, Bicep, and Terraform qualification evidence is unavailable.
- Required scorecard sample sets are unavailable.

See [REGISTER.md](REGISTER.md) for ownership, evidence, mitigation, and closure proof.

## Validation State

| Check                          | Result  | Evidence                                                                        |
| ------------------------------ | ------- | ------------------------------------------------------------------------------- |
| Prompt hash reproduction       | Pass    | Both isolated prompt hashes match the original worktree copies.                 |
| `npm run validate:vnext`       | Pass    | Local isolated worktree, 2026-07-14.                                            |
| `npm run test:vnext`           | Pass    | All workspace package suites passed.                                            |
| `npm run test:vnext-validator` | Pass    | Repository-model mutation cases passed.                                         |
| `npm run test:vnext-pack`      | Blocked | Timed out during clean consumer install; leaked child was terminated.           |
| PR #533 required checks        | Fail    | CI, docs, devcontainer summary, and CodeQL are red at the verified head.        |
| Security alert inventory       | Blocked | CodeQL alert #34 is open; no open secret-scanning or Dependabot alerts found.   |
| Project controls validation    | Pass    | Markdown, JSON, JavaScript, forms, local links, references, and mutation tests. |

## Resume Pointer

1. Validate, commit, push, and open the [#536](https://github.com/jonathan-vella/apex/issues/536) pull request against
   `feat/apex-vnext-rewrite`.
2. Create or configure the `APEX vNext` Project through
   [#541](https://github.com/jonathan-vella/apex/issues/541) after Projects permission is available.
3. Start exact-head stabilization with the high-severity CodeQL regression in
   [#537](https://github.com/jonathan-vella/apex/issues/537).

GitHub Issues become authoritative for daily work after seeding. This file remains a dated checkpoint and does not mirror
issue status.
