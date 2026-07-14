---
name: "APEX npm feed setup"
description: "Configure, authenticate, and validate an Azure Artifacts npm feed without exposing credentials to chat or Git."
agent: agent
model: "MAI-Code-1-Flash"
argument-hint: "Optional credential-free registry URL or npmrc snippet. Never include a token or auth block."
tools: [vscode/askQuestions, execute/runInTerminal, read, edit]
---

# Configure Azure Artifacts npm End to End

Configure the current APEX clone to use an approved Azure Artifacts npm feed, authenticate with the official credential
provider, and run the selected validation depth. Keep feed routing local to the clone and credentials local to the user.

## Mission

- Collect only credential-free configuration through `vscode/askQuestions`.
- Route npm through the selected Azure Artifacts feed without modifying shared repository configuration.
- Authenticate through `artifacts-npm-credprovider` device flow in the terminal or browser.
- Verify exact runtime dependencies and optionally run deterministic installs and package qualification.
- Leave Git clean and never expose credentials in chat, logs, tracked files, or command arguments.

## Scope And Preconditions

- Run from a Git clone whose root contains `package.json`.
- Linux-native Node.js and npm must be on `PATH`; stop if either path begins with `/mnt/c/`.
- The feed must use HTTPS under `pkgs.dev.azure.com` and have an approved npmjs.org upstream.
- The project `.npmrc` contains routing only. User authentication belongs in npm's user configuration file.
- This prompt configures a developer workstation or devcontainer. It does not configure Azure DevOps Pipelines; those use
  `NpmAuthenticate@0`.
- Do not commit `.npmrc`, credentials, corporate feed configuration, generated tokens, or identity-cache files.

## Inputs

If the argument hint contains a credential-free registry URL or snippet, use it as the default for the first question.
Otherwise, call `vscode/askQuestions` once with these three questions:

### Feed Configuration Question

- Header: `feed-config`
- Question: `Which credential-free npm feed configuration should this clone use?`
- Freeform input: allowed.
- Message: `Paste registry=... and optional always-auth=true only. Never include credentials or auth blocks.`
- Recommended option: `Use the APEX company feed` with this description:
  `registry=https://pkgs.dev.azure.com/lordofthecloud/ArtifactsFeed/_packaging/artifacts/npm/registry/`

### Token Mode Question

- Header: `token-mode`
- Question: `Which credential-provider token mode should be used?`
- Freeform input: disabled.
- Recommended option: `SelfDescribing token (recommended)` - avoids PAT generation but may require sign-in more often.
- Alternative option: `Provider default` - use only when organization policy explicitly permits it.

### Verification Depth Question

- Header: `verification-depth`
- Question: `How far should setup verification run?`
- Freeform input: disabled.
- Recommended option: `Full install and vNext package qualification` - dependencies, root/site install, and pack test.
- Alternative option: `Authenticate and install dependencies` - dependencies plus root/site install.
- Alternative option: `Configure and authenticate only` - stop after token and feed validation.

Never ask for a PAT, password, auth token, encoded password, auth block, or device code through `vscode/askQuestions`.

## Workflow

### Step 1 - Inspect Without Exposing Secrets

Resolve the repository root and inspect only non-secret state:

```bash
git rev-parse --show-toplevel
git status --short --branch
command -v node
command -v npm
node --version
npm --version
npm config get userconfig
```

Use file-reading tools for the project `.npmrc` when it exists. Before displaying any content, scan it for sensitive key
names: `_auth`, `_authToken`, `_password`, `password`, `token`, `username`, or `email`. If any appear, do not display the
file or values. Stop and tell the user to move authentication to the user configuration file.

Do not read or print the contents of the user npm configuration file or identity cache. It is sufficient to check file
existence, owner, and mode.

### Step 2 - Validate And Normalize Feed Input

Accept either a single registry URL or a snippet containing `registry=...` and optional `always-auth=true`.

- Trim leading and trailing whitespace from every line.
- Require exactly one `registry` entry.
- Require an HTTPS URL under `pkgs.dev.azure.com` ending in `/npm/registry/`.
- Reject every credential-bearing key listed in Step 1.
- Reject unknown npmrc keys rather than copying them blindly.
- Preserve the trailing slash on the registry URL.

When the snippet contains `always-auth=true`, inspect the npm major version. npm 11 warns that this project setting is
unknown. For npm 11 or newer, call `vscode/askQuestions` with one follow-up:

- `header: always-auth-policy`
- `question: npm reports always-auth as obsolete. How should setup continue?`
- `allowFreeformInput: false`
- options:
  - `Omit always-auth (recommended)`
  - `Keep always-auth because organization policy requires it`

Do not silently remove an explicitly required organization setting.

### Step 3 - Write Local Routing Safely

Use file-editing tools, not shell redirection, to create or update `<repo-root>/.npmrc` with the normalized credential-free
configuration. Preserve unrelated safe project settings only after validating them.

Use file-editing tools to add this entry to `<git-common-dir>/info/exclude` when missing:

```text
.npmrc
```

Resolve the common Git directory with `git rev-parse --git-common-dir`. Do not modify the shared `.gitignore`.

Validate:

```bash
npm config get registry
git check-ignore -v .npmrc
git status --short --branch
```

Stop if `.npmrc` appears as an untracked or tracked Git change.

### Step 4 - Install The Official Credential Provider

If `artifacts-npm-credprovider` is unavailable, install the exact supported provider from the unauthenticated Microsoft
Public Tools feed:

```bash
npm install --global @microsoft/artifacts-npm-credprovider@1.0.1 --registry https://pkgs.dev.azure.com/artifacts-public/PublicTools/_packaging/AzureArtifacts/npm/registry/ --no-audit --no-fund
artifacts-npm-credprovider --help
```

Do not install it from npmjs.org and do not add it to this repository's dependencies.

Ensure the provider identity-cache directory exists and is writable only by the current user. If a root-owned
`$HOME/.local` prevents creation, repair only `$HOME/.local/.IdentityService`; do not recursively change `$HOME/.local`.
Set the identity-cache directory mode to `700`.

Ensure npm's user configuration file exists outside the repository and set its mode to `600`. Create only a comment-only
placeholder when absent. Never write a placeholder token or credential value.

### Step 5 - Authenticate Through Device Flow

First validate existing credentials:

```bash
artifacts-npm-credprovider -c .npmrc --validate-only --verbosity minimal
```

If validation fails, run the provider with `--force`. For `SelfDescribing token`, set
`NUGET_CREDENTIALPROVIDER_VSTS_TOKENTYPE=SelfDescribing` only for that command. For `Provider default`, omit the variable.

Run authentication in the terminal and wait for completion. The user completes browser/device authentication directly.
Do not copy the device code into chat, pass it to `vscode/askQuestions`, or enter it on the user's behalf.

If authentication is canceled, stop and print the exact retry command without a device code. If the provider warns that
secure keyring storage is unavailable, verify the fallback cache is owned by the current user with mode `700` and the
user npm configuration is mode `600`.

### Step 6 - Verify Feed And Policy Eligibility

Run credential validation again, then verify the configured registry and APEX runtime pins:

```bash
artifacts-npm-credprovider -c .npmrc --validate-only --verbosity minimal
npm config get registry
npm view @sinclair/typebox@0.34.52 version
npm view @modelcontextprotocol/sdk@1.29.0 version
npm view zod@4.4.3 version
```

Classify failures precisely:

- `E401`: authentication is absent or expired; rerun Step 5 once.
- `E404` for an exact version: the version may be quarantined, unavailable in the feed, or blocked by upstream policy.
  Stop without changing registries or dependency pins.
- TLS or certificate errors: stop and report the endpoint and error category without dumping npm configuration.
- Do not bypass quarantine, use `--force`, switch to an unapproved registry, or depend on a warm cache.

### Step 7 - Run The Selected Verification

For `Configure and authenticate only`, stop after Step 6.

For either install option, run from the repository root:

```bash
npm ci --no-audit --no-fund
```

When `site/package.json` exists, also run:

```bash
npm --prefix site ci --no-audit --no-fund
```

Do not run `npm approve-scripts` automatically. Report script-approval warnings separately from installation failures.

For `Full install and vNext package qualification`, verify the script exists and run:

```bash
npm run test:vnext-pack
```

A registry-policy timeout is not automatically an APEX package defect. A test timeout that leaves a child process alive
is a separate test-harness defect and must be reported separately.

### Step 8 - Final Safety Check

Confirm routing, exclusion, permissions, and Git state without printing secrets:

```bash
npm config get registry
git check-ignore -v .npmrc
git status --short --branch
```

Use metadata-only file checks for the user npm configuration and identity cache. Do not print either file's contents.

## Output Expectations

Report:

- normalized feed host and path, without credentials;
- credential-provider version and token mode;
- token validation result;
- exact dependency eligibility results;
- root install, site install, and package qualification results when selected;
- project routing exclusion and user-file permission results;
- any quarantine, authentication, TLS, script-approval, or timeout blocker;
- the exact next safe command when user interaction or policy eligibility blocks completion.

Never include a PAT, token, encoded password, auth block, device code, user npmrc contents, or identity-cache contents.
Do not commit, push, open a pull request, publish a package, change dependency pins, or alter organization policy.

## Quality Assurance

- Feed input is credential-free and validated before writing.
- `.npmrc` is local to the clone and ignored by Git.
- Credentials remain outside the repository with restrictive permissions.
- Device authentication occurs only through the official provider.
- Every selected executable check ran, or the output identifies the precise blocking boundary.
- Final Git status contains no change created by this prompt.
