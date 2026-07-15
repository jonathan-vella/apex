import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type {
  EncryptedPlanArtifactStore,
  LocalEncryptedPlan,
  PersistedPreviewBinding,
  PreviewBindingStore,
} from "@apex/capabilities";
import { atomicWriteBytes, atomicWriteJson, sha256Bytes, sha256Json } from "@apex/kernel";

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const KEY_ENVIRONMENT_VARIABLE = "APEX_PLAN_TRANSPORT_KEY";

interface StoredArtifact {
  reference: string;
  artifact: LocalEncryptedPlan;
}

interface LatestBinding {
  previewHash: string;
}

async function ensureDirectory(path: string, mode?: number): Promise<void> {
  try {
    const existing = await lstat(path);
    if (existing.isSymbolicLink() || !existing.isDirectory()) {
      throw new Error(`Provider runtime directory is not a regular directory: ${path}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(path, { mode });
  }
  if (mode !== undefined) await chmod(path, mode);
}

async function createRuntimeRoot(workspaceRoot: string): Promise<string> {
  const apexRoot = join(workspaceRoot, ".apex");
  const localRoot = join(apexRoot, "local");
  const runtimeRoot = join(localRoot, "provider-runtime");
  await ensureDirectory(apexRoot);
  await ensureDirectory(localRoot, 0o700);
  await ensureDirectory(runtimeRoot, 0o700);
  return runtimeRoot;
}

async function createRuntimeDirectory(runtimeRoot: string, name: string): Promise<string> {
  const path = join(runtimeRoot, name);
  await ensureDirectory(path, 0o700);
  return path;
}

function requireHash(value: string, label: string): string {
  if (!HASH_PATTERN.test(value)) throw new Error(`${label} must be a SHA-256 hash`);
  return value;
}

function storageKey(value: string): string {
  return sha256Bytes(Buffer.from(value, "utf8"));
}

async function readJsonFile(path: string): Promise<unknown | undefined> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile())
      throw new Error(`Provider runtime file is not a regular file: ${path}`);
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readRegularFile(path: string, label: string): Promise<Buffer> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${label} is not a regular file: ${path}`);
  return await readFile(path);
}

function isTerraformInputFile(name: string): boolean {
  return (
    name === ".terraform.lock.hcl" ||
    name.endsWith(".tf") ||
    name.endsWith(".tf.json") ||
    name.endsWith(".tfvars") ||
    name.endsWith(".tfvars.json")
  );
}

async function terraformInputFiles(root: string, directory = root): Promise<string[]> {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Terraform configuration contains a symlink: ${path}`);
    if (entry.isDirectory()) {
      if (entry.name !== ".terraform") files.push(...(await terraformInputFiles(root, path)));
      continue;
    }
    if (entry.isFile() && isTerraformInputFile(entry.name)) files.push(path);
  }
  return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

export async function hashTerraformLockFile(terraformRoot: string): Promise<string> {
  return sha256Bytes(await readRegularFile(join(terraformRoot, ".terraform.lock.hcl"), "Terraform lock file"));
}

export async function hashTerraformConfiguration(terraformRoot: string): Promise<string> {
  const files = await terraformInputFiles(terraformRoot);
  if (files.length === 0) throw new Error(`Terraform configuration has no input files: ${terraformRoot}`);
  return sha256Json(
    await Promise.all(
      files.map(async (path) => ({
        path: relative(terraformRoot, path).replaceAll("\\", "/"),
        hash: sha256Bytes(await readRegularFile(path, "Terraform input")),
      })),
    ),
  );
}

function requireBinding(value: unknown, previewHash: string): PersistedPreviewBinding {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Persisted preview binding is invalid");
  }
  const binding = value as Record<string, unknown>;
  const preview = binding.preview;
  if (
    (binding.kind !== "bicep" && binding.kind !== "terraform") ||
    preview === null ||
    typeof preview !== "object" ||
    Array.isArray(preview) ||
    (preview as Record<string, unknown>).previewHash !== previewHash
  ) {
    throw new Error("Persisted preview binding does not match its hash");
  }
  return value as PersistedPreviewBinding;
}

function requireArtifact(value: unknown, reference: string): LocalEncryptedPlan {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Persisted encrypted plan artifact is invalid");
  }
  const stored = value as Partial<StoredArtifact>;
  if (stored.reference !== reference || stored.artifact === null || typeof stored.artifact !== "object") {
    throw new Error("Persisted encrypted plan artifact does not match its reference");
  }
  return stored.artifact;
}

export class FilePreviewBindingStore implements PreviewBindingStore {
  constructor(
    private readonly bindingsRoot: string,
    private readonly latestRoot: string,
    private readonly kind: PersistedPreviewBinding["kind"],
  ) {}

  async save(previewHash: string, binding: PersistedPreviewBinding): Promise<void> {
    requireHash(previewHash, "Preview hash");
    requireBinding(binding, previewHash);
    if (binding.kind !== this.kind) throw new Error(`Expected a ${this.kind} preview binding`);
    await atomicWriteJson(join(this.bindingsRoot, `${previewHash}.json`), binding);
    const preview = binding.preview;
    const latestKey = storageKey(JSON.stringify([this.kind, preview.projectId, preview.runId, preview.operation]));
    await atomicWriteJson(join(this.latestRoot, `${latestKey}.json`), { previewHash } satisfies LatestBinding);
  }

  async load(previewHash: string): Promise<PersistedPreviewBinding | undefined> {
    requireHash(previewHash, "Preview hash");
    const value = await readJsonFile(join(this.bindingsRoot, `${previewHash}.json`));
    if (value === undefined) return undefined;
    const binding = requireBinding(value, previewHash);
    if (binding.kind !== this.kind) throw new Error(`Expected a ${this.kind} preview binding`);
    return binding;
  }

  async loadLatest(
    projectId: string,
    runId: string,
    operation: "apply" | "destroy",
  ): Promise<PersistedPreviewBinding | undefined> {
    const latestKey = storageKey(JSON.stringify([this.kind, projectId, runId, operation]));
    const value = await readJsonFile(join(this.latestRoot, `${latestKey}.json`));
    if (value === undefined) return undefined;
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof (value as Partial<LatestBinding>).previewHash !== "string"
    ) {
      throw new Error("Latest preview binding pointer is invalid");
    }
    return await this.load(requireHash((value as LatestBinding).previewHash, "Latest preview hash"));
  }
}

export class FileEncryptedPlanArtifactStore implements EncryptedPlanArtifactStore {
  constructor(private readonly artifactsRoot: string) {}

  async put(reference: string, artifact: LocalEncryptedPlan): Promise<void> {
    if (reference.trim().length === 0) throw new Error("Encrypted plan reference is required");
    await atomicWriteJson(join(this.artifactsRoot, `${storageKey(reference)}.json`), {
      reference,
      artifact,
    } satisfies StoredArtifact);
  }

  async get(reference: string): Promise<LocalEncryptedPlan | undefined> {
    if (reference.trim().length === 0) throw new Error("Encrypted plan reference is required");
    const value = await readJsonFile(join(this.artifactsRoot, `${storageKey(reference)}.json`));
    return value === undefined ? undefined : requireArtifact(value, reference);
  }
}

async function readLocalKey(path: string): Promise<Buffer> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("Local plan transport key is not a regular file");
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) {
    throw new Error("Local plan transport key permissions must be 0600");
  }
  const key = await readFile(path);
  if (key.byteLength !== 32) throw new Error("Local plan transport key must contain exactly 32 bytes");
  return key;
}

function environmentKey(environment: NodeJS.ProcessEnv): Buffer | undefined {
  const encoded = environment[KEY_ENVIRONMENT_VARIABLE];
  if (encoded === undefined) return undefined;
  const key = Buffer.from(encoded, "base64");
  if (key.byteLength !== 32) throw new Error(`${KEY_ENVIRONMENT_VARIABLE} must encode exactly 32 bytes`);
  return key;
}

async function localKeyProvider(runtimeRoot: string, environment: NodeJS.ProcessEnv): Promise<Uint8Array> {
  const supplied = environmentKey(environment);
  if (supplied !== undefined) return supplied;
  const path = join(runtimeRoot, "plan-transport.key");
  try {
    return await readLocalKey(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await atomicWriteBytes(path, randomBytes(32), { refuseOverwrite: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return await readLocalKey(path);
}

export async function createFileProviderRuntime(
  workspaceRoot: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{
  bindingStores: {
    bicep: FilePreviewBindingStore;
    terraform: FilePreviewBindingStore;
  };
  artifactStore: FileEncryptedPlanArtifactStore;
  keyProvider: () => Promise<Uint8Array>;
}> {
  const runtimeRoot = await createRuntimeRoot(workspaceRoot);
  const bindingsRoot = await createRuntimeDirectory(runtimeRoot, "bindings");
  const latestRoot = await createRuntimeDirectory(runtimeRoot, "latest");
  const artifactsRoot = await createRuntimeDirectory(runtimeRoot, "artifacts");
  return {
    bindingStores: {
      bicep: new FilePreviewBindingStore(bindingsRoot, latestRoot, "bicep"),
      terraform: new FilePreviewBindingStore(bindingsRoot, latestRoot, "terraform"),
    },
    artifactStore: new FileEncryptedPlanArtifactStore(artifactsRoot),
    keyProvider: async () => await localKeyProvider(runtimeRoot, environment),
  };
}
