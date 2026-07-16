import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EnvelopeBindingValue = string | number;
export type EnvelopeBindings = Readonly<Record<string, EnvelopeBindingValue>>;

export interface EncryptedEnvelopeMetadata {
  readonly implementation: "apex-encrypted-envelope";
  readonly version: 1;
  readonly algorithm: "aes-256-gcm";
  readonly kind: string;
  readonly digest: string;
  readonly recipient: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly bindings: EnvelopeBindings;
}

export interface EncryptedEnvelope {
  readonly metadata: EncryptedEnvelopeMetadata;
  readonly iv: string;
  readonly authTag: string;
  readonly ciphertext: string;
}

function requireKey(key: Uint8Array): Buffer {
  if (key.byteLength !== 32) throw new TypeError("Encrypted envelope requires a 32-byte key");
  return Buffer.from(key);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalBindings(bindings: EnvelopeBindings): EnvelopeBindings {
  const canonical: Record<string, EnvelopeBindingValue> = {};
  for (const key of Object.keys(bindings).sort()) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
      throw new TypeError("Encrypted envelope binding names must be identifier-shaped");
    }
    const value = bindings[key]!;
    if (
      (typeof value !== "string" && typeof value !== "number") ||
      (typeof value === "number" && !Number.isFinite(value))
    ) {
      throw new TypeError(`Encrypted envelope binding ${key} must be a finite string or number`);
    }
    canonical[key] = value;
  }
  return canonical;
}

function authenticatedMetadata(metadata: EncryptedEnvelopeMetadata): Buffer {
  return Buffer.from(
    JSON.stringify({
      implementation: metadata.implementation,
      version: metadata.version,
      algorithm: metadata.algorithm,
      kind: metadata.kind,
      digest: metadata.digest,
      recipient: metadata.recipient,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      bindings: canonicalBindings(metadata.bindings),
    }),
    "utf8",
  );
}

function decodeBase64(value: string, label: string): Buffer {
  if (value.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(`Encrypted envelope ${label} is invalid base64`);
  }
  return Buffer.from(value, "base64");
}

function requireMetadata(metadata: EncryptedEnvelopeMetadata): void {
  const expectedKeys = [
    "algorithm",
    "bindings",
    "createdAt",
    "digest",
    "expiresAt",
    "implementation",
    "kind",
    "recipient",
    "version",
  ];
  if (Object.keys(metadata).sort().join("\0") !== expectedKeys.join("\0")) {
    throw new Error("Encrypted envelope metadata shape is invalid");
  }
  if (
    metadata.implementation !== "apex-encrypted-envelope" ||
    metadata.version !== 1 ||
    metadata.algorithm !== "aes-256-gcm"
  ) {
    throw new Error("Unsupported encrypted envelope");
  }
  if (metadata.kind.trim().length === 0 || metadata.recipient.trim().length === 0) {
    throw new Error("Encrypted envelope kind and recipient are required");
  }
  if (!/^[0-9a-f]{64}$/.test(metadata.digest)) throw new Error("Encrypted envelope digest is invalid");
  const createdAt = Date.parse(metadata.createdAt);
  const expiresAt = Date.parse(metadata.expiresAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
    throw new Error("Encrypted envelope timestamps are invalid");
  }
  canonicalBindings(metadata.bindings);
}

export class EncryptedEnvelopeTransport {
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly nonce: () => Uint8Array = () => randomBytes(12),
  ) {}

  encrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
    options: {
      readonly kind: string;
      readonly recipient: string;
      readonly ttlMs: number;
      readonly bindings: EnvelopeBindings;
    },
  ): EncryptedEnvelope {
    if (options.kind.trim().length === 0 || options.recipient.trim().length === 0 || options.ttlMs <= 0) {
      throw new TypeError("Encrypted envelope kind, recipient, and positive TTL are required");
    }
    if (!Number.isFinite(options.ttlMs)) throw new TypeError("Encrypted envelope TTL must be finite");
    const createdAt = this.now();
    const metadata: EncryptedEnvelopeMetadata = {
      implementation: "apex-encrypted-envelope",
      version: 1,
      algorithm: "aes-256-gcm",
      kind: options.kind,
      digest: sha256(plaintext),
      recipient: options.recipient,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + options.ttlMs).toISOString(),
      bindings: canonicalBindings(options.bindings),
    };
    const iv = Buffer.from(this.nonce());
    if (iv.byteLength !== 12) throw new TypeError("Encrypted envelope nonce must contain 12 bytes");
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

  decrypt(envelope: EncryptedEnvelope, key: Uint8Array, recipient: string): Buffer {
    requireMetadata(envelope.metadata);
    if (recipient.trim().length === 0 || envelope.metadata.recipient !== recipient) {
      throw new Error("Encrypted envelope recipient does not match");
    }
    if (Date.parse(envelope.metadata.expiresAt) <= this.now().getTime()) {
      throw new Error("Encrypted envelope has expired");
    }
    const iv = decodeBase64(envelope.iv, "IV");
    const authTag = decodeBase64(envelope.authTag, "authentication tag");
    if (iv.byteLength !== 12 || authTag.byteLength !== 16) throw new Error("Encrypted envelope parameters are invalid");
    const decipher = createDecipheriv("aes-256-gcm", requireKey(key), iv);
    decipher.setAAD(authenticatedMetadata(envelope.metadata));
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(decodeBase64(envelope.ciphertext, "ciphertext")),
      decipher.final(),
    ]);
    if (sha256(plaintext) !== envelope.metadata.digest) throw new Error("Encrypted envelope digest mismatch");
    return plaintext;
  }
}
