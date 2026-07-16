import { chmod, lstat, mkdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { EncryptedEnvelopeTransport, type EncryptedEnvelope, type EnvelopeBindings } from "@apex/capabilities";
import { atomicWriteBytes, canonicalJsonBytes, sha256Bytes, sha256Json, type JsonValue } from "@apex/kernel";

export const PROVIDER_TRANSFER_KIND = "apex-provider-authority";
export const PROVIDER_TRANSFER_MAX_BUNDLE_BYTES = 8 * 1024 * 1024;
export const PROVIDER_TRANSFER_MAX_FILE_BYTES = 4 * 1024 * 1024;

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BINDING_PATH_PATTERN = /^bindings\/[0-9a-f]{64}\.json$/;
const ARTIFACT_PATH_PATTERN = /^artifacts\/[0-9a-f]{64}\.json$/;

export type ProviderTransferProvider = "bicep" | "terraform";
export type ProviderTransferOperation = "apply" | "destroy";

export interface ProviderTransferBindings extends EnvelopeBindings {
  readonly provider: ProviderTransferProvider;
  readonly operation: ProviderTransferOperation;
  readonly projectId: string;
  readonly runId: string;
  readonly ownerEpoch: number;
  readonly previewHash: string;
  readonly recipient: string;
  readonly authorityExpiresAt: string;
  readonly artifactRef?: string;
  readonly planDigest?: string;
}

export interface ProviderTransferFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly content: string;
}

export interface ProviderTransferBundle {
  readonly implementation: "apex-provider-transfer";
  readonly version: 1;
  readonly bindings: ProviderTransferBindings;
  readonly files: readonly ProviderTransferFile[];
}

export interface ProviderTransferExportOptions {
  readonly previewHash: string;
  readonly provider: ProviderTransferProvider;
  readonly recipient: string;
  readonly ttlMs: number;
}

interface ParsedAuthority {
  readonly bindings: ProviderTransferBindings;
  readonly binding: Record<string, unknown>;
  readonly artifactRef?: string;
}

function earliestExpiry(...values: string[]): string {
  return values.reduce((earliest, value) => (Date.parse(value) < Date.parse(earliest) ? value : earliest));
}

interface StoredArtifact {
  readonly reference: string;
  readonly artifact: Record<string, unknown>;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is invalid`);
  return value as Record<string, unknown>;
}

function requireNonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} is required`);
  return value;
}

function requireHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) throw new Error(`${label} must be a SHA-256 hash`);
  return value;
}

function requireBase64(value: unknown, bytes: number, label: string): string {
  if (typeof value !== "string" || !BASE64_PATTERN.test(value)) throw new Error(`${label} is invalid`);
  const decoded = Buffer.from(value, "base64");
  if (decoded.byteLength !== bytes || decoded.toString("base64") !== value) throw new Error(`${label} is invalid`);
  return value;
}

function parseJson(bytes: Buffer, label: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

async function readRegular(path: string, label: string): Promise<Buffer> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} is not a regular file`);
  if (info.size > PROVIDER_TRANSFER_MAX_FILE_BYTES) throw new Error(`${label} exceeds the 4 MiB file limit`);
  return await readFile(path);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
    throw new Error(`${label} shape is invalid`);
  }
}

function requireTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid`);
  return value;
}

function validatePreview(preview: Record<string, unknown>): void {
  const expected = [
    "blockers",
    "changes",
    "commit",
    "createdAt",
    "dependencyRevision",
    "environment",
    "expiresAt",
    "iacHash",
    "inputHash",
    "operation",
    "ownerEpoch",
    "policyHash",
    "previewHash",
    "projectId",
    "runId",
    "schemaVersion",
    "target",
    "track",
  ];
  for (const optional of ["artifactHash", "stateLineage", "stateSerial"] as const) {
    if (preview[optional] !== undefined) expected.push(optional);
  }
  exactKeys(preview, expected, "Provider binding preview");
  if (preview.schemaVersion !== "1.0.0" || !Array.isArray(preview.changes) || !Array.isArray(preview.blockers)) {
    throw new Error("Provider binding preview shape is invalid");
  }
  for (const changeValue of preview.changes) {
    const change = requireRecord(changeValue, "Provider binding preview change");
    const changeKeys = ["action", "material", "resourceId"];
    if (change.details !== undefined) changeKeys.push("details");
    exactKeys(change, changeKeys, "Provider binding preview change");
    if (
      !["create", "update", "delete", "replace", "no-op", "unknown"].includes(change.action as string) ||
      typeof change.material !== "boolean"
    ) {
      throw new Error("Provider binding preview change is invalid");
    }
    requireNonempty(change.resourceId, "Provider binding preview change resourceId");
    if (change.details !== undefined) requireNonempty(change.details, "Provider binding preview change details");
  }
  for (const blocker of preview.blockers) requireNonempty(blocker, "Provider binding preview blocker");
  for (const key of ["commit", "dependencyRevision", "iacHash", "inputHash", "policyHash"] as const) {
    requireHash(preview[key], `Provider binding preview ${key}`);
  }
  if (preview.artifactHash !== undefined) requireHash(preview.artifactHash, "Provider binding preview artifactHash");
  requireTimestamp(preview.createdAt, "Provider binding preview createdAt");
  requireTimestamp(preview.expiresAt, "Provider binding preview expiresAt");
  requireNonempty(preview.environment, "Provider binding preview environment");
  requireNonempty(preview.target, "Provider binding preview target");
  if (preview.stateLineage !== undefined) requireNonempty(preview.stateLineage, "Provider binding stateLineage");
  if (
    preview.stateSerial !== undefined &&
    (!Number.isInteger(preview.stateSerial) || (preview.stateSerial as number) < 0)
  ) {
    throw new Error("Provider binding stateSerial is invalid");
  }
}

function parseBinding(
  value: unknown,
  previewHash: string,
  provider?: ProviderTransferProvider,
  recipient?: string,
): ParsedAuthority {
  const binding = requireRecord(value, "Provider binding");
  if (binding.kind !== "bicep" && binding.kind !== "terraform") throw new Error("Provider binding kind is invalid");
  if (provider !== undefined && binding.kind !== provider)
    throw new Error("Provider binding does not match requested provider");
  exactKeys(
    binding,
    binding.kind === "bicep"
      ? ["kind", "parametersHash", "preview", "providerBindingHash", "stackStateHash", "templateHash"]
      : ["attestation", "kind", "preview"],
    "Provider binding",
  );
  const preview = requireRecord(binding.preview, "Provider binding preview");
  validatePreview(preview);
  const previewExpiresAt = preview.expiresAt as string;
  if (preview.previewHash !== previewHash) throw new Error("Provider binding preview hash does not match its path");
  const projectId = requireNonempty(preview.projectId, "Provider binding projectId");
  const runId = requireNonempty(preview.runId, "Provider binding runId");
  if (preview.operation !== "apply" && preview.operation !== "destroy") {
    throw new Error("Provider binding operation is invalid");
  }
  if (!Number.isInteger(preview.ownerEpoch) || (preview.ownerEpoch as number) < 1) {
    throw new Error("Provider binding ownerEpoch is invalid");
  }
  if (preview.track !== binding.kind) throw new Error("Provider binding track is invalid");
  if (binding.kind === "bicep") {
    for (const key of ["parametersHash", "providerBindingHash", "stackStateHash", "templateHash"] as const) {
      requireHash(binding[key], `Bicep ${key}`);
    }
  }
  const common: ProviderTransferBindings = {
    provider: binding.kind as ProviderTransferProvider,
    operation: preview.operation as ProviderTransferOperation,
    projectId,
    runId,
    ownerEpoch: preview.ownerEpoch as number,
    previewHash,
    recipient: recipient ?? "",
    authorityExpiresAt: previewExpiresAt,
  };
  if (binding.kind === "bicep") return { binding, bindings: common };

  const attestation = requireRecord(binding.attestation, "Terraform attestation");
  const attestationKeys = [
    "artifactRef",
    "configHash",
    "createdAt",
    "expiresAt",
    "iacHash",
    "inputHash",
    "lockfileHash",
    "planDigest",
    "policyHash",
    "previewHash",
    "projectId",
    "recipient",
    "runId",
    "schemaVersion",
    "track",
    "transport",
  ];
  for (const optional of ["stateLineage", "stateSerial"] as const) {
    if (attestation[optional] !== undefined) attestationKeys.push(optional);
  }
  exactKeys(attestation, attestationKeys, "Terraform attestation");
  if (attestation.schemaVersion !== "1.0.0" || attestation.track !== "terraform") {
    throw new Error("Terraform attestation shape is invalid");
  }
  for (const key of ["iacHash", "inputHash", "policyHash"] as const) {
    requireHash(attestation[key], `Terraform attestation ${key}`);
  }
  requireTimestamp(attestation.createdAt, "Terraform attestation createdAt");
  const attestationExpiresAt = requireTimestamp(attestation.expiresAt, "Terraform attestation expiresAt");
  if (attestation.stateLineage !== undefined) requireNonempty(attestation.stateLineage, "Terraform stateLineage");
  if (
    attestation.stateSerial !== undefined &&
    (!Number.isInteger(attestation.stateSerial) || (attestation.stateSerial as number) < 0)
  ) {
    throw new Error("Terraform stateSerial is invalid");
  }
  for (const [key, expected] of [
    ["projectId", projectId],
    ["runId", runId],
    ["previewHash", previewHash],
  ] as const) {
    if (attestation[key] !== expected) throw new Error(`Terraform attestation ${key} mismatch`);
  }
  const artifactRef = requireNonempty(attestation.artifactRef, "Terraform artifactRef");
  const planDigest = requireHash(attestation.planDigest, "Terraform planDigest");
  requireHash(attestation.configHash, "Terraform configHash");
  requireHash(attestation.lockfileHash, "Terraform lockfileHash");
  const attestationRecipient = requireNonempty(attestation.recipient, "Terraform recipient");
  if (recipient !== undefined && attestationRecipient !== recipient) throw new Error("Terraform recipient mismatch");
  const transport = requireRecord(attestation.transport, "Terraform transport");
  exactKeys(
    transport,
    ["algorithm", "authTag", "encrypted", "implementation", "iv", "mediaType", "recipient"],
    "Terraform transport",
  );
  if (
    transport.encrypted !== true ||
    transport.implementation !== "local-reference" ||
    transport.algorithm !== "aes-256-gcm" ||
    transport.recipient !== attestationRecipient
  ) {
    throw new Error("Terraform transport is invalid");
  }
  requireBase64(transport.iv, 12, "Terraform attestation IV");
  requireBase64(transport.authTag, 16, "Terraform attestation authTag");
  return {
    binding,
    artifactRef,
    bindings: {
      ...common,
      recipient: attestationRecipient,
      authorityExpiresAt: earliestExpiry(previewExpiresAt, attestationExpiresAt),
      artifactRef,
      planDigest,
    },
  };
}

function parseStoredArtifact(value: unknown, authority: ParsedAuthority): StoredArtifact & { expiresAt: string } {
  const stored = requireRecord(value, "Terraform artifact");
  exactKeys(stored, ["artifact", "reference"], "Terraform artifact");
  if (stored.reference !== authority.artifactRef) throw new Error("Terraform artifact reference mismatch");
  const artifact = requireRecord(stored.artifact, "Terraform encrypted artifact");
  exactKeys(artifact, ["authTag", "ciphertext", "iv", "metadata"], "Terraform encrypted artifact");
  const metadata = requireRecord(artifact.metadata, "Terraform artifact metadata");
  exactKeys(
    metadata,
    ["algorithm", "createdAt", "digest", "expiresAt", "implementation", "recipient"],
    "Terraform artifact metadata",
  );
  if (
    metadata.digest !== authority.bindings.planDigest ||
    metadata.recipient !== authority.bindings.recipient ||
    metadata.implementation !== "local-reference" ||
    metadata.algorithm !== "aes-256-gcm"
  ) {
    throw new Error("Terraform artifact metadata mismatch");
  }
  const attestation = requireRecord(authority.binding.attestation, "Terraform attestation");
  const transport = requireRecord(attestation.transport, "Terraform transport");
  if (artifact.iv !== transport.iv || artifact.authTag !== transport.authTag) {
    throw new Error("Terraform artifact IV/authTag mismatch");
  }
  requireBase64(artifact.iv, 12, "Terraform artifact IV");
  requireBase64(artifact.authTag, 16, "Terraform artifact authTag");
  requireTimestamp(metadata.createdAt, "Terraform artifact createdAt");
  const expiresAt = requireTimestamp(metadata.expiresAt, "Terraform artifact expiresAt");
  const ciphertext = requireNonempty(artifact.ciphertext, "Terraform artifact ciphertext");
  if (!BASE64_PATTERN.test(ciphertext) || Buffer.from(ciphertext, "base64").toString("base64") !== ciphertext) {
    throw new Error("Terraform artifact ciphertext is invalid");
  }
  return { reference: stored.reference as string, artifact, expiresAt };
}

function bundleFile(path: string, bytes: Buffer): ProviderTransferFile {
  return { path, bytes: bytes.byteLength, sha256: sha256Bytes(bytes), content: bytes.toString("base64") };
}

export async function createProviderTransferBundle(
  root: string,
  options: ProviderTransferExportOptions,
  now: Date = new Date(),
): Promise<ProviderTransferBundle> {
  requireHash(options.previewHash, "Preview hash");
  if (options.provider !== "bicep" && options.provider !== "terraform") throw new Error("Provider is invalid");
  requireNonempty(options.recipient, "Provider transfer recipient");
  if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) throw new Error("Provider transfer TTL must be positive");
  const runtimeRoot = resolve(root, ".apex", "local", "provider-runtime");
  const bindingPath = `bindings/${options.previewHash}.json`;
  const bindingBytes = await readRegular(join(runtimeRoot, ...bindingPath.split("/")), "Provider binding");
  const authority = parseBinding(
    parseJson(bindingBytes, "Provider binding"),
    options.previewHash,
    options.provider,
    options.recipient,
  );
  let bindings = authority.bindings;
  const selected = [{ path: bindingPath, bytes: bindingBytes }];
  if (options.provider === "terraform") {
    const artifactPath = `artifacts/${sha256Bytes(Buffer.from(authority.artifactRef!, "utf8"))}.json`;
    const artifactBytes = await readRegular(join(runtimeRoot, ...artifactPath.split("/")), "Terraform artifact");
    const artifact = parseStoredArtifact(parseJson(artifactBytes, "Terraform artifact"), authority);
    bindings = {
      ...bindings,
      authorityExpiresAt: earliestExpiry(bindings.authorityExpiresAt, artifact.expiresAt),
    };
    selected.push({ path: artifactPath, bytes: artifactBytes });
  }
  if (Date.parse(bindings.authorityExpiresAt) <= now.getTime()) {
    throw new Error("Provider transfer authority has expired");
  }
  if (now.getTime() + options.ttlMs > Date.parse(bindings.authorityExpiresAt)) {
    throw new Error("Provider transfer envelope cannot outlive its preview authority");
  }
  const bundle: ProviderTransferBundle = {
    implementation: "apex-provider-transfer",
    version: 1,
    bindings,
    files: selected
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({ path, bytes }) => bundleFile(path, bytes)),
  };
  if (canonicalJsonBytes(bundle).byteLength > PROVIDER_TRANSFER_MAX_BUNDLE_BYTES) {
    throw new Error("Provider transfer plaintext bundle exceeds the 8 MiB limit");
  }
  return bundle;
}

export async function exportProviderTransfer(
  root: string,
  outputPath: string,
  options: ProviderTransferExportOptions,
  dependencies: { readonly key: Uint8Array; readonly now?: () => Date; readonly nonce?: () => Uint8Array },
): Promise<{ path: string; sha256: string; files: number; expiresAt: string }> {
  if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) throw new Error("Provider transfer TTL must be positive");
  const now = dependencies.now?.() ?? new Date();
  const bundle = await createProviderTransferBundle(root, options, now);
  const envelope = new EncryptedEnvelopeTransport(() => now, dependencies.nonce).encrypt(
    canonicalJsonBytes(bundle),
    dependencies.key,
    { kind: PROVIDER_TRANSFER_KIND, recipient: options.recipient, ttlMs: options.ttlMs, bindings: bundle.bindings },
  );
  const bytes = canonicalJsonBytes(envelope);
  await atomicWriteBytes(resolve(outputPath), bytes);
  return {
    path: resolve(outputPath),
    sha256: sha256Bytes(bytes),
    files: bundle.files.length,
    expiresAt: envelope.metadata.expiresAt,
  };
}

function requireBindings(value: unknown): ProviderTransferBindings {
  const bindings = requireRecord(value, "Provider transfer bindings") as Partial<ProviderTransferBindings>;
  if (bindings.provider !== "bicep" && bindings.provider !== "terraform")
    throw new Error("Provider transfer provider is invalid");
  if (bindings.operation !== "apply" && bindings.operation !== "destroy")
    throw new Error("Provider transfer operation is invalid");
  requireNonempty(bindings.projectId, "Provider transfer projectId");
  requireNonempty(bindings.runId, "Provider transfer runId");
  requireNonempty(bindings.recipient, "Provider transfer recipient");
  requireTimestamp(bindings.authorityExpiresAt, "Provider transfer authorityExpiresAt");
  requireHash(bindings.previewHash, "Provider transfer previewHash");
  if (!Number.isInteger(bindings.ownerEpoch) || (bindings.ownerEpoch ?? 0) < 1)
    throw new Error("Provider transfer ownerEpoch is invalid");
  const expected = [
    "authorityExpiresAt",
    "operation",
    "ownerEpoch",
    "previewHash",
    "projectId",
    "provider",
    "recipient",
    "runId",
  ];
  if (bindings.provider === "terraform") {
    requireNonempty(bindings.artifactRef, "Provider transfer artifactRef");
    requireHash(bindings.planDigest, "Provider transfer planDigest");
    expected.push("artifactRef", "planDigest");
  }
  exactKeys(bindings as Record<string, unknown>, expected, "Provider transfer bindings");
  return bindings as ProviderTransferBindings;
}

function decodeFile(entry: unknown): { path: string; bytes: Buffer } {
  const file = requireRecord(entry, "Provider transfer file") as unknown as ProviderTransferFile;
  exactKeys(
    file as unknown as Record<string, unknown>,
    ["bytes", "content", "path", "sha256"],
    "Provider transfer file",
  );
  if (
    typeof file.path !== "string" ||
    (!BINDING_PATH_PATTERN.test(file.path) && !ARTIFACT_PATH_PATTERN.test(file.path))
  ) {
    throw new Error("Provider transfer file path is invalid");
  }
  if (!Number.isInteger(file.bytes) || file.bytes < 0 || file.bytes > PROVIDER_TRANSFER_MAX_FILE_BYTES) {
    throw new Error(`Provider transfer file size is invalid: ${file.path}`);
  }
  requireHash(file.sha256, "Provider transfer file hash");
  if (!BASE64_PATTERN.test(file.content)) throw new Error(`Provider transfer file encoding is invalid: ${file.path}`);
  const bytes = Buffer.from(file.content, "base64");
  if (
    bytes.toString("base64") !== file.content ||
    bytes.byteLength !== file.bytes ||
    sha256Bytes(bytes) !== file.sha256
  ) {
    throw new Error(`Provider transfer file integrity check failed: ${file.path}`);
  }
  return { path: file.path, bytes };
}

function validateBundle(
  value: unknown,
  envelopeBindings: EnvelopeBindings,
): { bundle: ProviderTransferBundle; entries: Array<{ path: string; bytes: Buffer }> } {
  const bundle = requireRecord(value, "Provider transfer bundle") as Partial<ProviderTransferBundle>;
  exactKeys(
    bundle as Record<string, unknown>,
    ["bindings", "files", "implementation", "version"],
    "Provider transfer bundle",
  );
  if (bundle.implementation !== "apex-provider-transfer" || bundle.version !== 1 || !Array.isArray(bundle.files)) {
    throw new Error("Unsupported provider transfer bundle");
  }
  const bindings = requireBindings(bundle.bindings);
  if (sha256Json(bindings as JsonValue) !== sha256Json(envelopeBindings as JsonValue)) {
    throw new Error("Provider transfer envelope bindings do not match the bundle");
  }
  const entries = bundle.files.map(decodeFile);
  const paths = entries.map(({ path }) => path);
  if (new Set(paths).size !== paths.length || paths.join("\0") !== [...paths].sort().join("\0")) {
    throw new Error("Provider transfer files are duplicate or not in deterministic order");
  }
  const bindingPath = `bindings/${bindings.previewHash}.json`;
  const expected = [bindingPath];
  const bindingBytes = entries.find(({ path }) => path === bindingPath)?.bytes;
  if (bindingBytes === undefined) throw new Error("Provider transfer exact binding is missing");
  const authority = parseBinding(
    parseJson(bindingBytes, "Provider binding"),
    bindings.previewHash,
    bindings.provider,
    bindings.recipient,
  );
  let actualBindings = authority.bindings;
  if (bindings.provider === "terraform") {
    const artifactPath = `artifacts/${sha256Bytes(Buffer.from(bindings.artifactRef!, "utf8"))}.json`;
    expected.push(artifactPath);
    const artifactBytes = entries.find(({ path }) => path === artifactPath)?.bytes;
    if (artifactBytes === undefined) throw new Error("Provider transfer exact Terraform artifact is missing");
    const artifact = parseStoredArtifact(parseJson(artifactBytes, "Terraform artifact"), authority);
    actualBindings = {
      ...actualBindings,
      authorityExpiresAt: earliestExpiry(actualBindings.authorityExpiresAt, artifact.expiresAt),
    };
  }
  if (sha256Json(actualBindings as JsonValue) !== sha256Json(bindings as JsonValue)) {
    throw new Error("Provider transfer binding does not match bundle authority");
  }
  if (paths.join("\0") !== expected.sort().join("\0")) throw new Error("Provider transfer contains unrelated files");
  return { bundle: bundle as ProviderTransferBundle, entries };
}

async function assertSafeDirectory(path: string, label: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`${label} is unsafe`);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function ensureDirectory(path: string): Promise<void> {
  if (!(await assertSafeDirectory(path, "Provider transfer destination directory"))) await mkdir(path, { mode: 0o700 });
  await chmod(path, 0o700);
}

async function assertDestinationAncestors(root: string): Promise<void> {
  const apexRoot = join(root, ".apex");
  const localRoot = join(apexRoot, "local");
  const runtimeRoot = join(localRoot, "provider-runtime");
  await assertSafeDirectory(root, "Provider transfer workspace root");
  if (await assertSafeDirectory(apexRoot, "Provider transfer .apex directory")) {
    if (await assertSafeDirectory(localRoot, "Provider transfer local directory")) {
      if (await assertSafeDirectory(runtimeRoot, "Provider transfer runtime directory")) {
        await assertSafeDirectory(join(runtimeRoot, "bindings"), "Provider transfer bindings directory");
        await assertSafeDirectory(join(runtimeRoot, "artifacts"), "Provider transfer artifacts directory");
      }
    }
  }
}

export async function importProviderTransfer(
  root: string,
  envelopeValue: unknown,
  recipient: string,
  key: Uint8Array,
  now: () => Date = () => new Date(),
): Promise<{
  provider: ProviderTransferProvider;
  operation: ProviderTransferOperation;
  previewHash: string;
  files: number;
}> {
  requireNonempty(recipient, "Provider transfer recipient");
  const envelopeRecord = requireRecord(envelopeValue, "Provider transfer envelope");
  exactKeys(envelopeRecord, ["authTag", "ciphertext", "iv", "metadata"], "Provider transfer envelope");
  const envelope = envelopeValue as EncryptedEnvelope;
  const metadata = requireRecord(envelope.metadata, "Provider transfer envelope metadata");
  if (metadata.kind !== PROVIDER_TRANSFER_KIND) throw new Error("Provider transfer envelope kind is invalid");
  const maxEncodedBytes = Math.ceil(PROVIDER_TRANSFER_MAX_BUNDLE_BYTES / 3) * 4;
  if (typeof envelope.ciphertext !== "string" || envelope.ciphertext.length > maxEncodedBytes) {
    throw new Error("Provider transfer encrypted payload exceeds the 8 MiB limit");
  }
  const bindings = requireBindings(metadata.bindings);
  if (bindings.recipient !== recipient || metadata.recipient !== recipient)
    throw new Error("Provider transfer recipient mismatch");
  const plaintext = new EncryptedEnvelopeTransport(now).decrypt(envelope, key, recipient);
  if (plaintext.byteLength > PROVIDER_TRANSFER_MAX_BUNDLE_BYTES)
    throw new Error("Provider transfer plaintext exceeds 8 MiB");
  const { bundle, entries } = validateBundle(parseJson(plaintext, "Provider transfer bundle"), bindings);
  if (Date.parse(envelope.metadata.expiresAt) > Date.parse(bundle.bindings.authorityExpiresAt)) {
    throw new Error("Provider transfer envelope expiry exceeds its preview authority");
  }

  const workspaceRoot = resolve(root);
  await assertDestinationAncestors(workspaceRoot);
  const runtimeRoot = join(workspaceRoot, ".apex", "local", "provider-runtime");
  const preflight: Array<{ destination: string; bytes: Buffer; exists: boolean }> = [];
  for (const entry of entries) {
    const destination = resolve(runtimeRoot, ...entry.path.split("/"));
    if (!destination.startsWith(`${runtimeRoot}${sep}`) || relative(runtimeRoot, destination).startsWith("..")) {
      throw new Error("Provider transfer path escapes provider runtime");
    }
    if (destination.endsWith(`${sep}plan-transport.key`))
      throw new Error("Provider transfer cannot write the transport key");
    try {
      const info = await lstat(destination);
      if (info.isSymbolicLink() || !info.isFile())
        throw new Error(`Provider transfer destination is unsafe: ${entry.path}`);
      const existing = await readFile(destination);
      if (!existing.equals(entry.bytes)) throw new Error(`Provider transfer destination differs: ${entry.path}`);
      preflight.push({ destination, bytes: entry.bytes, exists: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      preflight.push({ destination, bytes: entry.bytes, exists: false });
    }
  }
  await ensureDirectory(join(workspaceRoot, ".apex"));
  await ensureDirectory(join(workspaceRoot, ".apex", "local"));
  await ensureDirectory(runtimeRoot);
  await ensureDirectory(join(runtimeRoot, "bindings"));
  await ensureDirectory(join(runtimeRoot, "artifacts"));
  for (const entry of preflight) {
    if (!entry.exists) await atomicWriteBytes(entry.destination, entry.bytes, { refuseOverwrite: true });
    await chmod(entry.destination, 0o600);
  }
  return {
    provider: bundle.bindings.provider,
    operation: bundle.bindings.operation,
    previewHash: bundle.bindings.previewHash,
    files: entries.length,
  };
}
