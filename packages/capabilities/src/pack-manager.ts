import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ProcessRunnerLike } from "./process-runner.js";

const HASH = /^[0-9a-f]{64}$/;
const EMPTY_DIGEST = createHash("sha256").update("").digest("hex");
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_BYTES = 1024 * 1024;
const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

export type CapabilityPackRuntime = "python" | "deno" | "npm";
export type CapabilityPackState = "installed" | "unavailable" | "blocked" | "invalid" | "not-installed";

export interface CapabilityPackArtifactSpec {
  readonly type: "local-directory" | "npm-tarball";
  readonly spec: string;
  readonly digest: string;
  readonly integrity?: string;
}

export interface CapabilityPackLockSpec {
  readonly installer: "uv" | "pip-hashes" | "deno";
  readonly path?: string;
  readonly digest: string;
  readonly directDigest: string;
  readonly transitiveDigest: string;
}

export interface CapabilityPackExecutableSpec {
  readonly command: string;
  readonly args: readonly string[];
}

export interface CapabilityPackDefinition {
  readonly id: string;
  readonly version?: string;
  readonly runtime?: CapabilityPackRuntime;
  readonly implementation?: CapabilityPackRuntime;
  readonly source?: string;
  readonly artifact?: CapabilityPackArtifactSpec;
  readonly lock?: CapabilityPackLockSpec;
  readonly executable?: CapabilityPackExecutableSpec;
  readonly capabilities?: readonly string[];
  readonly requires?: readonly string[];
  readonly requiredWorkflows?: readonly string[];
  readonly dependencyFree?: boolean;
  readonly script?: string;
  readonly scriptDigest?: string;
}

export interface CapabilityPackRegistryV1 {
  readonly schemaVersion: string;
  readonly protocolVersion?: string;
  readonly packs: readonly CapabilityPackDefinition[];
}

export interface CapabilityPackLockV1 {
  readonly schemaVersion: "1.0.0";
  readonly id: string;
  readonly version: string;
  readonly digest: string;
  readonly capabilities: readonly string[];
  readonly entrypoints: Readonly<Record<string, string>>;
  readonly requires: readonly string[];
  readonly runtime: CapabilityPackRuntime;
  readonly source: string;
  readonly sourceArtifactDigest: string;
  readonly installationManifestDigest: string;
  readonly artifactDigest: string;
  readonly directLockDigest: string;
  readonly transitiveLockDigest: string;
  readonly executable: CapabilityPackExecutableSpec;
  readonly installedAt?: string;
}

export interface CapabilityPackStatusResult {
  readonly id: string;
  readonly state: CapabilityPackState;
  readonly version?: string;
  readonly installedVersion?: string;
  readonly requiredWorkflows: readonly string[];
  readonly reason?: string;
  readonly action: string;
}

export interface CapabilityPackOperationResult extends CapabilityPackStatusResult {
  readonly changed: boolean;
  readonly lock?: CapabilityPackLockV1;
}

export interface CapabilityPackManagerOptions {
  readonly root: string;
  readonly manifestPath?: string;
  readonly processRunner: ProcessRunnerLike;
  readonly clock?: () => Date;
  readonly idSource?: () => string;
}

export interface CapabilityPackInstallOptions {
  readonly cacheDeno?: boolean;
}

interface PreparedPack {
  readonly definition: CapabilityPackDefinition;
  readonly runtime: CapabilityPackRuntime;
  readonly version: string;
  readonly artifact: CapabilityPackArtifactSpec;
  readonly executable: CapabilityPackExecutableSpec;
  readonly lock: CapabilityPackLockSpec;
}

export class CapabilityPackManager {
  readonly #root: string;
  readonly #manifestPath: string;
  readonly #runner: ProcessRunnerLike;
  readonly #clock: (() => Date) | undefined;
  readonly #idSource: () => string;

  constructor(options: CapabilityPackManagerOptions) {
    this.#root = resolve(options.root);
    this.#manifestPath = resolve(
      options.manifestPath ?? join(this.#root, ".apex", "runtime", "capability-packs.v1.json"),
    );
    this.#runner = options.processRunner;
    this.#clock = options.clock;
    this.#idSource = options.idSource ?? randomUUID;
  }

  async list(): Promise<readonly CapabilityPackStatusResult[]> {
    const registry = await this.#registry();
    return await Promise.all(registry.packs.map(async (pack) => await this.#status(pack)));
  }

  async status(id: string): Promise<CapabilityPackStatusResult> {
    return await this.#status(await this.#definition(id));
  }

  async install(id: string, options: CapabilityPackInstallOptions = {}): Promise<CapabilityPackOperationResult> {
    const definition = await this.#definition(id);
    const prepared = await this.#prepare(definition);
    if ("state" in prepared) return { ...prepared, changed: false };
    return await this.#installPrepared(prepared, options, false);
  }

  async update(id: string, options: CapabilityPackInstallOptions = {}): Promise<CapabilityPackOperationResult> {
    const definition = await this.#definition(id);
    const prepared = await this.#prepare(definition);
    if ("state" in prepared) return { ...prepared, changed: false };
    return await this.#installPrepared(prepared, options, true);
  }

  async rollback(id: string): Promise<CapabilityPackOperationResult> {
    this.#assertId(id);
    const target = this.#packDirectory(id);
    const previous = `${target}.previous`;
    if (!(await this.#exists(previous))) {
      return {
        ...(await this.status(id)),
        state: "blocked",
        reason: "rollback-unavailable",
        action: "No previous pack is available",
        changed: false,
      };
    }
    const staged = join(this.#localDirectory(), `rollback-${id}-${this.#idSource()}`);
    await mkdir(dirname(staged), { recursive: true });
    let previousIsStaged = false;
    let currentIsPrevious = false;
    let previousIsCurrent = false;
    try {
      await rename(previous, staged);
      previousIsStaged = true;
      if (await this.#exists(target)) {
        await rename(target, previous);
        currentIsPrevious = true;
      }
      await rename(staged, target);
      previousIsStaged = false;
      previousIsCurrent = true;
      const verified = await this.verify(id);
      if (verified.state !== "installed") throw new Error(verified.reason ?? "rollback verification failed");
      return { ...verified, changed: true, lock: await this.#readLock(target) };
    } catch (error) {
      if (previousIsCurrent) {
        await rename(target, staged);
        if (currentIsPrevious) await rename(previous, target);
        await rename(staged, previous);
      } else if (currentIsPrevious) {
        await rename(previous, target);
        await rename(staged, previous);
      } else if (previousIsStaged) {
        await rename(staged, previous);
      }
      throw error;
    }
  }

  async verify(id: string): Promise<CapabilityPackOperationResult> {
    this.#assertId(id);
    const directory = this.#packDirectory(id);
    if (!(await this.#exists(directory))) {
      return {
        ...(await this.status(id)),
        state: "not-installed",
        action: `Run apex capability install --pack ${id}`,
        changed: false,
      };
    }
    try {
      await this.#assertTreeSafe(directory);
      const lock = await this.#readLock(directory);
      if (
        lock.id !== id ||
        !HASH.test(lock.digest) ||
        !HASH.test(lock.sourceArtifactDigest) ||
        !HASH.test(lock.installationManifestDigest) ||
        !HASH.test(lock.artifactDigest) ||
        !HASH.test(lock.directLockDigest) ||
        !HASH.test(lock.transitiveLockDigest)
      ) {
        throw new Error("invalid pack lock");
      }
      const sourceDigest = await this.#treeDigest(directory, this.#generatedPaths());
      if (sourceDigest !== lock.sourceArtifactDigest || sourceDigest !== lock.artifactDigest)
        throw new Error("source artifact digest mismatch");
      if (this.#installationManifestDigest(lock) !== lock.installationManifestDigest)
        throw new Error("installation manifest digest mismatch");
      await this.#assertInstalledExecutable(directory, lock);
      return {
        id,
        state: "installed",
        version: lock.version,
        installedVersion: lock.version,
        requiredWorkflows: (await this.#optionalDefinition(id))?.requiredWorkflows ?? [],
        action: "No action required",
        changed: false,
        lock,
      };
    } catch (error) {
      return {
        id,
        state: "invalid",
        requiredWorkflows: (await this.#optionalDefinition(id))?.requiredWorkflows ?? [],
        reason: error instanceof Error ? error.message : "verification failed",
        action: `Run apex capability update --pack ${id}`,
        changed: false,
      };
    }
  }

  async uninstall(id: string): Promise<CapabilityPackOperationResult> {
    const definition = await this.#definition(id);
    const target = this.#packDirectory(id);
    const previous = `${target}.previous`;
    const changed = (await this.#exists(target)) || (await this.#exists(previous));
    await rm(target, { recursive: true, force: true });
    await rm(previous, { recursive: true, force: true });
    return {
      id,
      state: "not-installed",
      ...(definition.version === undefined ? {} : { version: definition.version }),
      requiredWorkflows: definition.requiredWorkflows ?? [],
      action: `Run apex capability install --pack ${id}`,
      changed,
    };
  }

  async requiredForWorkflows(workflows: readonly string[]): Promise<readonly CapabilityPackStatusResult[]> {
    const selected = new Set(workflows);
    const registry = await this.#registry();
    return await Promise.all(
      registry.packs
        .filter((pack) => (pack.requiredWorkflows ?? []).some((workflow) => selected.has(workflow)))
        .map(async (pack) => await this.#status(pack)),
    );
  }

  async #installPrepared(
    prepared: PreparedPack,
    options: CapabilityPackInstallOptions,
    replacing: boolean,
  ): Promise<CapabilityPackOperationResult> {
    const { definition, runtime, artifact, executable, lock, version } = prepared;
    const target = this.#packDirectory(definition.id);
    if (!replacing && (await this.#exists(target))) return { ...(await this.verify(definition.id)), changed: false };
    const staged = join(this.#localDirectory(), `capability-pack-${definition.id}-${this.#idSource()}`);
    const previous = `${target}.previous`;
    await mkdir(dirname(staged), { recursive: true });
    try {
      if (artifact.type === "local-directory") {
        const source = this.#resolveManifestPath(artifact.spec);
        await this.#assertTreeSafe(source);
        if ((await this.#treeDigest(source)) !== artifact.digest) throw new Error("artifact digest mismatch");
        await cp(source, staged, { recursive: true, dereference: false, errorOnExist: true, force: false });
      } else {
        await mkdir(staged);
        await this.#runner.run({
          executable: "npm",
          args: [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--save-exact",
            `--integrity=${artifact.integrity!}`,
            artifact.spec,
          ],
          cwd: staged,
          timeoutMs: DEFAULT_TIMEOUT_MS,
          maxOutputBytes: DEFAULT_OUTPUT_BYTES,
        });
        await this.#assertTreeSafe(staged);
        if ((await this.#treeDigest(staged)) !== artifact.digest) throw new Error("artifact digest mismatch");
      }
      await this.#assertTreeSafe(staged);
      await this.#installRuntime(prepared, staged, options);
      const sourceArtifactDigest = await this.#treeDigest(staged, this.#generatedPaths(false));
      if (sourceArtifactDigest !== artifact.digest) throw new Error("source artifact digest changed during install");
      const lockBase = {
        schemaVersion: "1.0.0",
        id: definition.id,
        version,
        digest: sourceArtifactDigest,
        capabilities: definition.capabilities ?? [definition.id],
        entrypoints: { default: executable.command },
        requires: definition.requires ?? [],
        runtime,
        source: artifact.spec,
        sourceArtifactDigest,
        artifactDigest: artifact.digest,
        directLockDigest: lock.directDigest,
        transitiveLockDigest: lock.transitiveDigest,
        executable,
        ...(this.#clock === undefined ? {} : { installedAt: this.#clock().toISOString() }),
      } as const;
      const packLock: CapabilityPackLockV1 = {
        ...lockBase,
        installationManifestDigest: this.#installationManifestDigest(lockBase),
      };
      await writeFile(join(staged, "pack.lock.json"), `${JSON.stringify(packLock, null, 2)}\n`, { flag: "wx" });
      await this.#assertTreeSafe(staged);
      await mkdir(dirname(target), { recursive: true });
      await rm(previous, { recursive: true, force: true });
      if (await this.#exists(target)) await rename(target, previous);
      try {
        await rename(staged, target);
      } catch (error) {
        if (await this.#exists(previous)) await rename(previous, target);
        throw error;
      }
      const verified = await this.verify(definition.id);
      if (verified.state !== "installed") {
        await rm(target, { recursive: true, force: true });
        if (await this.#exists(previous)) await rename(previous, target);
        throw new Error(verified.reason ?? "installed pack verification failed");
      }
      return { ...verified, changed: true, lock: packLock };
    } catch (error) {
      await rm(staged, { recursive: true, force: true });
      throw error;
    }
  }

  async #installRuntime(prepared: PreparedPack, staged: string, options: CapabilityPackInstallOptions): Promise<void> {
    const { definition, runtime, lock } = prepared;
    const lockPath = lock.path === undefined ? undefined : this.#resolveManifestPath(lock.path);
    if (lockPath !== undefined && (await this.#fileDigest(lockPath)) !== lock.digest)
      throw new Error("lock digest mismatch");
    if (runtime === "python") {
      if (definition.dependencyFree === true) {
        const script = this.#safeRelative(definition.script ?? prepared.executable.args.at(-1) ?? "");
        const scriptPath = join(staged, script);
        if (
          !HASH.test(definition.scriptDigest ?? "") ||
          (await this.#fileDigest(scriptPath)) !== definition.scriptDigest
        )
          throw new Error("script digest mismatch");
        return;
      }
      if (lockPath === undefined) throw new Error("lock-unavailable");
      if (lock.installer === "uv") {
        const stagedLock = join(
          staged,
          this.#safeRelative(relative(this.#resolveManifestPath(prepared.artifact.spec), lockPath)),
        );
        if ((await this.#fileDigest(stagedLock)) !== lock.digest) throw new Error("staged lock digest mismatch");
        try {
          await this.#runner.run({
            executable: "uv",
            args: ["sync", "--frozen", "--no-dev"],
            cwd: staged,
            timeoutMs: DEFAULT_TIMEOUT_MS,
            maxOutputBytes: DEFAULT_OUTPUT_BYTES,
          });
        } catch (error) {
          if (error instanceof Error && /ENOENT|not found|spawn uv/u.test(error.message))
            throw new Error("uv is required to install this capability pack; install uv and ensure it is on PATH", {
              cause: error,
            });
          throw error;
        }
        if ((await this.#fileDigest(stagedLock)) !== lock.digest) throw new Error("staged lock changed during uv sync");
        return;
      }
      if (lock.installer !== "pip-hashes")
        throw new Error("Python capability pack requires uv or pip-hashes installer");
      await this.#runner.run({
        executable: "python",
        args: ["-m", "venv", ".venv"],
        cwd: staged,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxOutputBytes: DEFAULT_OUTPUT_BYTES,
      });
      await this.#runner.run({
        executable: join(staged, ".venv", process.platform === "win32" ? "Scripts" : "bin", "python"),
        args: ["-m", "pip", "install", "--require-hashes", "-r", lockPath],
        cwd: staged,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxOutputBytes: DEFAULT_OUTPUT_BYTES,
      });
      return;
    }
    if (runtime === "deno" && options.cacheDeno === true) {
      if (lockPath === undefined) throw new Error("lock-unavailable");
      if (lock.installer !== "deno") throw new Error("Deno capability pack requires deno installer");
      const stagedLock = join(
        staged,
        this.#safeRelative(relative(this.#resolveManifestPath(prepared.artifact.spec), lockPath)),
      );
      if ((await this.#fileDigest(stagedLock)) !== lock.digest) throw new Error("staged lock digest mismatch");
      await this.#runner.run({
        executable: "deno",
        args: ["cache", "--frozen", `--lock=${stagedLock}`, prepared.executable.args.at(-1)!],
        cwd: staged,
        env: { ...process.env, DENO_DIR: join(staged, ".deno") },
        timeoutMs: DEFAULT_TIMEOUT_MS,
        maxOutputBytes: DEFAULT_OUTPUT_BYTES,
      });
      if ((await this.#fileDigest(stagedLock)) !== lock.digest)
        throw new Error("staged lock changed during deno cache");
    }
  }

  async #prepare(definition: CapabilityPackDefinition): Promise<PreparedPack | CapabilityPackStatusResult> {
    const unavailableBase = { id: definition.id, requiredWorkflows: definition.requiredWorkflows ?? [] };
    const runtime = definition.runtime ?? definition.implementation;
    if (definition.version === undefined || runtime === undefined || definition.executable === undefined) {
      return {
        ...unavailableBase,
        state: "unavailable",
        reason: "source-only",
        action:
          "This bundled pack has no published artifact metadata; install a distribution that supplies version, artifact, lock, and executable fields",
      };
    }
    const base = { ...unavailableBase, version: definition.version };
    let artifact = definition.artifact;
    if (artifact === undefined && definition.source !== undefined) {
      const source = this.#resolveManifestPath(definition.source);
      if (await this.#exists(source))
        artifact = { type: "local-directory", spec: definition.source, digest: await this.#treeDigest(source) };
    }
    if (artifact === undefined || !HASH.test(artifact.digest)) {
      return {
        ...base,
        state: "unavailable",
        reason: "artifact-unavailable",
        action: "Provide a digest-pinned local directory or external artifact",
      };
    }
    if (artifact.type === "npm-tarball" && (artifact.integrity === undefined || !artifact.spec.endsWith(".tgz"))) {
      return {
        ...base,
        state: "blocked",
        reason: "integrity-unavailable",
        action: "Provide an exact npm tarball spec and integrity",
      };
    }
    if (definition.lock === undefined && runtime === "python" && definition.dependencyFree === true) {
      return {
        definition,
        runtime,
        version: definition.version,
        artifact,
        executable: definition.executable,
        lock: {
          installer: "pip-hashes",
          digest: EMPTY_DIGEST,
          directDigest: EMPTY_DIGEST,
          transitiveDigest: EMPTY_DIGEST,
        },
      };
    }
    if (definition.lock === undefined) {
      return {
        ...base,
        state: "blocked",
        reason: "lock-unavailable",
        action: runtime === "python" ? "Provide a hash-locked requirements file" : "Provide a verified runtime lock",
      };
    }
    const lock = definition.lock;
    if (![lock.digest, lock.directDigest, lock.transitiveDigest].every((digest) => HASH.test(digest))) {
      return {
        ...base,
        state: "blocked",
        reason: "lock-unavailable",
        action: "Provide valid lock, direct dependency, and transitive dependency digests",
      };
    }
    return { definition, runtime, version: definition.version, artifact, executable: definition.executable, lock };
  }

  async #status(definition: CapabilityPackDefinition): Promise<CapabilityPackStatusResult> {
    const directory = this.#packDirectory(definition.id);
    if (await this.#exists(directory)) return await this.verify(definition.id);
    const prepared = await this.#prepare(definition);
    if ("state" in prepared) return prepared;
    return {
      id: definition.id,
      state: "not-installed",
      version: prepared.version,
      requiredWorkflows: definition.requiredWorkflows ?? [],
      action: `Run apex capability install --pack ${definition.id}`,
    };
  }

  async #registry(): Promise<CapabilityPackRegistryV1> {
    const value = JSON.parse(await readFile(this.#manifestPath, "utf8")) as CapabilityPackRegistryV1;
    if (!Array.isArray(value.packs)) throw new Error("Capability pack manifest must contain packs[]");
    const ids = new Set<string>();
    for (const pack of value.packs) {
      this.#assertId(pack.id);
      if (ids.has(pack.id)) throw new Error(`Duplicate capability pack '${pack.id}'`);
      ids.add(pack.id);
    }
    return value;
  }

  async #definition(id: string): Promise<CapabilityPackDefinition> {
    this.#assertId(id);
    const definition = (await this.#registry()).packs.find((pack) => pack.id === id);
    if (definition === undefined) throw new Error(`Unknown capability pack '${id}'`);
    return definition;
  }

  async #optionalDefinition(id: string): Promise<CapabilityPackDefinition | undefined> {
    try {
      return await this.#definition(id);
    } catch {
      return undefined;
    }
  }

  #assertId(id: string): void {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error(`Unsafe capability pack id '${id}'`);
  }

  #safeRelative(path: string): string {
    if (path.length === 0 || isAbsolute(path) || path.split(/[\\/]/u).includes(".."))
      throw new Error(`Unsafe relative path '${path}'`);
    return path;
  }

  #resolveManifestPath(path: string): string {
    const manifestRoot = dirname(this.#manifestPath);
    const candidate = resolve(manifestRoot, this.#safeRelative(path));
    if (candidate !== manifestRoot && !candidate.startsWith(`${manifestRoot}${sep}`))
      throw new Error(`Capability pack path escapes manifest root: ${path}`);
    return candidate;
  }

  #packDirectory(id: string): string {
    return join(this.#root, ".apex", "capability-packs", id);
  }
  #localDirectory(): string {
    return join(this.#root, ".apex", "local");
  }

  async #readLock(directory: string): Promise<CapabilityPackLockV1> {
    return JSON.parse(await readFile(join(directory, "pack.lock.json"), "utf8")) as CapabilityPackLockV1;
  }

  async #exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async #fileDigest(path: string): Promise<string> {
    return createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  }

  #generatedPaths(includePackLock = true): Set<string> {
    return new Set([...(includePackLock ? ["pack.lock.json"] : []), ".venv", "node_modules", ".deno", "deno-dir"]);
  }

  #installationManifestDigest(
    lock: Omit<CapabilityPackLockV1, "installationManifestDigest"> | CapabilityPackLockV1,
  ): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          sourceArtifactDigest: lock.sourceArtifactDigest,
          directLockDigest: lock.directLockDigest,
          transitiveLockDigest: lock.transitiveLockDigest,
          executable: lock.executable,
        }),
      )
      .digest("hex");
  }

  async #assertInstalledExecutable(directory: string, lock: CapabilityPackLockV1): Promise<void> {
    if (lock.runtime !== "python" || lock.executable.command !== "uv") return;
    const executable = join(
      directory,
      ".venv",
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "azure-pricing-mcp.exe" : "azure-pricing-mcp",
    );
    const metadata = await lstat(executable);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("installed capability executable is missing");
  }

  async #assertTreeSafe(root: string): Promise<void> {
    const rootPath = resolve(root);
    const rootStat = await lstat(rootPath);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
      throw new Error(`Pack root is not a real directory: ${rootPath}`);
    const canonicalRoot = await realpath(rootPath);
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        const item = await lstat(path);
        if (item.isSymbolicLink())
          throw new Error(`Symlink is not allowed in capability pack: ${relative(rootPath, path)}`);
        const canonical = await realpath(path);
        if (canonical !== canonicalRoot && !canonical.startsWith(`${canonicalRoot}${sep}`))
          throw new Error(`Capability pack path escapes root: ${path}`);
        if (item.isDirectory()) await visit(path);
        else if (!item.isFile()) throw new Error(`Unsupported capability pack entry: ${relative(rootPath, path)}`);
      }
    };
    await visit(rootPath);
  }

  async #treeDigest(root: string, ignored = new Set<string>()): Promise<string> {
    const hash = createHash("sha256");
    const visit = async (directory: string): Promise<void> => {
      const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
        compareText(left.name, right.name),
      );
      for (const entry of entries) {
        const path = join(directory, entry.name);
        const name = relative(root, path).split(sep).join("/");
        if ([...ignored].some((ignoredPath) => name === ignoredPath || name.startsWith(`${ignoredPath}/`))) continue;
        const item = await lstat(path);
        if (item.isSymbolicLink()) throw new Error(`Symlink is not allowed in capability pack: ${name}`);
        hash.update(entry.isDirectory() ? `d:${name}\0` : `f:${name}\0`);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile()) hash.update(await readFile(path));
        else throw new Error(`Unsupported capability pack entry: ${name}`);
      }
    };
    await visit(root);
    return hash.digest("hex");
  }
}
