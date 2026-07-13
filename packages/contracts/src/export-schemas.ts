import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CONTRACT_METADATA_FILENAME, createContractMetadataFile, createContractSchemaFiles } from "./schema-export.js";

const schemasDirectory = fileURLToPath(new URL("../schemas/", import.meta.url));
const checkOnly = process.argv.includes("--check");
const includeMetadata = process.argv.includes("--metadata");

const generatedFiles = new Map(createContractSchemaFiles().map(({ filename, contents }) => [filename, contents]));
if (includeMetadata) {
  generatedFiles.set(CONTRACT_METADATA_FILENAME, createContractMetadataFile());
}

async function findDrift(): Promise<string[]> {
  let existingFilenames: string[] = [];
  try {
    existingFilenames = await readdir(schemasDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const expectedFilenames = [...generatedFiles.keys()].sort();
  const relevantExistingFilenames = existingFilenames
    .filter(
      (filename) => filename.endsWith(".schema.json") || (includeMetadata && filename === CONTRACT_METADATA_FILENAME),
    )
    .sort();
  const drift = new Set(expectedFilenames.filter((filename) => !relevantExistingFilenames.includes(filename)));
  for (const filename of relevantExistingFilenames) {
    const expected = generatedFiles.get(filename);
    if (expected === undefined) {
      drift.add(filename);
      continue;
    }
    const actual = await readFile(new URL(`../schemas/${filename}`, import.meta.url), "utf8");
    if (actual !== expected) {
      drift.add(filename);
    }
  }
  return [...drift].sort();
}

if (checkOnly) {
  const drift = await findDrift();
  if (drift.length > 0) {
    console.error(`Contract schema drift detected: ${drift.join(", ")}`);
    process.exitCode = 1;
  }
} else {
  await mkdir(schemasDirectory, { recursive: true });
  const existingFilenames = await readdir(schemasDirectory);
  const staleSchemaFilenames = existingFilenames.filter(
    (filename) => filename.endsWith(".schema.json") && !generatedFiles.has(filename),
  );
  await Promise.all(staleSchemaFilenames.map((filename) => rm(new URL(`../schemas/${filename}`, import.meta.url))));
  await Promise.all(
    [...generatedFiles].map(([filename, contents]) =>
      writeFile(new URL(`../schemas/${filename}`, import.meta.url), contents, "utf8"),
    ),
  );
}
