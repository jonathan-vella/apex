# Plan: Hooks Consolidation & Hardening (Final)

Single-PR overhaul of both git hooks (lefthook) and VS Code agent hooks (`.github/hooks/`). Merges overlapping telemetry hooks, deduplicates lefthook validators, parallelizes pre-commit, promotes post-commit checks to pre-push, adds gitleaks safety net, adds a minimal PostToolUse audit hook, and introduces bats-based unit tests with before/after timing.

This plan ships as a dedicated follow-up PR from `main`, not on the current `chore/remove-post-edit-format-hook` branch.

## Locked decisions

| Decision                   | Detail                                                                                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR shape                   | One dedicated follow-up PR from `main`, split into reviewable commits by phase.                                                                                                                                                                                                   |
| Secrets                    | Keep `.github/hooks/secrets-scanner/scan-secrets.sh` on `Stop` and add `gitleaks` at `pre-commit`.                                                                                                                                                                                |
| Post-commit migration      | Remove `post-commit` block. Move `version-sync`, `deprecated-refs`, and `terminology` into `pre-push`. Do **not** migrate `json-syntax` — JSON validation is already covered by `npm run lint:json` in `diff-based-push-check.sh`.                                                |
| Bats installation          | Install `bats` via `apt-get install -y bats` in the dev container `onCreateCommand` and as a CI workflow step. Do **not** add it as an npm devDependency. `npx bats` does not work — `bats-core` is a system binary.                                                              |
| Tool audit scope           | The `PostToolUse` hook logs `tool_name` and success/failure metadata only. It does **not** log `duration_ms` (not available in PostToolUse stdin), tool input, or tool output.                                                                                                    |
| Telemetry env precedence   | `SKIP_SESSION_TELEMETRY=true` disables all merged telemetry behavior regardless of `SKIP_GOVERNANCE_AUDIT` or `SKIP_LOGGING`. If the umbrella flag is unset, the individual flags continue to work independently.                                                                 |
| gitleaks install policy    | Dev container feature `ghcr.io/devcontainers-contrib/features/gitleaks:1`. Lefthook checks `command -v gitleaks` and prints a yellow warning + skips if missing locally (does NOT block contributor). CI uses `gitleaks/gitleaks-action@v2` and treats absence as a hard failure. |
| Parallel pre-commit safety | `pre-commit.parallel: true` stays safe only while `markdown-lint` remains the sole `stage_fixed: true` command. No other auto-fixer is added in this work.                                                                                                                        |
| Log path stability         | Existing log paths (`logs/copilot/governance/audit.log`, `logs/copilot/session.log`, `logs/copilot/prompts.log`) are preserved — no churn for external consumers.                                                                                                                 |

---

## Phase 0 — Branch and baseline

**Blocks**: all subsequent phases.

**Files**: new `tools/scripts/bench-hooks.sh`, new `logs/hooks-bench/before.json`

1. Create branch `chore/hooks-consolidation` from `main`.
2. Add `tools/scripts/bench-hooks.sh` that:
   - Runs each agent hook (`SessionStart`, `UserPromptSubmit`, `Stop`) 10× with mock JSON input, recording wall-clock time.
   - Runs `lefthook run pre-commit --files <synthetic set>` to measure lefthook overhead.
   - Outputs results to `logs/hooks-bench/before.json`.
3. Run baseline benchmark and commit the JSON.
4. Document the benchmark method in the PR description so the after-state comparison is reproducible.

**Commit**: `chore(hooks): add benchmark harness and branch baseline`

---

## Phase 1 — Lefthook consolidation and push validation

**Files**: `lefthook.yml`, `tools/scripts/diff-based-push-check.sh`, `AGENTS.md`, `.gitleaksignore` _(new)_, `.devcontainer/devcontainer.json`

> **Note:** `.devcontainer/devcontainer.json` is first touched in Phase 1 to add the `ghcr.io/devcontainers-contrib/features/gitleaks:1` dev container feature. Without this, `command -v gitleaks` in the §1.3 pre-commit guard will always take the skip path after a fresh container rebuild, making local gitleaks enforcement dead code until the feature is installed.

### 1.1 Consolidate duplicate pre-commit commands

- Replace `agent-frontmatter`, `model-alignment`, and `agent-checks` with one `agents` command that runs `npm run validate:agents` once. All three currently invoke the same underlying script.
- The consolidated `agents` command must carry the **union** of the original globs: `**/*.agent.md` (from `agent-frontmatter` and `agent-checks`) **and** `**/*.prompt.md` (from `model-alignment`). If only `**/*.agent.md` is used, prompt-file model-alignment coverage is silently dropped.
- Replace `instruction-checks` and `instruction-refs` with one `instructions` command that runs `npm run validate:instruction-checks` once. Both share the same underlying script. The consolidated command must carry the **union** of the original globs: `**/*.instructions.md` (from `instruction-checks`) **and** `{.github/agents/**,.github/skills/**,.github/instructions/**}` (from `instruction-refs`). Without the broader glob, cross-reference validation for agent/skill files will silently stop triggering at pre-commit.
- Preserve meaningful `fail_text` on each consolidated command listing all dimensions checked (frontmatter, model alignment, body size, language density for agents; frontmatter, cross-references for instructions).

### 1.2 Enable parallel pre-commit

- Change `pre-commit.parallel: false` to `pre-commit.parallel: true` (flipping an explicit `false`, not just setting a default).
- Verify `markdown-lint` is the only `stage_fixed: true` command and its `*.md` glob does not overlap with terraform/python/bicep linters.
- **Guard**: Add a comment in `lefthook.yml` above the `parallel: true` line: `# SAFETY: parallel is safe only while markdown-lint is the sole stage_fixed command. Adding another auto-fixer requires switching back to parallel: false or adding explicit file-lock coordination.`

### 1.3 Add gitleaks pre-commit guard

Add a new `pre-commit` command `secrets-baseline`.

**Note:** This command intentionally omits a `glob:` key — unlike other pre-commit commands that are file-type-scoped, secrets can appear in any file type. The `--staged` flag on `gitleaks protect` already limits scope to staged files.

```yaml
secrets-baseline:
  run: |
    if command -v gitleaks &>/dev/null; then
      gitleaks protect --staged --redact --no-banner
    else
      echo "⚠️  gitleaks not installed — skipping secret scan (CI will enforce)"
    fi
  fail_text: |
    ❌ Secrets detected in staged files!
    🔧 Remove secrets before committing. See AGENTS.md for gitleaks setup.
```

### 1.3a Add `.gitleaksignore` for test fixtures

Create `.gitleaksignore` at the repo root to allowlist known test fixtures that contain dummy secret patterns:

```text
# Test fixtures with intentional dummy secrets (not real credentials)
tools/tests/test-hooks.sh
tools/tests/bats/secrets-scanner.bats
```

Without this file, `gitleaks protect --staged` will flag `AKIAIOSFODNN7EXAMPLE` and similar dummy patterns used in hook test cases, breaking every pre-commit run.

### 1.4 Remove post-commit section

Delete the entire `post-commit:` section from `lefthook.yml`.

### 1.5 Extend pre-push with migrated checks

Add the following to `tools/scripts/diff-based-push-check.sh`:

- `version-sync` — run `npm run lint:version-sync` unconditionally (not file-type-scoped).
- `deprecated-refs` — run `npm run lint:deprecated-refs` unconditionally.
- `terminology` — run `npm run validate:terminology` unconditionally.

These three are not file-type-scoped like the existing checks; add them as unconditional steps that always run on push.

Do **not** add `json-syntax` — `npm run lint:json` already runs for changed JSON files in the existing file-type-scoped block.

**Double-run note:** `lint:version-sync` and `lint:deprecated-refs` already run in `validate:_node` (local full suite) and `validate:_node-ci` (CI). Adding them to `diff-based-push-check.sh` means they run **twice** during local `git push` (once via the script, once as part of `validate:all` if the developer runs it separately). This is acceptable — pre-push is the git-hook safety net, while `validate:all` is the explicit developer command. They do **not** double-run in CI because the CI workflow uses `validate:_node-ci` directly, not lefthook's pre-push.

### 1.6 Keep pre-push block lean

The `pre-push` lefthook block retains: `branch-naming`, `branch-scope`, `diff-based-check`. No new lefthook commands — the three migrated checks run inside `diff-based-push-check.sh`.

### 1.7 Update AGENTS.md

- Add gitleaks as a prerequisite in the Build & Validation section.
- Document the local soft-skip / CI hard-fail behavior.

**Commit**: `refactor(lefthook): consolidate validators, parallel, drop post-commit, add gitleaks`

---

## Phase 2 — Merge session telemetry hooks

**Files**:

- new `.github/hooks/session-telemetry/hooks.json`
- new `.github/hooks/session-telemetry/session-start.sh`
- new `.github/hooks/session-telemetry/prompt-submit.sh`
- new `.github/hooks/session-telemetry/session-end.sh`
- `.vscode/settings.json`
- `.devcontainer/devcontainer.json`
- `tools/tests/test-hooks.sh`
- `tools/scripts/validate-hooks.mjs`
- delete `.github/hooks/governance-audit/`
- delete `.github/hooks/session-logger/`

### 2.1 Create session-telemetry hook directory

Create `.github/hooks/session-telemetry/hooks.json` with three event entries:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bash .github/hooks/session-telemetry/session-start.sh",
        "timeout": 5
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "bash .github/hooks/session-telemetry/prompt-submit.sh",
        "timeout": 10
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "bash .github/hooks/session-telemetry/session-end.sh",
        "timeout": 5
      }
    ]
  }
}
```

### 2.2 Implement merged scripts

**`session-start.sh`** — merge of `audit-session-start.sh` + `log-session-start.sh`:

- Check `SKIP_SESSION_TELEMETRY` first (umbrella kill switch).
- Check `SKIP_GOVERNANCE_AUDIT` and `SKIP_LOGGING` independently.
- Read stdin once (`INPUT=$(cat)`).
- Write governance log to `logs/copilot/governance/audit.log` (unless governance skipped).
- Write session log to `logs/copilot/session.log` (unless logging skipped).
- Emit one `systemMessage` for context injection (project step, subscription, branch). The `systemMessage` is always emitted regardless of which individual flags are set — it is the hook's primary contribution to the agent session. When `SKIP_GOVERNANCE_AUDIT` is set, governance log writes are skipped but the `systemMessage` still fires. When `SKIP_LOGGING` is set, session log writes are skipped but the `systemMessage` still fires. Only `SKIP_SESSION_TELEMETRY` suppresses everything including the `systemMessage`.
- Document env precedence in script header comment.

**`prompt-submit.sh`** — merge of `audit-prompt.sh` + `log-prompt.sh`:

- Same umbrella/individual skip logic.
- Run threat pattern detection (from `audit-prompt.sh`).
- Log prompt event to `logs/copilot/prompts.log`.
- Log governance event to `logs/copilot/governance/audit.log`.

**`session-end.sh`** — merge of `audit-session-end.sh` + `log-session-end.sh`:

- Same umbrella/individual skip logic.
- Add `stop_hook_active` check: if stdin JSON contains `"stop_hook_active": true`, return immediately with `{"continue": true}` to prevent infinite re-invocation. This implements the safety behavior described in docs but never previously coded.
- Count session events and threat stats from governance log.
- Write session end entries to both logs.

### 2.3 Update both settings sources in lockstep

Update `chat.hookFilesLocations` in **both** files simultaneously:

- `.vscode/settings.json`
- `.devcontainer/devcontainer.json`

Remove `session-logger` and `governance-audit` entries. Add `session-telemetry`.

Phase 2 intermediate `chat.hookFilesLocations` block (4 entries — `tool-audit` is added in Phase 3):

```json
{
  ".github/hooks/tool-guardian": true,
  ".github/hooks/secrets-scanner": true,
  ".github/hooks/session-telemetry": true,
  ".github/hooks/subagent-validation": true
}
```

The final 5-entry block (after Phase 3 adds `tool-audit`) is:

```json
{
  ".github/hooks/tool-guardian": true,
  ".github/hooks/secrets-scanner": true,
  ".github/hooks/session-telemetry": true,
  ".github/hooks/subagent-validation": true,
  ".github/hooks/tool-audit": true
}
```

### 2.4 Extend validate-hooks.mjs

Add a cross-check against `.devcontainer/devcontainer.json` in addition to the existing `.vscode/settings.json` check. The validator currently only checks `.vscode/settings.json` — stale entries in `devcontainer.json` would go undetected. Parse `customizations.vscode.settings["chat.hookFilesLocations"]` and validate the same way.

**Important:** `devcontainer.json` is JSONC (JSON with Comments). The validator must use the existing `parseJsonc` helper (from `_lib/parse-jsonc.mjs`) — not raw `JSON.parse`, which will fail on comment syntax.

### 2.5 Rewrite test-hooks.sh paths (keep tests green)

In the same commit, update the **10** test cases in `tools/tests/test-hooks.sh` that reference `governance-audit/` and `session-logger/` paths (6 under `session-logger/` + 4 under `governance-audit/`) to point at the new `session-telemetry/` scripts. This keeps intermediate commits green before the bats migration in Phase 4.

**Note:** This path-rewrite is intentionally throw-away work — Phase 4 replaces `test-hooks.sh` with a thin bats wrapper. The intermediate rewrite is needed so that every commit in the PR keeps tests green.

Mapping:
| Old path | New path |
|---|---|
| `session-logger/log-session-start.sh` | `session-telemetry/session-start.sh` |
| `session-logger/log-session-end.sh` | `session-telemetry/session-end.sh` |
| `session-logger/log-prompt.sh` | `session-telemetry/prompt-submit.sh` |
| `governance-audit/audit-session-start.sh` | `session-telemetry/session-start.sh` |
| `governance-audit/audit-session-end.sh` | `session-telemetry/session-end.sh` |
| `governance-audit/audit-prompt.sh` | `session-telemetry/prompt-submit.sh` |

### 2.6 Delete old directories

Remove `.github/hooks/governance-audit/` and `.github/hooks/session-logger/` only after the new directory, settings updates, and test rewrites are in place.

### 2.7 Preserve log file paths

No changes to log output locations:

- `logs/copilot/governance/audit.log`
- `logs/copilot/session.log`
- `logs/copilot/prompts.log`

**Commit**: `refactor(hooks): merge session telemetry hooks`

---

## Phase 3 — Add PostToolUse audit hook

**Files**:

- new `.github/hooks/tool-audit/hooks.json`
- new `.github/hooks/tool-audit/tool-audit.sh`
- `.vscode/settings.json`
- `.devcontainer/devcontainer.json`

### 3.1 Create hook directory

Create `.github/hooks/tool-audit/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "command",
        "command": "bash .github/hooks/tool-audit/tool-audit.sh",
        "timeout": 5
      }
    ]
  }
}
```

### 3.2 Implement tool-audit.sh

- Read stdin JSON. If stdin is empty or not valid JSON, log a fallback entry with `"tool_name": "unknown"` and `"error": "invalid_stdin"` — do **not** fail or return a non-zero exit code.
- Extract `tool_name` and success/failure state if present.
- Do **not** extract `duration_ms` (not available in PostToolUse stdin), tool input, or tool output.
- Append a single JSON line to `logs/copilot/tool-audit.log`.
- Always return `{"continue": true}`.

### 3.3 Register in settings

Add `.github/hooks/tool-audit` to `chat.hookFilesLocations` in both:

- `.vscode/settings.json`
- `.devcontainer/devcontainer.json`

### 3.4 Document log growth

Add an operational note in the hooks guide about `tool-audit.log` growth. Do not add logrotate infrastructure in this phase.

### 3.5 Register new log path

The new log file `logs/copilot/tool-audit.log` joins the existing set of preserved log paths. The complete set after this phase:

- `logs/copilot/governance/audit.log`
- `logs/copilot/session.log`
- `logs/copilot/prompts.log`
- `logs/copilot/tool-audit.log` _(new)_

**Commit**: `feat(hooks): add post-tool audit hook`

---

## Phase 4 — Install bats and build permanent hook test suite

**Files**:

- `.devcontainer/devcontainer.json`
- `tools/tests/test-hooks.sh`
- new `tools/tests/bats/setup.bash`
- new `tools/tests/bats/session-telemetry-start.bats`
- new `tools/tests/bats/session-telemetry-prompt.bats`
- new `tools/tests/bats/session-telemetry-end.bats`
- new `tools/tests/bats/tool-guardian.bats`
- new `tools/tests/bats/secrets-scanner.bats`
- new `tools/tests/bats/subagent-validation.bats`
- new `tools/tests/bats/tool-audit.bats`
- new `tools/tests/bats/lefthook-config.bats`

### 4.1 Install bats

Add `bats` to the dev container `onCreateCommand` via `sudo apt-get install -y bats`, alongside the existing `graphviz` and `dos2unix` installations on line 39 of `.devcontainer/devcontainer.json`.

Do **not** add `bats` as an npm devDependency. `bats-core` is a system binary — `npx bats` does not work.

### 4.2 Create bats test structure

**`tools/tests/bats/setup.bash`** — common helpers:

- Mock JSON builders for hook stdin input.
- `assert_json_valid` helper (validates output is parseable JSON).
- Temp log directory setup/teardown.

**One `.bats` file per hook area:**

| Test file                       | Coverage                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-telemetry-start.bats`  | Env skip (`SKIP_SESSION_TELEMETRY`, individual flags), jq present/absent fallback, session-state parsing, no `az` CLI graceful path                                                                              |
| `session-telemetry-prompt.bats` | Clean prompt passthrough, threat detection per category (`data_exfil`, `prompt_injection`, `privilege_escalation`, `system_destruction`, `credential_exposure`), `BLOCK_ON_THREAT` strict mode exit 1, allowlist |
| `session-telemetry-end.bats`    | Event counting from session start, `stop_hook_active` infinite-loop prevention, no log file edge case                                                                                                            |
| `tool-guardian.bats`            | Destructive patterns (`rm -rf /`, `git push -f main`, `terraform destroy`, `drop table`), allowlist, hook self-modification block (`replace_string_in_file` on `.github/hooks/`), warn vs block mode             |
| `secrets-scanner.bats`          | AWS key, GitHub PAT, private key block, allowlist, placeholder skip, binary file skip, no-git-repo skip                                                                                                          |
| `subagent-validation.bats`      | Challenger valid JSON, challenger missing findings, challenger invalid JSON, codegen empty output, generic short output, normal passthrough                                                                      |
| `tool-audit.bats`               | Log line shape, missing fields default, always continue                                                                                                                                                          |
| `lefthook-config.bats`          | Parses `lefthook.yml`, asserts: no `post-commit` block, `pre-commit.parallel: true`, all referenced npm scripts exist in `package.json`                                                                          |

### 4.3 Update test wrapper

Replace the contents of `tools/tests/test-hooks.sh` (∼250 lines) with a thin wrapper that invokes `bats tools/tests/bats/` directly (not via `npx`). All existing test logic migrates into the `.bats` files above.

**Note:** The Phase 2 path-rewrite of this file (§2.5) is intentionally throw-away work — it exists only to keep intermediate commits green. This phase replaces the entire file.

### 4.4 Keep package.json minimal

Retain `test:hooks` script. Update its value only if needed to match the wrapper. Do **not** add a `bats` npm dependency.

**Commit**: `test(hooks): install bats and migrate hook tests`

---

## Phase 5 — CI enforcement

**Files**: `.github/workflows/ci.yml`

### 5.1 Install bats in CI

Add a workflow step: `sudo apt-get install -y bats`. This step **must** appear before the `npm run test:hooks` step in the workflow YAML — bats is not pre-installed on `ubuntu-latest`.

### 5.2 Add gitleaks enforcement

Add gitleaks using `gitleaks/gitleaks-action@v2`. This is a hard failure in CI (unlike the local soft-skip).

Requirements:

- The action requires `GITHUB_TOKEN` (usually available as `${{ secrets.GITHUB_TOKEN }}`).
- The `.gitleaksignore` file created in Phase 1 (§1.3a) must be present to suppress false positives from test fixtures containing dummy secret patterns.
- Consider using `--baseline-path` if the action flags secrets in historical commits. For a greenfield run, the `--staged` / PR-diff scope should be sufficient.

### 5.3 Add hook validation and test steps

Add explicit CI steps for:

- `npm run validate:hooks`
- `npm run test:hooks`

### 5.4 Keep existing structure

Keep `npm run validate:_node-ci` unless there is a separate reason to restructure CI scope.

### 5.5 Checkout depth

If pre-push or diff-based validation depends on remote history, ensure `actions/checkout` uses sufficient `fetch-depth` (may need `fetch-depth: 0`).

**Commit**: `ci(hooks): enforce gitleaks and hook validation`

---

## Phase 6 — Docs alignment

**Files**:

- `site/src/content/docs/guides/hooks.md`
- `site/src/content/docs/concepts/how-it-works/workflow-engine.md`
- `.github/skills/copilot-customization/references/hooks.md`
- `AGENTS.md`
- `CHANGELOG.md`

### 6.1 Update hook inventory tables

All hook inventory tables must reflect the final 5-directory set:

| Hook Directory         | Event(s)                             | Purpose                                               | Timeout |
| :--------------------- | :----------------------------------- | :---------------------------------------------------- | ------: |
| `secrets-scanner/`     | Stop                                 | Scan for leaked secrets at session end                |     30s |
| `session-telemetry/`   | SessionStart, Stop, UserPromptSubmit | Merged session lifecycle logging and governance audit |   5–10s |
| `subagent-validation/` | SubagentStop                         | Validate subagent output quality (advisory)           |     15s |
| `tool-audit/`          | PostToolUse                          | Log tool usage metadata (name, status)                |      5s |
| `tool-guardian/`       | PreToolUse                           | Block dangerous terminal commands                     |     10s |

**Timeout note:** The `session-telemetry/` `Stop` handler timeout remains at 5s (inherited from the original `session-logger`). After the merge, `session-end.sh` also counts events from the governance log — on a large log file this could approach the timeout. Monitor during Phase 7 smoke testing and increase to 10s if needed.

Update this table in:

- `site/src/content/docs/guides/hooks.md`
- `site/src/content/docs/concepts/how-it-works/workflow-engine.md`
- `.github/skills/copilot-customization/references/hooks.md`

### 6.2 Normalize event name casing

Normalize all event name references to **PascalCase** (matches `hooks.json` files and `validate-hooks.mjs` VALID_EVENTS set):

- `PreToolUse` (not `preToolUse`)
- `PostToolUse` (not `postToolUse`)
- `SessionStart` (not `sessionStart`)
- `Stop` (not `sessionEnd`)
- `UserPromptSubmit` (not `userPromptSubmitted`)
- `SubagentStop` (not `subagentStop`)

This applies especially to the **inventory table** in `.github/skills/copilot-customization/references/hooks.md` (lines 37–40), which currently uses camelCase (`preToolUse`, `sessionStart`, `sessionEnd`, `userPromptSubmitted`). The file's prose at line 25 already uses correct PascalCase.

### 6.3 Fix stale infinite-loop section

Fix the `site/src/content/docs/guides/hooks.md` line 91 reference to `session-report.sh` and `stop_hook_active`. Neither existed in the codebase before this work. Update to reference the actual implementation in `session-telemetry/session-end.sh` which now implements the `stop_hook_active` check (added in Phase 2).

**Dependency note:** This fix describes Phase 2 code as if it already exists. Since Phase 2 precedes Phase 6 in commit order, the forward-reference is safe — by the time Phase 6 commits, the `session-end.sh` implementation is already in the tree.

### 6.4 Update workflow-engine docs

Update `site/src/content/docs/concepts/how-it-works/workflow-engine.md` lines 242–243 to replace `session-logger` and `governance-audit` with `session-telemetry`.

### 6.5 Document two-layer secrets model

Add a section to the hooks guide explaining the defense-in-depth approach:

- **Layer 1**: `gitleaks` at pre-commit (blocks known secret patterns in staged files).
- **Layer 2**: Regex scanner at session end via `secrets-scanner/scan-secrets.sh` (catches in-session writes not yet staged).

### 6.6 Add changelog entry

Add a changelog entry summarizing the hook consolidation under the next version.

**Commit**: `docs(hooks): align inventory, safety notes, and changelog`

---

## Phase 7 — Final validation and smoke testing

### 7.1 Automated validation

```bash
npm run validate:hooks    # Must exit 0
npm run test:hooks        # All bats tests pass
npm run validate:all      # Full suite passes
```

### 7.2 Performance comparison

Run `tools/scripts/bench-hooks.sh` again and save to `logs/hooks-bench/after.json`.

Compare before vs after with event-specific targets. These targets are **conditional on the Phase 0 baseline** — if a hook is already very fast (e.g., <200ms), a 30% improvement is in the noise and should not be treated as a hard gate. Treat the targets below as expectations for hooks with non-trivial baseline latency (>500ms):

| Event                                             | Target                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `SessionStart`                                    | ≥ 30% faster                                                                      |
| `UserPromptSubmit`                                | ≥ 30% faster                                                                      |
| `Stop`                                            | ≥ 10% faster (secrets-scanner dominates; telemetry merge saves ~5s on ~35s total) |
| `pre-commit` on multi-domain synthetic change set | ≥ 20% faster                                                                      |

### 7.3 Manual smoke tests

| Test                 | Action                                                                                | Expected                                                       |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Context injection    | Start a Copilot session in dev container                                              | Only **one** context-injection message appears (not two)       |
| Governance threat    | Submit prompt containing `ignore previous instructions`                               | Governance event logged in `logs/copilot/governance/audit.log` |
| Tool guardian        | Request agent run `rm -rf /`                                                          | Blocked, deny decision returned                                |
| Hook registration    | Open settings from both `.vscode/settings.json` and `.devcontainer/devcontainer.json` | Both register same 5 hook directories                          |
| Gitleaks pre-commit  | Stage a file containing `AKIAIOSFODNN7EXAMPLE` and commit                             | Blocked at pre-commit                                          |
| Secrets Stop scanner | Write `AKIAIOSFODNN7EXAMPLE` in workspace file, end session                           | Logged in `logs/copilot/secrets/scan.log`                      |

---

## Verification matrix

| Verification                | Command or action                                           | Pass criteria                                                                     |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Hook schema validation      | `npm run validate:hooks`                                    | Exits 0; all 5 dirs detected; both settings files checked                         |
| Hook tests                  | `npm run test:hooks`                                        | All bats tests pass                                                               |
| Full repo validation        | `npm run validate:all`                                      | Exits 0                                                                           |
| Pre-commit dry run          | `lefthook run pre-commit --files <synthetic set>`           | Parallel execution, no race issues                                                |
| Pre-push validation         | `bash tools/scripts/diff-based-push-check.sh`               | `version-sync`, `deprecated-refs`, `terminology` all run; no duplicate JSON check |
| CI parity                   | GitHub Actions `ci` workflow                                | Includes gitleaks, `validate:hooks`, `test:hooks`                                 |
| Governance smoke test       | Prompt containing `ignore previous instructions`            | Governance event logged                                                           |
| Tool guardian smoke test    | Blocked destructive tool request                            | Deny decision returned                                                            |
| Self-mod block smoke test   | Request edit to `.github/hooks/tool-guardian/guard-tool.sh` | Blocked                                                                           |
| Secrets gitleaks smoke test | Staged secret-like token before commit                      | Blocked at pre-commit                                                             |
| Secrets Stop smoke test     | Secret-like content left in workspace file                  | Logged by session-end scanner                                                     |
| Perf comparison             | `tools/scripts/bench-hooks.sh` before vs after              | Meets event-specific targets                                                      |

---

## Commit plan

One PR with these commits in order:

| #   | Commit message                                                                         | Phase   |
| --- | -------------------------------------------------------------------------------------- | ------- |
| 1   | `chore(hooks): add benchmark harness and branch baseline`                              | Phase 0 |
| 2   | `refactor(lefthook): consolidate validators, parallel, drop post-commit, add gitleaks` | Phase 1 |
| 3   | `refactor(hooks): merge session telemetry hooks`                                       | Phase 2 |
| 4   | `feat(hooks): add post-tool audit hook`                                                | Phase 3 |
| 5   | `test(hooks): install bats and migrate hook tests`                                     | Phase 4 |
| 6   | `ci(hooks): enforce gitleaks and hook validation`                                      | Phase 5 |
| 7   | `docs(hooks): align inventory, safety notes, and changelog`                            | Phase 6 |

Phase 7 is validation — no commit, results embedded in PR description.

---

## Rollback

If the merged PR must be backed out, use `git revert <merge-sha>`. That restores the deleted hook directories and associated settings cleanly without requiring manual reconstruction.

**Squash-merge caveat:** If this PR is squash-merged (the GitHub default for many repos), revert the single squash commit. If it is merge-committed (`--no-ff`), revert the merge commit with `-m 1` to specify the mainline parent. In either case, `git revert` restores deleted files correctly. Verify after revert that `.github/hooks/governance-audit/` and `.github/hooks/session-logger/` are restored and `chat.hookFilesLocations` points to the original 5 directories.

---

## Scope boundaries

**Included**:

- Hook consolidation (merge `governance-audit/` + `session-logger/` → `session-telemetry/`)
- Lefthook consolidation (deduplicate validators, enable parallel, drop post-commit)
- Pre-commit gitleaks guard (local soft-skip, CI hard-fail)
- Session-end regex secret scanning retained
- PostToolUse audit hook (metadata only)
- Hook tests (bats-based)
- Hook docs and CI alignment
- Extend `validate-hooks.mjs` to cross-check `devcontainer.json`

**Excluded**:

- Replacing the regex secret scanner with another scanner
- Rewriting `tool-guardian` threat patterns
- Adding agent-scoped frontmatter hooks to `.agent.md` files
- Capturing tool payload content or timing in the audit hook
- Adding log rotation infrastructure beyond documentation notes

---

## Residual risks

| #   | Risk                                                                                                    | Mitigation                                                                          |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `pre-commit.parallel: true` could race if a future command also uses `stage_fixed: true` on `.md` files | `markdown-lint` is the only auto-fixer today; document the constraint               |
| 2   | Hook behavior is subject to VS Code Preview feature changes                                             | Pin to documented stable invariants; test via bats                                  |
| 3   | External log consumers may rely on current file paths                                                   | Log path preservation is non-negotiable in this change set                          |
| 4   | CI and dev container can diverge if lifecycle and workflow installs drift                               | Both install bats and gitleaks; `validate-hooks.mjs` now checks both settings files |
| 5   | `version-sync`, `deprecated-refs`, `terminology` are unconditional in pre-push (not file-scoped)        | Acceptable — they are fast validators and only run on push, not commit              |

---

## Files changed summary

| File                                                             | Action                                                                              | Phase      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| `tools/scripts/bench-hooks.sh`                                   | **Create**                                                                          | 0          |
| `logs/hooks-bench/before.json`                                   | **Create**                                                                          | 0          |
| `lefthook.yml`                                                   | **Edit** — consolidate commands, parallel, drop post-commit, add gitleaks           | 1          |
| `.gitleaksignore`                                                | **Create** — allowlist test fixtures with dummy secrets                             | 1          |
| `tools/scripts/diff-based-push-check.sh`                         | **Edit** — add version-sync, deprecated-refs, terminology                           | 1          |
| `AGENTS.md`                                                      | **Edit** — gitleaks prereq                                                          | 1, 6       |
| `.github/hooks/session-telemetry/hooks.json`                     | **Create**                                                                          | 2          |
| `.github/hooks/session-telemetry/session-start.sh`               | **Create**                                                                          | 2          |
| `.github/hooks/session-telemetry/prompt-submit.sh`               | **Create**                                                                          | 2          |
| `.github/hooks/session-telemetry/session-end.sh`                 | **Create**                                                                          | 2          |
| `.vscode/settings.json`                                          | **Edit** — update `chat.hookFilesLocations`                                         | 2, 3       |
| `.devcontainer/devcontainer.json`                                | **Edit** — add gitleaks feature, update `chat.hookFilesLocations`, add bats install | 1, 2, 3, 4 |
| `tools/tests/test-hooks.sh`                                      | **Edit** — rewrite paths (Phase 2), then replace with bats wrapper (Phase 4)        | 2, 4       |
| `tools/scripts/validate-hooks.mjs`                               | **Edit** — add devcontainer.json cross-check                                        | 2          |
| `.github/hooks/governance-audit/`                                | **Delete**                                                                          | 2          |
| `.github/hooks/session-logger/`                                  | **Delete**                                                                          | 2          |
| `.github/hooks/tool-audit/hooks.json`                            | **Create**                                                                          | 3          |
| `.github/hooks/tool-audit/tool-audit.sh`                         | **Create**                                                                          | 3          |
| `tools/tests/bats/setup.bash`                                    | **Create**                                                                          | 4          |
| `tools/tests/bats/*.bats` (8 files)                              | **Create**                                                                          | 4          |
| `.github/workflows/ci.yml`                                       | **Edit** — add bats install, gitleaks, hook validation + tests                      | 5          |
| `site/src/content/docs/guides/hooks.md`                          | **Edit** — new inventory, fix infinite-loop section, two-layer secrets docs         | 6          |
| `site/src/content/docs/concepts/how-it-works/workflow-engine.md` | **Edit** — update hooks table                                                       | 6          |
| `.github/skills/copilot-customization/references/hooks.md`       | **Edit** — sync inventory, normalize event casing                                   | 6          |
| `CHANGELOG.md`                                                   | **Edit** — add entry                                                                | 6          |
| `logs/hooks-bench/after.json`                                    | **Create**                                                                          | 7          |
