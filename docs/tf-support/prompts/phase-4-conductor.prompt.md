---
mode: agent
description: Implements Phase 4 — Conductor & Requirements modifications. Adds IaC selection to Requirements, Terraform routing to Conductor, iac_tool awareness to Architect.
---

# Phase 4 — Conductor & Requirements Modifications

## Prerequisites

**CRITICAL**: Phase 2 agents must be merged BEFORE this phase.
The CI `agent-validation.yml` validates that every `handoffs:` reference points to a
real agent file. Modifying the Conductor to reference `11-Terraform Planner` will fail
CI if that file doesn't exist yet.

Options:
- Confirm Phase 2 is merged, then do Phase 4 as a separate PR
- OR batch Phase 3 + Phase 4 together with Phase 2 in one large PR

## Context Load

1. `docs/tf-support/PROGRESS.md` — confirm Phase 4 is active
2. `.github/agents/01-conductor.agent.md` — current state (READ ALL of it)
3. `.github/agents/02-requirements.agent.md` — current state
4. `.github/agents/03-architect.agent.md` — current state
5. `docs/tf-support/tf-support-plan.prompt.md` — items 21, 22, 23

## Item 4.21 — Modify `02-requirements.agent.md`

Add `iac_tool` field to the Requirements agent. IaC preference is captured ONCE here.

Changes needed:

1. Find the "Must-Have Information" table in the agent body. Add a new row:
   | IaC tool | Bicep or Terraform — ask if not specified; default is Bicep |

2. Find the `01-requirements.md` output template section. Add `iac_tool` field:
   ```
   iac_tool: Bicep    # or Terraform
   ```

3. Update the workflow path description: change any reference to
   `bicep-plan → bicep-code` → `{iac}-plan → {iac}-code` (or equivalent phrasing)

> This is the **only place** IaC preference is captured. Downstream agents read it
> from `01-requirements.md`. Do NOT add IaC selection prompts to any other agent.

## Item 4.22 — Modify `01-conductor.agent.md`

This is the largest change in Phase 4. Make all changes in a single edit to minimize
the chance of partially-broken frontmatter.

**Frontmatter `agents` array** — add three entries:
```yaml
- "11-Terraform Planner"
- "12-Terraform Code Generator"
- "13-Terraform Deploy"
```

**Frontmatter `handoffs` array** — add three entries:
```yaml
- step: "Step 4: Implementation Plan (Terraform)"
  agent: "11-Terraform Planner"
  description: "When iac_tool=Terraform: create Terraform implementation plan"
- step: "Step 5: Generate Terraform"
  agent: "12-Terraform Code Generator"
  description: "When iac_tool=Terraform: generate Terraform code"
- step: "Step 6: Deploy (Terraform)"
  agent: "13-Terraform Deploy"
  description: "When iac_tool=Terraform: deploy Terraform infrastructure"
```

**Body changes**:

1. Workflow table: update Step 4 label to `IaC Plan (Bicep or Terraform)`,
   Step 5 to `IaC Code`, Step 6 to `Deploy`

2. IaC Routing Logic: add a section that says:
   - Read `iac_tool` from `01-requirements.md` (if it exists)
   - `iac_tool: Bicep` → route to `05-Bicep Planner` → `06-Bicep Code Generator` → `07-Deploy`
   - `iac_tool: Terraform` → route to `11-Terraform Planner` → `12-Terraform Code Generator` → `13-Terraform Deploy`
   - If no requirements artifact exists at direct Step 4 entry, ask: "Bicep or Terraform?" (one-time fallback only)

3. Subagent delegation table: add rows for Terraform planner, code gen, deploy

4. Subagent integration table: add rows for `terraform-lint-subagent`,
   `terraform-review-subagent`, `terraform-plan-subagent`

**DO NOT** split the Conductor into a "Bicep Conductor" and "Terraform Conductor".
One Conductor, one routing rule.

## Item 4.23 — Modify `03-architect.agent.md`

Small change. Find the WAF assessment section or the recommendations section.
Add a note that when `iac_tool: Terraform` is present in `01-requirements.md`:

- Note Terraform-specific considerations: state management, provider constraints,
  backend storage requirements, `random_suffix` for naming, AVM-TF module availability
- These are additive — still produce the same WAF assessment artifact

## Validation

```bash
npm run lint:agent-frontmatter
npm run validate:all
```

After editing the Conductor, specifically verify:
```bash
npm run lint:agent-frontmatter 2>&1 | grep -E "(conductor|FAIL|ERROR)"
```

The agent-validation CI checks handoff targets — run a quick local check:
```bash
for agent in $(grep -oP '(?<="agent": ")[^"]+' .github/agents/01-conductor.agent.md); do
  echo "Checking: $agent"
  grep -rl "name: $agent" .github/agents/ || echo "MISSING: $agent"
done
```

## Commit

```bash
git add .github/agents/01-conductor.agent.md \
        .github/agents/02-requirements.agent.md \
        .github/agents/03-architect.agent.md
git commit -m "feat(agents): add Terraform routing to Conductor and IaC selection to Requirements

- 01-conductor: add 11-/12-/13- agents + handoffs, IaC routing from iac_tool field
- 02-requirements: add iac_tool field (Bicep|Terraform), default Bicep
- 03-architect: add iac_tool awareness for Terraform-specific WAF notes"
```

## Update PROGRESS.md

Check off `4.21`, `4.22`, `4.23`. Phase 4 → `✅ Complete`, `active_phase: 5`. Commit.

## Regression Check

Run `docs/tf-support/prompts/regression-check.prompt.md` — the Conductor modification
is the highest-risk change. Verify existing Bicep routing is unaffected.
