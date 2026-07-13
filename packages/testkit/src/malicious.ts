import { mkdir, symlink } from "node:fs/promises";
import { dirname } from "node:path";

export const maliciousPaths = Object.freeze([
  "../outside",
  "../../etc/passwd",
  "/absolute/path",
  "nested/../../../outside",
  "..\\outside",
]);

export const secretFixtures = Object.freeze({
  azureClientSecret: "not-a-real-client-secret",
  githubToken: "ghp_notARealToken000000000000000000000",
  privateKey: "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----",
});

export function oversizedFixture(maxBytes: number, fill = 0x61): Buffer {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("maxBytes must be a non-negative safe integer");
  }
  return Buffer.alloc(maxBytes + 1, fill);
}

export async function symlinkFixture(linkPath: string, targetPath: string): Promise<string> {
  await mkdir(dirname(linkPath), { recursive: true });
  await symlink(targetPath, linkPath);
  return linkPath;
}
