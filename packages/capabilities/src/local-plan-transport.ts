import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface LocalEncryptedPlanMetadata {
  readonly implementation: "local-reference";
  readonly algorithm: "aes-256-gcm";
  readonly digest: string;
  readonly recipient: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface LocalEncryptedPlan {
  readonly metadata: LocalEncryptedPlanMetadata;
  readonly iv: string;
  readonly authTag: string;
  readonly ciphertext: string;
}

export interface DecryptedPlanHandle {
  readonly path: string;
  dispose(): Promise<void>;
}

function requireKey(key: Uint8Array): Buffer {
  if (key.byteLength !== 32) {
    throw new TypeError("Local plan transport requires a caller-supplied 32-byte key");
  }
  return Buffer.from(key);
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function authenticatedMetadata(metadata: LocalEncryptedPlanMetadata): Buffer {
  return Buffer.from(JSON.stringify(metadata), "utf8");
}

export class LocalEncryptedPlanTransport {
  constructor(private readonly now: () => Date = () => new Date()) {}

  encrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
    options: { readonly recipient: string; readonly ttlMs: number },
  ): LocalEncryptedPlan {
    if (options.recipient.trim().length === 0 || options.ttlMs <= 0) {
      throw new TypeError("Plan recipient and positive expiry are required");
    }
    const createdAt = this.now();
    const metadata: LocalEncryptedPlanMetadata = {
      implementation: "local-reference",
      algorithm: "aes-256-gcm",
      digest: digest(plaintext),
      recipient: options.recipient,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + options.ttlMs).toISOString(),
    };
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", requireKey(key), iv);
    cipher.setAAD(authenticatedMetadata(metadata));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      metadata,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  decrypt(encrypted: LocalEncryptedPlan, key: Uint8Array, recipient: string): Buffer {
    if (encrypted.metadata.implementation !== "local-reference" || encrypted.metadata.algorithm !== "aes-256-gcm") {
      throw new Error("Unsupported encrypted plan transport");
    }
    if (encrypted.metadata.recipient !== recipient) {
      throw new Error("Encrypted plan recipient does not match the current authority");
    }
    if (new Date(encrypted.metadata.expiresAt).getTime() <= this.now().getTime()) {
      throw new Error("Encrypted plan has expired");
    }
    const decipher = createDecipheriv("aes-256-gcm", requireKey(key), Buffer.from(encrypted.iv, "base64"));
    decipher.setAAD(authenticatedMetadata(encrypted.metadata));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64")), decipher.final()]);
    if (digest(plaintext) !== encrypted.metadata.digest) {
      throw new Error("Encrypted plan digest mismatch");
    }
    return plaintext;
  }

  async decryptToRestrictiveTemp(
    encrypted: LocalEncryptedPlan,
    key: Uint8Array,
    recipient: string,
  ): Promise<DecryptedPlanHandle> {
    const directory = await mkdtemp(join(tmpdir(), "apex-local-plan-"));
    const path = join(directory, "saved.tfplan");
    try {
      await writeFile(path, this.decrypt(encrypted, key, recipient), { mode: 0o600, flag: "wx" });
      await chmod(path, 0o600);
      let disposed = false;
      return {
        path,
        async dispose() {
          if (disposed) return;
          disposed = true;
          try {
            const bytes = await readFile(path);
            await writeFile(path, randomBytes(bytes.length), { mode: 0o600 });
          } finally {
            await rm(directory, { recursive: true, force: true });
          }
        },
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
}
