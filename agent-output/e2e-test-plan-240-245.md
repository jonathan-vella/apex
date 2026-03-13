# End-to-End Test Plan — Issues #240 + #245

Branch: `feat/azure-skills-integration`
Covers: Azure Skills Plugin integration (21 skills), azure-deploy activation, azd CLI

---

## A. Automated Validators (CI-equivalent)

Run each validator and record PASS/FAIL. Expected: 0 errors on all.

### A1. Core Structural Validators

| #    | Command                                               | What it checks                                                                     | Expected         |
| ---- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------- |
| A1.1 | `node scripts/validate-agent-registry.mjs`            | Skills in agent-registry.json exist on disk                                        | PASS (0 errors)  |
| A1.2 | `node scripts/validate-skill-affinity.mjs`            | Skills in skill-affinity.json exist; primary skills referenced in agent Read lines | PASS (0 errors)  |
| A1.3 | `node scripts/validate-skills-format.mjs`             | All 38 SKILL.md files have valid frontmatter                                       | PASS (0 errors)  |
| A1.4 | `node scripts/validate-skill-digests.mjs`             | Digest files exist, <60% of source, H2 subset                                      | PASS (0 errors)  |
| A1.5 | `node scripts/validate-no-stale-skill-references.mjs` | No references to retired names (azure-troubleshooting)                             | PASS (0 matches) |
| A1.6 | `node scripts/validate-workflow-graph.mjs`            | Workflow DAG is valid                                                              | PASS             |
| A1.7 | `node scripts/validate-session-state.mjs`             | Session state JSON schema valid                                                    | PASS             |
| A1.8 | `node scripts/validate-session-lock.mjs`              | Session lock model valid                                                           | PASS             |

### A2. Content Validators

| #     | Command                                | What it checks                                   | Expected |
| ----- | -------------------------------------- | ------------------------------------------------ | -------- |
| A2.1  | `npm run lint:agent-frontmatter`       | All agent .agent.md files have valid frontmatter | PASS     |
| A2.2  | `npm run lint:instruction-frontmatter` | All instruction files have valid frontmatter     | PASS     |
| A2.3  | `npm run lint:artifact-templates`      | Artifact template H2 compliance                  | PASS     |
| A2.4  | `npm run lint:h2-sync`                 | H2 headings sync between templates and artifacts | PASS     |
| A2.5  | `npm run lint:governance-refs`         | Governance references valid                      | PASS     |
| A2.6  | `npm run validate:instruction-refs`    | Instruction file references resolve              | PASS     |
| A2.7  | `npm run lint:json`                    | All JSON/JSONC files valid syntax                | PASS     |
| A2.8  | `npm run lint:mcp-config`              | MCP server configuration valid                   | PASS     |
| A2.9  | `npm run lint:deprecated-refs`         | No deprecated patterns                           | PASS     |
| A2.10 | `npm run lint:version-sync`            | Version strings in sync                          | PASS     |

### A3. Size & Structure Validators

| #    | Command                         | What it checks                          | Expected                                 |
| ---- | ------------------------------- | --------------------------------------- | ---------------------------------------- |
| A3.1 | `npm run lint:skill-size`       | Skills <200 lines or in KNOWN_OVERSIZED | PASS                                     |
| A3.2 | `npm run lint:agent-body-size`  | Agent bodies <400 lines                 | PASS                                     |
| A3.3 | `npm run lint:glob-audit`       | No broad wildcards on large files       | PASS                                     |
| A3.4 | `npm run lint:skill-references` | No orphaned reference files             | PASS                                     |
| A3.5 | `npm run lint:orphaned-content` | No unreferenced skills/instructions     | PASS (warnings OK for new plugin skills) |

### A4. External Tool Validators

| #    | Command                      | What it checks                       | Expected                                      |
| ---- | ---------------------------- | ------------------------------------ | --------------------------------------------- |
| A4.1 | `npm run lint:md`            | Markdown linting (markdownlint-cli2) | Known failures in plugin files (pre-existing) |
| A4.2 | `npm run lint:python`        | Python linting (ruff)                | PASS                                          |
| A4.3 | `npm run lint:terraform-fmt` | Terraform format check               | PASS                                          |
| A4.4 | `npm run validate:terraform` | Terraform validate per project       | PASS                                          |

### A5. Full Suite

| #    | Command                | Expected                                                          |
| ---- | ---------------------- | ----------------------------------------------------------------- |
| A5.1 | `npm run validate:all` | PASS (only pre-existing lint:md and lint:docs-freshness failures) |

---

## B. Skill Rename Verification

Verifies `azure-troubleshooting` → `azure-diagnostics` rename is complete.

| #   | Check                           | Command                                                                                                                    | Expected                                                     |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| B1  | Old skill directory deleted     | `ls .github/skills/azure-troubleshooting 2>&1`                                                                             | "No such file or directory"                                  |
| B2  | New skill directory exists      | `ls .github/skills/azure-diagnostics/SKILL.md`                                                                             | File exists                                                  |
| B3  | Custom refs merged              | `ls .github/skills/azure-diagnostics/references/infraops-*`                                                                | 3 files: kql-templates, health-checks, remediation-playbooks |
| B4  | Zero stale refs in configs      | `grep -r "azure-troubleshooting" .github/agent-registry.json .github/skill-affinity.json`                                  | 0 matches                                                    |
| B5  | Zero stale refs in agents       | `grep -r "azure-troubleshooting" .github/agents/`                                                                          | 0 matches                                                    |
| B6  | Zero stale refs in prompts      | `grep -r "azure-troubleshooting" .github/prompts/`                                                                         | 0 matches                                                    |
| B7  | Zero stale refs in instructions | `grep -r "azure-troubleshooting" .github/instructions/`                                                                    | 0 matches                                                    |
| B8  | Zero stale refs in docs         | `grep -r "azure-troubleshooting" docs/ AGENTS.md`                                                                          | 0 matches                                                    |
| B9  | Diagnose agent reads new skill  | `grep "azure-diagnostics" .github/agents/09-diagnose.agent.md`                                                             | Match found                                                  |
| B10 | Affinity inherits tiers         | `python3 -c "import json; d=json.load(open('.github/skill-affinity.json')); print(d['agents']['09-Diagnose']['primary'])"` | Contains 'azure-diagnostics'                                 |

---

## C. azure-validate Skill Verification

Verifies preflight extraction from iac-common.

| #   | Check                          | Command                                                                                                                                             | Expected                                     |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| C1  | azure-validate skill exists    | `ls .github/skills/azure-validate/SKILL.md`                                                                                                         | File exists                                  |
| C2  | InfraOps preflight merged      | `ls .github/skills/azure-validate/references/infraops-preflight.md`                                                                                 | File exists                                  |
| C3  | Preflight contains auth check  | `grep "az account get-access-token" .github/skills/azure-validate/references/infraops-preflight.md`                                                 | Match found                                  |
| C4  | Preflight contains governance  | `grep "Governance-to-Code" .github/skills/azure-validate/references/infraops-preflight.md`                                                          | Match found                                  |
| C5  | Preflight contains stop rules  | `grep "STOP IMMEDIATELY" .github/skills/azure-validate/references/infraops-preflight.md`                                                            | Match found                                  |
| C6  | iac-common slimmed             | `wc -l .github/skills/iac-common/SKILL.md`                                                                                                          | <80 lines (was 126)                          |
| C7  | iac-common xrefs validate      | `grep "azure-validate" .github/skills/iac-common/SKILL.md`                                                                                          | Match found                                  |
| C8  | iac-common no preflight        | `grep -c "MSAL token\|STOP IMMEDIATELY\|Governance-to-Code" .github/skills/iac-common/SKILL.md`                                                     | 0 matches                                    |
| C9  | Deploy agents have validate    | `grep "azure-validate" .github/agent-registry.json`                                                                                                 | Matches in deploy.bicep and deploy.terraform |
| C10 | Validate is primary for deploy | `python3 -c "import json; d=json.load(open('.github/skill-affinity.json')); print('azure-validate' in d['agents']['07b-Bicep Deploy']['primary'])"` | True                                         |

---

## D. Plugin Skills Import Verification

Verifies all 21 plugin skills are correctly installed.

| #   | Check                        | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Expected                                 |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| D1  | Total skill count            | `ls -d .github/skills/*/SKILL.md \| wc -l`                                                                                                                                                                                                                                                                                                                                                                                                                                         | 38 (18 original - 1 deleted + 21 plugin) |
| D2  | All 21 plugin skills present | `for s in appinsights-instrumentation azure-ai azure-aigateway azure-cloud-migrate azure-compliance azure-compute azure-cost-optimization azure-deploy azure-diagnostics azure-hosted-copilot-sdk azure-kusto azure-messaging azure-prepare azure-quotas azure-rbac azure-resource-lookup azure-resource-visualizer azure-storage azure-validate entra-app-registration microsoft-foundry; do test -f ".github/skills/$s/SKILL.md" && echo "OK: $s" \|\| echo "MISSING: $s"; done` | All 21 "OK"                              |
| D3  | All have valid frontmatter   | `node scripts/validate-skills-format.mjs 2>&1 \| tail -3`                                                                                                                                                                                                                                                                                                                                                                                                                          | "All skills passed"                      |
| D4  | No Windows line endings      | `find .github/skills -name "*.md" -exec grep -lP '\r' {} \; \| wc -l`                                                                                                                                                                                                                                                                                                                                                                                                              | 0                                        |
| D5  | Plugin version pinned        | `cat .github/plugins/PLUGIN_VERSION.md \| grep "Commit"`                                                                                                                                                                                                                                                                                                                                                                                                                           | Shows commit hash                        |

---

## E. azure-deploy Activation Verification (Issue #245)

| #   | Check                        | Command                                                                                                                                                 | Expected  |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| E1  | NOT ACTIVE notice removed    | `grep "NOT ACTIVE" .github/skills/azure-deploy/SKILL.md`                                                                                                | 0 matches |
| E2  | In agent-registry for 07b    | `python3 -c "import json; d=json.load(open('.github/agent-registry.json')); print('azure-deploy' in d['agents']['deploy']['bicep']['skills'])"`         | True      |
| E3  | In agent-registry for 07t    | `python3 -c "import json; d=json.load(open('.github/agent-registry.json')); print('azure-deploy' in d['agents']['deploy']['terraform']['skills'])"`     | True      |
| E4  | Secondary for 07b            | `python3 -c "import json; d=json.load(open('.github/skill-affinity.json')); print('azure-deploy' in d['agents']['07b-Bicep Deploy']['secondary'])"`     | True      |
| E5  | Secondary for 07t            | `python3 -c "import json; d=json.load(open('.github/skill-affinity.json')); print('azure-deploy' in d['agents']['07t-Terraform Deploy']['secondary'])"` | True      |
| E6  | Still "never" for non-deploy | `python3 -c "import json; d=json.load(open('.github/skill-affinity.json')); print('azure-deploy' in d['agents']['01-Conductor']['never'])"`             | True      |

---

## F. azd CLI & Devcontainer Verification

| #   | Check                            | How to test                                             | Expected                |
| --- | -------------------------------- | ------------------------------------------------------- | ----------------------- |
| F1  | azd feature in devcontainer.json | `grep "azure-dev/azd" .devcontainer/devcontainer.json`  | Match found             |
| F2  | azd auth check in post-start.sh  | `grep "azd auth" .devcontainer/post-start.sh`           | Match found             |
| F3  | azd available on PATH            | `azd version` (after container rebuild)                 | Version string returned |
| F4  | azd auth status                  | `azd auth token --output json` (after `azd auth login`) | Valid token JSON        |

> **Note**: F3-F4 require a devcontainer rebuild. Test after `devcontainer rebuild`.

---

## G. azure.yaml & Deploy Agent Verification

| #   | Check                                    | Command                                                                        | Expected    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| G1  | azure.yaml exists for nordic-fresh-foods | `ls infra/bicep/nordic-fresh-foods/azure.yaml`                                 | File exists |
| G2  | azure.yaml has correct infra provider    | `grep "provider: bicep" infra/bicep/nordic-fresh-foods/azure.yaml`             | Match found |
| G3  | azure.yaml has hooks                     | `grep "preprovision\|postprovision" infra/bicep/nordic-fresh-foods/azure.yaml` | Both found  |
| G4  | 07b agent has azd-first workflow         | `grep "azd provision" .github/agents/07b-bicep-deploy.agent.md`                | Match found |
| G5  | 07b agent keeps deploy.ps1 fallback      | `grep "deploy.ps1" .github/agents/07b-bicep-deploy.agent.md`                   | Match found |
| G6  | 06b codegen generates azure.yaml         | `grep "azure.yaml" .github/agents/06b-bicep-codegen.agent.md`                  | Match found |
| G7  | iac-common has azd patterns              | `grep "azd provision" .github/skills/iac-common/SKILL.md`                      | Match found |
| G8  | iac-common has decision table            | `grep "azd vs deploy.ps1" .github/skills/iac-common/SKILL.md`                  | Match found |
| G9  | infra/bicep/AGENTS.md updated            | `grep "azd provision" infra/bicep/AGENTS.md`                                   | Match found |
| G10 | AGENTS.md lists azd                      | `grep "Azure Developer CLI" AGENTS.md`                                         | Match found |

---

## H. MCP Configuration Verification

| #   | Check                       | Command                             | Expected                                |
| --- | --------------------------- | ----------------------------------- | --------------------------------------- |
| H1  | .mcp.json exists            | `cat .mcp.json`                     | Valid JSON with azure-mcp-plugin server |
| H2  | .vscode/mcp.json unchanged  | `git diff main -- .vscode/mcp.json` | Empty (no changes)                      |
| H3  | MCP config validator passes | `npm run lint:mcp-config`           | PASS                                    |

---

## I. Documentation Verification

| #   | Check                                      | Command                                                                   | Expected    |
| --- | ------------------------------------------ | ------------------------------------------------------------------------- | ----------- |
| I1  | Migration guide exists                     | `test -f docs/migration/azure-skills-plugin.md && echo OK`                | OK          |
| I2  | Migration guide shows azure-deploy active  | `grep "Active.*secondary.*deploy" docs/migration/azure-skills-plugin.md`  | Match found |
| I3  | skills-and-instructions.md updated         | `grep "Azure Plugin Skills" docs/how-it-works/skills-and-instructions.md` | Match found |
| I4  | agents.md has azure-diagnostics            | `grep "azure-diagnostics" docs/how-it-works/agents.md`                    | Match found |
| I5  | agents.md has azure-validate               | `grep "azure-validate" docs/how-it-works/agents.md`                       | Match found |
| I6  | copilot-instructions has azure-diagnostics | `grep "azure-diagnostics" .github/copilot-instructions.md`                | Match found |
| I7  | prompt-guide updated                       | `grep "azure-diagnostics" docs/prompt-guide/reference.md`                 | Match found |

---

## J. New Scripts Verification

| #   | Check                         | Command                                                                                                            | Expected                      |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| J1  | Stale refs script exists      | `node scripts/validate-no-stale-skill-references.mjs 2>&1 \| tail -3`                                              | "PASS" with 0 errors          |
| J2  | Digest generator exists       | `node scripts/generate-skill-digests.mjs --help 2>&1 \|\| node scripts/generate-skill-digests.mjs 2>&1 \| tail -3` | Runs without error            |
| J3  | Both in package.json          | `grep "validate:stale-refs\|generate:digests" package.json`                                                        | Both found                    |
| J4  | stale-refs in validate:\_node | `grep "validate:stale-refs" package.json`                                                                          | Found in validate:\_node line |
| J5  | KNOWN_OVERSIZED updated       | `grep "azure-kusto\|azure-cost-optimization\|azure-quotas" scripts/validate-skill-size.mjs`                        | All 3 found                   |

---

## K. E2E Agent Workflow Smoke Test (Manual)

These require invoking agents in VS Code Copilot and cannot be automated.

| #   | Test                                    | How                                                                   | Expected                                                                           |
| --- | --------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| K1  | Diagnose agent loads azure-diagnostics  | Open Chat → @09-Diagnose → "Diagnose my Azure resources"              | Agent reads `.github/skills/azure-diagnostics/SKILL.md`, NOT azure-troubleshooting |
| K2  | Deploy agent detects azure.yaml         | Open Chat → @07b-Bicep Deploy → "Deploy nordic-fresh-foods"           | Agent detects azure.yaml and offers azd provision as Option 1                      |
| K3  | Deploy agent offers deploy.ps1 fallback | Open Chat → @07b-Bicep Deploy → "Deploy a project without azure.yaml" | Agent falls back to deploy.ps1 workflow                                            |
| K4  | Codegen generates azure.yaml            | Open Chat → @06b-Bicep CodeGen → "Generate infra for a new project"   | Agent includes azure.yaml in file structure output                                 |
| K5  | azure-validate loads for deploy         | Open Chat → @07b-Bicep Deploy → "Run preflight checks"                | Agent references azure-validate skill content (auth, governance, stop rules)       |
| K6  | azure-cost-optimization available       | Open Chat → @08-As-Built → Request cost analysis                      | Agent can load azure-cost-optimization as secondary skill                          |

---

## Automated Test Runner

Run all automated checks (sections A-J) in one shot:

```bash
# Quick sanity (< 30s)
node scripts/validate-agent-registry.mjs && \
node scripts/validate-skill-affinity.mjs && \
node scripts/validate-skills-format.mjs && \
node scripts/validate-no-stale-skill-references.mjs && \
echo "✅ Core validators PASS"

# Full stale reference sweep (< 10s)
grep -r "azure-troubleshooting" .github/ docs/ scripts/ AGENTS.md \
  --include="*.md" --include="*.json" --include="*.mjs" --include="*.jsonc" \
  | grep -v "PLUGIN_VERSION\|validate-no-stale\|migration/" \
  | wc -l  # Expected: 0

# Full automated suite (< 2min)
npm run validate:all
```
