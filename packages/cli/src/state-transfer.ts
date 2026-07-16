import { lstat, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { EncryptedEnvelopeTransport, type EncryptedEnvelope, type EnvelopeBindings } from "@apex/capabilities";
import { SECRET_FIELD_PATTERN, SECRET_VALUE_PATTERN } from "@apex/contracts";
import {
  EventJournal,
  atomicWriteBytes,
  canonicalJsonBytes,
  sha256Bytes,
  sha256Json,
  type JsonValue,
} from "@apex/kernel";
import type { WriterTransferClaim } from "@apex/kernel";

export const STATE_TRANSFER_KIND = "apex-repository-state";
export const STATE_TRANSFER_MAX_BUNDLE_BYTES = 16 * 1024 * 1024;
export const STATE_TRANSFER_MAX_FILE_BYTES = 4 * 1024 * 1024;

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const SAFE_POLICY_ASSERTIONS = new Map<string, boolean>([
  ["runtime/defaults.v1.json/securityInvariants/hardcodedSecretsAllowed", false],
  ["runtime/defaults.v1.json/securityInvariants/secretValuesInGitAllowed", false],
  ["runtime/defaults.v1.json/evidence/genericSecretScanRequired", true],
  ["runtime/defaults.v1.json/telemetry/authorizationEvidenceSeparable", true],
]);

export interface StateTransferFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly content: string;
}

export interface StateTransferBindings extends EnvelopeBindings {
  readonly claimHash: string;
  readonly projectId: string;
  readonly runId: string;
  readonly ownerEpoch: number;
  readonly recipient: string;
  readonly repository: string;
  readonly branch: string;
  readonly commit: string;
  readonly workflowId: string;
  readonly journalHead: string;
  readonly claimExpiresAt: string;
  readonly approvalEnvironment?: string;
}

export interface StateTransferBundle {
  readonly implementation: "apex-state-transfer";
  readonly version: 1;
  readonly bindings: StateTransferBindings;
  readonly files: readonly StateTransferFile[];
}

export interface StateTransferExportOptions {
  readonly claimHash: string;
  readonly recipient: string;
  readonly ttlMs: number;
}

interface Selection {
  projectId: string;
  runId: string;
}

interface RunState extends Selection {
  ownerEpoch: number;
  runtimeLockHash: string;
}

function safeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes("\\") &&
    path !== "." &&
    path !== ".." &&
    !path.startsWith("../") &&
    posix.normalize(path) === path
  );
}

function prohibitedStatePath(path: string): boolean {
  return /(?:^|\/)(?:credentials?(?:\.json)?|terraform\.tfstate(?:\.[^/]*)?|[^/]+\.tfplan(?:\.enc)?|state-plans?)(?:\/|$)/i.test(
    path,
  );
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function requireHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) throw new Error(`${label} must be a SHA-256 hash`);
  return value;
}

function parseJson(bytes: Buffer, path: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`State transfer file is not valid JSON: ${path}`);
  }
}

function secretPaths(value: unknown, path: string, findings: string[]): void {
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERN.test(value)) findings.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => secretPaths(entry, `${path}/${index}`, findings));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
    if (
      SECRET_FIELD_PATTERN.test(key) &&
      !(SAFE_POLICY_ASSERTIONS.has(entryPath) && SAFE_POLICY_ASSERTIONS.get(entryPath) === entry)
    ) {
      findings.push(entryPath);
    }
    secretPaths(entry, entryPath, findings);
  }
}

function validateJsonSafety(bytes: Buffer, path: string): unknown {
  const value = parseJson(bytes, path);
  const findings: string[] = [];
  secretPaths(value, path, findings);
  if (findings.length > 0) {
    throw new Error(`State transfer contains secret-bearing JSON paths: ${[...new Set(findings)].sort().join(", ")}`);
  }
  return value;
}

async function readRegular(path: string, label: string): Promise<Buffer> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} is not a regular file: ${path}`);
  if (info.size > STATE_TRANSFER_MAX_FILE_BYTES) throw new Error(`${label} exceeds the 4 MiB file limit: ${path}`);
  return await readFile(path);
}

async function readOptionalRegular(path: string, label: string): Promise<Buffer | undefined> {
  try {
    return await readRegular(path, label);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function walkRegularFiles(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`State transfer source contains a symlink: ${path}`);
    if (entry.isDirectory()) files.push(...(await walkRegularFiles(root, path)));
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
    else throw new Error(`State transfer source is not a regular file: ${path}`);
  }
  return files.sort();
}

function referencedHashes(bytes: Buffer): string[] {
  return [...new Set(bytes.toString("utf8").match(/[0-9a-f]{64}/g) ?? [])].sort();
}

async function collectObjectClosure(apexRoot: string, seedFiles: readonly Buffer[]): Promise<Map<string, Buffer>> {
  const pending = [...new Set(seedFiles.flatMap(referencedHashes))].sort();
  const objects = new Map<string, Buffer>();
  while (pending.length > 0) {
    const hash = pending.shift()!;
    if (objects.has(hash)) continue;
    const objectPath = join(apexRoot, "objects", "sha256", hash.slice(0, 2), hash.slice(2));
    const bytes = await readOptionalRegular(objectPath, "State transfer object");
    if (bytes === undefined) continue;
    if (sha256Bytes(bytes) !== hash) throw new Error(`State transfer object hash mismatch: ${hash}`);
    validateJsonSafety(bytes, `objects/sha256/${hash.slice(0, 2)}/${hash.slice(2)}`);
    objects.set(hash, bytes);
    for (const reference of referencedHashes(bytes)) if (!objects.has(reference)) pending.push(reference);
    pending.sort();
  }
  return objects;
}

function bundleFile(path: string, bytes: Buffer): StateTransferFile {
  if (!safeRelativePath(path)) throw new Error(`Unsafe state transfer path: ${path}`);
  if (prohibitedStatePath(path)) throw new Error(`State transfer path is prohibited: ${path}`);
  if (path !== ".gitignore") validateJsonSafety(bytes, path);
  return { path, bytes: bytes.byteLength, sha256: sha256Bytes(bytes), content: bytes.toString("base64") };
}

async function currentState(
  root: string,
  claimHash: string,
  recipient: string,
  now: Date,
): Promise<{
  apexRoot: string;
  selection: Selection;
  run: RunState;
  claim: WriterTransferClaim;
  claimPath: string;
  journalHead: string;
}> {
  requireHash(claimHash, "Transfer claim hash");
  if (recipient.trim().length === 0) throw new Error("State transfer recipient is required");
  const apexRoot = resolve(root, ".apex");
  const selection = parseJson(
    await readRegular(join(apexRoot, "config.json"), "APEX selection"),
    "config.json",
  ) as Selection;
  const projectId = requireIdentifier(selection.projectId, "Selected project");
  const runId = requireIdentifier(selection.runId, "Selected run");
  const runRoot = join(apexRoot, "projects", projectId, "runs", runId);
  const run = parseJson(await readRegular(join(runRoot, "run.json"), "Selected run"), "run.json") as RunState;
  if (run.projectId !== projectId || run.runId !== runId || !Number.isInteger(run.ownerEpoch) || run.ownerEpoch < 1) {
    throw new Error("Selected run does not match APEX config");
  }
  const claimPath = join(runRoot, "transfers", `${claimHash}.json`);
  const claimBytes = await readRegular(claimPath, "Transfer claim");
  const claim = validateJsonSafety(
    claimBytes,
    relative(apexRoot, claimPath).split(sep).join("/"),
  ) as WriterTransferClaim;
  if (sha256Json(claim as unknown as JsonValue) !== claimHash) throw new Error("Transfer claim hash/path mismatch");
  if (claim.projectId !== projectId || claim.runId !== runId) throw new Error("Transfer claim project/run mismatch");
  if (claim.recipient !== recipient) throw new Error("Transfer claim recipient mismatch");
  if (claim.nextEpoch !== run.ownerEpoch + 1) throw new Error("Transfer claim owner epoch is stale");
  if (!Number.isFinite(Date.parse(claim.expiresAt)) || Date.parse(claim.expiresAt) <= now.getTime()) {
    throw new Error("Transfer claim has expired");
  }
  const journal = new EventJournal(join(runRoot, "journal"));
  const events = await journal.replay();
  if (
    !events.some(
      (event) =>
        event.type === "transfer-requested" &&
        event.ownerEpoch === run.ownerEpoch &&
        (event.payload as { claimHash?: unknown }).claimHash === claimHash,
    )
  ) {
    throw new Error("Transfer claim is not recorded at the current owner epoch");
  }
  const journalHead = requireHash(await journal.head(), "State transfer journal head");
  return { apexRoot, selection: { projectId, runId }, run, claim, claimPath, journalHead };
}

export async function createStateTransferBundle(
  root: string,
  options: StateTransferExportOptions,
  now: Date = new Date(),
): Promise<StateTransferBundle> {
  if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) throw new Error("State transfer TTL must be positive");
  const state = await currentState(root, options.claimHash, options.recipient, now);
  if (now.getTime() + options.ttlMs > Date.parse(state.claim.expiresAt)) {
    throw new Error("State transfer envelope cannot outlive its writer-transfer claim");
  }
  const runRoot = join(state.apexRoot, "projects", state.selection.projectId, "runs", state.selection.runId);
  const paths = new Set<string>([
    "config.json",
    "apex.lock.json",
    `projects/${state.selection.projectId}/project.json`,
  ]);
  if ((await readOptionalRegular(join(state.apexRoot, ".gitignore"), "APEX gitignore")) !== undefined) {
    paths.add(".gitignore");
  }
  try {
    for (const entry of await readdir(join(state.apexRoot, "runtime"), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`State transfer runtime contains a symlink: ${entry.name}`);
      if (entry.isFile() && entry.name.endsWith(".json")) paths.add(`runtime/${entry.name}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const path of await walkRegularFiles(runRoot)) {
    paths.add(`projects/${state.selection.projectId}/runs/${state.selection.runId}/${path}`);
  }
  const sourceFiles: Array<{ path: string; bytes: Buffer }> = [];
  for (const path of [...paths].sort()) {
    sourceFiles.push({
      path,
      bytes: await readRegular(join(state.apexRoot, ...path.split("/")), "State transfer file"),
    });
  }
  const runPrefix = `projects/${state.selection.projectId}/runs/${state.selection.runId}/`;
  const objects = await collectObjectClosure(
    state.apexRoot,
    sourceFiles.filter(({ path }) => path.startsWith(runPrefix)).map(({ bytes }) => bytes),
  );
  for (const [hash, bytes] of objects) {
    sourceFiles.push({ path: `objects/sha256/${hash.slice(0, 2)}/${hash.slice(2)}`, bytes });
  }
  const files = sourceFiles
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path, bytes }) => bundleFile(path, bytes));
  const bindings: StateTransferBindings = {
    claimHash: options.claimHash,
    projectId: state.selection.projectId,
    runId: state.selection.runId,
    ownerEpoch: state.run.ownerEpoch,
    recipient: options.recipient,
    repository: state.claim.repository,
    branch: state.claim.branch,
    commit: state.claim.commit,
    workflowId: state.claim.workflowId,
    journalHead: state.journalHead,
    claimExpiresAt: state.claim.expiresAt,
    ...(state.claim.approvalEnvironment === undefined ? {} : { approvalEnvironment: state.claim.approvalEnvironment }),
  };
  const bundle: StateTransferBundle = { implementation: "apex-state-transfer", version: 1, bindings, files };
  if (canonicalJsonBytes(bundle).byteLength > STATE_TRANSFER_MAX_BUNDLE_BYTES) {
    throw new Error("State transfer plaintext bundle exceeds the 16 MiB limit");
  }
  return bundle;
}

export async function exportStateTransfer(
  root: string,
  outputPath: string,
  options: StateTransferExportOptions,
  dependencies: { readonly now?: () => Date; readonly nonce?: () => Uint8Array; readonly key: Uint8Array },
): Promise<{ path: string; sha256: string; files: number; expiresAt: string }> {
  if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) throw new Error("State transfer TTL must be positive");
  const now = dependencies.now?.() ?? new Date();
  const bundle = await createStateTransferBundle(root, options, now);
  const transport = new EncryptedEnvelopeTransport(() => now, dependencies.nonce);
  const envelope = transport.encrypt(canonicalJsonBytes(bundle), dependencies.key, {
    kind: STATE_TRANSFER_KIND,
    recipient: options.recipient,
    ttlMs: options.ttlMs,
    bindings: bundle.bindings,
  });
  const bytes = canonicalJsonBytes(envelope);
  await atomicWriteBytes(resolve(outputPath), bytes);
  return {
    path: resolve(outputPath),
    sha256: sha256Bytes(bytes),
    files: bundle.files.length,
    expiresAt: envelope.metadata.expiresAt,
  };
}

function allowedBundlePath(path: string, bindings: StateTransferBindings): boolean {
  if (prohibitedStatePath(path)) return false;
  const runPrefix = `projects/${bindings.projectId}/runs/${bindings.runId}/`;
  return (
    path === ".gitignore" ||
    path === "config.json" ||
    path === "apex.lock.json" ||
    /^runtime\/[^/]+\.json$/.test(path) ||
    path === `projects/${bindings.projectId}/project.json` ||
    path.startsWith(runPrefix) ||
    /^objects\/sha256\/[0-9a-f]{2}\/[0-9a-f]{62}$/.test(path)
  );
}

function decodeEntry(entry: StateTransferFile, bindings: StateTransferBindings): Buffer {
  if (!safeRelativePath(entry.path) || !allowedBundlePath(entry.path, bindings)) {
    throw new Error(`State transfer path is outside the allowlist: ${entry.path}`);
  }
  if (!Number.isInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > STATE_TRANSFER_MAX_FILE_BYTES) {
    throw new Error(`State transfer file size is invalid: ${entry.path}`);
  }
  if (
    !HASH_PATTERN.test(entry.sha256) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.content)
  ) {
    throw new Error(`State transfer file encoding is invalid: ${entry.path}`);
  }
  const bytes = Buffer.from(entry.content, "base64");
  if (
    bytes.toString("base64") !== entry.content ||
    bytes.byteLength !== entry.bytes ||
    sha256Bytes(bytes) !== entry.sha256
  ) {
    throw new Error(`State transfer file integrity check failed: ${entry.path}`);
  }
  const objectMatch = /^objects\/sha256\/([0-9a-f]{2})\/([0-9a-f]{62})$/.exec(entry.path);
  if (objectMatch !== null && `${objectMatch[1]}${objectMatch[2]}` !== entry.sha256) {
    throw new Error(`State transfer object path does not match its content: ${entry.path}`);
  }
  if (entry.path !== ".gitignore") validateJsonSafety(bytes, entry.path);
  return bytes;
}

function validateJournal(entries: Map<string, Buffer>, bindings: StateTransferBindings): void {
  const prefix = `projects/${bindings.projectId}/runs/${bindings.runId}/journal/`;
  const journal = [...entries]
    .filter(([path]) => path.startsWith(prefix))
    .sort(([left], [right]) => left.localeCompare(right));
  let previousHash: string | null = null;
  for (const [index, [path, bytes]] of journal.entries()) {
    const name = path.slice(prefix.length);
    const event = parseJson(bytes, path) as Record<string, unknown>;
    const expectedSequence = index + 1;
    if (name !== `${String(expectedSequence).padStart(16, "0")}.json` || event.sequence !== expectedSequence) {
      throw new Error(`State transfer journal sequence is invalid: ${path}`);
    }
    if (
      event.projectId !== bindings.projectId ||
      event.runId !== bindings.runId ||
      event.previousHash !== previousHash
    ) {
      throw new Error(`State transfer journal chain is invalid: ${path}`);
    }
    if (sha256Json(event.payload as JsonValue) !== event.payloadHash) {
      throw new Error(`State transfer journal payload is invalid: ${path}`);
    }
    const { hash, ...withoutHash } = event;
    if (typeof hash !== "string" || sha256Json(withoutHash as JsonValue) !== hash) {
      throw new Error(`State transfer journal hash is invalid: ${path}`);
    }
    previousHash = hash;
  }
  if (previousHash !== bindings.journalHead) throw new Error("State transfer journal head does not match bindings");
}

function validateObjectClosure(entries: Map<string, Buffer>, bindings: StateTransferBindings): void {
  const objectPrefix = "objects/sha256/";
  const objects = new Map<string, Buffer>();
  for (const [path, bytes] of entries) {
    if (path.startsWith(objectPrefix)) objects.set(path.slice(objectPrefix.length).replace("/", ""), bytes);
  }
  const runPrefix = `projects/${bindings.projectId}/runs/${bindings.runId}/`;
  const pending = [
    ...new Set(
      [...entries].filter(([path]) => path.startsWith(runPrefix)).flatMap(([, bytes]) => referencedHashes(bytes)),
    ),
  ];
  const referenced = new Set<string>();
  while (pending.length > 0) {
    const hash = pending.shift()!;
    const bytes = objects.get(hash);
    if (bytes === undefined || referenced.has(hash)) continue;
    referenced.add(hash);
    pending.push(...referencedHashes(bytes));
  }
  const unreferenced = [...objects.keys()].filter((hash) => !referenced.has(hash));
  if (unreferenced.length > 0) throw new Error("State transfer contains unreferenced objects");
}

function requireBindings(value: unknown): StateTransferBindings {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("State transfer bindings are invalid");
  const bindings = value as Partial<StateTransferBindings>;
  requireHash(bindings.claimHash, "State transfer claim hash");
  requireHash(bindings.journalHead, "State transfer journal head");
  requireIdentifier(bindings.projectId, "State transfer project");
  requireIdentifier(bindings.runId, "State transfer run");
  if (typeof bindings.claimExpiresAt !== "string" || !Number.isFinite(Date.parse(bindings.claimExpiresAt))) {
    throw new Error("State transfer claim expiry is invalid");
  }
  if (
    bindings.approvalEnvironment !== undefined &&
    (typeof bindings.approvalEnvironment !== "string" || bindings.approvalEnvironment.trim().length === 0)
  ) {
    throw new Error("State transfer approval environment is invalid");
  }
  if (!Number.isInteger(bindings.ownerEpoch) || (bindings.ownerEpoch ?? 0) < 1)
    throw new Error("State transfer owner epoch is invalid");
  for (const key of ["recipient", "repository", "branch", "commit", "workflowId"] as const) {
    if (typeof bindings[key] !== "string" || bindings[key]!.trim().length === 0) {
      throw new Error(`State transfer ${key} is required`);
    }
  }
  const expected = [
    ...(bindings.approvalEnvironment === undefined ? [] : ["approvalEnvironment"]),
    "branch",
    "claimExpiresAt",
    "claimHash",
    "commit",
    "journalHead",
    "ownerEpoch",
    "projectId",
    "recipient",
    "repository",
    "runId",
    "workflowId",
  ];
  if (Object.keys(bindings).sort().join("\0") !== expected.join("\0"))
    throw new Error("State transfer bindings shape is invalid");
  return bindings as StateTransferBindings;
}

function validateBundle(
  value: unknown,
  envelopeBindings: EnvelopeBindings,
): {
  bundle: StateTransferBundle;
  entries: Array<{ path: string; bytes: Buffer }>;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("State transfer bundle is invalid");
  const bundle = value as Partial<StateTransferBundle>;
  if (bundle.implementation !== "apex-state-transfer" || bundle.version !== 1 || !Array.isArray(bundle.files)) {
    throw new Error("Unsupported state transfer bundle");
  }
  const bindings = requireBindings(bundle.bindings);
  if (sha256Json(bindings as JsonValue) !== sha256Json(envelopeBindings as JsonValue)) {
    throw new Error("State transfer envelope bindings do not match the bundle");
  }
  const seen = new Set<string>();
  const entries = bundle.files.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("State transfer file entry is invalid");
    const typed = entry as StateTransferFile;
    if (typeof typed.path !== "string" || seen.has(typed.path))
      throw new Error("State transfer contains duplicate or invalid paths");
    seen.add(typed.path);
    return { path: typed.path, bytes: decodeEntry(typed, bindings) };
  });
  if (entries.map(({ path }) => path).join("\0") !== [...seen].sort().join("\0")) {
    throw new Error("State transfer files are not in deterministic path order");
  }
  return { bundle: bundle as StateTransferBundle, entries };
}

async function assertNoSymlinkAncestors(apexRoot: string, destination: string): Promise<void> {
  const relativePath = relative(apexRoot, destination);
  let current = apexRoot;
  for (const segment of relativePath.split(sep).slice(0, -1)) {
    current = join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw new Error(`State transfer destination ancestor is unsafe: ${current}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

async function assertApexRootSafe(apexRoot: string): Promise<void> {
  try {
    const info = await lstat(apexRoot);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`State transfer APEX root is unsafe: ${apexRoot}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function requiredEntry(entries: Map<string, Buffer>, path: string): Buffer {
  const value = entries.get(path);
  if (value === undefined) throw new Error(`State transfer is missing required file: ${path}`);
  return value;
}

export async function importStateTransfer(
  root: string,
  envelopeValue: unknown,
  recipient: string,
  key: Uint8Array,
  now: () => Date = () => new Date(),
): Promise<{ projectId: string; runId: string; files: number; claimHash: string }> {
  if (envelopeValue === null || typeof envelopeValue !== "object" || Array.isArray(envelopeValue)) {
    throw new Error("State transfer envelope is invalid");
  }
  const envelope = envelopeValue as EncryptedEnvelope;
  if (Object.keys(envelope).sort().join("\0") !== ["authTag", "ciphertext", "iv", "metadata"].join("\0")) {
    throw new Error("State transfer envelope shape is invalid");
  }
  if (envelope.metadata === null || typeof envelope.metadata !== "object" || Array.isArray(envelope.metadata)) {
    throw new Error("State transfer envelope metadata is invalid");
  }
  const maxEncodedPlaintextBytes = Math.ceil(STATE_TRANSFER_MAX_BUNDLE_BYTES / 3) * 4;
  if (typeof envelope.ciphertext !== "string" || envelope.ciphertext.length > maxEncodedPlaintextBytes) {
    throw new Error("State transfer encrypted payload exceeds the 16 MiB limit");
  }
  if (envelope.metadata.kind !== STATE_TRANSFER_KIND) throw new Error("State transfer envelope kind is invalid");
  const bindings = requireBindings(envelope.metadata.bindings);
  if (bindings.recipient !== recipient) throw new Error("State transfer binding recipient mismatch");
  const plaintext = new EncryptedEnvelopeTransport(now).decrypt(envelope, key, recipient);
  if (plaintext.byteLength > STATE_TRANSFER_MAX_BUNDLE_BYTES)
    throw new Error("State transfer plaintext exceeds 16 MiB");
  const { bundle, entries } = validateBundle(parseJson(plaintext, "state-transfer-bundle"), bindings);
  const files = new Map(entries.map(({ path, bytes }) => [path, bytes]));
  validateJournal(files, bindings);
  validateObjectClosure(files, bindings);
  const config = parseJson(requiredEntry(files, "config.json"), "config.json") as Selection;
  if (config.projectId !== bindings.projectId || config.runId !== bindings.runId) {
    throw new Error("State transfer config does not match its bindings");
  }
  const projectPath = `projects/${bindings.projectId}/project.json`;
  const runPath = `projects/${bindings.projectId}/runs/${bindings.runId}/run.json`;
  const claimPath = `projects/${bindings.projectId}/runs/${bindings.runId}/transfers/${bindings.claimHash}.json`;
  const project = parseJson(requiredEntry(files, projectPath), projectPath) as { projectId?: unknown };
  const run = parseJson(requiredEntry(files, runPath), runPath) as RunState;
  const claim = parseJson(requiredEntry(files, claimPath), claimPath) as WriterTransferClaim;
  if (
    project.projectId !== bindings.projectId ||
    run.projectId !== bindings.projectId ||
    run.runId !== bindings.runId
  ) {
    throw new Error("State transfer project/run files do not match bindings");
  }
  if (run.ownerEpoch !== bindings.ownerEpoch || claim.nextEpoch !== bindings.ownerEpoch + 1) {
    throw new Error("State transfer owner epoch does not match bindings");
  }
  if (
    sha256Json(claim as unknown as JsonValue) !== bindings.claimHash ||
    claim.projectId !== bindings.projectId ||
    claim.runId !== bindings.runId ||
    claim.recipient !== bindings.recipient ||
    claim.repository !== bindings.repository ||
    claim.branch !== bindings.branch ||
    claim.commit !== bindings.commit ||
    claim.workflowId !== bindings.workflowId ||
    claim.approvalEnvironment !== bindings.approvalEnvironment
  ) {
    throw new Error("State transfer claim does not match bindings");
  }
  if (Date.parse(claim.expiresAt) <= now().getTime()) throw new Error("State transfer claim has expired");
  if (
    claim.expiresAt !== bindings.claimExpiresAt ||
    Date.parse(envelope.metadata.expiresAt) > Date.parse(bindings.claimExpiresAt)
  ) {
    throw new Error("State transfer envelope expiry exceeds its claim");
  }
  const lock = parseJson(requiredEntry(files, "apex.lock.json"), "apex.lock.json");
  if (sha256Json(lock as JsonValue) !== run.runtimeLockHash)
    throw new Error("State transfer runtime lock hash mismatch");

  const apexRoot = resolve(root, ".apex");
  await assertApexRootSafe(apexRoot);
  const preflight: Array<{ destination: string; bytes: Buffer; exists: boolean }> = [];
  for (const entry of entries) {
    const destination = resolve(apexRoot, ...entry.path.split("/"));
    if (destination !== apexRoot && !destination.startsWith(`${apexRoot}${sep}`))
      throw new Error(`State transfer path escapes .apex: ${entry.path}`);
    if (entry.path.startsWith("local/") || entry.path === "local")
      throw new Error("State transfer cannot overwrite .apex/local");
    await assertNoSymlinkAncestors(apexRoot, destination);
    try {
      const info = await lstat(destination);
      if (info.isSymbolicLink() || !info.isFile())
        throw new Error(`State transfer destination is unsafe: ${entry.path}`);
      const existing = await readFile(destination);
      if (!existing.equals(entry.bytes)) throw new Error(`State transfer destination differs: ${entry.path}`);
      preflight.push({ destination, bytes: entry.bytes, exists: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      preflight.push({ destination, bytes: entry.bytes, exists: false });
    }
  }
  for (const entry of preflight)
    if (!entry.exists) await atomicWriteBytes(entry.destination, entry.bytes, { refuseOverwrite: true });
  return {
    projectId: bundle.bindings.projectId,
    runId: bundle.bindings.runId,
    files: entries.length,
    claimHash: bundle.bindings.claimHash,
  };
}
