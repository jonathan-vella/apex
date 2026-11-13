import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

export const PRICING_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const stableJson = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
export const digestObject = (value) => sha256(stableJson(value));

export function rawPageBytes(page) {
  const bytes =
    page.raw_response_base64 === undefined
      ? Buffer.from(page.raw_response, "utf8")
      : Buffer.from(page.raw_response_base64, "base64");
  if (
    (page.raw_response_base64 !== undefined && bytes.toString("base64") !== page.raw_response_base64) ||
    bytes.toString("utf8") !== page.raw_response
  )
    throw new Error("Raw page byte encoding mismatch");
  return bytes;
}

function syncDirectory(directory) {
  const fd = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function safePath(target) {
  const resolved = path.resolve(target);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error("Pricing paths must not contain symlinks");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return resolved;
}

export function resolvePricingWorkspacePath(target, cwd = process.cwd()) {
  const directory = path.resolve(cwd);
  const reference = target.replaceAll("\\", "/");
  if (path.isAbsolute(target)) return path.normalize(target);
  if (reference.startsWith("agent-output/")) {
    let ancestor = directory;
    while (path.dirname(ancestor) !== ancestor) {
      if (path.basename(ancestor) === "agent-output") return path.resolve(path.dirname(ancestor), target);
      ancestor = path.dirname(ancestor);
    }
  }
  if (
    !path.isAbsolute(target) &&
    (directory === PRICING_ROOT || directory.startsWith(`${PRICING_ROOT}${path.sep}`)) &&
    /^(tools|\.github)\//.test(reference)
  )
    return path.resolve(PRICING_ROOT, target);
  return path.resolve(directory, target);
}

export function readSnapshot(target, reader, cwd = process.cwd()) {
  const filename = safePath(resolvePricingWorkspacePath(target, cwd));
  if (reader) {
    const bytes = Buffer.from(reader(target));
    return { path: filename, reference: target, bytes, sha256: sha256(bytes), reader, cwd };
  }
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error("Pricing input must be a regular file");
    const bytes = fs.readFileSync(fd);
    return { path: filename, bytes, sha256: sha256(bytes) };
  } finally {
    fs.closeSync(fd);
  }
}

export function assertSnapshots(snapshots) {
  for (const snapshot of snapshots) {
    if (readSnapshot(snapshot.reference ?? snapshot.path, snapshot.reader, snapshot.cwd).sha256 !== snapshot.sha256)
      throw new Error("Pricing source changed during validation");
  }
}

export function writeExclusive(target, bytes) {
  const filename = safePath(target);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const staging = `${filename}.${randomUUID()}.pending`;
  const fd = fs.openSync(staging, "wx", 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.linkSync(staging, filename);
    syncDirectory(path.dirname(filename));
  } catch (error) {
    try {
      fs.closeSync(fd);
    } catch {
      /* Already closed after sync. */
    }
    throw error;
  } finally {
    fs.unlinkSync(staging);
  }
}

export function evidenceDirectory(output) {
  const directory = safePath(path.join(path.dirname(path.resolve(output)), "pricing-evidence"));
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export function acquirePricingLock(target) {
  const filename = safePath(target);
  let fd;
  try {
    fd = fs.openSync(filename, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const snapshot = readSnapshot(filename);
    let owner;
    try {
      owner = JSON.parse(snapshot.bytes);
    } catch (cause) {
      throw new Error("Unrecognized pricing lock; preserve it for owner recovery", { cause });
    }
    if (owner.schema_version !== "pricing-lock-v1" || !Number.isInteger(owner.pid) || owner.pid <= 0 || !owner.token)
      throw new Error("Invalid pricing lock owner; existing file preserved", { cause: error });
    try {
      process.kill(owner.pid, 0);
      throw new Error("Pricing operation already has a live owner", { cause: error });
    } catch (probe) {
      if (probe.code !== "ESRCH") throw probe;
    }
    const recoveryPath = `${filename}.recover`;
    const recovery = fs.openSync(recoveryPath, "wx", 0o600);
    try {
      if (readSnapshot(filename).sha256 !== snapshot.sha256)
        throw new Error("Pricing lock ownership changed", { cause: error });
      fs.unlinkSync(filename);
      fd = fs.openSync(filename, "wx", 0o600);
    } finally {
      fs.closeSync(recovery);
      fs.unlinkSync(recoveryPath);
    }
  }
  const owner = {
    schema_version: "pricing-lock-v1",
    pid: process.pid,
    token: randomUUID(),
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(fd, JSON.stringify(owner));
  fs.fsyncSync(fd);
  return { fd, filename, token: owner.token };
}

export function releasePricingLock(lock) {
  try {
    const owner = JSON.parse(readSnapshot(lock.filename).bytes);
    if (owner.schema_version === "pricing-lock-v1" && owner.token === lock.token && owner.pid === process.pid)
      fs.unlinkSync(lock.filename);
  } finally {
    fs.closeSync(lock.fd);
  }
}

export function withLedger(output, operation) {
  const directory = evidenceDirectory(output);
  const filename = path.join(directory, "request-ledger.json");
  const lock = `${filename}.lock`;
  const ownership = acquirePricingLock(lock);
  try {
    const ledger = fs.existsSync(filename)
      ? JSON.parse(readSnapshot(filename).bytes)
      : { schema_version: "pricing-request-ledger-v1", attempts: [] };
    if (ledger.schema_version !== "pricing-request-ledger-v1" || !Array.isArray(ledger.attempts))
      throw new Error("Invalid pricing request ledger");
    const result = operation(ledger, directory);
    const staging = `${filename}.${randomUUID()}.pending`;
    fs.writeFileSync(staging, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    const snapshot = fs.openSync(staging, "r");
    try {
      fs.fsyncSync(snapshot);
    } finally {
      fs.closeSync(snapshot);
    }
    fs.renameSync(staging, filename);
    syncDirectory(directory);
    return result;
  } finally {
    releasePricingLock(ownership);
  }
}

export function reserveQuery({
  output,
  query,
  call_id,
  source = "mcp",
  retry_of = null,
  remaining_requests = 20,
  request_binding_path,
  cwd = PRICING_ROOT,
}) {
  if (!call_id || typeof call_id !== "string" || !["mcp", "direct"].includes(source))
    throw new Error("Native call identity and supported source are required");
  return withLedger(output, (ledger) => {
    let binding;
    let maxBudget = 20;
    if (request_binding_path) {
      const snapshot = readSnapshot(request_binding_path, undefined, cwd);
      const record = JSON.parse(snapshot.bytes);
      if (
        record.schema_version !== "pricing-request-binding-v1" ||
        digestObject(record.request_snapshot) !== record.request_sha256
      )
        throw new Error("Invalid immutable preflight request binding");
      binding = { request_binding_path, request_binding_sha256: snapshot.sha256 };
      if (record.request_snapshot?.budget_tier === "portfolio") maxBudget = 60;
    }
    if (ledger.budget_tier === "portfolio") maxBudget = 60;
    else if (maxBudget === 60) ledger.budget_tier = "portfolio";
    if (!Number.isInteger(remaining_requests) || remaining_requests < 1 || remaining_requests > maxBudget)
      throw new Error("Invalid remaining pricing request allowance");
    ledger.external_requests_used ??= maxBudget - remaining_requests;
    const query_hash = digestObject(query);
    const existing = ledger.attempts.find((attempt) => attempt.call_id === call_id);
    if (existing) {
      if (
        existing.query_hash !== query_hash ||
        existing.source !== source ||
        (binding &&
          (existing.request_binding_path !== binding.request_binding_path ||
            existing.request_binding_sha256 !== binding.request_binding_sha256))
      )
        throw new Error("Call identity or authoritative request binding conflict");
      return structuredClone(existing);
    }
    const prior = ledger.attempts.filter((attempt) => attempt.query_hash === query_hash && attempt.source === source);
    if (prior.length) {
      const previous = prior.at(-1);
      if (
        !retry_of ||
        previous.call_id !== retry_of ||
        prior.length !== 1 ||
        previous.state !== "error" ||
        ![408, 429, 500, 502, 503, 504].includes(previous.http_status)
      )
        throw new Error("Unchanged query already reserved; replay evidence or resolve its existing reservation");
    }
    if (ledger.attempts.length + ledger.external_requests_used >= maxBudget)
      throw new Error("Shared pricing request budget exhausted");
    const attempt = {
      call_id,
      source,
      query,
      query_hash,
      state: "planned",
      planned_at: new Date().toISOString(),
      ...(retry_of ? { retry_of } : {}),
      ...binding,
    };
    ledger.attempts.push(attempt);
    return structuredClone(attempt);
  });
}

export function updateAttempt(output, callId, changes) {
  return withLedger(output, (ledger) => {
    const attempt = ledger.attempts.find((entry) => entry.call_id === callId);
    if (!attempt) throw new Error("Query must be reserved before issue/capture");
    if (changes.state === "issued" && attempt.state !== "planned") throw new Error("Query already issued");
    Object.assign(attempt, changes);
    return structuredClone(attempt);
  });
}

export function ledgerCounts(ledger) {
  return {
    issued_requests: ledger.attempts.filter((attempt) => attempt.issued_confirmed).length,
    unknown_reservations: ledger.attempts.filter((attempt) => !attempt.issued_confirmed).length,
    reserved_requests: ledger.attempts.length,
  };
}

export function decodePricingResponse(bytes) {
  const buffer = Buffer.from(bytes);
  const text = buffer.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(buffer)) throw new Error("Invalid native response UTF-8 bytes");
  let value = JSON.parse(text);
  for (let depth = 0; depth < 6; depth++) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid pricing response wrapper");
    if (value.isError || value.error || (value.status !== undefined && value.status !== 200))
      throw new Error("Native pricing response reports an error");
    if (value.truncated || value.isTruncated || value.partial || value.hasMore || value.NextPageLink)
      throw new Error("Incomplete pricing response");
    if (Array.isArray(value.Items)) return value.Items;
    if (Array.isArray(value.prices)) return value.prices;
    if (value.results) {
      value = value.results;
      continue;
    }
    if (value.result) {
      value = value.result;
      continue;
    }
    if (Array.isArray(value.content)) {
      const texts = value.content.filter((part) => part.type === "text");
      if (texts.length !== 1 || value.content.length !== 1) throw new Error("Ambiguous native response content");
      value = JSON.parse(texts[0].text);
      continue;
    }
    throw new Error("Unsupported pricing response wrapper");
  }
  throw new Error("Pricing response wrapper nesting exceeds limit");
}

export function capturedPricingEnvelope(bytes) {
  const buffer = Buffer.from(bytes);
  const text = buffer.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(buffer)) throw new Error("Invalid native response UTF-8 bytes");
  let value = JSON.parse(text);
  for (let depth = 0; depth < 6; depth++) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid native pricing envelope");
    if (Array.isArray(value.content)) {
      if (value.content.length !== 1 || value.content[0]?.type !== "text")
        throw new Error("Ambiguous native pricing response content");
      value = JSON.parse(value.content[0].text);
      continue;
    }
    if (value.result) {
      value = value.result;
      continue;
    }
    if (value.status !== undefined || value.results || Array.isArray(value.Items) || Array.isArray(value.prices))
      return value;
    throw new Error("Unsupported native pricing failure envelope");
  }
  throw new Error("Native pricing envelope nesting exceeds limit");
}

export const METER_FIELDS = [
  "meterId",
  "meterName",
  "serviceName",
  "productName",
  "skuName",
  "armSkuName",
  "armRegionName",
  "currencyCode",
  "type",
  "unitOfMeasure",
  "tierMinimumUnits",
  "effectiveStartDate",
  "retailPrice",
];

export function normalizeMeter(row) {
  const normalized = { ...row, armRegionName: row.armRegionName ?? row.region, type: row.type ?? row.priceType };
  if (normalized.tierMinimumUnits === undefined && /^(1\s*\/?\s*)?hours?$/i.test(row.unitOfMeasure ?? ""))
    normalized.tierMinimumUnits = null;
  for (const field of METER_FIELDS) {
    if (["retailPrice", "tierMinimumUnits"].includes(field)) {
      if (
        field === "tierMinimumUnits" &&
        normalized[field] === null &&
        /^(1\s*\/?\s*)?hours?$/i.test(row.unitOfMeasure ?? "")
      )
        continue;
      if (typeof normalized[field] !== "number" || !Number.isFinite(normalized[field]) || normalized[field] < 0)
        throw new Error(`Missing or invalid native meter ${field}`);
    } else if (
      typeof normalized[field] !== "string" ||
      (!normalized[field] && !["armRegionName", "armSkuName"].includes(field))
    ) {
      throw new Error(`Missing native meter ${field}`);
    }
  }
  if (!Number.isFinite(Date.parse(normalized.effectiveStartDate))) throw new Error("Invalid meter effective date");
  const base = Object.fromEntries(METER_FIELDS.map((field) => [field, normalized[field]]));
  if (normalized.type === "Reservation" && typeof row.reservationTerm === "string" && row.reservationTerm.trim()) {
    base.reservationTerm = row.reservationTerm.trim();
  }
  return base;
}

export function captureMcpResponse({
  output,
  query,
  call_id,
  native_call_id = call_id,
  response_path,
  cwd = PRICING_ROOT,
}) {
  if (typeof native_call_id !== "string" || !native_call_id.trim())
    throw new Error("Actual native call identity is required");
  const snapshot = readSnapshot(response_path);
  const directory = evidenceDirectory(output);
  const filename = path.join(directory, `${snapshot.sha256}.raw`);
  const attempt = withLedger(output, (ledger) => {
    const entry = ledger.attempts.find((item) => item.call_id === call_id);
    if (!entry || entry.source !== "mcp" || entry.query_hash !== digestObject(query) || !entry.issued_at)
      throw new Error("Matching issued native query reservation required");
    if (ledger.attempts.some((item) => item.call_id !== call_id && item.native_call_id === native_call_id))
      throw new Error("Native tool call is already captured under another reservation");
    return structuredClone(entry);
  });
  if (
    attempt.request_binding_path &&
    readSnapshot(attempt.request_binding_path, undefined, cwd).sha256 !== attempt.request_binding_sha256
  )
    throw new Error("Immutable preflight request binding changed before capture");
  if (attempt.evidence_path) {
    const saved = JSON.parse(readSnapshot(attempt.evidence_path, undefined, cwd).bytes);
    if (saved.response_sha256 !== snapshot.sha256 || saved.native_call_id !== native_call_id)
      throw new Error("Native call identity cannot capture different bytes");
    return saved;
  }
  if (fs.existsSync(filename)) {
    if (readSnapshot(filename).sha256 !== snapshot.sha256) throw new Error("Existing evidence hash conflict");
  } else writeExclusive(filename, snapshot.bytes);
  let rows = [];
  let status = "FAILED";
  let failure = null;
  try {
    rows = decodePricingResponse(snapshot.bytes);
    status = rows.length ? "COMPLETE" : "EMPTY";
  } catch {
    failure = "INVALID_OR_ERROR_RESPONSE";
  }
  const evidencePath = path.join(directory, `${digestObject({ call_id, query })}.json`);
  const portablePath = (filename) => path.relative(cwd, filename).replaceAll(path.sep, "/");
  const evidence = {
    schema_version: "pricing-response-evidence-v1",
    status,
    source: "mcp",
    provenance: "caller-supplied-native-call",
    call_id,
    native_call_id,
    ...(attempt.request_binding_path
      ? {
          request_binding_path: attempt.request_binding_path,
          request_binding_sha256: attempt.request_binding_sha256,
        }
      : {}),
    query,
    query_hash: digestObject(query),
    queried_at: attempt.issued_at,
    captured_at: new Date().toISOString(),
    evidence_path: portablePath(evidencePath),
    raw_path: portablePath(filename),
    response_sha256: snapshot.sha256,
    normalized_rows: rows,
    meter_rows: rows.flatMap((row) => {
      try {
        const meter = normalizeMeter(row);
        return [{ row_sha256: digestObject(meter), meter }];
      } catch {
        return [];
      }
    }),
    failure,
  };
  if (fs.existsSync(evidencePath)) {
    const saved = JSON.parse(readSnapshot(evidencePath).bytes);
    if (
      saved.response_sha256 !== evidence.response_sha256 ||
      saved.query_hash !== evidence.query_hash ||
      saved.call_id !== call_id ||
      saved.native_call_id !== native_call_id
    )
      throw new Error("Existing capture must be preserved");
    evidence.captured_at = saved.captured_at;
  } else writeExclusive(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  let http_status;
  try {
    http_status = capturedPricingEnvelope(snapshot.bytes).status;
  } catch {
    /* Invalid raw bytes are preserved. */
  }
  updateAttempt(output, call_id, {
    state: status === "FAILED" ? "error" : "completed",
    issued_confirmed: true,
    native_call_id,
    evidence_path: portablePath(evidencePath),
    response_sha256: snapshot.sha256,
    http_status,
  });
  return evidence;
}

export function verifyCapturedFailure(failure, readEvidenceFile, cwd = PRICING_ROOT, expectedLedgerPath) {
  const snapshots = [];
  const derivedAttempts = [];
  let latestQueriedAt = -Infinity;
  for (const attempt of failure?.attempts ?? []) {
    if (!attempt.evidence_path) throw new Error("Fallback requires exact captured native failure evidence");
    const read = (reference) => readSnapshot(reference, readEvidenceFile, cwd);
    const metadata = read(attempt.evidence_path);
    snapshots.push(metadata);
    const capture = JSON.parse(metadata.bytes);
    if (
      capture.schema_version !== "pricing-response-evidence-v1" ||
      capture.source !== "mcp" ||
      capture.provenance !== "caller-supplied-native-call" ||
      !capture.call_id ||
      !capture.native_call_id ||
      capture.query_hash !== digestObject(capture.query)
    )
      throw new Error("Invalid captured native failure provenance");
    const isCompleteMcpFailureKind =
      failure.kind === "missing_tier_metadata" || failure.kind === "single_non_hourly_missing_tier_metadata";
    if (
      (failure.kind === "empty_result" && capture.status !== "EMPTY") ||
      (isCompleteMcpFailureKind && capture.status !== "COMPLETE") ||
      (failure.kind !== "empty_result" && !isCompleteMcpFailureKind && capture.status !== "FAILED")
    )
      throw new Error("Captured native result does not establish the claimed failure kind");
    const raw = read(capture.raw_path);
    snapshots.push(raw);
    if (raw.sha256 !== capture.response_sha256) throw new Error("Captured failure byte hash mismatch");
    const envelope = capturedPricingEnvelope(raw.bytes);
    if (
      (attempt.response !== undefined &&
        stableJson(JSON.parse(raw.bytes)) !== stableJson(attempt.response) &&
        stableJson(envelope) !== stableJson(attempt.response)) ||
      ((attempt.query !== undefined || attempt.parameters !== undefined) &&
        digestObject(attempt.query ?? attempt.parameters) !== capture.query_hash)
    )
      throw new Error("Fallback failure differs from actual captured native response/query");
    const ledgerReference = path.join(path.dirname(attempt.evidence_path), "request-ledger.json");
    if (
      expectedLedgerPath &&
      resolvePricingWorkspacePath(ledgerReference, cwd) !== resolvePricingWorkspacePath(expectedLedgerPath, cwd)
    )
      throw new Error("Native failure and direct fallback must share one request ledger scope");
    const ledgerSnapshot = read(ledgerReference);
    snapshots.push(ledgerSnapshot);
    const ledger = JSON.parse(ledgerSnapshot.bytes);
    const issued = ledger.attempts?.find((item) => item.call_id === capture.call_id);
    if (
      !issued?.issued_at ||
      issued.query_hash !== capture.query_hash ||
      issued.native_call_id !== capture.native_call_id ||
      issued.response_sha256 !== capture.response_sha256 ||
      issued.issued_at !== capture.queried_at ||
      !["completed", "error"].includes(issued.state)
    )
      throw new Error("Captured failure lacks matching issued ledger entry");
    const queried = Date.parse(capture.queried_at);
    if (
      !Number.isFinite(queried) ||
      !Number.isFinite(Date.parse(capture.captured_at)) ||
      Date.parse(capture.captured_at) < queried ||
      queried > Date.now() ||
      Date.parse(capture.captured_at) > Date.now()
    )
      throw new Error("Captured failure timestamps are invalid or future-dated");
    latestQueriedAt = Math.max(latestQueriedAt, queried);
    const canonicalQuery =
      Object.hasOwn(capture.query, "serviceName") &&
      Object.hasOwn(capture.query, "currencyCode") &&
      Object.hasOwn(capture.query, "priceType");
    const nativeStatus = envelope.status ?? issued.http_status;
    if (attempt.http_status !== undefined && attempt.http_status !== nativeStatus)
      throw new Error(
        "Claimed HTTP status contradicts captured native response; authentication failures cannot authorize fallback",
      );
    derivedAttempts.push({
      evidence_path: attempt.evidence_path,
      ...(canonicalQuery ? { query: capture.query } : { parameters: capture.query }),
      response: envelope,
      ...(nativeStatus === undefined ? {} : { http_status: nativeStatus }),
      ...(failure.kind === "transient_exhausted"
        ? {
            error:
              typeof envelope.message === "string"
                ? envelope.message
                : typeof envelope.error === "string"
                  ? envelope.error
                  : "Captured retryable native pricing failure",
          }
        : {}),
    });
  }
  if (!snapshots.length) throw new Error("Captured MCP failure is required");
  snapshots.failure = {
    ...failure,
    recorded_at: failure.recorded_at ?? new Date(latestQueriedAt).toISOString(),
    captured_recorded_at: new Date(latestQueriedAt).toISOString(),
    attempts: derivedAttempts,
  };
  return snapshots;
}
