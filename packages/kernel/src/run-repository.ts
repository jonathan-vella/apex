import type { RunConfigV1 } from "@apex/contracts";
import { constants } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { sha256Json, type JsonValue } from "./canonical.js";
import { EventJournal, type AppendEventInput } from "./event-journal.js";
import { atomicWriteJson } from "./files.js";

export interface RunMutation {
  expectedRunHash: string;
  expectedJournalHead?: string | null;
  event: Omit<AppendEventInput, "expectedHead">;
  update: (current: RunConfigV1) => RunConfigV1;
}

export interface RunMutationResult {
  run: RunConfigV1;
  runHash: string;
  eventHash: string;
}

export type RunTransactionStage = "intent" | "journal" | "run" | "cleanup";

export interface RunRepositoryOptions {
  clock?: () => Date;
  idSource?: () => string;
  lockTtlMs?: number;
  faultInjector?: (stage: RunTransactionStage) => void | Promise<void>;
}

interface TransactionIntent {
  version: 1;
  eventId: string;
  beforeHash: string;
  afterHash: string;
  after: RunConfigV1;
}

interface MutationLock {
  token: string;
  pid: number;
  host: string;
  createdAt: string;
  expiresAt: string;
}

export class RunRepository {
  private readonly runPath: string;
  private readonly lockPath: string;
  private readonly intentPath: string;
  private readonly clock: () => Date;
  private readonly idSource: () => string;
  private readonly lockTtlMs: number;
  private readonly faultInjector?: RunRepositoryOptions["faultInjector"];
  readonly journal: EventJournal;

  constructor(runDirectory: string, options: RunRepositoryOptions = {}) {
    const directory = resolve(runDirectory);
    this.runPath = join(directory, "run.json");
    this.lockPath = join(directory, ".run-mutation.lock");
    this.intentPath = join(directory, ".run-transaction.json");
    this.clock = options.clock ?? (() => new Date());
    this.idSource = options.idSource ?? (() => crypto.randomUUID());
    this.lockTtlMs = options.lockTtlMs ?? 30_000;
    this.faultInjector = options.faultInjector;
    this.journal = new EventJournal(join(directory, "journal"));
  }

  async hash(): Promise<string> {
    return sha256Json((await this.read()) as unknown as JsonValue);
  }
  async read(): Promise<RunConfigV1> {
    await this.withLock(() => this.recover());
    return this.readRaw();
  }

  async mutate(input: RunMutation): Promise<RunMutationResult> {
    return this.withLock(async () => {
      await this.recover();
      const current = await this.readRaw();
      const actualHash = sha256Json(current as unknown as JsonValue);
      if (actualHash !== input.expectedRunHash)
        throw new Error(`Stale run hash: expected ${input.expectedRunHash}, found ${actualHash}`);
      const journalHead = await this.journal.head();
      if (input.expectedJournalHead !== undefined && input.expectedJournalHead !== journalHead) {
        throw new Error(
          `Stale journal head: expected ${String(input.expectedJournalHead)}, found ${String(journalHead)}`,
        );
      }
      const next = input.update(structuredClone(current));
      if (next.projectId !== current.projectId || next.runId !== current.runId)
        throw new Error("Run identity cannot change");
      const afterHash = sha256Json(next as unknown as JsonValue);
      const intent: TransactionIntent = {
        version: 1,
        eventId: input.event.eventId,
        beforeHash: actualHash,
        afterHash,
        after: next,
      };
      await atomicWriteJson(this.intentPath, intent, { refuseOverwrite: true });
      await this.faultInjector?.("intent");
      const event = await this.journal.append({
        ...input.event,
        expectedHead: journalHead,
        payload: {
          ...(input.event.payload as Record<string, JsonValue>),
          transaction: { afterHash, after: next as unknown as JsonValue },
        },
      });
      await this.faultInjector?.("journal");
      await atomicWriteJson(this.runPath, next);
      await this.faultInjector?.("run");
      await rm(this.intentPath, { force: true });
      await this.faultInjector?.("cleanup");
      return { run: next, runHash: afterHash, eventHash: event.hash };
    });
  }

  private async recover(): Promise<void> {
    let intent: TransactionIntent;
    try {
      intent = JSON.parse(await readFile(this.intentPath, "utf8")) as TransactionIntent;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    const committed = (await this.journal.replay()).find((event) => event.eventId === intent.eventId);
    if (committed === undefined) {
      await rm(this.intentPath, { force: true });
      return;
    }
    const transaction = (committed.payload as { transaction?: { afterHash?: unknown; after?: unknown } }).transaction;
    if (
      transaction?.afterHash !== intent.afterHash ||
      sha256Json(transaction.after as JsonValue) !== intent.afterHash
    ) {
      throw new Error("Committed run transaction does not match its intent");
    }
    await atomicWriteJson(this.runPath, transaction.after);
    await rm(this.intentPath, { force: true });
  }

  private async readRaw(): Promise<RunConfigV1> {
    return JSON.parse(await readFile(this.runPath, "utf8")) as RunConfigV1;
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    const token = this.idSource();
    const createdAt = this.clock();
    const metadata: MutationLock = {
      token,
      pid: process.pid,
      host: hostname(),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + this.lockTtlMs).toISOString(),
    };
    const acquire = async () => {
      const handle = await open(this.lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      await handle.writeFile(JSON.stringify(metadata));
      await handle.close();
    };
    try {
      await acquire();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let existing: MutationLock;
      try {
        existing = JSON.parse(await readFile(this.lockPath, "utf8")) as MutationLock;
      } catch {
        throw new Error("Run mutation lock metadata is unreadable", { cause: error });
      }
      if (Date.parse(existing.expiresAt) > this.clock().getTime())
        throw new Error("Run mutation is already in progress", { cause: error });
      await rm(this.lockPath);
      await acquire();
    }
    try {
      return await operation();
    } finally {
      try {
        const current = JSON.parse(await readFile(this.lockPath, "utf8")) as MutationLock;
        if (current.token === token) await rm(this.lockPath, { force: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
}
