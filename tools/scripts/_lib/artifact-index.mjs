/**
 * Process-scoped index of files under agent-output/.
 *
 * Validators can filter this immutable snapshot instead of independently
 * walking the same project trees. Mutating tools must call resetArtifactIndex().
 */

import fs from "node:fs";
import path from "node:path";

const AGENT_OUTPUT_DIR = "agent-output";
let artifactFiles;

function walk(dir, output) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, output);
    else output.push(fullPath);
  }
}

export function getArtifactFiles() {
  if (!artifactFiles) {
    artifactFiles = [];
    walk(AGENT_OUTPUT_DIR, artifactFiles);
    artifactFiles.sort();
  }
  return artifactFiles;
}

export function findArtifactFiles(predicate) {
  return getArtifactFiles().filter(predicate);
}

export function resetArtifactIndex() {
  artifactFiles = undefined;
}
