# Azure Skills Plugin Alignment

Program index: [master roadmap](apex-workflow-optimization.md#master-roadmap-and-tracking).
Related evidence: [audit ledger](apex-workflow-audit.md#deep-skill-audit-backlog),
[fork provenance and refresh rule](apex-workflow-audit.md#skill-merger-and-retirement-plan) and
[skill remediation plan](skill-remediation.md).

## Status

- **State**: Planned. Phase 0 is done (branch created, plan saved); implementation starts at Phase 1 on request.
- **Owner**: Jonathan Vella ([@jonathan-vella](https://github.com/jonathan-vella)) with GitHub Copilot.
- **Created**: 2026-09-23 against `main` at `a656e66d`, after the `apex-` rename and SK remediation merge.
- **Updated**: 2026-09-23 against `main` at `5fef0f82`, when this implementation plan replaced the deferred plan.
- **Branch**: `feat/azure-skills-upstream-alignment`. Commit and push after each phase; no pull request until the
  owner approves. Commits are authored as Jonathan Vella (GitHub `jonathan-vella`).
- **Upstream pin**: `microsoft/azure-skills` tag `v1.2.51`, commit `cbf7c8b0`.
- **Scope**: The Microsoft-derived `apex-azure-*` and `apex-entra-app-registration` skills, the Microsoft `azure`
  plugin (skills, MCP server and hooks), and the APEX Azure MCP configuration.
- **Question**: Can the plugin replace or complement APEX skills and the APEX Azure MCP configuration?
- **Answer**: Don't replace. Keep the APEX copies, import useful upstream work with local adaptations, add three
  narrowed skills and track upstream drift weekly. Keep the pinned MCP server. The plugin coexistence spike is
  deferred.

## Before Starting

Upstream and `main` change quickly; refresh these before Phase 1.

1. Upstream: compare the latest plugin tag with `v1.2.51`. If it is newer, re-run the table A defect checks and
   update the pin before importing anything.
2. APEX: confirm the verdicts still hold after `main` changes since `5fef0f82`.
3. Azure MCP: on the pinned server, confirm that the WAF service guide tool returns only a link, and record its
   exact tool name.
4. Workflows: use the action major versions the current workflows use (`actions/checkout@v7` and
   `actions/setup-node@v7` on 2026-09-23).

Checked 2026-09-23: `v1.2.51` is still the latest tag, `main` is unchanged since `5fef0f82`, and the WAF tool
(`wellarchitectedframework_serviceguide_get` with a `service` parameter) returned only a link.

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
- **WAF service guide tool**: Azure MCP `wellarchitectedframework serviceguide get` returns only a link to the
  guide's markdown file, or the list of supported services, so the call itself is small. The size risk is fetching
  a whole guide afterwards, and a checkpoint doesn't clear the chat
  ([bounded tool results](../../../../.github/skills/apex-azure-defaults/references/research-workflow.md#bounded-tool-results)).

## Owner Decisions (2026-09-23)

### Round 1: Assessment

| Question                      | Answer                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Safety versus maintenance     | Asked for a plain-language defect explanation (tables A to C); final call pending                                                 |
| Generic app-development scope | Decide per skill                                                                                                                  |
| Plugin relationship           | Explore replacing or complementing APEX skills and the Azure MCP configuration with the plugin                                    |
| Upstream contributions        | No pull requests to Microsoft                                                                                                     |
| Upstream-only skills          | Harvest ideas; narrowed forks of `azure-kubernetes` (advisory), `azure-reliability` (assessment) and `azure-upgrade` (assessment) |
| Refresh mechanism             | Scheduled drift report                                                                                                            |

### Rounds 2 To 5: Implementation

These supersede round 1 where they differ.

- **Safety versus maintenance**: fix the local defects and import upstream work, with focused tests for every new
  safety rule.
- **Scope**: the three new skills, upstream improvements to existing skills, the local fixes, the drift report, a
  SKU availability check for 07b and 07t, and apex-docs updates. The plugin coexistence spike is deferred.
- **Names**: every new skill uses the `apex-` prefix.
- **Branch and Git**: all work on `feat/azure-skills-upstream-alignment`, committed and pushed after each phase,
  with no pull request until the owner approves.
- **Diagnostics scripts**: import all of them after a security review; `run-ig` runs only with explicit approval.
- **Agent wiring**: reference the new skills the same way existing skills are referenced, through conditional
  **Read** entries and cross-skill links, without trial runs.
- **Infra-planner ideas**: only the WAF service guide tool in 03-Architect. Referenced workloads and the checkov scan
  are out of scope.
- **Reliability findings**: written into existing artifacts; no new artifact type.
- **Branch size**: content first and tooling last, so the branch can split into two pull requests.
- **WAF guide size**: the tool finds the guide, bounded Learn search answers the questions, and whole-guide fetches
  are the exception.

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

Phases run in order. Content comes first and tooling last, so the branch can split into two pull requests (see
[Pull Request Split](#pull-request-split)). Each phase commits its own tests. Every import keeps reference markers,
Reference Index entries, working links, MIT attribution and a description of at most 500 characters, and every new
safety rule gets a focused test.

### Phase 0: Branch And Baseline

- [x] Set this repository's Git author to Jonathan Vella (GitHub `jonathan-vella`).
- [x] Create `feat/azure-skills-upstream-alignment` from `main` and save this plan on it.
- [x] Run the [Before Starting](#before-starting) checks.

### Phase 1: Pin Manifest

- [x] Add `tools/registry/upstream-skill-pins.json` and its schema in `tools/schemas/`. For each APEX skill, record
      the upstream skill and path, fork base `90fcf6de`, reviewed tag `v1.2.51`, status (fork, new fork, retired
      upstream or APEX-only merge), the upstream files imported or adapted, and one upstream check per SK defect.
- [x] Test the manifest against its schema.
- [x] Add an "Upstream Alignment" backlog (UP-xx IDs, ledger status vocabulary) to the
      [audit ledger](apex-workflow-audit.md), pointing to the manifest and this plan.

### Phase 2: Local Fixes

- [x] prepare: remove the legacy `administratorLogin` block and the allow-all firewall rule in
      [sql-database/bicep.md](../../../../.github/skills/apex-azure-prepare/references/services/sql-database/bicep.md);
      adopt the Entra-only rules (no admin login, `Active Directory Default` connection strings, `principalType`);
      and fix the SDK pointer in [SKILL.md](../../../../.github/skills/apex-azure-prepare/SKILL.md).
- [x] deploy: add environment approval to
      [github-bicep.yml](../../../../.github/skills/apex-azure-deploy/references/recipes/cicd/examples/github-bicep.yml)
      and make the generic Step 0 in [SKILL.md](../../../../.github/skills/apex-azure-deploy/SKILL.md) ask before
      running.
- [x] validate: replace `cd infra` and `./main.bicep` in the
      [recipes](../../../../.github/skills/apex-azure-validate/references/recipes/README.md) with the per-project
      `infra/{iac}/{project}/` path.
- [x] cost: write reports to `agent-output/{project}/`, use tag keys from policy, link the pricing guidance, and
      update [test_skill_consolidation.mjs](../../../../tools/tests/scripts/test_skill_consolidation.mjs).
- [x] quotas: delete the legacy section at the end of
      [commands.md](../../../../.github/skills/apex-azure-quotas/references/commands.md) and replace US example
      regions with placeholders.
- [x] entra: add a preview and approval to the bulk-delete script in
      [cli-commands.md](../../../../.github/skills/apex-entra-app-registration/references/cli-commands.md) and fix
      the SDK pointer.
- [x] compliance: remove the duplicate trigger sections and use tag keys from policy in
      [azure-resource-graph.md](../../../../.github/skills/apex-azure-compliance/references/azure-resource-graph.md).
- [x] kusto: restore "Common Issues" as a reference. rbac: fix the Bicep snippet, checked with `bicep build` in
      `tmp/`, and add AVM `roleAssignments` guidance.
- [x] Remove stale `KNOWN_OVERSIZED` entries in
      [validate-skill-checks.mjs](../../../../tools/scripts/validate-skill-checks.mjs).
- [x] cloud-migrate: add the Workflow Routing preamble that prepare, validate and deploy use, and remove the leftover
      `.azure/preparation-manifest.md` step in
      [code-migration.md](../../../../.github/skills/apex-azure-cloud-migrate/references/services/functions/code-migration.md).

### Phase 3: SKU Availability Check

- [x] Add a `sku-availability.md` reference to
      [apex-azure-quotas](../../../../.github/skills/apex-azure-quotas/SKILL.md) covering VM, VMSS and AKS node
      sizes (restrictions, subscription availability and zones), App Service, SQL, PostgreSQL and MySQL flexible
      server, Container Apps workload profiles, Storage, and other services by resource-type regions.
- [x] Report each result as `AVAILABLE`, `RESTRICTED`, `NOT_OFFERED` or `UNKNOWN`. Missing data is never treated
      as available, and zones are checked when zone redundancy is required.
- [x] Add a documented helper, tested with sample JSON like the SK-28 quota helper test.
- [x] Update the scope and triggers in the quotas SKILL.md; quota headroom still doesn't mean regional capacity.
- [x] Point the pre-flight checks in [07b](../../../../.github/agents/07b-bicep-deploy.agent.md),
      [07t](../../../../.github/agents/07t-terraform-deploy.agent.md) and
      [sku-manifest.instructions.md](../../../../.github/instructions/sku-manifest.instructions.md) at the new
      section, and suggest only substitutes that are available and have enough quota.

### Phase 4: Role Checks And Deploy Safety

- [x] validate: add a report-only role check (missing roles, control plane versus data plane, and scope) that hands
      findings to 06b and 06t, plus the `{{ .Env.* }}` scan for azd and Terraform projects.
- [x] deploy: add a read-only live role check; `AcrPull` before a Container Apps deploy, inside the approved 07b and
      07t phases; an existing Container Apps environment check; and the Principal Type Mismatch and Container App
      Revision Timeout error entries.

### Phase 5: Diagnostics Import

- [x] Import the upstream AKS, VM, messaging and App Service guides with reference markers, all linked from
      [SKILL.md](../../../../.github/skills/apex-azure-diagnostics/SKILL.md). Keep the infraops files and the SK-27
      fix.
- [x] Import all bash and PowerShell scripts after a security review. `run-ig` refuses to run without an explicit
      approval flag, keeps its dry run and documents debug-pod cleanup. Set executable bits and syntax-check every
      script.
- [x] Update the SKILL.md routing, keep the description at 500 characters or fewer, and send AKS design questions
      to `apex-azure-kubernetes`.

### Phase 6: Other Upstream Imports

- [x] prepare: App Service (SKU selection, networking, custom domains), Container Apps (networking, revisions, day-2
      operations, Terraform) and Functions (hosting plans, cold start) guides, each checked against the
      private-endpoint baseline.
- [x] cost: query and forecast workflows with guardrails and 429 handling, mapped to the ARM MCP `query_costs`,
      `forecast_costs` and `list_dimensions` tools; the total bill shown with savings; storage tier guidance without
      deletion rules of thumb.
- [x] cloud-migrate: App Service and Container Apps assessment and mapping guides and the Kubernetes DNS rule,
      without the CLI deployment guides.
- [x] resources: web-app triggers, no secrets in diagrams, the .NET 10 example and an output location. storage:
      access-tier triggers. compute: quota and SKU checks through `apex-azure-quotas`, tool-neutral fetch wording and
      region placeholders.

### Phase 7: New Skills And Agent Wiring

- [x] `apex-azure-kubernetes`: Day-0 AKS design with autoscaling, rightsizing, spot, VPA, read-only CLI, safeguards
      and workload identity references. No `az aks create` and no app deployment templates; AKS Automatic readiness
      is deferred.
- [x] `apex-azure-reliability`: assessment only (zone redundancy, storage redundancy, health probes, multi-region,
      App Service and Functions), with no "Fix now" or self-deploy. It returns findings and never creates its own
      report file; see [Reliability Findings](#reliability-findings).
- [x] `apex-azure-upgrade`: Functions assessment, the Consumption to Flex Consumption mapping, and Azure Cache for
      Redis to Azure Managed Redis. No automation scripts and no Java tree.
- [x] For all three: `license: MIT`, `metadata.author: Microsoft`, the upstream `metadata.version`, loadable by users
      and agents, reference markers, one Reference Index, an entry in the pin manifest and in `ownedSkills` in
      [test_service_skill_remediation.mjs](../../../../tools/tests/scripts/test_service_skill_remediation.mjs).
      Import review found four upstream defects, recorded in the manifest notes: a printed `AzureWebJobsStorage`
      value, a wrong Terraform attribute, a removed Redis retirement page and an outdated Flex certificate claim.
- [x] Add conditional **Read** entries: [03-Architect](../../../../.github/agents/03-architect.agent.md)
      (kubernetes when AKS is in scope, upgrade for existing Functions or Redis workloads),
      [05-IaC Planner](../../../../.github/agents/05-iac-planner.agent.md) (kubernetes), and
      [08-As-Built](../../../../.github/agents/08-as-built.agent.md) and
      [09-Diagnose](../../../../.github/agents/09-diagnose.agent.md) (reliability).
- [x] Add links from
      [service-class-menu.md](../../../../.github/skills/apex-azure-defaults/references/service-class-menu.md),
      [deprecated-services.md](../../../../.github/skills/apex-azure-defaults/references/deprecated-services.md),
      prepare's [aks/README.md](../../../../.github/skills/apex-azure-prepare/references/services/aks/README.md) and
      the diagnostics "do not use for" line. The menu now offers Azure Managed Redis, and the deprecation table lists
      the Learn retirement dates for Azure Cache for Redis and Linux Consumption.
- [x] Add the new skills to the `KNOWN_UNLINKED_SKILLS` allowlist in
      [validate-orphaned-content.mjs](../../../../tools/scripts/validate-orphaned-content.mjs) only if the check still
      flags them after wiring. Not needed: the check doesn't flag them.
- [x] Test for forbidden commands in the new skills and for any standalone reliability artifact path.

#### Reliability Findings

The skill returns findings; the calling agent writes them under existing headings, so no template or validator
changes are needed.

- **08-As-Built** writes to `07-backup-dr-plan.md`
  ([template](../../../../.github/skills/apex-azure-artifacts/templates/07-backup-dr-plan.template.md)): the
  Availability row in the Executive Summary, "1. Recovery Objectives", geo-redundancy rows in "2. Backup Strategy",
  region failover to `germanywestcentral` in "3. Disaster Recovery Procedures" and failover drills in "4. Testing
  Schedule". It adds a short summary to "8. Backup & Disaster Recovery" in `07-design-document.md`
  ([template](../../../../.github/skills/apex-azure-artifacts/templates/07-design-document.template.md)).
- **09-Diagnose** writes to `08-resource-health-report.md`: gaps under "Issues Identified (by severity)" with
  evidence and critical, warning or info tags; fixes under "Prevention Recommendations" as proposals only, never
  executed, with IaC changes routed to 06b and 06t; and open items under "Next Steps".

### Phase 8: WAF Service Guides In 03-Architect

- [x] Add a "WAF Service Guides" section to
      [research-workflow.md](../../../../.github/skills/apex-azure-defaults/references/research-workflow.md) and a
      one-line pointer in the 03-Architect evidence rules, following the procedure below.
- [x] Keep the assessment template unchanged; guides are cited in the existing pillar evidence.

#### WAF Guide Procedure

1. List the supported services once per step, then get the link once for each listed in-scope service.
2. Search that guide on Microsoft Learn for the pillar and SKU questions, following the "search first, fetch
   second" rule in [apex-microsoft-docs](../../../../.github/skills/apex-microsoft-docs/SKILL.md).
3. Fetch a whole guide only when search can't answer a scoring claim: one guide at a time, with a size check, the
   useful points saved to `02-waf-research.tmp.md` straight away, and never the same guide twice.
4. After a whole-guide fetch, checkpoint and ask for a fresh chat before the assessment, chart, cost and review
   phases, because a checkpoint doesn't clear the chat.
5. Cite the Learn page, not the GitHub link. If the tool fails or has no guide, use Learn search, record the gap
   and lower the confidence.

A research subagent would isolate large results best, but it adds a new agent and search results are already small.
Caching guide summaries in the repository would go stale. Neither is planned.

### Phase 9: Content Close-Out (End Of Pull Request 1)

- [ ] Update the [skills catalog](../../../../.github/skills/README.md) and the root README if they list skills.
- [ ] Regenerate the Explorer graph in its own commit.
- [ ] Run full validation and push.

### Phase 10: Drift Report Tooling (Pull Request 2)

- [ ] Add `tools/scripts/report-upstream-skill-drift.mjs`. It finds the latest tag with Git, because the REST API
      rate-limits, fetches only the pinned and latest plugin trees, and reports changed files per skill, changelog
      lines, new or retired skills, and whether each SK defect is still present upstream or fixed there (a
      retirement candidate). It never writes to `.github/skills`. Model it on
      [fetch-vendor-prompting-guides.mjs](../../../../tools/scripts/fetch-vendor-prompting-guides.mjs), and add a
      `report:upstream-skills` npm script and an offline fixture test.
- [ ] Add `.github/workflows/upstream-skill-drift.yml`: weekly and manual runs, Node 24, `npm ci`, `contents: read`
      and `issues: write`, concurrency, the current action major versions, and one labelled issue updated in place
      with `gh`. Keep it out of `CONSUMER_WORKFLOWS` in
      [sync-workflows.mjs](../../../../tools/scripts/sync-workflows.mjs), and add it to the workflow table in
      [github-actions.instructions.md](../../../../.github/instructions/github-actions.instructions.md).
- [ ] Regenerate the Explorer graph in its own commit, run full validation and push.

### Phase 11: apex-docs (After Pull Request 1)

- [ ] In [apex-docs](https://github.com/jonathan-vella/apex-docs), on a branch with the same name, add the new skills
      to the Azure Plugin Skills row in `skills-and-instructions.md` and sections with example prompts to
      `skills-subagents.md`; update the diagnostics, quotas, cost, cloud-migrate and 03-Architect text; run its
      checks; commit and push.
- [ ] Merge after pull request 1. The docs update automation then moves the pinned APEX commit and refreshes the
      Explorer graph.

## Pull Request Split

- Tests travel with their phase.
- Tooling commits never touch skills or agents, and content commits never touch the drift script or workflow.
- The Explorer graph is always its own commit. After a rebase it is regenerated, never cherry-picked.
- Pull request 1 comes from a new branch created at the end of Phase 9. Pull request 2 holds the tooling commits,
  rebased onto `main` after pull request 1 merges or stacked on it. It depends on pull request 1 because the drift
  report reads the pin manifest.
- apex-docs waits only for pull request 1. A single pull request is still possible.

## Verification

1. After each phase: `npm run validate:skills`, `validate:skill-checks`, `test:tool-contracts`,
   `lint:orphaned-content`, `test:orphan-skill-discovery`, `lint:docs-freshness`, `lint:safe-shell`, `lint:md`,
   `lint:json` and `lint:prose`; for agent edits also `validate:agents`, `lint:vendor-prompting` and
   `validate:context-budget`.
2. Before each push: `npm run validate:all`, `npm run build:explorer-graph`, `npm run validate:explorer-graph` and
   `npm run check:mcp-release`. Hooks pass without bypasses.
3. `bicep build` of the RBAC snippet in `tmp/`, bash and PowerShell syntax checks for every imported script, and a
   test that `run-ig` refuses to run without approval.
4. The drift report's offline test passes, and a live run from the base to `v1.2.51` reproduces this assessment,
   for example SK-12 still present upstream and the new diagnostics AKS folder.
5. Two manual workflow runs produce exactly one issue, updated in place.
6. The WAF tool's exact name and link-only output are confirmed on the pinned server.

## Decisions And Boundaries

- No wholesale replacement, consistent with the recorded refresh rule.
- No upstream pull requests; the drift report tracks convergence instead.
- Keep the `apex-azure-cost-optimization` and `apex-azure-rbac` names and the pinned `azure-mcp` 2.0.5 server.
- Left out from upstream: Kubernetes app deployment and AKS Automatic readiness; reliability live-change and
  IaC-patching guides; upgrade automation and Java; cloud-migrate deployment guides; prepare MCP templates, the root
  plan file, SQL grant scripts and automatic `azd up`; the cost attribution header and the `temp/` and `output/`
  folders; and the compute VM creator.
- From infra-planner, only the WAF service guide tool.
- Out of scope: agent roles, approval gates, existing artifact and session schemas, model assignments, Azure writes
  and the plugin coexistence spike.

## Deferred Work

Not scheduled. Before picking this up, re-check the VS Code plugin controls: whether plugin skills and plugin MCP
servers can be disabled individually, whether plugin MCP arguments can be pinned or overridden, the
`chat.plugins.enabled` default, and marketplace ref pinning.

### Plugin Coexistence Spike (Throwaway Branch)

- [ ] Install `azure@azure-skills` and confirm plugin skills appear as `/azure:*` beside `apex-*` skills.
- [ ] Check whether individual plugin skills can be disabled, especially infra-planner, app-onboard and Foundry.
- [ ] Check whether the plugin MCP server starts under the npm policy and can be disabled on its own.
- [ ] Confirm telemetry behavior and the opt-out, using `AZURE_SKILLS_TELEMETRY_LOG_DIR` for a local log.
- [ ] Record the effective `chat.plugins.enabled` value and whether personal skills stay isolated.
- [ ] Run about ten routing prompts (hub-spoke plan, deploy my app, check quotas, which role, list web apps,
      container app failing) in the default agent and in agents 01, 05, 06b, 06t and 09. Pass when APEX agents
      always load `apex-*` skills, then record a go or no-go.

### Plugin Decision (After The Spike)

- [ ] Go: document an optional per-user install; decide the telemetry opt-out in
      [devcontainer.json](../../../../.devcontainer/devcontainer.json), which also silences APEX's own Azure MCP
      telemetry; disable high-collision plugin skills and the plugin MCP server; optionally retire the kusto and
      cloud-migrate copies with their callers and tests.
- [ ] No-go: block agent plugins for the workspace in [settings.json](../../../../.vscode/settings.json), and extend
      the rationale in [validate-extension-bloat.mjs](../../../../tools/scripts/validate-extension-bloat.mjs) and the
      [devcontainer README](../../../../.devcontainer/README.md).

### Further Considerations

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
- [Upstream tag `v1.2.51`](https://github.com/microsoft/azure-skills/tree/v1.2.51)
- [Azure MCP WAF service guide command](https://github.com/microsoft/mcp/blob/main/tools/Azure.Mcp.Tools.WellArchitectedFramework/src/Commands/ServiceGuide/ServiceGuideGetCommand.cs)
