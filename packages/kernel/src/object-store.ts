import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { canonicalJsonBytes, sha256Bytes } from "./canonical.js";
import { atomicWriteBytes } from "./files.js";

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export class ObjectStore {
  readonly root: string;

  constructor(projectRoot: string) {
    this.root = resolve(projectRoot, ".apex", "objects", "sha256");
  }

  async putBytes(bytes: Uint8Array): Promise<string> {
    const hash = sha256Bytes(bytes);
    const path = await this.pathFor(hash, true);
    try {
      await atomicWriteBytes(path, bytes, { refuseOverwrite: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    const stored = await this.getBytes(hash);
    if (!Buffer.from(stored).equals(Buffer.from(bytes))) {
      throw new Error(`Object ${hash} is not immutable`);
    }
    return hash;
  }

  async putJson(value: unknown): Promise<string> {
    return this.putBytes(canonicalJsonBytes(value));
  }

  async getBytes(hash: string): Promise<Buffer> {
    const path = await this.pathFor(hash, false);
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      bytes = await handle.readFile();
    } finally {
      await handle.close();
    }
    if (sha256Bytes(bytes) !== hash) {
      throw new Error(`Object hash verification failed for ${hash}`);
    }
    return bytes;
  }

  async getJson<T>(hash: string): Promise<T> {
    return JSON.parse((await this.getBytes(hash)).toString("utf8")) as T;
  }

  private async pathFor(hash: string, create: boolean): Promise<string> {
    if (!HASH_PATTERN.test(hash)) {
      throw new Error("Invalid SHA-256 object identifier");
    }
    if (create) {
      await mkdir(this.root, { recursive: true });
    }
    const root = await realpath(this.root);
    if (root !== this.root) {
      throw new Error("Object store root must not be a symlink");
    }
    const path = join(root, hash.slice(0, 2), hash.slice(2));
    if (create) {
      await mkdir(dirname(path), { recursive: true });
    }
    const parent = await realpath(dirname(path));
    const relation = relative(root, parent);
    if (relation.startsWith("..") || resolve(parent, hash.slice(2)) !== resolve(path)) {
      throw new Error("Object path escapes the store");
    }
    try {
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error("Object path must be a regular file");
      }
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      await handle.close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    return path;
  }
}
