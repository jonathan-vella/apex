import { FakeIaCProvider } from "@apex/capabilities";
import type { ProjectConfigV1, RunConfigV1 } from "@apex/contracts";
import { EventJournal, ObjectStore, ProjectStore } from "@apex/kernel";
import { FakeClock, SequenceIds } from "./determinism.js";
import { fixtureHash } from "./fixtures.js";

export interface TestScenario {
  workspaceRoot: string;
  clock: FakeClock;
  ids: SequenceIds;
  project: ProjectConfigV1;
  run: RunConfigV1;
  projectStore: ProjectStore;
  eventJournal: EventJournal;
  objectStore: ObjectStore;
  bicep: FakeIaCProvider;
  terraform: FakeIaCProvider;
}

export interface ScenarioOptions {
  clock?: FakeClock;
  ids?: SequenceIds;
  projectId?: string;
  displayName?: string;
  environment?: string;
  targetScope?: string;
}

export async function createScenario(workspaceRoot: string, options: ScenarioOptions = {}): Promise<TestScenario> {
  const clock = options.clock ?? new FakeClock();
  const ids = options.ids ?? new SequenceIds("scenario");
  const projectStore = new ProjectStore(workspaceRoot, clock.now, ids.next);
  const project = await projectStore.initializeProject({
    projectId: options.projectId ?? "test-project",
    displayName: options.displayName ?? "Test Project",
    defaultIacTool: "bicep",
  });
  const run = await projectStore.createRun(project.projectId, {
    environment: options.environment ?? "test",
    targetScope: options.targetScope ?? "/subscriptions/00000000-0000-0000-0000-000000000000",
    runtimeLockHash: fixtureHash("runtime-lock"),
  });
  const eventJournal = new EventJournal(`${projectStore.runDirectory(project.projectId, run.runId)}/journal`);
  const objectStore = new ObjectStore(workspaceRoot);
  const providerOptions = { now: clock.now, nextId: ids.next };
  return {
    workspaceRoot,
    clock,
    ids,
    project,
    run,
    projectStore,
    eventJournal,
    objectStore,
    bicep: new FakeIaCProvider({ track: "bicep", ...providerOptions }),
    terraform: new FakeIaCProvider({ track: "terraform", ...providerOptions }),
  };
}
