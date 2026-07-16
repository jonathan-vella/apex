import { constants } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { atomicWriteJson } from "./files.js";

export interface LeaseRecord {
  ownerId: string;
  ownerEpoch: number;
  acquiredAt: string;
  expiresAt: string;
}

export type Clock = () => Date;

export class LeaseStore {
  private readonly lockPath: string;
  private readonly path: string;

  constructor(
    path: string,
    private readonly clock: Clock = () => new Date(),
  ) {
    this.path = resolve(path);
    this.lockPath = `${this.path}.lock`;
  }

  async acquire(ownerId: string, ttlMs: number): Promise<LeaseRecord> {
    return this.withLock(async () => {
      const previous = await this.read();
      const now = this.clock();
      if (previous !== null && Date.parse(previous.expiresAt) > now.getTime()) {
        throw new Error(`Lease is held by ${previous.ownerId}`);
      }
      const lease = this.createLease(ownerId, (previous?.ownerEpoch ?? 0) + 1, ttlMs, now);
      await atomicWriteJson(this.path, lease);
      return lease;
    });
  }

  async acquireAtEpoch(ownerId: string, ownerEpoch: number, ttlMs: number): Promise<LeaseRecord> {
    return this.withLock(async () => {
      const previous = await this.read();
      const now = this.clock();
      if (previous !== null && Date.parse(previous.expiresAt) > now.getTime()) {
        throw new Error(`Lease is held by ${previous.ownerId}`);
      }
      if (!Number.isInteger(ownerEpoch) || ownerEpoch < 1) throw new Error("Lease owner epoch must be positive");
      if (previous !== null && previous.ownerEpoch > ownerEpoch) throw new Error("Lease owner epoch cannot regress");
      const lease = this.createLease(ownerId, ownerEpoch, ttlMs, now);
      await atomicWriteJson(this.path, lease);
      return lease;
    });
  }

  async heartbeat(ownerId: string, ownerEpoch: number, ttlMs: number): Promise<LeaseRecord> {
    return this.withLock(async () => {
      const current = await this.requireCurrent(ownerId, ownerEpoch);
      const lease = this.createLease(ownerId, current.ownerEpoch, ttlMs, this.clock(), current.acquiredAt);
      await atomicWriteJson(this.path, lease);
      return lease;
    });
  }

  async release(ownerId: string, ownerEpoch: number): Promise<void> {
    await this.withLock(async () => {
      const current = await this.requireCurrent(ownerId, ownerEpoch);
      await atomicWriteJson(this.path, { ...current, expiresAt: this.clock().toISOString() });
    });
  }

  async current(): Promise<LeaseRecord | null> {
    const lease = await this.read();
    return lease !== null && Date.parse(lease.expiresAt) > this.clock().getTime() ? lease : null;
  }

  private createLease(
    ownerId: string,
    ownerEpoch: number,
    ttlMs: number,
    now: Date,
    acquiredAt = now.toISOString(),
  ): LeaseRecord {
    if (!ownerId || !Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error("Lease owner and positive TTL are required");
    }
    return { ownerId, ownerEpoch, acquiredAt, expiresAt: new Date(now.getTime() + ttlMs).toISOString() };
  }

  private async requireCurrent(ownerId: string, ownerEpoch: number): Promise<LeaseRecord> {
    const current = await this.read();
    if (current === null || Date.parse(current.expiresAt) <= this.clock().getTime()) {
      throw new Error("Lease has expired");
    }
    if (current.ownerId !== ownerId || current.ownerEpoch !== ownerEpoch) {
      throw new Error("Stale lease owner or epoch");
    }
    return current;
  }

  private async read(): Promise<LeaseRecord | null> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as LeaseRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.path), { recursive: true });
    let handle;
    try {
      handle = await open(this.lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error("Lease update is already in progress", { cause: error });
      }
      throw error;
    }
    try {
      return await operation();
    } finally {
      await handle.close();
      await rm(this.lockPath, { force: true });
    }
  }
}
