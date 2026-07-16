---
title: "Record vNext Live Qualification"
description: "Bind manual VS Code, GitHub, and Azure qualification evidence to one exact vNext candidate."
sidebar:
  order: 8
---

Use the live qualification record only after deterministic qualification passes. The record binds manual and
cloud-backed results to one repository commit, package lock, release manifest, runtime bundle, and evidence manifest.
The command creates and validates evidence files; it does not invoke VS Code, approve a gate, or call a cloud provider.

## Prepare the Candidate

Install dependencies and produce the release package set from the exact commit under test:

```bash
npm ci
npm run qualify:vnext
npm run pack:vnext
```

Create the template only from a clean Git worktree. The command rejects tracked or untracked files because they are not
represented by the candidate commit.

When the public npm registry is unavailable locally, use an approved registry proxy as a process-scoped override:

```bash
npm_config_registry="$APPROVED_NPM_PROXY" npm ci
```

Do not commit a machine-specific registry in `.npmrc` or rewrite `package-lock.json` to the proxy. The committed lock
remains normalized to the public npm registry so CI and other consumers use the same content-addressed dependencies.

## Create the Evidence Files

Choose the timestamp before creating the template. Reusing the same inputs produces the same JSON bytes except for the
Git commit and artifact hashes that intentionally identify the candidate.

```bash
npm run live:vnext -- template \
  --release-manifest dist/vnext-packages/release-manifest.json \
  --created-at 2026-07-15T08:00:00.000Z \
  --actor maintainer \
  --environment sandbox \
  --target-scope subscription/sandbox \
  --project release-qualification \
  --run candidate-1 \
  --evidence-manifest dist/live-qualification/evidence-manifest.json \
  --output dist/live-qualification/live-qualification.json
```

The command refuses to overwrite either output. Every scenario starts as `unavailable` with an explicit owner and next
action. This prevents an unexecuted scenario from appearing successful. Top-level `createdAt` records template creation;
each scenario records an actual `startedAt` and `completedAt` at or after that instant.

## Execute Human-Owned Scenarios

Update one scenario only after its evidence has been captured and hashed into `evidence-manifest.json`.

| Scenario                      | Required execution and approval boundary                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `vscode-experience`           | A maintainer uses a supported VS Code release to verify discovery, handoffs, questions, hidden workers, and MCP startup.                 |
| `restart-cross-device`        | The user restarts and resumes on another device, then explicitly accepts writer transfer.                                                |
| `github-oidc-writer-transfer` | A GitHub Environment reviewer approves the job before OIDC and CI writer acceptance.                                                     |
| `bicep-lifecycle`             | An authorized maintainer approves an isolated sandbox before preview, apply, inventory, diagnosis, recovery, and destroy.                |
| `terraform-lifecycle`         | An authorized maintainer approves the backend and sandbox before exact-plan preview, apply, inventory, diagnosis, recovery, and destroy. |
| `promotion`                   | A reviewer approves the linked environment run and its refreshed Deployment Preview gate.                                                |

For `pass` or `fail`, provide at least one `evidenceRefs[]` hash that exists in the evidence manifest. For
`unavailable`, retain `reason`, `owner`, and `nextAction`. Record actual start/completion timestamps and tool versions.
Never place credentials, tokens, state, saved plans, or raw secret-bearing logs in either JSON file.

The GitHub scenario must prove separate writers: writer A creates the exact preview at epoch $N$, then creates one
transfer claim; writer B accepts at epoch $N+1$, obtains claim-bound Gate 4 approval, and deploys that preview. Capture
the preview hash, transfer claim hash, both epochs, approval hash, recipient-bound provider transfer, and operation
result. A deterministic test pass does not qualify this live boundary, and production workflow enablement remains
blocked until this scenario passes on the release candidate.

## Validate and Render

Validation compares the record with the current Git commit and current artifact bytes. It rejects missing scenarios,
duplicates, invalid timestamps, stale hashes, unknown evidence references, and secret-shaped fields or values.

```bash
npm run live:vnext -- validate \
  --file dist/live-qualification/live-qualification.json \
  --evidence-manifest dist/live-qualification/evidence-manifest.json \
  --release-manifest dist/vnext-packages/release-manifest.json

npm run live:vnext -- render \
  --file dist/live-qualification/live-qualification.json \
  --output dist/live-qualification/live-qualification.md
```

Store accepted evidence only in the approved private evidence boundary. Publication, deployment, approval, and merge to
`main` remain separate maintainer-authorized operations.

The rendered Markdown identifies the project/run and candidate, summarizes outcome counts, and lists each scenario with
its environment, target, and evidence count. It is a review view only; the validated JSON remains authoritative.

## Related

- [Qualify the vNext Preview](../testing/) — run deterministic lanes and the supported manual checklist
- [Operate the vNext Preview](../operations/) — inspect state, transfer writers, and reconcile operations
- [vNext Security](../security/) — preserve authorization, secret handling, and evidence boundaries
