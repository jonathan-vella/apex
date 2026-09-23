# Azure Skills Plugin Alignment

Program index: [master roadmap](apex-workflow-optimization.md#master-roadmap-and-tracking).
Related evidence: [audit ledger](apex-workflow-audit.md#deep-skill-audit-backlog),
[fork provenance and refresh rule](apex-workflow-audit.md#skill-merger-and-retirement-plan) and
[skill remediation plan](skill-remediation.md).

## Status

- **State**: Deferred; saved 2026-09-23 for later re-evaluation. Not started and no implementation approved.
- **Owner**: Jonathan Vella with GitHub Copilot.
- **Created**: 2026-09-23 against `main` at `a656e66d`, after the `apex-` rename and SK remediation merge.
- **Scope**: The Microsoft-derived `apex-azure-*` and `apex-entra-app-registration` skills, the Microsoft `azure`
  plugin (skills, MCP server and hooks), and the APEX Azure MCP configuration.
- **Question**: Can the plugin replace or complement APEX skills and the APEX Azure MCP configuration?
- **Answer at save time**: Don't replace. Keep the APEX copies, import useful upstream work, track upstream drift
  weekly, and use the plugin only as an optional complement after a coexistence spike. Keep the pinned MCP server.

## Re-evaluation Checklist

Refresh this evidence before acting; upstream and VS Code change quickly.

1. Upstream: compare the latest plugin tag with `v1.2.51`, re-run the table A defect checks on upstream `main`, and
   note renamed, retired or new skills.
2. VS Code: check whether plugin skills and plugin MCP servers can be disabled individually, whether plugin MCP
   arguments can be pinned or overridden, the `chat.plugins.enabled` default, and marketplace ref pinning.
3. APEX: confirm the verdicts still hold after later edits to skills, remediation tests, consumers and validators.
4. Owner: confirm the decisions below, especially the plugin relationship and the safety trade-off.

## Evidence Snapshot (2026-09-23)

- **Fork base**: `microsoft/azure-skills` commit
  [`90fcf6de`](https://github.com/microsoft/azure-skills/commit/90fcf6de8ceef59e28b34714785a52d19aab071c), dated
  2026-03-12 and contained in tags `v1.1.37` onward. APEX import commit: `c61794c8`.
- **Upstream now**: plugin `v1.2.51`, about 120 releases after the base, roughly half of them Foundry work. The
  source of truth is [GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure); the
  [azure-skills](https://github.com/microsoft/azure-skills) repository is a generated mirror with signed `vX.Y.Z`
  tags, though not every version is tagged.
- **Versions**: APEX never bumped `metadata.version` after local edits, so APEX versions equal the base and don't
  describe content.
- **Refresh rule already recorded**: map original names to `apex-` directories, review upstream diffs, preserve
  local adaptations and licenses, and never recopy an upstream tree wholesale. No upstream pin exists in
  `tools/registry/`.
- **Plugin payload**: skills; `.mcp.json` with one `azure` server running `npx -y @azure/mcp@latest server start`;
  and `hooks/copilot-hooks.json`, which runs a telemetry script at session start and after every tool call. It
  sends tool names, skill names and versions, and reference paths, but not prompts or arguments. Opt out with
  `AZURE_MCP_COLLECT_TELEMETRY=false`.
- **Install routes**: the companion of the VS Code Azure MCP extension (denylisted in
  [validate-extension-bloat.mjs](../../../../tools/scripts/validate-extension-bloat.mjs)), VS Code Agent Plugins
  (marketplace, Git source or `chat.pluginLocations`), Copilot CLI (VS Code auto-discovers
  `~/.copilot/installed-plugins/`) and APM. Marketplace plugins refresh every 24 hours with no version pin.
- **Isolation gaps**: the repository has no `chat.plugins.*` settings, and `chat.agentSkillsLocations` is
  deprecated and honored only by the Local agent.
- **Coexistence**: `apex-` names avoid name collisions, and plugin skills appear as `/azure:<skill>`. APEX agents
  reference `apex-*` skills by explicit name or path, so workflow runs keep using APEX copies; free-form chats can
  load either set.
- **APEX Azure MCP coupling**: [mcp.json](../../../../.vscode/mcp.json) pins `@azure/mcp@2.0.5` and sets
  `NPM_CONFIG_ALLOW_REMOTE=all` for the npm 12 feed. [configure-mcp.mjs](../../../../.devcontainer/configure-mcp.mjs)
  holds the defaults and release check, [validate-mcp-config.mjs](../../../../tools/scripts/validate-mcp-config.mjs)
  requires `servers.azure-mcp`, and
  [test_devcontainer_setup.mjs](../../../../tools/tests/scripts/test_devcontainer_setup.mjs) asserts the environment
  variable. Agents 03, 05, 06b, 06t, 07b, 07t, 08 and 09 use `azure-mcp/*`. The cost worker uses
  `azure-resource-manager-mcp`, which the plugin doesn't provide.
- **Validator friction**: verbatim upstream files fail the 500-character description cap in
  [validate-skills.mjs](../../../../tools/scripts/validate-skills.mjs), canary markers in
  [validate-skill-checks.mjs](../../../../tools/scripts/validate-skill-checks.mjs), the Reference Index check in
  [check-docs-freshness.mjs](../../../../tools/scripts/check-docs-freshness.mjs), `apex-` naming, the orphan
  allowlist and the SK remediation tests.

## Owner Decisions (2026-09-23)

| Question                      | Answer                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Safety versus maintenance     | Asked for a plain-language defect explanation (tables A to C); final call pending                                                 |
| Generic app-development scope | Decide per skill                                                                                                                  |
| Plugin relationship           | Explore replacing or complementing APEX skills and the Azure MCP configuration with the plugin                                    |
| Upstream contributions        | No pull requests to Microsoft                                                                                                     |
| Upstream-only skills          | Harvest ideas; narrowed forks of `azure-kubernetes` (advisory), `azure-reliability` (assessment) and `azure-upgrade` (assessment) |
| Refresh mechanism             | Scheduled drift report                                                                                                            |

## Assessment

### A. Defects That Return With Microsoft's Current Version

Upstream `main` still had each defect on 2026-09-23. APEX fixed them, and its remediation tests guard the fixes.

| Skill                         | Plain language                                             | What happens                                                                                                    | ID           |
| ----------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------ |
| prepare: Key Vault samples    | Reading your password out loud to check it                 | Samples print secret values                                                                                     | SK-12        |
| prepare: Node runtime         | Forget your key and everyone gets the same spare           | Built-in fallback session secret in production                                                                  | SK-12        |
| prepare and deploy            | You ask for a drawing and the builder pours concrete       | Preparation ends with `azd up`; the checklist creates environments before choosing a recipe                     | SK-11        |
| prepare and quotas            | Coupons don't mean the shop has stock                      | Quota treated as capacity; VM count added to vCPU usage                                                         | SK-23, SK-28 |
| quotas script                 | Counting blanks as zero and hiding mistakes                | Missing values become 0, errors are discarded, Azure JSON is pasted into Python source                          | SK-28 helper |
| prepare and deploy            | The recipe needs an ingredient that doesn't exist          | Invalid Terraform backend variables; `az sql db query` isn't a documented command                               | SK-22        |
| compliance                    | Drinking the milk to read the expiry date                  | The expiry audit retrieves secret values instead of metadata                                                    | SK-15        |
| compliance: TypeScript sample | Mixing up your diary and your house key                    | Secrets confused with cryptographic keys                                                                        | SK-37        |
| entra                         | You ask for a spare key and the locksmith changes the lock | Adding a credential deletes existing ones, and the sample prints the new secret                                 | SK-17        |
| entra samples                 | Testing your key on someone else's car                     | Tests the CLI identity instead of the app; the app-only sample calls `/me`; suggests pasting tokens into jwt.ms | SK-29        |
| storage                       | Using the master key instead of your badge                 | Commands without `--auth-mode login` fall back to account keys                                                  | Local fix    |
| cost                          | Tidying up by throwing out the whole toy box               | `Remove-Item temp -Recurse -Force` can delete user files                                                        | SK-08        |
| cost: Redis                   | The TV shows an error, so you bin it and promise a refund  | "Failed cache: delete immediately, save $50–300 a month"                                                        | SK-19        |
| cost and resources            | Two kids named Sam, and the wrong one gets detention       | Unused-resource queries omit resource and subscription IDs                                                      | SK-20        |
| diagnostics                   | Living on the same street doesn't make you family          | Function App telemetry matched by resource group                                                                | SK-27        |
| kusto                         | "Bring me every book in the library"                       | KQL examples with no time or row limits                                                                         | SK-31        |

### B. Where APEX Is Behind Or Wrong

| Skill                      | Plain language                                             | Fix                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prepare: SQL               | A spare admin key under the doormat and the gate left open | Remove the legacy admin login block and allow-all firewall rule in [sql-database/bicep.md](../../../../.github/skills/apex-azure-prepare/references/services/sql-database/bicep.md); adopt upstream's "never generate `administratorLogin`" rule and Entra-only connection strings |
| validate and deploy        | Nobody checks the guest list                               | Add a static role check before deployment and a read-only live role check afterwards                                                                                                                                                                                               |
| deploy: CI sample          | A robot ships every push to production                     | [github-bicep.yml](../../../../.github/skills/apex-azure-deploy/references/recipes/cicd/examples/github-bicep.yml) has no environment approval                                                                                                                                     |
| cost                       | Leaving money reports on the kitchen table                 | Reports go to `output/`, which Git doesn't ignore ([SKILL.md](../../../../.github/skills/apex-azure-cost-optimization/SKILL.md)); tag keys use the wrong casing                                                                                                                    |
| diagnostics                | A doctor who knows only two illnesses                      | Import AKS, VM, messaging and App Service guides and evidence scripts                                                                                                                                                                                                              |
| cloud-migrate              | Knows only one road                                        | Import Fargate, Kubernetes, Cloud Run, Spring, Beanstalk, Heroku and App Engine assessments                                                                                                                                                                                        |
| cost                       | Finds savings but can't show the bill                      | Add cost query and forecast rules using the ARM MCP cost tools                                                                                                                                                                                                                     |
| quotas                     | Checks the coupons, never whether the shop sells the item  | No SKU availability check, although 07b and 07t expect one; upstream lacks it too                                                                                                                                                                                                  |
| quotas                     | Two rulebooks that disagree                                | Delete the legacy section at the end of [commands.md](../../../../.github/skills/apex-azure-quotas/references/commands.md)                                                                                                                                                         |
| resources                  | Might draw a password on the whiteboard                    | Add the no-secrets-in-diagrams rule, web-app triggers and an output location                                                                                                                                                                                                       |
| entra                      | A cleanup with no "are you sure?"                          | Add approval to the bulk-delete script in [cli-commands.md](../../../../.github/skills/apex-entra-app-registration/references/cli-commands.md)                                                                                                                                     |
| compliance, kusto and rbac | Small tidy-ups                                             | Remove duplicate trigger sections, restore kusto "Common Issues" and fix a Bicep snippet that doesn't compile                                                                                                                                                                      |

### C. What Installing The Plugin Brings

| Issue                   | Plain language                                                        | Detail                                                                                                         |
| ----------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Telemetry hook          | A helper who writes down every tool you touch and mails the list home | Fires at session start and after every tool call, including APEX Azure MCP calls                               |
| MCP on `@latest`        | Always grabbing the newest box, even test versions                    | APEX pins an exact version because `latest` can be a prerelease                                                |
| Auto-update             | The rulebook can change overnight                                     | Plugins refresh every 24 hours with no pin                                                                     |
| npm policy              | The key doesn't fit this door                                         | The plugin's server and hook lack `NPM_CONFIG_ALLOW_REMOTE=all`, so they may not start in this container       |
| Tool names              | Calling someone by the wrong name                                     | APEX agents use `azure-mcp/*`; the plugin server is named `azure`                                              |
| Competing orchestrators | Two bus drivers grabbing one steering wheel                           | `azure-enterprise-infra-planner` and `azure-app-onboard` run their own plan-to-deploy flows and approval steps |
| Root-level files        | Moving your whole closet to make room                                 | They write `.azure/deployment-plan.md` and `./infra/`; app-onboard can rename `infra/` to `infra.bak/`         |
| Loud rules              | Someone shouting "ignore everyone else"                               | Skill text such as "Authoritative guidance — supersedes prior training" and "No exceptions"                    |
| CI checks               | Right answer, wrong format, still an F                                | Description cap, canary markers, Reference Index, `apex-` names and remediation tests                          |

### Replace Or Keep

| APEX skill                                                                  | Upstream skill                                                                                                                      | Verdict                                      | Key reason                                                                                                                           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apex-azure-prepare`                                                        | `azure-prepare`                                                                                                                     | Keep and cherry-pick                         | APEX fixed SK-11, SK-12, SK-22 and SK-23; upstream moved to MCP templates and a root plan file                                       |
| `apex-azure-validate`                                                       | `azure-validate`                                                                                                                    | Keep and cherry-pick                         | Holds the APEX/generic routing split and the preflight used by `apex-iac-common`; take role verification and the `{{ .Env.* }}` scan |
| `apex-azure-deploy`                                                         | `azure-deploy`                                                                                                                      | Keep and cherry-pick                         | SK-11 and SK-22 fixed; take the live role check, AcrPull two-phase gate and error entries                                            |
| `apex-azure-cloud-migrate`                                                  | `azure-cloud-migrate`                                                                                                               | Keep and import guides; complement candidate | Small APEX delta, no agent consumer, seven new upstream scenarios                                                                    |
| `apex-azure-cost-optimization`                                              | `azure-cost`                                                                                                                        | Keep the name and cherry-pick                | SK-08, SK-19 and SK-20 fixed; take the query and forecast guardrails                                                                 |
| `apex-azure-compliance`                                                     | `azure-compliance`                                                                                                                  | Keep with one trim                           | SK-15 and SK-37 security fixes; upstream barely changed                                                                              |
| `apex-azure-diagnostics`                                                    | `azure-diagnostics`                                                                                                                 | Keep and import                              | Loaded by 09-Diagnose; upstream grew from 8 to 51 files                                                                              |
| `apex-azure-kusto`                                                          | `azure-kusto`                                                                                                                       | Keep; complement candidate                   | Upstream content unchanged apart from the SK-31 defect                                                                               |
| `apex-azure-compute`                                                        | `azure-compute`                                                                                                                     | Keep with small cherry-picks                 | Upstream VM creator uses raw templates, public IPs and `eastus`, and skips approval gates                                            |
| `apex-azure-quotas`                                                         | `azure-quotas`                                                                                                                      | Keep                                         | Upstream treats quota as capacity and ships a fragile script                                                                         |
| `apex-azure-storage`                                                        | `azure-storage`                                                                                                                     | Keep and add triggers                        | `--auth-mode login` matches the no-shared-key baseline                                                                               |
| `apex-azure-resources`                                                      | `azure-resource-lookup`, `azure-resource-visualizer`                                                                                | Keep and cherry-pick                         | Owns the shared unused-resource queries                                                                                              |
| `apex-entra-app-registration`                                               | `entra-app-registration`                                                                                                            | Keep                                         | Owns shared auth guidance linked from other skills; upstream still wipes credentials                                                 |
| `apex-azure-rbac`                                                           | Retired upstream in `v1.1.95`                                                                                                       | Keep for now                                 | Revisit after role verification is ported                                                                                            |
| New `apex-azure-kubernetes`, `apex-azure-reliability`, `apex-azure-upgrade` | `azure-kubernetes`, `azure-reliability`, `azure-upgrade`                                                                            | Narrowed forks                               | Advisory or assessment only                                                                                                          |
| None                                                                        | `azure-enterprise-infra-planner`                                                                                                    | Harvest ideas                                | Referenced workloads, WAF service-guide tool, checkov gate                                                                           |
| None                                                                        | App onboarding and its prerequisite check, Foundry, AI, AI gateway, messaging, Entra agent ID, Python App Service deploy, AI Runway | Skip                                         | Duplicate the APEX workflow or are app-development tools                                                                             |
| APEX-only skills                                                            | None                                                                                                                                | Keep                                         | No upstream equivalent                                                                                                               |

### MCP Recommendation

Keep the pinned `azure-mcp` server. The plugin runs the same `@azure/mcp` package on `@latest`, so switching adds no
tools and loses the exact pin and npm setting. A switch would also touch the listed agents' tool lists, the MCP
validator, the setup defaults and release check, and the devcontainer setup test. Revisit only if VS Code lets users
pin or override plugin MCP arguments.

## Plan

### Phase 0: Decision Record

- [ ] When re-evaluation approves work, add an "Upstream Alignment" backlog (UP-xx IDs, ledger status vocabulary)
      to the [audit ledger](apex-workflow-audit.md) with the fork base, the reviewed version, the verdicts and the
      rejected options.

### Phase 1: Coexistence Spike (Throwaway Branch; Parallel With Phases 2 And 3)

- [ ] Install `azure@azure-skills` and confirm plugin skills appear as `/azure:*` beside `apex-*` skills.
- [ ] Check whether individual plugin skills can be disabled, especially infra-planner, app-onboard and Foundry.
- [ ] Check whether the plugin MCP server starts under the npm policy and can be disabled on its own.
- [ ] Confirm telemetry behavior and the opt-out, using `AZURE_SKILLS_TELEMETRY_LOG_DIR` for a local log.
- [ ] Record the effective `chat.plugins.enabled` value and whether personal skills stay isolated.
- [ ] Run about ten routing prompts (hub-spoke plan, deploy my app, check quotas, which role, list web apps,
      container app failing) in the default agent and in agents 01, 05, 06b, 06t and 09. Pass when APEX agents
      always load `apex-*` skills, then record a go or no-go.

### Phase 2: Cherry-Picks And Local Fixes (Independent; Small PRs; Keep SK Tests Passing)

- [ ] Security first: the prepare SQL block; approval in the deploy CI sample; cost reports moved to
      `agent-output/{project}/` with [test_skill_consolidation.mjs](../../../../tools/tests/scripts/test_skill_consolidation.mjs)
      updated; approval in the entra cleanup script.
- [ ] Role verification: a report-only static check in validate and a read-only live check in deploy.
- [ ] Imports: diagnostics guides and scripts after a security review (`run-ig` approval-only); cloud-migrate
      assessments without the CLI provisioning guides; cost query and forecast rules mapped to ARM MCP; prepare
      Functions, App Service and Container Apps guides.
- [ ] Small fixes: the rest of table B; validate recipe paths that `cd infra`; a deploy Step 0 that asks first; the
      prepare SDK pointer; compute quota delegation, region placeholders and tool-neutral fetch wording.
- [ ] Remove stale `KNOWN_OVERSIZED` entries in
      [validate-skill-checks.mjs](../../../../tools/scripts/validate-skill-checks.mjs).
- [ ] Every import keeps canary markers, Reference Index entries, working links, MIT attribution and a description
      of at most 500 characters, and gets focused tests for new safety rules.

### Phase 3: Upstream Drift Report (After Phase 0; Parallel With Phase 2)

- [ ] Pin manifest `tools/registry/upstream-skill-pins.json` with a schema: upstream path, `apex-` directory, base
      SHA, reviewed tag, status (fork, new fork or retired upstream) and one upstream check per SK defect.
- [ ] Script `tools/scripts/report-upstream-skill-drift.mjs`: fetch tags with Git because the REST API rate-limits;
      report changed files, changelog lines, new or retired skills, and whether each defect is still present or
      fixed upstream (a retirement candidate); never write to `.github/skills`. Model it on
      [fetch-vendor-prompting-guides.mjs](../../../../tools/scripts/fetch-vendor-prompting-guides.mjs), and add an npm
      script and an offline fixture test.
- [ ] Workflow `.github/workflows/upstream-skill-drift.yml`: weekly and manual runs; `contents: read` and
      `issues: write`; one issue updated in place; pinned actions. Keep it out of `CONSUMER_WORKFLOWS` in
      [sync-workflows.mjs](../../../../tools/scripts/sync-workflows.mjs).

### Phase 4: Narrowed Forks And Harvested Ideas (Parallel With Phases 2 And 3)

- [ ] `apex-azure-kubernetes`: Day-0 decisions only; no `az aks create` and no app deployment.
- [ ] `apex-azure-reliability`: assessment phases only; no "Fix now" or self-deploy; failover `germanywestcentral`.
- [ ] `apex-azure-upgrade`: Functions-to-Flex and Redis-to-Azure-Managed-Redis assessment only; no Java or scripts.
- [ ] Record fork provenance in the pin manifest, add the forks to the allowlist in
      [validate-orphaned-content.mjs](../../../../tools/scripts/validate-orphaned-content.mjs), and add link tests.
- [ ] Record infra-planner ideas as proposals only: a referenced-workload brownfield mode,
      `wellarchitectedframework_serviceguide_get` for the Architect agent, and an optional checkov scan.

### Phase 5: Plugin Decision (After Phase 1)

- [ ] Go: document an optional per-user install; decide the telemetry opt-out in
      [devcontainer.json](../../../../.devcontainer/devcontainer.json), which also silences APEX's own Azure MCP
      telemetry; disable high-collision plugin skills and the plugin MCP server; optionally retire the kusto and
      cloud-migrate copies with their callers and tests.
- [ ] No-go: block agent plugins for the workspace in [settings.json](../../../../.vscode/settings.json), and extend
      the rationale in [validate-extension-bloat.mjs](../../../../tools/scripts/validate-extension-bloat.mjs) and the
      [devcontainer README](../../../../.devcontainer/README.md).

### Phase 6: Integration

- [ ] Regenerate the Explorer graph and update the [skills catalog](../../../../.github/skills/README.md) if the skill
      set changes. Track published-doc updates in apex-docs.

## Verification

1. `npm run validate:all`
2. `npm run test:tool-contracts`
3. `npm run validate:skills`, `npm run validate:skill-checks`, `npm run lint:orphaned-content`,
   `npm run test:orphan-skill-discovery`, `npm run lint:safe-shell`, `npm run lint:md` and `npm run lint:json`
4. `npm run check:mcp-release` still passes.
5. The drift report from the base to `v1.2.51` reproduces this assessment, for example SK-12 still present upstream
   and the new diagnostics AKS folder.
6. Two manual workflow runs produce exactly one issue, updated in place.
7. Spike results are recorded in this plan.

## Decisions And Boundaries

- No wholesale replacement, consistent with the recorded refresh rule.
- No upstream pull requests; the drift report tracks convergence instead.
- Keep `apex-azure-cost-optimization` and `apex-azure-rbac` for now.
- Out of scope: agent roles, schemas and approval gates, model assignments, Azure writes and apex-docs content.

## Further Considerations

1. If APEX becomes infra-only, the largest saving is pruning the generic Functions template tree in
   `apex-azure-prepare` in favor of the plugin's template tool. SK-12, SK-13 and SK-14 tests pin that tree, so do
   this only after a go.
2. A vendored local plugin registered through `chat.pluginLocations` could pin MCP arguments and drop the hooks, but
   it is another copy to maintain.
3. The telemetry opt-out also silences APEX's own Azure MCP telemetry.

## Sources

- [Upstream plugin skills](https://github.com/microsoft/azure-skills/tree/main/.github/plugins/azure-skills/skills)
- [Upstream plugin changelog](https://github.com/microsoft/azure-skills/blob/main/.github/plugins/azure-skills/CHANGELOG.md)
- [VS Code agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [VS Code agent skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)
