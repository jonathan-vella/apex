<!-- ref:codegen-do-dont-v1 -->

# Codegen DO / DON'T — Shared Rules

Canonical DO/DON'T list for the Step 5 IaC CodeGen agents
([`06b-bicep-codegen`](../../../agents/06b-bicep-codegen.agent.md) and
[`06t-terraform-codegen`](../../../agents/06t-terraform-codegen.agent.md)).
Both agents read this file and append only their tool-specific bullets
(Bicep parameter types, AVM-vs-azurerm phrasing, Front Door dual-location,
PostgreSQL Entra-only, `terraform -target` ban, `var.deployment_phase`,
etc.) in their own bodies.

Anything that applies to **both** Bicep and Terraform CodeGen lives
here. If a rule starts to drift between the two agents, update this
file first.

---

## DO — applies to both 06b and 06t

- **Run preflight check BEFORE writing any IaC** (Phase 1).
- Use `askQuestions` to present Phase 1 + 1.5 blockers (batch all open
  decisions into one inline form).
- Use AVM / AVM-TF modules for **every** resource that has one.
- Generate the unique-suffix value **once** (in `main.bicep` for Bicep,
  `locals.tf` for Terraform) and pass it to every module / resource.
- Apply baseline tags + governance extras from
  `04-governance-constraints.json` (no hand-authored tag maps).
- Parse `04-governance-constraints.json` and map each Deny / DeployIfNotExists
  policy to a concrete IaC argument or module input.
- Apply the project security baseline: TLS 1.2 minimum, HTTPS-only,
  Managed Identity (no shared keys), `publicNetworkAccess: Disabled`
  for prod data services, no `allowSharedKeyAccess`, no public blob.
- Run the tool-specific lint/build step after generation
  (`bicep build` + `bicep lint` for Bicep, `terraform validate` +
  `terraform fmt -check` for Terraform).
- **Inspect the compiled module schema before authoring an AVM call**.
  For Bicep: read `~/.bicep/br/mcr.microsoft.com/bicep$<module-path>/<version>$/main.json`
  and confirm every param name (and every nested object-type field name) you
  intend to use exists in the schema. Drift between AVM minor versions is the
  single biggest cause of `bicep build` failures — see
  [`avm-pitfalls.md` § Schema Drift](../../azure-bicep-patterns/references/avm-pitfalls.md#schema-drift-in-pinned-avm-versions-mandatory-pre-author-check)
  for the running catalogue of cases. For Terraform: use
  `terraform providers schema -json` (or the upstream module README pinned to
  the exact version) — never copy variable names from docs alone.
- Save `05-implementation-reference.md` and update the project README.

## DON'T — applies to both 06b and 06t

- Start coding before the preflight check passes.
- Silently halt on a blocker without telling the user why.
- List blockers in chat and wait for a reply — that wastes a round-trip;
  use `askQuestions` (DO list).
- **Edit `agent-output/{project}/04-implementation-plan.md`,
  `04-governance-constraints.md`, or `04-governance-constraints.json`** —
  frozen after gate-3 per `metadata.plan_lock` in the workflow graph.
  Plan-level `must_fix` findings return to Step 4, not Step 5.
- Invoke `challenger-review-subagent` with
  `artifact_type = "implementation-plan"` from Step 5 — plan-level reviews
  run at Step 4 only; Step 5 uses `artifact_type = "iac-code"`.
- Issue more than one `askQuestions` call per challenger pass — batch
  every open decision into one inline form (see
  [`codegen-shared-workflow.md`](codegen-shared-workflow.md) →
  Batched User Decisions).
- Bundle multiple file bodies in a single response — exceeds VS Code's
  per-response output-token ceiling and aborts the turn with
  _"the response hit the length limit"_. Emit ONE file per response
  turn (see [`codegen-shared-workflow.md`](codegen-shared-workflow.md) →
  Phase 2: Output Cadence).
- Hardcode unique strings (use the shared suffix).
- Use hardcoded tag lists / maps that ignore governance.
- Skip governance compliance mapping (HARD GATE). The
  `Phase 1.5: Governance Compliance Mapping` H2 in the agent body is
  mandatory — never bypass it.
- Use `APPINSIGHTS_INSTRUMENTATIONKEY` — use `APPLICATIONINSIGHTS_CONNECTION_STRING`.
- Put hyphens in Storage Account names.
- **Deploy** — that's the Deploy agent's job (07b / 07t).
- Proceed without checking AVM module parameter / variable types
  (known issues exist; see
  [`avm-module-index.md`](avm-module-index.md)).
- **Generate parameters or variables not declared in the plan's
  Code-Generation Contract section.** If a needed input is missing,
  STOP and traverse `↩ Return to Step 4` per
  [`governance-drift-routing.md`](governance-drift-routing.md).
  CodeGen does NOT invent inputs.
