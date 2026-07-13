#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const assetsRoot = join(packageRoot, "assets");

function portablePath(path) {
  return path.split(sep).join("/");
}

function assertContained(root, path) {
  const child = relative(root, path);
  if (child === "" || child === ".." || child.startsWith(`..${sep}`) || child.startsWith(sep)) {
    throw new Error(`Unsafe asset path: ${path}`);
  }
}

async function walkFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    assertContained(root, path);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) throw new Error(`Asset source contains a symlink: ${path}`);
    if (metadata.isDirectory()) files.push(...(await walkFiles(root, path)));
    else if (metadata.isFile()) files.push(path);
    else throw new Error(`Unsupported asset source entry: ${path}`);
  }
  return files;
}

async function sourceVersion(path) {
  const value = JSON.parse(await readFile(path, "utf8"));
  if (typeof value.version === "string") return value.version;
  if (typeof value.schemaVersion === "string") return value.schemaVersion;
  throw new Error(`Asset version is missing from ${path}`);
}

async function fileDigest(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function treeDigest(root) {
  const hash = createHash("sha256");
  const visit = async (directory) => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const name = portablePath(relative(root, path));
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) throw new Error(`Asset source contains a symlink: ${path}`);
      hash.update(metadata.isDirectory() ? `d:${name}\0` : `f:${name}\0`);
      if (metadata.isDirectory()) await visit(path);
      else if (metadata.isFile()) hash.update(await readFile(path));
      else throw new Error(`Unsupported asset source entry: ${path}`);
    }
  };
  await visit(root);
  return hash.digest("hex");
}

async function copyEntry(sourceRoot, destinationRoot, sourceRelative, inventory) {
  const source = join(sourceRoot, sourceRelative);
  const metadata = await lstat(source);
  if (metadata.isSymbolicLink()) throw new Error(`Asset source contains a symlink: ${source}`);
  const files = metadata.isDirectory() ? await walkFiles(source) : [source];
  for (const sourceFile of files) {
    const destinationRelative = metadata.isDirectory()
      ? join(sourceRelative, relative(source, sourceFile))
      : sourceRelative;
    const destination = join(destinationRoot, destinationRelative);
    assertContained(destinationRoot, destination);
    await mkdir(dirname(destination), { recursive: true });
    await cp(sourceFile, destination, { force: true, errorOnExist: false });
    const bytes = await readFile(sourceFile);
    inventory.push({
      path: portablePath(relative(assetsRoot, destination)),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.byteLength,
    });
  }
}

async function prepareCapabilityPacks(inventory) {
  const policy = JSON.parse(await readFile(join(repositoryRoot, "config", "capability-packs.v1.json"), "utf8"));
  const definitions = new Map(policy.packs.map((pack) => [pack.id, pack]));
  const packsRoot = join(assetsRoot, "capability-packs");
  const sources = [
    {
      id: "azure-pricing",
      root: join(repositoryRoot, "tools", "mcp-servers", "azure-pricing"),
      entries: ["pyproject.toml", "uv.lock", "src"],
    },
    {
      id: "azure-governance-discovery",
      root: join(repositoryRoot, ".github", "skills", "azure-governance-discovery"),
      entries: [join("scripts", "discover.py"), join("scripts", "render_governance.py")],
    },
    {
      id: "drawio",
      root: join(repositoryRoot, "tools", "mcp-servers", "drawio"),
      entries: ["deno.json", "deno.lock", "src", join("assets", "azure-public-service-icons")],
    },
  ];
  for (const source of sources) {
    const destination = join(packsRoot, source.id, "source");
    for (const entry of source.entries) await copyEntry(source.root, destination, entry, inventory);
  }

  const emptyDigest = createHash("sha256").update("").digest("hex");
  const pricingSource = join(packsRoot, "azure-pricing", "source");
  const governanceSource = join(packsRoot, "azure-governance-discovery", "source");
  const drawioSource = join(packsRoot, "drawio", "source");
  const pricingPyproject = await readFile(join(pricingSource, "pyproject.toml"), "utf8");
  const pricingVersion = pricingPyproject.match(/^version\s*=\s*"([^"]+)"/mu)?.[1];
  if (pricingVersion === undefined) throw new Error("Azure pricing version is missing from pyproject.toml");
  const drawioConfig = JSON.parse(await readFile(join(drawioSource, "deno.json"), "utf8"));
  const uvDigest = await fileDigest(join(pricingSource, "uv.lock"));
  const denoDigest = await fileDigest(join(drawioSource, "deno.lock"));
  const governanceScriptDigest = await fileDigest(join(governanceSource, "scripts", "discover.py"));
  const metadata = (id) => {
    const definition = definitions.get(id);
    if (definition === undefined) throw new Error(`Capability pack metadata is missing for ${id}`);
    return definition;
  };
  const registry = {
    schemaVersion: policy.schemaVersion,
    protocolVersion: policy.protocolVersion,
    installationPolicy: policy.installationPolicy,
    packs: [
      {
        ...metadata("azure-pricing"),
        version: pricingVersion,
        runtime: "python",
        artifact: {
          type: "local-directory",
          spec: "capability-packs/azure-pricing/source",
          digest: await treeDigest(pricingSource),
        },
        lock: {
          installer: "uv",
          path: "capability-packs/azure-pricing/source/uv.lock",
          digest: uvDigest,
          directDigest: uvDigest,
          transitiveDigest: uvDigest,
        },
        executable: { command: "uv", args: ["run", "--frozen", "--no-dev", "azure-pricing-mcp"] },
        capabilities: ["azure-pricing"],
      },
      {
        ...metadata("azure-governance-discovery"),
        version: "1.0.0",
        runtime: "python",
        artifact: {
          type: "local-directory",
          spec: "capability-packs/azure-governance-discovery/source",
          digest: await treeDigest(governanceSource),
        },
        lock: {
          installer: "pip-hashes",
          digest: emptyDigest,
          directDigest: emptyDigest,
          transitiveDigest: emptyDigest,
        },
        executable: { command: "python", args: ["scripts/discover.py"] },
        dependencyFree: true,
        script: "scripts/discover.py",
        scriptDigest: governanceScriptDigest,
        capabilities: ["governance-discovery"],
      },
      {
        ...metadata("drawio"),
        version: typeof drawioConfig.version === "string" ? drawioConfig.version : "1.0.0",
        runtime: "deno",
        artifact: {
          type: "local-directory",
          spec: "capability-packs/drawio/source",
          digest: await treeDigest(drawioSource),
        },
        lock: {
          installer: "deno",
          path: "capability-packs/drawio/source/deno.lock",
          digest: denoDigest,
          directDigest: denoDigest,
          transitiveDigest: denoDigest,
        },
        executable: { command: "deno", args: ["run", "--frozen", "-P", "src/index.ts", "--transport", "stdio"] },
        capabilities: ["drawio"],
      },
    ],
  };
  const registryPath = join(packsRoot, "registry.v1.json");
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  const registryBytes = await readFile(registryPath);
  inventory.push({
    path: portablePath(relative(assetsRoot, registryPath)),
    sha256: createHash("sha256").update(registryBytes).digest("hex"),
    bytes: registryBytes.byteLength,
  });
}

async function prepareAssets() {
  const sources = [
    { name: "customizations", root: join(repositoryRoot, "customizations") },
    { name: "config", root: join(repositoryRoot, "config") },
  ];
  const inventory = [];
  await rm(assetsRoot, { recursive: true, force: true });
  await mkdir(assetsRoot, { recursive: true });

  for (const source of sources) {
    const sourceMetadata = await lstat(source.root);
    if (!sourceMetadata.isDirectory() || sourceMetadata.isSymbolicLink()) {
      throw new Error(`Asset source must be a real directory: ${source.root}`);
    }
    for (const sourceFile of await walkFiles(source.root)) {
      const sourceRelative = relative(source.root, sourceFile);
      const destination = join(assetsRoot, source.name, sourceRelative);
      assertContained(join(assetsRoot, source.name), destination);
      await mkdir(dirname(destination), { recursive: true });
      await cp(sourceFile, destination, { force: true, errorOnExist: false });
      const bytes = await readFile(sourceFile);
      inventory.push({
        path: portablePath(relative(assetsRoot, destination)),
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.byteLength,
      });
    }
  }

  await prepareCapabilityPacks(inventory);

  const manifest = {
    version: 1,
    sources: {
      customizations: await sourceVersion(join(repositoryRoot, "customizations", "manifest.json")),
      config: await sourceVersion(join(repositoryRoot, "config", "runtime-bundle.v1.json")),
    },
    files: inventory.sort((left, right) => left.path.localeCompare(right.path)),
  };
  await writeFile(join(assetsRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await prepareAssets();
