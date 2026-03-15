<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Prepare (Minimal)

**Triggers**:
Activate this skill when user wants to:

**Rules**:
1. **Plan first** — Create `.azure/plan.md` before any code generation

**❌ PLAN-FIRST WORKFLOW — MANDATORY**:

**❌ STEP 0: Specialized Technology Check — MANDATORY FIRST ACTION**:
**BEFORE starting Phase 1**, check if the user's prompt mentions a specialized technology that has a dedicated skill wit

**Phase 1: Planning (BLOCKING — Complete Before Any Execution)**:
Create `.azure/plan.md` by completing these steps. Do NOT generate any artifacts until the plan is approved.

**Phase 2: Execution (Only After Plan Approval)**:
Execute the approved plan. Update `.azure/plan.md` status after each step.

**Outputs**:

**SDK Quick References**:

**Next**:
**→ Update plan status to `Ready for Validation`, then invoke azure-validate**

**Reference Index**:
Load these on demand — do NOT read all at once:

Read `SKILL.md` or `SKILL.digest.md` for full content.
