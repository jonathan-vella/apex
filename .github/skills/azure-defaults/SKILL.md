---
name: azure-defaults
description: '**UTILITY SKILL** — Applies canonical Azure defaults through an IaC workflow covering governance precedence, CAF naming, AVM-first composition, unique suffixes, cost monitoring, VNet planning, and lifecycle checks. WHEN: "Azure naming convention", "CAF naming", "resource tags", "AVM module", "security baseline", "region default". DO NOT USE FOR: artifact templates or pricing lookups.'
compatibility: Works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool.
license: MIT
metadata:
  author: jonathan-vella
  version: "3.0"
  category: azure-infrastructure
---

# Azure Defaults

Apply the canonical defaults from
[`.github/copilot-instructions.md`](../../copilot-instructions.md#azure-defaults-canonical)
without duplicating them here. Live governance discovered for the target scope
always overrides repository defaults.

## Prerequisites

- Read the canonical Azure Defaults section once per session.
- Read `04-governance-constraints.json` when it exists.
- Read `sku-manifest.json` for creative SKU decisions; do not derive SKUs from
  artifact prose.
- Load only the reference needed for the current decision.

## IaC Workflow

1. **Resolve governance precedence** — apply live policy constraints before
   fallback regions, tags, networking, cost, or security defaults.
2. **Generate one stable suffix** — derive it once from deployment scope and
   pass it to every globally unique resource name.
3. **Apply CAF naming** — use resource-specific abbreviations and length limits;
   load [naming examples](references/naming-full-examples.md) when constraints
   differ by service.
4. **Resolve AVM modules live** — prefer AVM, pin the latest stable version at
   plan time, and record justified stale-pin exceptions in the IaC contract.
5. **Apply canonical security defaults** — use the canonical baseline and load
   [AVM pitfalls](references/security-baseline-full.md) only when module
   parameters or lifecycle constraints require detail.
6. **Run conditional planning gates** — apply VNet and cost-monitoring workflows
   when their triggers hold; governance remains authoritative.
7. **Check service lifecycle** — use the latest supported GA LTS runtime and
   reject retired, classic, preview, or short-lifecycle choices for durable
   production workloads unless explicitly approved.
8. **Validate the output** — run the stack validator and the security, AVM pin,
   SKU coverage, and governance checks relevant to the produced IaC.

## IaC-Specific Invariants

- **Unique suffix**: generate one deterministic suffix per deployment scope and
  pass it into modules rather than recomputing it independently.
- **AVM-first**: do not hand-roll a resource with an applicable stable AVM module.
- **Live pins**: resolve module versions at plan time; training-data pins are not
  evidence of currency.
- **Governance wins**: discovered policy overrides every fallback in the
  canonical defaults and this workflow.
- **VNet planning is interactive**: confirm CIDRs when a workload requires VNet
  integration, private endpoints, or a VNet-attached service. Production cannot
  defer the gate.
- **Cost monitoring is explicit**: production requires the governed budget,
  notification, and anomaly-monitoring contract; non-production exceptions must
  use a documented mode.
- **Lifecycle is verified live**: selectable engine and runtime versions require
  current support-policy evidence.

## Validation

```bash
npm run validate:region-canonical
npm run validate:iac-security-baseline
npm run validate:avm-versions:freeze
npm run validate:sku-iac-coverage
```

Then run `bicep build` and `bicep lint`, or `terraform fmt -check` and
`terraform validate`, for the selected stack.

## Reference Index

Load references progressively; do not read the directory wholesale.

| Decision area | References |
| --- | --- |
| Naming and tags | [Naming examples](references/naming-full-examples.md), [tag strategy](references/tag-strategy.md) |
| AVM and security | [AVM modules](references/avm-modules.md), [security and AVM pitfalls](references/security-baseline-full.md) |
| Networking | [VNet planning](references/vnet-planning.md), [identity resolution](references/identity-resolution.md) |
| Cost and sizing | [Cost baseline](references/cost-alerts-baseline.md), [Bicep](references/cost-alerts-bicep.md), [Terraform](references/cost-alerts-terraform.md), [pricing](references/pricing-guidance.md), [service matrices](references/service-matrices.md) |
| Governance and lifecycle | [Governance discovery](references/governance-discovery.md), [policy effects](references/policy-effect-decision-tree.md), [deprecated services](references/deprecated-services.md), [workflow gates](references/workflow-gates.md) |
| Architecture and review | [WAF criteria](references/waf-criteria.md), [research workflow](references/research-workflow.md), [review protocol](references/adversarial-review-protocol.md), [deep review](references/adversarial-review-deep.md) |
| IaC implementation | [Terraform conventions](references/terraform-conventions.md), [plan decisions](references/plan-design-decisions.md), [Azure CLI auth](references/azure-cli-auth-validation.md) |
| Artifact integration | [Artifact categories](references/artifact-type-categories.md), [cost delegation](references/cost-estimate-parent-contract.md), [service class menu](references/service-class-menu.md) |
