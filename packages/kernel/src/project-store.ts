import type { IacTool, ProjectConfigV1, ProjectId, RunConfigV1, RunId } from "@apex/contracts";
import { CONTRACT_VERSION } from "@apex/contracts";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { atomicWriteJson } from "./files.js";
import type { Clock } from "./lease-store.js";

export type IdSource = () => string;

export interface InitializeProjectInput {
  projectId: ProjectId;
  displayName: string;
  defaultIacTool: IacTool;
}

export interface CreateRunInput {
  environment: string;
  targetScope: string;
  runtimeLockHash: string;
  iacTool?: IacTool;
  parentRunId?: RunId;
}

export class ProjectStore {
  readonly apexRoot: string;

  constructor(
    workspaceRoot: string,
    private readonly clock: Clock = () => new Date(),
    private readonly idSource: IdSource = () => crypto.randomUUID(),
  ) {
    this.apexRoot = resolve(workspaceRoot, ".apex");
  }

  async initializeProject(input: InitializeProjectInput): Promise<ProjectConfigV1> {
    const project: ProjectConfigV1 = {
      schemaVersion: CONTRACT_VERSION,
      projectId: input.projectId,
      displayName: input.displayName,
      createdAt: this.clock().toISOString(),
      defaultIacTool: input.defaultIacTool,
    };
    const directory = this.projectDirectory(input.projectId);
    await mkdir(join(directory, "runs"), { recursive: true });
    await atomicWriteJson(join(directory, "project.json"), project, { refuseOverwrite: true });
    return project;
  }

  async createRun(projectId: ProjectId, input: CreateRunInput): Promise<RunConfigV1> {
    const project = await this.getProject(projectId);
    const runId = this.idSource() as RunId;
    const run: RunConfigV1 = {
      schemaVersion: CONTRACT_VERSION,
      projectId,
      runId,
      environment: input.environment,
      targetScope: input.targetScope,
      iacTool: input.iacTool ?? project.defaultIacTool,
      createdAt: this.clock().toISOString(),
      runtimeLockHash: input.runtimeLockHash,
      ...(input.parentRunId === undefined ? {} : { parentRunId: input.parentRunId }),
      ownerEpoch: 1,
      gates: [1, 2, 3, 4].map((gate) => ({ gate, state: "closed", dependencyHash: input.runtimeLockHash })),
    };
    const directory = this.runDirectory(projectId, runId);
    await mkdir(join(directory, "journal"), { recursive: true });
    await mkdir(join(directory, "tasks"), { recursive: true });
    await atomicWriteJson(join(directory, "run.json"), run, { refuseOverwrite: true });
    return run;
  }

  async getProject(projectId: ProjectId): Promise<ProjectConfigV1> {
    return this.readJson(join(this.projectDirectory(projectId), "project.json"));
  }

  async getRun(projectId: ProjectId, runId: RunId): Promise<RunConfigV1> {
    return this.readJson(join(this.runDirectory(projectId, runId), "run.json"));
  }

  projectDirectory(projectId: ProjectId): string {
    this.assertIdentifier(projectId);
    return join(this.apexRoot, "projects", projectId);
  }

  runDirectory(projectId: ProjectId, runId: RunId): string {
    this.assertIdentifier(runId);
    return join(this.projectDirectory(projectId), "runs", runId);
  }

  private assertIdentifier(value: string): void {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) {
      throw new Error("Invalid project or run identifier");
    }
  }

  private async readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf8")) as T;
  }
}
