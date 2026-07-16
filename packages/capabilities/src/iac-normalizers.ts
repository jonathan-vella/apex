import type { DeploymentPreviewV1 } from "@apex/contracts";

export type NormalizedPreview = Pick<DeploymentPreviewV1, "changes" | "blockers"> & {
  readonly stateLineage?: string;
  readonly stateSerial?: number;
};

export class IacOutputParseError extends Error {
  constructor(
    public readonly source: "azure-what-if" | "azure-stack" | "terraform-plan",
    message: string,
  ) {
    super(message);
    this.name = "IacOutputParseError";
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseJsonProcessOutput(source: IacOutputParseError["source"], stdout: string): unknown {
  try {
    return JSON.parse(stdout) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new IacOutputParseError(source, `Invalid ${source} JSON output: ${reason}`);
  }
}

export function normalizeAzureWhatIf(value: unknown): NormalizedPreview {
  const root = object(value);
  if (root === undefined) {
    throw new IacOutputParseError("azure-what-if", "Azure what-if output must be a JSON object");
  }
  const properties = object(root.properties);
  const rawChanges = array(properties?.changes ?? root.changes);
  if (!Array.isArray(properties?.changes ?? root.changes)) {
    throw new IacOutputParseError("azure-what-if", "Azure what-if output does not contain a changes array");
  }

  const blockers: string[] = [];
  const changes: DeploymentPreviewV1["changes"] = rawChanges.map((entry, index) => {
    const change = object(entry);
    if (change === undefined) blockers.push(`Azure what-if change ${index} is not a JSON object`);
    const resourceId = text(change?.resourceId) ?? text(change?.id) ?? `unknown-azure-resource-${index}`;
    const rawType = text(change?.changeType) ?? text(change?.result) ?? "Unknown";
    const normalized = rawType.toLowerCase().replaceAll(/[^a-z]/g, "");
    const action =
      normalized === "create"
        ? "create"
        : normalized === "modify" || normalized === "update" || normalized === "deploy"
          ? "update"
          : normalized === "delete"
            ? "delete"
            : normalized === "nochange" || normalized === "noeffect" || normalized === "ignore"
              ? "no-op"
              : "unknown";
    if (action === "unknown") {
      blockers.push(`Azure what-if returned unsupported or unevaluated change '${rawType}' for '${resourceId}'`);
    }
    if (action !== "no-op" && resourceId.startsWith("unknown-")) {
      blockers.push(`Azure material change ${index} has no stable resource ID`);
    }
    return {
      resourceId,
      action,
      material: action !== "no-op",
      details: `Azure changeType: ${rawType}`,
    };
  });

  const materialIds = changes.filter(({ material }) => material).map(({ resourceId }) => resourceId);
  for (const duplicate of materialIds.filter((id, index) => materialIds.indexOf(id) !== index)) {
    blockers.push(`Azure what-if contains duplicate material resource ID '${duplicate}'`);
  }

  for (const diagnostic of array(properties?.diagnostics ?? root.diagnostics)) {
    const item = object(diagnostic);
    const level = text(item?.level)?.toLowerCase();
    if (level === "error" || level === "warning") {
      blockers.push(text(item?.message) ?? `Azure what-if ${level} diagnostic`);
    }
  }
  return { changes, blockers };
}

export function normalizeTerraformPlan(value: unknown): NormalizedPreview {
  const root = object(value);
  if (root === undefined) {
    throw new IacOutputParseError("terraform-plan", "Terraform plan output must be a JSON object");
  }
  const blockers: string[] = [];
  const changes: DeploymentPreviewV1["changes"] = array(root.resource_changes).map((entry, index) => {
    const resource = object(entry);
    const change = object(resource?.change);
    if (resource === undefined || change === undefined || !Array.isArray(change?.actions)) {
      blockers.push(`Terraform resource change ${index} is malformed`);
    }
    const actions = array(change?.actions).filter((action): action is string => typeof action === "string");
    const resourceId = text(resource?.address) ?? `unknown-terraform-resource-${index}`;
    const signature = actions.join(",");
    const action =
      signature === "create"
        ? "create"
        : signature === "update"
          ? "update"
          : signature === "delete"
            ? "delete"
            : signature === "no-op" || signature === "read"
              ? "no-op"
              : signature === "delete,create" || signature === "create,delete"
                ? "replace"
                : "unknown";
    if (action === "unknown") {
      blockers.push(
        `Terraform returned unsupported or unevaluated actions '${signature || "missing"}' for '${resourceId}'`,
      );
    }
    if (action !== "no-op" && resourceId.startsWith("unknown-")) {
      blockers.push(`Terraform material change ${index} has no stable resource address`);
    }
    return {
      resourceId,
      action,
      material: action !== "no-op",
      details: `Terraform actions: ${signature || "missing"}`,
    };
  });
  const materialIds = changes.filter(({ material }) => material).map(({ resourceId }) => resourceId);
  for (const duplicate of materialIds.filter((id, index) => materialIds.indexOf(id) !== index)) {
    blockers.push(`Terraform plan contains duplicate material resource address '${duplicate}'`);
  }
  if (array(root.deferred_changes).length > 0) {
    blockers.push("Terraform plan contains deferred changes that cannot be evaluated safely");
  }
  if (root.errored === true) {
    blockers.push("Terraform reported an errored plan");
  }
  const priorState = object(root.prior_state);
  const stateValues = object(priorState?.values);
  const lineage = text(priorState?.lineage) ?? text(stateValues?.lineage);
  const serialValue = priorState?.serial ?? stateValues?.serial;
  const serial =
    typeof serialValue === "number" && Number.isInteger(serialValue) && serialValue >= 0 ? serialValue : undefined;
  return {
    changes,
    blockers,
    ...(lineage === undefined ? {} : { stateLineage: lineage }),
    ...(serial === undefined ? {} : { stateSerial: serial }),
  };
}

export interface AzureStackResource {
  readonly logicalId: string;
  readonly resourceId: string;
  readonly type: string;
  readonly location: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export function selectAzureDeploymentStack(value: unknown, resourceGroup: string, stackName: string): unknown | null {
  if (!Array.isArray(value)) {
    throw new IacOutputParseError("azure-stack", "Azure stack list output must be a JSON array");
  }
  const names = new Set<string>();
  let selected: Record<string, unknown> | null = null;
  for (const [index, entry] of value.entries()) {
    const stack = object(entry);
    const name = text(stack?.name);
    const id = text(stack?.id);
    if (stack === undefined || name === undefined || id === undefined) {
      throw new IacOutputParseError("azure-stack", `Azure stack list entry ${index} is malformed`);
    }
    const normalizedName = name.toLowerCase();
    if (names.has(normalizedName)) {
      throw new IacOutputParseError("azure-stack", `Azure stack list contains duplicate name '${name}'`);
    }
    names.add(normalizedName);
    const expectedSuffix = `/resourcegroups/${resourceGroup.toLowerCase()}/providers/microsoft.resources/deploymentstacks/${normalizedName}`;
    if (!id.toLowerCase().endsWith(expectedSuffix)) {
      throw new IacOutputParseError("azure-stack", `Azure stack '${name}' is outside the requested resource group`);
    }
    if (normalizedName === stackName.toLowerCase()) selected = stack;
  }
  if (selected === null) return null;
  const properties = object(selected.properties);
  if (properties === undefined || !Array.isArray(properties.resources)) {
    throw new IacOutputParseError("azure-stack", `Azure stack '${stackName}' has malformed managed resources`);
  }
  return selected;
}

export function normalizeAzureStackResources(value: unknown): readonly AzureStackResource[] {
  const root = object(value);
  if (root === undefined) {
    throw new IacOutputParseError("azure-stack", "Azure stack output must be a JSON object");
  }
  const properties = object(root.properties);
  const resources = array(properties?.resources ?? root.resources);
  return resources.map((entry, index) => {
    const resource = object(entry);
    const resourceId = text(resource?.id) ?? text(resource?.resourceId);
    if (resourceId === undefined) {
      throw new IacOutputParseError("azure-stack", `Azure stack resource ${index} has no resource ID`);
    }
    return {
      logicalId: text(resource?.name) ?? resourceId,
      resourceId,
      type: text(resource?.type) ?? "unknown",
      location: text(resource?.location) ?? "global",
      properties: object(resource?.properties) ?? {},
    };
  });
}
