const REDACTED = "[REDACTED]";
const SECRET_KEY = /(?:password|passwd|secret|token|key|connectionstring|sas|credential)/i;
const SECRET_LITERAL =
  /(?:\bBearer\s+[A-Za-z0-9._~+/=-]+|(?:AccountKey|SharedAccessSignature|ClientSecret)\s*=|\b(?:password|passwd|secret|token|api[_-]?key|client[_-]?secret)\s*[:=]\s*\S+)/i;

type RedactionMode = "remove" | "replace";

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function sanitize(value: unknown, sensitive: unknown, mode: RedactionMode): unknown {
  if (sensitive === true) return mode === "replace" ? REDACTED : undefined;
  if (Array.isArray(value)) {
    const sensitivity = Array.isArray(sensitive) ? sensitive : [];
    return value.flatMap((item, index) => {
      const sanitized = sanitize(item, sensitivity[index], mode);
      return sanitized === undefined ? [] : [sanitized];
    });
  }
  const record = object(value);
  if (record !== undefined) {
    const sensitivity = object(sensitive) ?? {};
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      if (SECRET_KEY.test(key)) {
        if (mode === "replace") sanitized[key] = REDACTED;
        continue;
      }
      const clean = sanitize(item, sensitivity[key], mode);
      if (clean !== undefined) sanitized[key] = clean;
    }
    return sanitized;
  }
  return value;
}

export function redactStructuredSecrets(value: unknown): unknown {
  return sanitize(value, undefined, "replace");
}

export function secretFreeProperties(value: unknown, sensitive: unknown): Readonly<Record<string, unknown>> {
  const sanitized = sanitize(value, sensitive, "remove");
  const properties = object(sanitized) ?? {};
  if (SECRET_LITERAL.test(JSON.stringify(properties))) {
    throw new Error("Terraform inventory contains a secret-like literal after structural redaction");
  }
  return properties;
}
