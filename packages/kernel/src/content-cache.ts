import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { sha256Json, type JsonValue } from "./canonical.js";
import { atomicWriteJson } from "./files.js";
import { ObjectStore } from "./object-store.js";

export interface ContentCacheInput {
  dependencies: Record<string, JsonValue>;
  config: JsonValue;
  toolchain: JsonValue;
}

interface CacheEntry {
  objectHash: string;
  dependencies: string[];
}

export function contentCacheKey(input: ContentCacheInput): string {
  return sha256Json(input as unknown as JsonValue);
}

export class ContentCache {
  private readonly root: string;
  private readonly objects: ObjectStore;

  constructor(projectRoot: string) {
    const root = resolve(projectRoot);
    this.root = join(root, ".apex", "cache", "content");
    this.objects = new ObjectStore(projectRoot);
  }

  async get<T extends JsonValue>(input: ContentCacheInput): Promise<T | null> {
    const path = await this.entryPath(contentCacheKey(input));
    try {
      const entry = JSON.parse(await readFile(path, "utf8")) as CacheEntry;
      return this.objects.getJson<T>(entry.objectHash);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async set(input: ContentCacheInput, value: JsonValue): Promise<string> {
    const key = contentCacheKey(input);
    const objectHash = await this.objects.putJson(value);
    await atomicWriteJson(await this.entryPath(key, true), {
      objectHash,
      dependencies: Object.keys(input.dependencies).sort(),
    });
    return key;
  }

  async invalidate(dependency?: string): Promise<number> {
    await this.assertRoot();
    let names: string[];
    try {
      names = await readdir(this.root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
    let count = 0;
    for (const name of names.filter((item) => /^[0-9a-f]{64}\.json$/.test(item))) {
      const path = await this.entryPath(name.slice(0, -5));
      const entry = JSON.parse(await readFile(path, "utf8")) as CacheEntry;
      if (dependency === undefined || entry.dependencies.includes(dependency)) {
        await rm(path);
        count += 1;
      }
    }
    return count;
  }

  private async assertRoot(create = false): Promise<void> {
    if (create) await mkdir(this.root, { recursive: true });
    try {
      if ((await lstat(this.root)).isSymbolicLink()) throw new Error("Content cache root must not be a symlink");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async entryPath(key: string, create = false): Promise<string> {
    if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("Invalid content cache key");
    await this.assertRoot(create);
    const path = join(this.root, `${key}.json`);
    if (relative(this.root, path).startsWith("..")) throw new Error("Content cache path escapes root");
    try {
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Content cache entry must be a regular file");
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      await handle.close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return path;
  }
}
