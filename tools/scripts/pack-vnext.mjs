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
      Object.entries(manifest.dependencies ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

async function sourceCommit() {
  const { stdout } = await run("git", ["rev-parse", "HEAD"]);
  return stdout.trim();
}

async function writeReleaseSecurityArtifacts(outputDirectory, releaseManifest) {
  const sbomResult = await run("npm", ["sbom", "--omit=dev", "--sbom-format=cyclonedx"]);
  const sbom = JSON.parse(sbomResult.stdout);
  sbom.serialNumber = `urn:uuid:${releaseManifest.sourceCommit.slice(0, 8)}-${releaseManifest.sourceCommit.slice(8, 12)}-4${releaseManifest.sourceCommit.slice(13, 16)}-8${releaseManifest.sourceCommit.slice(17, 20)}-${releaseManifest.sourceCommit.slice(20, 32)}`;
  if (sbom.metadata) sbom.metadata.timestamp = "1970-01-01T00:00:00.000Z";
  await writeFile(join(outputDirectory, "sbom.cdx.json"), `${JSON.stringify(sbom, null, 2)}\n`);
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    subject: releaseManifest.packages.map((entry) => ({ name: entry.file, digest: { sha256: entry.sha256 } })),
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://apexops.dev/build-types/npm-workspaces/v1",
        externalParameters: {
          includeTestkit: releaseManifest.packages.some((entry) => entry.package === "@apex/testkit"),
        },
        internalParameters: { node: process.version },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/jonathan-vella/apex.git",
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
    sbom: { file: "sbom.cdx.json", sha256: await sha256(join(outputDirectory, "sbom.cdx.json")) },
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
    const releaseManifest = { version: 1, sourceCommit: await sourceCommit(), packages };
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
