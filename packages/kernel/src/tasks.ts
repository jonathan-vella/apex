import type { ProjectId, QuestionV1Schema, RunId, TaskEnvelopeV1, TaskResultV1 } from "@apex/contracts";
import { CONTRACT_VERSION } from "@apex/contracts";
import type { Static } from "@sinclair/typebox";
import type { Clock } from "./lease-store.js";
import type { IdSource } from "./project-store.js";

type QuestionV1 = Static<typeof QuestionV1Schema>;

export interface CreateTaskInput extends Omit<TaskEnvelopeV1, "schemaVersion" | "taskId" | "createdAt" | "expiresAt"> {
  ttlMs: number;
}

export function createTaskEnvelope(input: CreateTaskInput, clock: Clock, idSource: IdSource): TaskEnvelopeV1 {
  const now = clock();
  if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
    throw new Error("Task TTL must be positive");
  }
  const { ttlMs, ...task } = input;
  return {
    schemaVersion: CONTRACT_VERSION,
    ...task,
    taskId: idSource(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

export function assertTaskCurrent(task: TaskEnvelopeV1, head: string, ownerEpoch: number, clock: Clock): void {
  if (Date.parse(task.expiresAt) <= clock().getTime()) {
    throw new Error("Task has expired");
  }
  if (task.expectedHead !== head) {
    throw new Error("Task journal head is stale");
  }
  if (task.ownerEpoch !== ownerEpoch) {
    throw new Error("Task owner epoch is stale");
  }
}

export function needsInput(taskId: string, questions: QuestionV1[]): TaskResultV1 {
  if (questions.length === 0) {
    throw new Error("needs_input requires at least one question");
  }
  return { schemaVersion: CONTRACT_VERSION, taskId, status: "needs_input", questions };
}

export type { ProjectId, RunId };
