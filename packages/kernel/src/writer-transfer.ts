import type { ProjectId, RunId } from "@apex/contracts";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256Json, type JsonValue } from "./canonical.js";
import { EventJournal } from "./event-journal.js";
import { atomicWriteJson } from "./files.js";
import { LeaseStore, type Clock } from "./lease-store.js";
import { RunRepository, type RunRepositoryOptions } from "./run-repository.js";

export interface WriterTransferClaim {
  projectId: ProjectId;
  runId: RunId;
  repository: string;
  branch: string;
  commit: string;
  workflowId: string;
  sender: string;
  recipient: string;
  approvalEnvironment?: string;
  nextEpoch: number;
  expiresAt: string;
}

export interface CreateTransferInput extends Omit<WriterTransferClaim, "nextEpoch" | "expiresAt"> {
  currentEpoch: number;
  currentGitHead: string;
  ttlMs: number;
  eventId: string;
}

export interface AcceptTransferInput {
  claimHash: string;
  recipient: string;
  currentGitHead: string;
  eventId: string;
}

export interface WriterOwnership {
  ownerId: string;
  ownerEpoch: number;
  repository: string;
  branch: string;
  commit: string;
  workflowId: string;
  approvalEnvironment?: string;
  acceptedAt: string;
}

export class WriterTransferStore {
  private readonly claimDirectory: string;
  private readonly ownershipPath: string;
  private readonly journal: EventJournal;
  private readonly runs: RunRepository;
  private readonly leases: LeaseStore;

  constructor(
    runDirectory: string,
    private readonly clock: Clock = () => new Date(),
    repositoryOptions: RunRepositoryOptions = {},
  ) {
    const directory = resolve(runDirectory);
    this.claimDirectory = join(directory, "transfers");
    this.ownershipPath = join(directory, "ownership.json");
    this.journal = new EventJournal(join(directory, "journal"));
    this.runs = new RunRepository(directory, { clock, ...repositoryOptions });
    this.leases = new LeaseStore(join(directory, "writer-lease.json"), clock);
  }

  leaseStore(): LeaseStore {
    return this.leases;
  }

  async create(input: CreateTransferInput): Promise<{ claim: WriterTransferClaim; hash: string }> {
    if (input.commit !== input.currentGitHead) throw new Error("Transfer commit does not match current Git head");
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) throw new Error("Transfer TTL must be positive");
    if (input.approvalEnvironment !== undefined && input.approvalEnvironment.trim().length === 0) {
      throw new Error("Transfer approval environment must be nonempty");
    }
    const run = await this.runs.read();
    if (run.projectId !== input.projectId || run.runId !== input.runId || run.ownerEpoch !== input.currentEpoch)
      throw new Error("Stale transfer epoch or run identity");
    const claim: WriterTransferClaim = {
      projectId: input.projectId,
      runId: input.runId,
      repository: input.repository,
      branch: input.branch,
      commit: input.commit,
      workflowId: input.workflowId,
      sender: input.sender,
      recipient: input.recipient,
      ...(input.approvalEnvironment === undefined ? {} : { approvalEnvironment: input.approvalEnvironment }),
      nextEpoch: input.currentEpoch + 1,
      expiresAt: new Date(this.clock().getTime() + input.ttlMs).toISOString(),
    };
    const hash = sha256Json(claim as unknown as JsonValue);
    await atomicWriteJson(join(this.claimDirectory, `${hash}.json`), claim, { refuseOverwrite: true });
    await this.journal.append({
      eventId: input.eventId,
      projectId: input.projectId,
      runId: input.runId,
      type: "transfer-requested",
      timestamp: this.clock().toISOString(),
      ownerEpoch: input.currentEpoch,
      expectedHead: await this.journal.head(),
      payload: { claimHash: hash, recipient: input.recipient },
    });
    await this.leases.release(input.sender, input.currentEpoch);
    return { claim, hash };
  }

  async accept(input: AcceptTransferInput): Promise<WriterOwnership> {
    if (!/^[0-9a-f]{64}$/.test(input.claimHash)) throw new Error("Invalid transfer claim hash");
    const claim = JSON.parse(
      await readFile(join(this.claimDirectory, `${input.claimHash}.json`), "utf8"),
    ) as WriterTransferClaim;
    if (sha256Json(claim as unknown as JsonValue) !== input.claimHash)
      throw new Error("Transfer claim integrity check failed");
    if (claim.recipient !== input.recipient) throw new Error("Transfer recipient does not match claim");
    if (claim.commit !== input.currentGitHead) throw new Error("Transfer claim Git head is stale");
    if (Date.parse(claim.expiresAt) <= this.clock().getTime()) throw new Error("Transfer claim has expired");
    const run = await this.runs.read();
    if (run.ownerEpoch + 1 !== claim.nextEpoch) throw new Error("Transfer claim owner epoch is stale");
    const lease = await this.leases.acquire(input.recipient, Date.parse(claim.expiresAt) - this.clock().getTime());
    let mutation;
    try {
      mutation = await this.runs.mutate({
        expectedRunHash: await this.runs.hash(),
        event: {
          eventId: input.eventId,
          projectId: claim.projectId,
          runId: claim.runId,
          type: "transfer-accepted",
          timestamp: this.clock().toISOString(),
          ownerEpoch: claim.nextEpoch,
          payload: { claimHash: input.claimHash, recipient: input.recipient },
        },
        update: (current) => ({ ...current, ownerEpoch: claim.nextEpoch }),
      });
    } catch (error) {
      await this.leases.release(input.recipient, lease.ownerEpoch);
      throw error;
    }
    const ownership: WriterOwnership = {
      ownerId: input.recipient,
      ownerEpoch: mutation.run.ownerEpoch,
      repository: claim.repository,
      branch: claim.branch,
      commit: claim.commit,
      workflowId: claim.workflowId,
      ...(claim.approvalEnvironment === undefined ? {} : { approvalEnvironment: claim.approvalEnvironment }),
      acceptedAt: this.clock().toISOString(),
    };
    await atomicWriteJson(this.ownershipPath, ownership);
    return ownership;
  }

  async currentOwnership(): Promise<WriterOwnership | null> {
    try {
      return JSON.parse(await readFile(this.ownershipPath, "utf8")) as WriterOwnership;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}

export type WriterTransferProtocol = Pick<WriterTransferStore, "create" | "accept" | "currentOwnership">;
