export interface CommandPlan {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
}

export interface BicepTarget {
  readonly resourceGroup: string;
  readonly deploymentName: string;
  readonly templateFile: string;
  readonly parametersFile?: string;
  readonly cwd?: string;
}

export type BicepStackActionOnUnmanage = "deleteAll" | "deleteResources" | "detachAll";
export type BicepStackDenySettingsMode = "denyDelete" | "denyWriteAndDelete" | "none";

export interface BicepStackTarget extends BicepTarget {
  readonly stackName: string;
  readonly actionOnUnmanage?: BicepStackActionOnUnmanage;
  readonly denySettingsMode: BicepStackDenySettingsMode;
  readonly ownershipAuthorizesDeleteResources?: boolean;
  readonly dedicatedSandboxResourceGroup?: boolean;
  readonly allowDeleteAll?: boolean;
}

export interface ResolvedBicepStackTarget extends BicepStackTarget {
  readonly actionOnUnmanage: BicepStackActionOnUnmanage;
}

function withBicepParameters(args: string[], parametersFile: string | undefined): string[] {
  return parametersFile === undefined ? args : [...args, "--parameters", parametersFile];
}

export class BicepCommandAdapter {
  validate(templateFile: string, cwd?: string): CommandPlan {
    return { executable: "bicep", args: ["build", templateFile], ...(cwd === undefined ? {} : { cwd }) };
  }

  preview(target: BicepTarget): CommandPlan {
    const args = withBicepParameters(
      [
        "deployment",
        "group",
        "what-if",
        "--resource-group",
        target.resourceGroup,
        "--name",
        target.deploymentName,
        "--template-file",
        target.templateFile,
        "--output",
        "json",
      ],
      target.parametersFile,
    );
    return { executable: "az", args, ...(target.cwd === undefined ? {} : { cwd: target.cwd }) };
  }

  apply(target: BicepTarget): CommandPlan {
    const args = withBicepParameters(
      [
        "deployment",
        "group",
        "create",
        "--resource-group",
        target.resourceGroup,
        "--name",
        target.deploymentName,
        "--template-file",
        target.templateFile,
        "--output",
        "json",
      ],
      target.parametersFile,
    );
    return { executable: "az", args, ...(target.cwd === undefined ? {} : { cwd: target.cwd }) };
  }

  stackApply(target: ResolvedBicepStackTarget): CommandPlan {
    const args = withBicepParameters(
      [
        "stack",
        "group",
        "create",
        "--resource-group",
        target.resourceGroup,
        "--name",
        target.stackName,
        "--template-file",
        target.templateFile,
        "--action-on-unmanage",
        target.actionOnUnmanage,
        "--deny-settings-mode",
        target.denySettingsMode,
        "--yes",
        "--output",
        "json",
      ],
      target.parametersFile,
    );
    return { executable: "az", args, ...(target.cwd === undefined ? {} : { cwd: target.cwd }) };
  }

  stackDestroy(target: ResolvedBicepStackTarget): CommandPlan {
    return {
      executable: "az",
      args: [
        "stack",
        "group",
        "delete",
        "--resource-group",
        target.resourceGroup,
        "--name",
        target.stackName,
        "--action-on-unmanage",
        target.actionOnUnmanage,
        "--yes",
        "--output",
        "json",
      ],
      ...(target.cwd === undefined ? {} : { cwd: target.cwd }),
    };
  }

  stackList(target: BicepStackTarget): CommandPlan {
    return {
      executable: "az",
      args: ["stack", "group", "list", "--resource-group", target.resourceGroup, "--output", "json"],
      ...(target.cwd === undefined ? {} : { cwd: target.cwd }),
    };
  }
}

export class TerraformCommandAdapter {
  init(cwd: string, backend: boolean): CommandPlan {
    return {
      executable: "terraform",
      args: ["init", `-backend=${String(backend)}`, "-input=false"],
      cwd,
    };
  }

  validate(cwd: string): readonly CommandPlan[] {
    return [
      { executable: "terraform", args: ["fmt", "-check"], cwd },
      { executable: "terraform", args: ["validate"], cwd },
    ];
  }

  preview(cwd: string, savedPlanPath: string, destroy = false): CommandPlan {
    this.#requirePlanPath(savedPlanPath);
    return {
      executable: "terraform",
      args: ["plan", ...(destroy ? ["-destroy"] : []), `-out=${savedPlanPath}`, "-input=false"],
      cwd,
    };
  }

  applyExact(cwd: string, savedPlanPath: string): CommandPlan {
    this.#requirePlanPath(savedPlanPath);
    return { executable: "terraform", args: ["apply", "-input=false", savedPlanPath], cwd };
  }

  showJson(cwd: string, savedPlanPath: string): CommandPlan {
    this.#requirePlanPath(savedPlanPath);
    return { executable: "terraform", args: ["show", "-json", savedPlanPath], cwd };
  }

  #requirePlanPath(savedPlanPath: string): void {
    if (savedPlanPath.trim().length === 0 || savedPlanPath.startsWith("-")) {
      throw new TypeError("A concrete saved Terraform plan path is required");
    }
  }
}

export class AzureCliReadAdapter {
  resourceGraph(query: string, subscriptions: readonly string[] = []): CommandPlan {
    return {
      executable: "az",
      args: [
        "graph",
        "query",
        "--graph-query",
        query,
        ...(subscriptions.length === 0 ? [] : ["--subscriptions", ...subscriptions]),
        "--output",
        "json",
      ],
    };
  }

  armGet(resourceId: string, apiVersion: string): CommandPlan {
    return {
      executable: "az",
      args: ["rest", "--method", "get", "--url", `${resourceId}?api-version=${encodeURIComponent(apiVersion)}`],
    };
  }
}
