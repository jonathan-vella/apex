import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJsonBytes, type JsonValue } from "./canonical.js";
import { atomicWriteBytes, atomicWriteJson } from "./files.js";
import { ObjectStore } from "./object-store.js";

export type EvidenceRetention = "immutable" | "project" | "optional";

export interface EvidenceKindPolicy {
  contentTypes: string[];
  maxBytes: number;
  retention: EvidenceRetention;
}

export interface EvidencePolicyConfig {
  kinds: Record<string, EvidenceKindPolicy>;
}

export interface EvidenceAcceptance {
  status: "accepted" | "quarantined";
  kind: string;
  bytes: number;
  retention: EvidenceRetention;
  hash?: string;
  quarantinePath?: string;
  redacted: boolean;
  reasons: string[];
}

const SECRET_KEY =
  /(?:secret|password|passphrase|token|authorization|api[-_]?key|private[-_]?key|access[-_]?key|clientSecret|connectionString|sasToken)/i;
const HIGH_RISK = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/,
  /\b(?:AccountKey|SharedAccessSignature)=[^\s;]+/i,
  /\bAuthorization\s*[:=]\s*Bearer\s+[A-Za-z0-9._~+\/-]{16,}/i,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}/i,
  /\b(?:Server|Data Source)=[^;\r\n]+;[\s\S]{0,512}\b(?:Password|Pwd|AccountKey)=[^;\r\n]+/i,
  /\b(?:clientSecret|accessToken|refreshToken|sasToken)\s*[:=]\s*["']?[^\s,"'}]{8,}/i,
];

export class EvidencePolicy {
  constructor(readonly config: EvidencePolicyConfig) {}

  rule(kind: string, contentType: string): EvidenceKindPolicy {
    const rule = this.config.kinds[kind];
    if (rule === undefined) throw new Error(`Evidence kind ${kind} is not allowed`);
    if (!rule.contentTypes.includes(contentType))
      throw new Error(`Content type ${contentType} is not allowed for ${kind}`);
    if (!Number.isInteger(rule.maxBytes) || rule.maxBytes < 1)
      throw new Error(`Invalid evidence byte budget for ${kind}`);
    return rule;
  }
}

export class EvidenceStore {
  private readonly objects: ObjectStore;
  private readonly localRoot: string;
  private readonly telemetryPath: string;

  constructor(
    projectRoot: string,
    private readonly policy: EvidencePolicy,
  ) {
    const root = resolve(projectRoot);
    this.objects = new ObjectStore(root);
    this.localRoot = join(root, ".apex", "local");
    this.telemetryPath = join(this.localRoot, "telemetry.json");
  }

  async accept(input: {
    kind: string;
    contentType: string;
    value: JsonValue | Uint8Array;
    required: boolean;
  }): Promise<EvidenceAcceptance> {
    const rule = this.policy.rule(input.kind, input.contentType);
    const originalBytes =
      input.value instanceof Uint8Array ? Buffer.from(input.value) : canonicalJsonBytes(input.value);
    let bytes: Buffer;
    let wasRedacted = false;
    const uncertainReasons: string[] = [];
    if (input.value instanceof Uint8Array) {
      bytes = Buffer.from(input.value);
      if (input.contentType === "application/json") {
        try {
          const parsed = JSON.parse(bytes.toString("utf8")) as JsonValue;
          const redactedValue = redact(parsed);
          bytes = canonicalJsonBytes(redactedValue.value);
          wasRedacted = redactedValue.redacted;
        } catch {
          uncertainReasons.push("malformed-json");
        }
      } else if (!isSafeText(bytes)) {
        uncertainReasons.push("unknown-binary");
      }
    } else {
      const redactedValue = redact(input.value);
      bytes = canonicalJsonBytes(redactedValue.value);
      wasRedacted = redactedValue.redacted;
    }
    if (bytes.byteLength > rule.maxBytes) throw new Error(`Evidence exceeds ${input.kind} byte budget`);
    const reasons = [
      ...uncertainReasons,
      ...HIGH_RISK.filter(
        (pattern) => pattern.test(originalBytes.toString("utf8")) || pattern.test(bytes.toString("utf8")),
      ).map((pattern) => `high-risk-pattern:${pattern.source}`),
    ];
    if (reasons.length > 0) {
      if (input.required || rule.retention === "immutable")
        throw new Error("Required immutable evidence contains high-risk content");
      const quarantinePath = join(this.localRoot, "quarantine", `${crypto.randomUUID()}.bin`);
      await atomicWriteBytes(quarantinePath, bytes, { refuseOverwrite: true });
      return {
        status: "quarantined",
        kind: input.kind,
        bytes: bytes.byteLength,
        retention: rule.retention,
        quarantinePath,
        redacted: wasRedacted,
        reasons,
      };
    }
    const hash = await this.objects.putBytes(bytes);
    return {
      status: "accepted",
      kind: input.kind,
      bytes: bytes.byteLength,
      retention: input.required ? "immutable" : rule.retention,
      hash,
      redacted: wasRedacted,
      reasons: [],
    };
  }

  async setTelemetryConsent(consent: boolean): Promise<void> {
    await atomicWriteJson(this.telemetryPath, { consent });
  }

  async exportTelemetry(): Promise<JsonValue | null> {
    try {
      return JSON.parse(await readFile(this.telemetryPath, "utf8")) as JsonValue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async deleteTelemetry(): Promise<void> {
    await rm(this.telemetryPath, { force: true });
  }
}

function isSafeText(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  const text = bytes.toString("utf8");
  return Buffer.from(text, "utf8").equals(bytes) && !/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(text);
}

function redact(value: JsonValue): { value: JsonValue; redacted: boolean } {
  if (Array.isArray(value)) {
    const items = value.map(redact);
    return { value: items.map((item) => item.value), redacted: items.some((item) => item.redacted) };
  }
  if (value !== null && typeof value === "object") {
    let changed = false;
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) {
        result[key] = "[REDACTED]";
        changed = true;
      } else {
        const nested = redact(item);
        result[key] = nested.value;
        changed ||= nested.redacted;
      }
    }
    return { value: result, redacted: changed };
  }
  return { value, redacted: false };
}
