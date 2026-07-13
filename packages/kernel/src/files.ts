import { constants } from "node:fs";
import { link, mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJsonBytes } from "./canonical.js";

export interface AtomicWriteOptions {
  refuseOverwrite?: boolean;
}

export async function atomicWriteBytes(
  path: string,
  bytes: Uint8Array,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${basename(path)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    if (options.refuseOverwrite) {
      await link(temporary, path);
      await rm(temporary);
      return;
    }
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function atomicWriteJson(path: string, value: unknown, options: AtomicWriteOptions = {}): Promise<void> {
  await atomicWriteBytes(path, canonicalJsonBytes(value), options);
}
