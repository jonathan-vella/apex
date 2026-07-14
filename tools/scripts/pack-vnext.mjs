#!/usr/bin/env node
/**
 * Build and pack the publishable APEX vNext workspace packages.
 *
 * @example
 * node tools/scripts/pack-vnext.mjs --output-dir dist/vnext-packages
 */

import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runtimePackages = ["contracts", "kernel", "capabilities", "renderers", "cli"];
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function run(command, args, cwd = repositoryRoot) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stderr}${stdout}`));
    });
  });
}

function parseArguments(argv) {
  let outputDirectory = join(repositoryRoot, "dist", "vnext-packages");
  let includeTestkit = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output-dir") {
      const value = argv[++index];
      if (value === undefined) throw new Error("Missing value for --output-dir");
      outputDirectory = resolve(repositoryRoot, value);
    } else if (argv[index] === "--include-testkit") includeTestkit = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return { outputDirectory, includeTestkit };
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function packageMetadata(packageName) {
  const manifest = JSON.parse(await readFile(join(repositoryRoot, "packages", packageName, "package.json"), "utf8"));
  return {
    name: manifest.name,
    version: manifest.version,
    dependencies: Object.fromEntries(
      Object.entries(manifest.dependencies ?? {}).sort(([left], [right]) => compareText(left, right)),
    ),
  };
}

async function sourceCommit() {
  const { stdout } = await run("git", ["rev-parse", "HEAD"]);
  return stdout.trim();
}

async function sourceRepository() {
  const { stdout } = await run("git", ["remote", "get-url", "origin"]);
  const remote = stdout.trim();
  if (/^https?:\/\//.test(remote) || /^ssh:\/\//.test(remote)) {
    const url = new URL(remote);
    url.username = "";
    url.password = "";
    return `git+${url.toString()}`;
  }
  const scp = /^([^@]+@[^:]+):(.+)$/.exec(remote);
  if (scp !== null) return `git+ssh://${scp[1]}/${scp[2]}`;
  return `git+${remote}`;
}

async function releaseToolchain() {
  const toolchain = JSON.parse(await readFile(join(repositoryRoot, "config", "toolchain.v1.json"), "utf8"));
  return Object.fromEntries(
    Object.entries(toolchain.compatibilitySet).sort(([left], [right]) => compareText(left, right)),
  );
}

function normalizeSbom(sbom, releaseManifest) {
  const releaseRefs = new Set(releaseManifest.packages.map((entry) => `${entry.package}@${entry.version}`));
  const workspaceRef = (component) => {
    const reference = component?.["bom-ref"];
    if (typeof reference === "string" && reference.startsWith("@apex/")) return reference;
    if (typeof component?.purl === "string") {
      const match = /^pkg:npm\/@apex\/([^@]+)@(.+)$/.exec(decodeURIComponent(component.purl));
      if (match !== null) return `@apex/${match[1]}@${match[2]}`;
    }
    return component?.group === "@apex" && typeof component.name === "string" && typeof component.version === "string"
      ? `@apex/${component.name}@${component.version}`
      : undefined;
  };
  const unreleasedRefs = new Set(
    (sbom.components ?? [])
      .flatMap((component) => {
        const workspace = workspaceRef(component);
        return workspace !== undefined && !releaseRefs.has(workspace) ? [component["bom-ref"]] : [];
      })
      .filter((reference) => typeof reference === "string"),
  );
  let dependencies = (sbom.dependencies ?? [])
    .filter(({ ref }) => !unreleasedRefs.has(ref))
    .map((dependency) => ({
      ...dependency,
      dependsOn: (dependency.dependsOn ?? []).filter((reference) => !unreleasedRefs.has(reference)).sort(),
    }));
  const dependencyMap = new Map(dependencies.map((dependency) => [dependency.ref, dependency.dependsOn]));
  const rootRef = sbom.metadata?.component?.["bom-ref"];
  const reachable = new Set(typeof rootRef === "string" ? [rootRef] : []);
  const pending = [...reachable];
  while (pending.length > 0) {
    const reference = pending.shift();
    for (const dependency of dependencyMap.get(reference) ?? []) {
      if (reachable.has(dependency)) continue;
      reachable.add(dependency);
      pending.push(dependency);
    }
  }
  sbom.components = (sbom.components ?? [])
    .filter((component) => reachable.has(component["bom-ref"]))
    .sort((left, right) => compareText(String(left["bom-ref"]), String(right["bom-ref"])));
  dependencies = dependencies
    .filter(({ ref }) => reachable.has(ref))
    .map((dependency) => ({
      ...dependency,
      dependsOn: dependency.dependsOn.filter((reference) => reachable.has(reference)),
    }))
    .sort((left, right) => compareText(String(left.ref), String(right.ref)));
  sbom.dependencies = dependencies;
  const retainedWorkspaces = new Set(
    sbom.components.flatMap((component) => {
      const workspace = workspaceRef(component);
      return workspace === undefined ? [] : [workspace];
    }),
  );
  for (const reference of releaseRefs) {
    if (!retainedWorkspaces.has(reference))
      throw new Error(`CycloneDX SBOM is missing released workspace ${reference}`);
  }
  for (const reference of retainedWorkspaces) {
    if (!releaseRefs.has(reference)) throw new Error(`CycloneDX SBOM contains unreleased workspace ${reference}`);
  }
  return sbom;
}

async function writeReleaseSecurityArtifacts(outputDirectory, releaseManifest) {
  const sbomResult = await run("npm", ["sbom", "--omit=dev", "--sbom-format=cyclonedx"]);
  const sbom = normalizeSbom(JSON.parse(sbomResult.stdout), releaseManifest);
  sbom.serialNumber = `urn:uuid:${releaseManifest.sourceCommit.slice(0, 8)}-${releaseManifest.sourceCommit.slice(8, 12)}-4${releaseManifest.sourceCommit.slice(13, 16)}-8${releaseManifest.sourceCommit.slice(17, 20)}-${releaseManifest.sourceCommit.slice(20, 32)}`;
  if (sbom.metadata) sbom.metadata.timestamp = "1970-01-01T00:00:00.000Z";
  await writeFile(join(outputDirectory, "sbom.cdx.json"), `${JSON.stringify(sbom, null, 2)}\n`);
  const sbomHash = await sha256(join(outputDirectory, "sbom.cdx.json"));
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      ...releaseManifest.packages.map((entry) => ({ name: entry.file, digest: { sha256: entry.sha256 } })),
      { name: "sbom.cdx.json", digest: { sha256: sbomHash } },
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://apexops.dev/build-types/npm-workspaces/v1",
        externalParameters: {
          includeTestkit: releaseManifest.packages.some((entry) => entry.package === "@apex/testkit"),
        },
        internalParameters: releaseManifest.toolchain,
        resolvedDependencies: [
          {
            uri: releaseManifest.sourceRepository,
            digest: { gitCommit: releaseManifest.sourceCommit },
          },
        ],
      },
      runDetails: {
        builder: { id: "https://github.com/jonathan-vella/apex/tools/scripts/pack-vnext.mjs" },
        metadata: { invocationId: releaseManifest.sourceCommit },
      },
    },
  };
  await writeFile(join(outputDirectory, "provenance.intoto.jsonl"), `${JSON.stringify(provenance)}\n`);
  return {
    sbom: { file: "sbom.cdx.json", sha256: sbomHash },
    provenance: {
      file: "provenance.intoto.jsonl",
      sha256: await sha256(join(outputDirectory, "provenance.intoto.jsonl")),
    },
  };
}

async function packWorkspace(packageName, stagingDirectory) {
  const { stdout } = await run("npm", [
    "pack",
    "--workspace",
    `@apex/${packageName}`,
    "--json",
    "--pack-destination",
    stagingDirectory,
  ]);
  let result;
  try {
    result = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`npm pack returned invalid JSON for @apex/${packageName}: ${stdout}`, { cause: error });
  }
  const filename = result[0]?.filename;
  if (typeof filename !== "string") throw new Error(`npm pack did not return a filename for @apex/${packageName}`);
  return resolve(stagingDirectory, basename(filename));
}

export async function packVnext({ outputDirectory, includeTestkit = false }) {
  await run("npm", ["run", "build:vnext"]);
  await run("npm", ["run", "schemas:check", "--workspace", "@apex/contracts"]);

  const stagingDirectory = await mkdtemp(join(tmpdir(), "apex-vnext-pack-"));
  const packageNames = includeTestkit ? [...runtimePackages, "testkit"] : runtimePackages;
  try {
    await rm(outputDirectory, { recursive: true, force: true });
    await mkdir(outputDirectory, { recursive: true });
    const packages = [];
    for (const packageName of packageNames) {
      const stagedTarball = await packWorkspace(packageName, stagingDirectory);
      const filename = basename(stagedTarball);
      const destination = join(outputDirectory, filename);
      await copyFile(stagedTarball, destination);
      const metadata = await packageMetadata(packageName);
      const fileMetadata = await stat(destination);
      packages.push({
        package: metadata.name,
        version: metadata.version,
        file: filename,
        sha256: await sha256(destination),
        bytes: fileMetadata.size,
        dependencies: metadata.dependencies,
      });
    }
    const releaseManifest = {
      version: 1,
      sourceCommit: await sourceCommit(),
      sourceRepository: await sourceRepository(),
      toolchain: await releaseToolchain(),
      packages,
    };
    const security = await writeReleaseSecurityArtifacts(outputDirectory, releaseManifest);
    releaseManifest.security = security;
    await writeFile(join(outputDirectory, "release-manifest.json"), `${JSON.stringify(releaseManifest, null, 2)}\n`);
    return releaseManifest;
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    await packVnext(options);
    console.log(`Packed vNext packages to ${options.outputDirectory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
