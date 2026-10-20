# Development Container for APEX

> **[Version](../VERSION.md)**

This devcontainer defines the complete development toolchain for APEX on Azure Linux 4.
Azure Linux 4 preview is intentionally accepted. The native ARM64 image builds and required CLIs pass
startup checks as `vscode`. Native AMD64 builds and post-rebuild manual acceptance remain pending.

**Base image:** `mcr.microsoft.com/azurelinux-beta/base/core:4.0` (`amd64` and `arm64`), pinned to the
manifest-index digest in [Dockerfile](Dockerfile).
The verified index is `sha256:63ef5dda2fb5681ae3aa5c9597a8c4b24364da91ec459b419fa3c38160595fae`.
The image reports `ID=azurelinux`, `ID_LIKE=fedora`, and `VERSION_ID=4.0`; its native package manager is DNF 5.

### Version Selection

Retained tooling was resolved against publisher metadata on 2026-10-20 and pinned for reproducible builds.
Node uses stable Current rather than LTS. Python uses 3.15.0 while the package compatibility floor and Ruff
syntax target remain 3.14; the existing CI lane is retained and a current-Python lane is added.
Unsuccessful native builds or compatibility tests must not silently downgrade these selections.
Native packages use the latest versions available from the configured Azure Linux repositories.
Direct selections are pinned; repository-resolved native packages and transitive dependencies do not make
the entire image bit-for-bit reproducible.

The npm registry's `latest` tag is not sufficient evidence of stability: Azure MCP's tag currently selects
a prerelease, while the highest stable version from the configured feed remains 3.0.0.
Official npm registry access was TLS-blocked during this execution; feed freshness against upstream is unverified.

## What's Included

### Devcontainer Features (installed via `devcontainer.json`)

| Feature                   | Version | Purpose                           |
| ------------------------- | ------- | --------------------------------- |
| Azure CLI (local Feature) | 2.91.0  | Isolated Python environment; no APT/dpkg dependency |
| PowerShell                | 7.6.7   | Scripting and pinned analysis tooling |
| Python (local Feature) | 3.15.0 / pip 26.2.1 | Isolated project environment; existing minimum remains supported |
| Node.js                   | 26.12.0 | Stable Current for validation and MCP |

The upstream Azure CLI, GitHub CLI, and azd Features invoke Debian tooling, so they are not used on this base.
Azure CLI is installed by a local Feature after Python, in `/opt/azure-cli`, with a standalone `az` symlink.
GitHub CLI, Terraform, Bicep, and azd are verified standalone build-time binaries.
The upstream azd Feature can report success after failing to install on this base; the standalone installer
fails closed on download, checksum, extraction, or installation errors instead.
The upstream Python Feature uses DNF 4 options, so the local Python Feature uses checksum-verified uv's
managed interpreter and a separate writable environment at `/usr/local/python/current`.
It does not modify the managed base or bypass its `EXTERNALLY-MANAGED` marker.
Retained upstream Features passed a native ARM64 build; AMD64 verification remains pending.
The Feature lock pins wrapper artifacts,
not every runtime dependency.

### Tools Installed by `post-create.sh`

| Step | Setup                          | Method                                                        |
| ---- | ------------------------------ | ------------------------------------------------------------- |
| 1    | Mounted directories            | Ensure uv, gh config, and Terraform cache directories are writable |
| 2    | npm and workspace dependencies | Ensure npm 12.2.0, then `npm ci` from `package-lock.json`       |
| 3    | Python and apex-recall         | One `uv pip install --python` into the writable project environment; import and CLI verification |
| 4    | PowerShell analysis | `npm run setup:powershell` for the pinned analyzer; no unused Az module bundle |
| 5    | Build tools and Terraform      | Check gitleaks, uv, and Terraform versions                     |
| 6    | Azure CLI and Bicep            | Stable extension auto-install, disable CLI auto-upgrade, check Bicep with fallback install |
| 7    | MCP defaults and tool versions | Add missing defaults via JSONC edits; run tool-version validation |

Required setup errors stop the script with a nonzero exit. PowerShell and PSScriptAnalyzer remain required;
Az.Accounts, Az.Resources, Az.Storage, Az.Network, Az.KeyVault, and Az.Websites are no longer preinstalled.
Maintained Azure scripts use Azure CLI/REST. Install a particular Az module only for an actual local consumer.
Setup does not change global Git settings or credentials.

PowerShell analysis uses the exact PSScriptAnalyzer version in
[`requirements.psd1`](../tools/powershell/requirements.psd1), installed from PSGallery in `CurrentUser` scope.
It does not change repository trust or require root. Run `npm run setup:powershell` to provision it manually,
then `npm run lint:powershell` and `npm run test:powershell`. Missing PowerShell or the pinned analyzer fails closed.
The checker only parses/analyzes maintained sources; it never executes Azure or Kubernetes collection scripts.
Installation requires HTTPS access to PowerShell Gallery; analysis is offline once the module is installed.
On corporate dev boxes, the verified CFS PowerShell endpoint is
`https://packagefeedproxy.microsoft.io/powershell/v2`. Configure an approved source before provisioning:
the repository name `PSGallery` alone does not establish CFS routing. Analyzer 1.25.0 was successfully
provisioned through this proxy after verifying its publication date against the seven-day minimum.

### Build-Time Tools (installed via `Dockerfile`)

DNF installs retained native utilities, Graphviz, Bats, archive/checksum tools, Git/SSH, runtime libraries,
and user-management prerequisites. `dos2unix` was removed because no active conversion task required it.
The base's `coreutils-single` is retained because installing the conflicting `coreutils` package fails.
`diffutils` supplies `diff` for context-baseline comparisons; missing tools or comparison errors fail
explicitly instead of being reported as file changes.
`libatomic` supplies `libatomic.so.1`, required by the selected Node.js binary on ARM64.
The image explicitly creates `vscode` and noninteractive sudo, rather than inheriting them from an Ubuntu base.
Package-feed environment defaults live in the Dockerfile so local Feature builds and running containers
use the configured npm and Python feeds; runtime-only `containerEnv` does not configure Feature installation.

The default CFS proxy, `packagefeedproxy.microsoft.io`, is intended for corporate laptops and dev boxes,
not automated builds or CI. Those workloads require an authenticated, approved team-owned Azure Artifacts feed.
Keep package managers on the proxy or that approved feed; `ms-feed-*` links are for browsing/troubleshooting only.
Do not switch to public registries to work around quarantine or missing metadata.
Only install versions whose upstream artifacts are at least seven days old, including transitive and build
dependencies. Verify original publication dates separately: a mirror's upload timestamp can reflect later
ingestion, and feed availability alone does not establish artifact age.

Python setup retains Pillow 12.3.0 and Ruff 0.17.0 as the validated CFS-available pins.
Do not replace them with newer releases until both the seven-day minimum and CFS availability are verified.

| Standalone tool | Selected version |
| --- | --- |
| uv / uvx | 0.13.3 |
| gitleaks | 8.30.1 |
| Terraform | 1.16.6 |
| GitHub CLI | 2.102.0 |
| Bicep | 0.48.1 |
| Azure Developer CLI (azd) | 1.36.0 |

Artifacts for both architectures are SHA-256 verified using [the download manifest](download-checksums.json).
Terraform's checksum-file signature was verified against the HashiCorp public key with primary fingerprint
`C874011F0AB405110D02105534365D9472D7468F`. Other recorded release digests are not described as independent signatures.
Terraform now has an explicit release pin rather than a floating APT package. Record publisher provenance and
review both architecture hashes whenever updating it. Existing minimum-version gates are not installation pins.
`update-tools.sh` restores Python requirements but does not upgrade standalone Bicep or other pinned binaries;
update the relevant pins, regenerate locks, and rebuild.

`post-create.sh` optionally installs azqr 4.2.2 to `~/.local/bin` from the same verified manifest.
If installation fails, setup reports whether another executable is usable; otherwise Quick Review is unavailable.
An unsuccessful CLI installation is not advertised as a CLI fallback.

### MCP Servers (auto-configured in `.mcp.json`)

| Server            | Transport         | Purpose                                          |
| ----------------- | ----------------- | ------------------------------------------------ |
| Azure Resource Manager MCP | http      | Azure cost management (retail pricing uses Azure MCP) |
| GitHub MCP        | http              | Copilot-provided GitHub context                  |
| Azure MCP Server  | stdio (`npx`)      | RBAC-aware Azure context for agents              |

Setup adds only missing default server entries. It preserves JSONC comments, custom arguments,
existing defaults, and custom or retired server entries. Malformed configuration fails setup and
is left untouched; setup does not perform automatic server migrations.

#### Azure MCP Runtime And Release Checks

Azure MCP uses an exact stable npm package version in the JSON configuration, with no editor-extension dependency.
The npm `latest` tag may point to a prerelease; it is not a stable-channel guarantee.
The server entry sets `NPM_CONFIG_ALLOW_REMOTE=all` for that child process only because npm 12 otherwise
rejects cross-host tarball URLs returned by the configured package feed. This permits any remote dependency URL
within that process, not a hostname allowlist. It does not change the registry or global npm settings.

`post-start.sh` runs the release check automatically on every container start, including the start after a rebuild.
It prints the result in the Dev Containers startup output. The registry request has a 30-second timeout;
outdated, offline, timeout or missing-dependency results produce a warning without blocking container startup.
No package installation, configuration rewrite, automatic upgrade or MCP restart happens in this hook.
An editor-window reload alone is not a container start. For a long-running container or to retry a warning, run:

```bash
npm run check:mcp-release
```

This read-only check queries the configured feed, selects the highest stable semantic version, and compares it
with both the workspace pin and the defaults in `configure-mcp.mjs`. It exits nonzero when an update is needed,
the pins differ, the package is not exactly pinned to a stable release, or metadata cannot be verified.
Feed lag remains possible; `CURRENT` means current according to that registry, not proof of upstream completeness.
The existing Weekly Maintenance workflow runs the same check on schedule and manual dispatch after publication
to the default branch. Monitor failed workflow notifications; it neither opens nor merges upgrade PRs automatically.

| Owner | When | Outcome |
| --- | --- | --- |
| Dev Containers `postStartCommand` | Every container start | Automatic advisory check; warnings keep the container usable |
| GitHub Actions Weekly Maintenance | Monday 06:00 UTC or manual dispatch | Failing job on outdated or unverifiable pins |
| Maintainer | After a warning or failed maintenance job | Review and validate the upgrade, then restart the MCP server |

For an upgrade, review release notes, update the package pin in `.mcp.json` and `configure-mcp.mjs` together,
then run `node --test tools/tests/scripts/test_devcontainer_setup.mjs` and `npm run lint:mcp-config`.
Restart Azure MCP from VS Code's `MCP: List Servers` command. Verify the reported runtime version, MCP initialization
and tool discovery before resuming APEX. Downloaded updates do not replace an already-running server.
Keep the previous pin available for rollback; do not auto-promote a beta or silently change versions during a workflow.

### VS Code Extensions

- **GitHub Copilot** — Copilot Chat
- **Python** — IntelliSense (Pylance), linting, debugging
- **Azure** — Bicep and Resource Groups explorer; Azure CLI and azd remain container tools
- **PowerShell** — language support
- **Markdown** — Native VS Code editing with Prettier formatting
- **GitHub** — Actions, Pull Requests
- **Terraform** — HashiCorp Terraform
- **Other** — YAML

#### Lean Extension Policy

Azure MCP runs directly from [the workspace MCP configuration](../.mcp.json), not an editor extension.
Keep GitHub Copilot Chat; GitHub Copilot for Azure is a separate, unwanted extension for this workflow.
The Azure Tools pack and Azure MCP Server extension bundle Azure Copilot. AI Toolkit adds another agent/skill
surface and depends on that MCP extension. Avoid those packages for the lean APEX setup.

Service-specific Azure explorers, Azure testing, and CLI/azd editor extensions are optional interfaces,
not prerequisites for the installed command-line tools. Removing them does not remove Azure CLI, azd,
Terraform, PowerShell, or the configured MCP servers. Keep the .NET runtime required by Bicep and the
Python debugger/environment tooling when using Python development features.

Workspace `unwantedRecommendations` discourage installation; they do not uninstall existing extensions
or override personal Settings Sync. The devcontainer also uses `-publisher.extension` entries to remove
the unwanted packages from the automatic container install list. `npm run validate:extension-bloat`
requires those exclusions and rejects direct additions, including version-pinned entries.
These exclusions are not an extension security policy and do not block manual or dependency-driven installs.

For an existing container, uninstall GitHub Copilot for Azure and AI Toolkit before uninstalling Azure MCP Server.
Remove the Azure Tools pack as well, retaining unrelated service explorers when offered the choice.
Reload the VS Code window, then use `MCP: List Servers` to verify that only the workspace Azure MCP provider remains.
Keep Azure Resource Manager MCP and Bicep MCP; they provide different capabilities.
If packages return, check the host/profile extensions and `dev.containers.defaultExtensions` for the Azure Tools pack
or its dependencies. Rebuild the container to apply changed devcontainer exclusions.
The extension validator guards repository declarations, not personal installations.

#### Further Setup Optimization

| Area | Implemented State / Remaining Work |
| ---- | ---------------------------------- |
| Required dependencies | Fail-fast npm, Python, and synchronous PowerShell setup |
| Python installation | Shared requirements and editable recall install, followed by verification |
| MCP configuration | Missing-default-only JSONC edits; existing entries preserved; malformed input fails untouched |
| Image layers | Azure Linux native prerequisites and checksum-verified standalone tools installed at build time |
| Cache persistence | Terraform provider volume added; uv volume retained |
| Additional caches | No new npm or PowerShell module volumes: measured value and portability remain unproven |
| Git authentication | Existing credentials preserved; optional token forwarding uses the VS Code host process |
| Validation and timing | Native ARM64 image build and non-root CLI smoke checks pass; cold/warm workspace setup and AMD64 verification remain pending |

Startup performs a bounded, read-only MCP release query; `post-start.sh` does no installs or upgrades.
No extension-removal token savings or rebuild-time improvement is claimed without measurements.

## Quick Start

### Prerequisites

- **Docker Desktop** installed and running
- **VS Code** with **Dev Containers** extension (`ms-vscode-remote.remote-containers`)
- **4 GB RAM** minimum allocated to Docker
- **10 GB disk space** for container image and tools

### Opening the Devcontainer

**Option 1: Command Palette** (recommended)

1. Open VS Code in this repository folder
2. Press `F1` or `Ctrl+Shift+P`
3. Type and select: `Dev Containers: Reopen in Container`
4. Wait for the image build and post-create setup to finish; cold-build time depends on downloads and host resources

**Option 2: Notification Prompt**

1. Open VS Code in this repository folder
2. Click "Reopen in Container" when prompted

### Manual Automated Acceptance After Rebuild

Rebuild first, wait for post-create to finish, and attach as `vscode`.
The full suite is not a lifecycle hook: the user starts it manually.
Run from the repository root with expected identity taken from the configured target, not copied from the
container being tested. Use a fresh output directory on every run.

For the selected native ARM64 build:

```bash
bash tools/scripts/validate-devcontainer.sh \
  --variant candidate \
  --expected-distro-id azurelinux \
  --expected-os 4.0 \
  --expected-arch arm64 \
  --expected-python-version 3.15.0 \
  --expected-node-version 26.12.0 \
  --output-dir "tmp/devcontainer-validation/manual-$(date -u +%Y%m%dT%H%M%SZ)-arm64"
```

For an intentionally built AMD64 container, use `--expected-arch amd64` and an `amd64` output-directory suffix.
The run produces `verdict.json`, `checks.tsv`, per-check logs, warnings, and setup-log evidence.
A zero exit status and fresh mandatory-check `PASS` verdict are required; report failures rather than deleting checks.
Test dependency/provider downloads require network access, but acceptance must not deploy resources or apply Terraform.
CI independently compares historical baseline/candidate environments on native architectures; do not fabricate
the other matrix legs from this local run. Readiness remains **awaiting manual acceptance** until results are inspected.

### Validation Limits and Rollback

The native ARM64 image build and non-root required-CLI smoke checks passed on 2026-10-20.
Cold/warm workspace setup, the complete native architecture matrix, and editor attachment remain unverified.
The Python 3.15 dependency installation now succeeds through CFS with the explicitly approved Pillow 12.3.0
and Ruff 0.17.0 fallback pins. Runtime, transitive and build dependency publication ages were verified against
the seven-day minimum. Rendering and recall regressions passed (385 passed, 5 skipped), along with lifecycle
contract tests (28 passed). The complete post-create lifecycle and non-Python tool ages have not been revalidated.
No TLS verification was disabled and no package-manager download bypassed CFS.

The Azure MCP pin remains 3.0.0, the highest stable version reported by the configured feed.
Fresh full tool-snapshot discovery was blocked by an authentication requirement; the existing same-version
snapshot was preserved and static references were checked. No Azure login or resource operation was performed.

The historical baseline is `c1755e12380a445fd7dd71330a3590d248436cc3`.
Before publication, keep that complete source environment available for comparison.
If rollback becomes necessary, restore the coherent Dockerfile, Features/lock, installers/manifests, lifecycle,
dependency selections, tests, and documentation through a reviewed change. Merely restoring Ubuntu's `FROM`
while retaining Azure Linux installation commands is not a rollback.
Do not delete credential/cache volumes or use destructive Git reset/force-push operations.

### First-Time Setup (inside container)

```bash
# 1. Authenticate with Azure
az login

# 2. Set your default subscription
az account set --subscription "<your-subscription-id>"

# 3. Start working
# Open Chat (Ctrl+Shift+I) → Select Orchestrator → Describe your project
```

## GitHub Authentication

Git normally uses credentials forwarded by VS Code Dev Containers from the host credential helper
or SSH agent. Git and the `gh` CLI can use different identities; successful Git access does not
establish a `gh` login.

For `gh`, use an explicitly authenticated configuration in the persistent `~/.config/gh` Docker
volume, or an optional host-process `GH_TOKEN`. If authentication is needed, the user chooses and
performs it, for example with `gh auth login`. Setup and agents must not run login automatically,
switch credentials, or persist Git credential-helper changes.

### Optional Host-Process Token

`remoteEnv.GH_TOKEN` uses `${localEnv:GH_TOKEN}`: the environment inherited by the **host VS Code process**
when it launches. Supply a token securely in that host environment before launching VS Code; an already
running VS Code process may need a full exit and relaunch before reopening the container.
After rotation, refresh that host environment and relaunch VS Code so the container receives the new value.

`terminal.integrated.env.*` applies only to integrated terminals. It does not populate `${localEnv:GH_TOKEN}`
and does not make a token available to all lifecycle hooks, MCP processes, or the extension host.
An export inside the container likewise does not change the host VS Code environment.

A fine-grained PAT is optional, not the only supported authentication method. Limit its repository access,
permissions, and lifetime to the intended operations; organization policies or approval may also apply.
An environment token takes precedence over stored `gh` credentials. Never put secrets in repository files,
paste them into chat, or ask an agent to receive or display them.

### Identity Mismatch on Git Push

When Git reports permission denied to an unexpected account, compare that identity with the CLI identity:

```bash
gh api user --jq .login
```

Check the target repository and branch as well. Do not automatically switch accounts or change persistent
Git configuration. If the user confirms the `gh` identity is the intended account and explicitly authorizes
using it for this push, use a per-command helper for the approved feature branch:

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin <approved-feature-branch>
```

Replace the branch placeholder before running. The empty helper clears inherited helpers for this invocation;
single quotes protect `!` from Bash history expansion. This does not change saved Git settings or authorize
a force push or a push to `main`. If the identities already match, investigate repository permissions or branch
protection instead of changing credentials.

## Environment Configuration

### Environment Variables

| Variable                  | Value                         | Purpose                                                  |
| ------------------------- | ----------------------------- | -------------------------------------------------------- |
| `AZURE_DEFAULTS_LOCATION` | `swedencentral`               | Default Azure region (EU GDPR-compliant)                 |
| `GH_TOKEN`                | `${localEnv:GH_TOKEN}`        | Optional token inherited by the host VS Code process     |
| `PYTHONDONTWRITEBYTECODE` | `1`                           | Skip `.pyc` generation                                   |
| `PYTHONUNBUFFERED`        | `1`                           | Unbuffered Python output                                 |
| `UV_CACHE_DIR`            | `~/.cache/uv`                 | uv package cache                                         |
| `TF_PLUGIN_CACHE_DIR`     | `~/.terraform.d/plugin-cache` | Terraform provider cache                                 |

### Azure CLI Extension Auto-Install

`post-create.sh` configures Azure CLI so extension-backed commands do not pause for prompts:

```bash
az config set extension.use_dynamic_install=yes_without_prompt
az config set extension.dynamic_install_allow_preview=false
```

Preview extensions remain opt-in. To auto-install preview extensions too, change
`extension.dynamic_install_allow_preview` to `true` in `~/.azure/config`.

## Lifecycle Scripts

### `onCreateCommand` — Azure CLI Smoke Check

Runs `az version --output none` once when the container is created and fails if Azure CLI is unusable.
System packages and standalone build tools are already installed in the image.

### `postCreateCommand` — `post-create.sh`

Runs once after container creation. Installs workspace dependencies and the analyzer, adds missing
MCP defaults, and verifies tools. Required failures stop setup. Output goes to stdout/stderr in the
Dev Containers creation log and `~/.devcontainer-install.log`. It does not launch the full acceptance suite.

### `postStartCommand` — `post-start.sh`

Runs on every container start without installing or upgrading dependencies:

| Check | Method |
| --- | --- |
| azd authentication | Read-only status check |

APEX agent runtime hooks are retired: container and workspace settings no longer register `.github/hooks/`.
No replacement tool-guardian or automatic post-subagent validator is installed.
Lefthook Git hooks, gitleaks and CI checks remain independent; they do not replace runtime tool interception.
Use `npm run test:git-hooks` for the retained Lefthook configuration tests and
`npm run validate:vscode` to check configuration, including retired hook registrations.

### When to Rebuild vs. Restart

| Situation                       | Action                                       |
| ------------------------------- | -------------------------------------------- |
| Workspace dependency setup failed | Resolve the reported error, then run `bash .devcontainer/post-create.sh` |
| Build-time tool missing or broken | Rebuild the container; post-create verifies but does not reinstall uv/gitleaks |
| New devcontainer feature needed | `F1` → Rebuild Container                     |
| OS-level or base image update   | `F1` → Rebuild Container Without Cache       |
| Dependency or tool update       | Update the relevant pins or lockfile, then rebuild the container |

## Troubleshooting

| Issue                      | Solution                                                 |
| -------------------------- | -------------------------------------------------------- |
| Container won't start      | Check Docker is running; increase memory to 4 GB+        |
| Workspace dependency missing | Resolve setup errors and rerun `bash .devcontainer/post-create.sh` |
| Python feed returns 404 or cannot find a pinned release | Check CFS availability/quarantine and artifact age; do not bypass the approved feed |
| uv or gitleaks missing     | Rebuild the image; check the build log and download manifest |
| Azure auth fails           | Use `az login --use-device-code`                         |
| `gh` CLI not authenticated | Explicitly authenticate `gh`, or supply optional host-process `GH_TOKEN` |
| Git and `gh` identities differ | Follow [Identity Mismatch on Git Push](#identity-mismatch-on-git-push) |
| Stale tool versions        | Review pins and locks before rebuilding; uv/gitleaks are not updated by the tool updater |
| Full rebuild needed        | `F1` → `Dev Containers: Rebuild Container Without Cache` |

If a build fails with `unsupported modifier (:P) in substitution`, check local Feature environment values.
Feature `containerEnv` becomes Dockerfile `ENV`, so extend the inherited path with `${PATH}`, not
`${containerEnv:PATH}`. The latter remains valid in `devcontainer.json`'s `remoteEnv`.

The acceptance evaluator keeps its validation variant separate from `/etc/os-release`'s `VARIANT` field,
so Azure Linux container-image metadata can be sourced without a readonly-variable collision.

Full troubleshooting guide: [Troubleshooting](https://apexops.pro/guides/troubleshooting/)

## Resource Usage

| Metric             | Value   |
| ------------------ | ------- |
| Container image    | Not measured for Azure Linux 4 |
| Memory (idle)      | Not measured |
| Memory (active)    | Not measured |
| Disk (with caches) | Not measured |

## Security Notes

- Azure credentials persist in the host `~/.azure/` bind mount; never commit credentials to Git
- Explicit `gh` authentication persists in its config volume; optional `GH_TOKEN` comes from the host process
- Never store tokens in repository files or send secrets through chat or model-visible tool input
- gitleaks runs as a pre-commit hook for secret scanning (soft-skips if not installed)
- Use Azure Key Vault for production secrets
- Use service principals for CI/CD environments

## Related Documentation

- [Workflow Guide](https://apexops.pro/concepts/workflow/)
- [Prompt Guide](https://apexops.pro/guides/prompt-guide/)
- [Troubleshooting](https://apexops.pro/guides/troubleshooting/)
- [Copilot Instructions](../.github/copilot-instructions.md)
- [Repository README](../README.md)
