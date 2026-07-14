export type WorkflowValidatorExecution = "schema" | "inline" | "capability" | "review" | "external-command";

export interface WorkflowValidatorOwnership {
  readonly id: string;
  readonly owner: "@apex/kernel" | "@apex/capabilities" | "@apex/cli";
  readonly entrypoint: string;
  readonly execution: WorkflowValidatorExecution;
}

interface OwnershipGroup extends Omit<WorkflowValidatorOwnership, "id"> {
  readonly ids: readonly string[];
}

const ownershipGroups: readonly OwnershipGroup[] = [
  {
    ids: [
      "schema:architecture-v1",
      "schema:governance-constraints-v1",
      "schema:iac-binding-v1",
      "schema:implementation-intent-v1",
      "schema:policy-property-map-v1",
      "schema:requirements-v1",
    ],
    owner: "@apex/cli",
    entrypoint: "ApexService.assertValid",
    execution: "schema",
  },
  {
    ids: [
      "business:availability-current",
      "business:bicep-binding-coverage",
      "business:binding-track-match",
      "business:cost-arithmetic",
      "business:dependency-acyclic",
      "business:governance-completeness",
      "business:governance-freshness",
      "business:plan-source-coverage",
      "business:policy-effect-coverage",
      "business:policy-property-map",
      "business:requirements-completeness",
      "business:requirements-traceability",
      "business:terraform-binding-coverage",
    ],
    owner: "@apex/cli",
    entrypoint: "ApexService.completeTask",
    execution: "inline",
  },
  {
    ids: ["business:logical-resource-parity", "business:security-baseline"],
    owner: "@apex/capabilities",
    entrypoint: "validateGeneratedTree",
    execution: "capability",
  },
  {
    ids: [
      "review:architecture-comprehensive",
      "review:governance-reconciliation",
      "review:plan-comprehensive",
      "review:requirements-comprehensive",
    ],
    owner: "@apex/cli",
    entrypoint: "ApexService.reviewBlockers",
    execution: "review",
  },
  {
    ids: ["gate:architecture-cost-governance-ready", "gate:implementation-plan-ready", "gate:requirements-ready"],
    owner: "@apex/cli",
    entrypoint: "ApexService.route",
    execution: "inline",
  },
  {
    ids: ["gate:approval-binding-complete", "gate:no-hard-blockers", "gate:preview-current"],
    owner: "@apex/cli",
    entrypoint: "ApexService.assertPreviewReady",
    execution: "inline",
  },
  {
    ids: ["bicep:build", "bicep:format", "bicep:lint"],
    owner: "@apex/capabilities",
    entrypoint: "validateGeneratedTree",
    execution: "external-command",
  },
  {
    ids: ["terraform:format", "terraform:init-backend-false", "terraform:validate"],
    owner: "@apex/capabilities",
    entrypoint: "validateGeneratedTree",
    execution: "external-command",
  },
  {
    ids: ["terraform:saved-plan-binding"],
    owner: "@apex/capabilities",
    entrypoint: "NativeTerraformProvider.previewApply",
    execution: "capability",
  },
  {
    ids: ["preview:coverage", "preview:freshness", "preview:hash-bindings", "preview:policy-precheck"],
    owner: "@apex/cli",
    entrypoint: "ApexService.assertPreviewReady",
    execution: "inline",
  },
  {
    ids: ["deploy:exact-approved-operation", "deploy:stale-writer-rejection"],
    owner: "@apex/cli",
    entrypoint: "ApexService.deploy",
    execution: "inline",
  },
  {
    ids: ["deploy:bicep-stack-ownership"],
    owner: "@apex/capabilities",
    entrypoint: "NativeBicepProvider.apply",
    execution: "capability",
  },
  {
    ids: ["deploy:exact-saved-plan", "deploy:state-lineage-and-serial"],
    owner: "@apex/capabilities",
    entrypoint: "NativeTerraformProvider.apply",
    execution: "capability",
  },
  {
    ids: ["inventory:eventual-consistency-reconciled", "inventory:secret-free", "inventory:source-coverage"],
    owner: "@apex/cli",
    entrypoint: "ApexService.inventory",
    execution: "inline",
  },
  {
    ids: ["diagnosis:read-only", "diagnosis:secret-free"],
    owner: "@apex/cli",
    entrypoint: "ApexService.diagnose",
    execution: "inline",
  },
  {
    ids: ["quality:no-subjective-deterministic-claims", "quality:scorecard-decidable"],
    owner: "@apex/cli",
    entrypoint: "evaluateQuality",
    execution: "inline",
  },
  {
    ids: ["terminal:run-evidence-complete"],
    owner: "@apex/cli",
    entrypoint: "ApexService.status",
    execution: "inline",
  },
];

const ownershipEntries = ownershipGroups.flatMap(({ ids, ...ownership }) =>
  ids.map((id): WorkflowValidatorOwnership => ({ id, ...ownership })),
);

export const WORKFLOW_VALIDATOR_OWNERSHIP: ReadonlyMap<string, WorkflowValidatorOwnership> = new Map(
  ownershipEntries.map((entry) => [entry.id, entry]),
);

if (WORKFLOW_VALIDATOR_OWNERSHIP.size !== ownershipEntries.length) {
  throw new Error("Workflow validator ownership contains duplicate IDs");
}

export function workflowValidatorOwnership(id: string): WorkflowValidatorOwnership | undefined {
  return WORKFLOW_VALIDATOR_OWNERSHIP.get(id);
}
