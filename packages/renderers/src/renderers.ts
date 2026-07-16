import type {
  ApprovalEvidenceV1,
  DeploymentPreviewV1,
  RequirementsV1,
  ResourceInventoryV1,
  RunConfigV1,
} from "@apex/contracts";
import { escapeMarkdown, markdownTable, optional, stableJson } from "./markdown.js";

const compareText = (left: string, right: string): number => left.localeCompare(right);

function fieldList(fields: readonly (readonly [string, unknown])[]): string {
  return fields.map(([label, value]) => `- **${label}:** ${escapeMarkdown(value)}`).join("\n");
}

export function renderRequirements(requirements: RequirementsV1): string {
  const rows = [...requirements.requirements]
    .sort((left, right) => compareText(left.id, right.id))
    .map((item) => [item.id, item.priority, item.status, item.statement, item.source]);
  const assumptions = [...requirements.assumptions].sort(compareText);
  const unknowns = [...requirements.unknowns].sort(compareText);
  return [
    "# Requirements",
    "",
    fieldList([
      ["Project", requirements.projectId],
      ["Environment", requirements.environment],
      ["Workload", requirements.workload],
    ]),
    "",
    "## Requirements",
    "",
    markdownTable(["ID", "Priority", "Status", "Statement", "Source"], rows),
    "",
    "## Assumptions",
    "",
    assumptions.length === 0 ? "None." : assumptions.map((item) => `- ${escapeMarkdown(item)}`).join("\n"),
    "",
    "## Unknowns",
    "",
    unknowns.length === 0 ? "None." : unknowns.map((item) => `- ${escapeMarkdown(item)}`).join("\n"),
  ].join("\n");
}

export function renderRunStatus(run: RunConfigV1): string {
  const gates = [...run.gates]
    .sort((left, right) => left.gate - right.gate)
    .map((gate) => [
      gate.gate,
      gate.state,
      gate.state === "inherited" ? optional(gate.inheritedFromRunId) : "-",
      optional(gate.decidedAt),
      optional(gate.reason),
      gate.dependencyHash,
    ]);
  return [
    "# Run Status",
    "",
    fieldList([
      ["Project", run.projectId],
      ["Run", run.runId],
      ["Environment", run.environment],
      ["Target scope", run.targetScope],
      ["IaC tool", run.iacTool],
      ["Parent run", optional(run.parentRunId)],
      ["Owner epoch", run.ownerEpoch],
      ["Created", run.createdAt],
    ]),
    "",
    "## Gates",
    "",
    markdownTable(["Gate", "State", "Inherited From", "Decided", "Reason", "Dependency Hash"], gates),
  ].join("\n");
}

function previewAction(action: DeploymentPreviewV1["changes"][number]["action"]): string {
  return action === "delete" || action === "replace" ? `**${action.toUpperCase()}**` : action;
}

export function renderDeploymentPreview(preview: DeploymentPreviewV1): string {
  const changes = [...preview.changes]
    .sort((left, right) =>
      compareText(`${left.resourceId}\u0000${left.action}`, `${right.resourceId}\u0000${right.action}`),
    )
    .map((change) => [
      change.resourceId,
      previewAction(change.action),
      change.material ? "yes" : "no",
      optional(change.details),
    ]);
  const blockers = [...preview.blockers].sort(compareText);
  const destructive =
    preview.operation === "destroy" ||
    preview.changes.some(({ action }) => action === "delete" || action === "replace");
  return [
    "# Deployment Preview",
    "",
    destructive ? "> **DESTRUCTIVE CHANGES PRESENT**" : "> No destructive changes detected.",
    "",
    fieldList([
      ["Project", preview.projectId],
      ["Run", preview.runId],
      ["Environment", preview.environment],
      ["Track", preview.track],
      ["Operation", preview.operation],
      ["Target", preview.target],
      ["Created", preview.createdAt],
      ["Expires", preview.expiresAt],
      ["Preview hash", preview.previewHash],
    ]),
    "",
    "## Blockers",
    "",
    blockers.length === 0 ? "None." : blockers.map((blocker) => `- **BLOCKED:** ${escapeMarkdown(blocker)}`).join("\n"),
    "",
    "## Semantic Changes",
    "",
    changes.length === 0 ? "No changes." : markdownTable(["Resource", "Action", "Material", "Details"], changes),
  ].join("\n");
}

export function renderApprovalEvidence(approval: ApprovalEvidenceV1): string {
  const summary = [
    "# Approval Evidence",
    "",
    fieldList([
      ["Project", approval.projectId],
      ["Run", approval.runId],
      ["Gate", approval.gate],
      ["Decision", approval.decision.toUpperCase()],
      ["Actor", approval.actor],
      ["Mechanism", approval.mechanism],
      ["Recipient identity", optional(approval.recipientIdentity)],
      ["Writer transfer claim hash", optional(approval.writerTransferClaimHash)],
      ["Writer epoch", approval.writerEpoch],
      ["Dependency hash", approval.dependencyHash],
      ["Preview hash", optional(approval.previewHash)],
      ["Decided", approval.decidedAt],
      ["Expires", optional(approval.expiresAt)],
    ]),
  ];
  if (approval.mechanism === "github-environment") {
    summary.push(
      "",
      "## GitHub Environment Context",
      "",
      fieldList([
        ["Repository", approval.githubContext.repository],
        ["Ref", approval.githubContext.ref],
        ["Commit", approval.githubContext.sha],
        ["Workflow ref", approval.githubContext.workflowRef],
        ["Run", `${approval.githubContext.runId} (attempt ${approval.githubContext.runAttempt})`],
        ["Job", approval.githubContext.job],
        ["Environment", approval.githubContext.environment],
        ["Workflow actor", approval.githubContext.actor],
        ["Workflow actor ID", approval.githubContext.actorId],
        ["Recipient identity", approval.githubContext.recipientIdentity],
      ]),
    );
  }
  return summary.join("\n");
}

export function renderResourceInventory(inventory: ResourceInventoryV1): string {
  const rows = [...inventory.resources]
    .sort((left, right) =>
      compareText(`${left.logicalId}\u0000${left.resourceId}`, `${right.logicalId}\u0000${right.resourceId}`),
    )
    .map((resource) => [
      resource.logicalId,
      resource.resourceId,
      resource.type,
      resource.location,
      stableJson(resource.properties),
    ]);
  return [
    "# Resource Inventory",
    "",
    fieldList([
      ["Project", inventory.projectId],
      ["Run", inventory.runId],
      ["Deployment hash", inventory.deploymentHash],
      ["Collected", inventory.collectedAt],
    ]),
    "",
    "## Resources",
    "",
    rows.length === 0
      ? "No resources."
      : markdownTable(["Logical ID", "Resource ID", "Type", "Location", "Properties"], rows),
  ].join("\n");
}
