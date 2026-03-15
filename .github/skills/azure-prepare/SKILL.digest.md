<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Prepare (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Triggers

Activate this skill when user wants to:
- Create a new application
- Add services or components to an existing app
- Make updates or changes to existing application
- Modernize or migrate an application
- Set up Azure infrastructure

> _See SKILL.md for full content._

## Rules

1. **Plan first** — Create `.azure/plan.md` before any code generation
2. **Get approval** — Present plan to user before execution
3. **Research before generating** — Load references and invoke related skills
4. **Update plan progressively** — Mark steps complete as you go
5. **Validate before deploy** — Invoke azure-validate before azure-deploy
6. **Confirm Azure context** — Use `ask_user` for subscription and location per [Azure Context](references/azure-context.md)

> _See SKILL.md for full content._

## ❌ PLAN-FIRST WORKFLOW — MANDATORY

> **YOU MUST CREATE A PLAN BEFORE DOING ANY WORK**
>
> 1. **STOP** — Do not generate any code, infrastructure, or configuration yet
> 2. **PLAN** — Follow the Planning Phase below to create `.azure/plan.md`
> 3. **CONFIRM** — Present the plan to the user and get approval
> 4. **EXECUTE** — Only after approval, execute the plan step by step

> _See SKILL.md for full content._

## ❌ STEP 0: Specialized Technology Check — MANDATORY FIRST ACTION

**BEFORE starting Phase 1**, check if the user's prompt mentions a specialized technology that has a dedicated skill with tested templates. If matched, **invoke that skill FIRST** — then resume azure-prepare for validation and deployment.

| Prompt keywords | Invoke FIRST |
|----------------|-------------|
| Lambda, AWS Lambda, migrate AWS, migrate GCP, Lambda to Functions, migrate from AWS, migrate from GCP | **azure-cloud-migrate** |
| copilot SDK, copilot app, copilot-powered, @github/copilot-sdk, CopilotClient | **azure-hosted-copilot-sdk** |

> _See SKILL.md for full content._

## Phase 1: Planning (BLOCKING — Complete Before Any Execution)

Create `.azure/plan.md` by completing these steps. Do NOT generate any artifacts until the plan is approved.

| # | Action | Reference |
|---|--------|-----------|
| 0 | **❌ Check Prompt for Specialized Tech** — If user mentions copilot SDK, Azure Functions, etc., invoke that skill first | [specialized-routing.md](references/specialized-routing.md) |
| 1 | **Analyze Workspace** — Determine mode: NEW, MODIFY, or MODERNIZE | [analyze.md](references/analyze.md) |

> _See SKILL.md for full content._

## Phase 2: Execution (Only After Plan Approval)

Execute the approved plan. Update `.azure/plan.md` status after each step.

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Research Components** — Load service references + invoke related skills | [research.md](references/research.md) |
| 2 | **Confirm Azure Context** — Detect and confirm subscription + location and check the resource provisioning limit | [Azure Context](references/azure-context.md) |

> _See SKILL.md for full content._

## Outputs

| Artifact | Location |
|----------|----------|
| **Plan** | `.azure/plan.md` |
| Infrastructure | `./infra/` |
| AZD Config | `azure.yaml` (AZD only) |
| Dockerfiles | `src/<component>/Dockerfile` |

> _See SKILL.md for full content._

## SDK Quick References

- **Azure Developer CLI**: [azd](references/sdk/azd-deployment.md)
- **Azure Identity**: [Python](references/sdk/azure-identity-py.md) | [.NET](references/sdk/azure-identity-dotnet.md) | [TypeScript](references/sdk/azure-identity-ts.md) | [Java](references/sdk/azure-identity-java.md)
- **App Configuration**: [Python](references/sdk/azure-appconfiguration-py.md) | [TypeScript](references/sdk/azure-appconfiguration-ts.md) | [Java](references/sdk/azure-appconfiguration-java.md)

---
