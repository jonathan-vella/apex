import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";

const GUIDANCE = ["checklists_sha", "protocol_sha", "reviewer_contract_sha", "reviewer_definition_sha"];
const snapshot = (cache) => Object.fromEntries(GUIDANCE.map((key) => [key, cache?.[key] ?? null]));

export function reviewCompatibility(original, current, root = process.cwd()) {
  const registry = path.join(root, "tools/registry/review-contract.json");
  const policy = fs.existsSync(registry) ? JSON.parse(fs.readFileSync(registry, "utf8")) : null;
  if (policy && (policy.contract !== "review-v1" || !Array.isArray(policy.editorial_compatibility)))
    throw new Error("Unsupported review compatibility contract");
  if (isDeepStrictEqual(original, current)) return "exact";
  if (!original || !current || original.artifact_sha !== current.artifact_sha) return "material-change";
  const preserved = (cache) =>
    Object.fromEntries(Object.entries(cache).filter(([key]) => !GUIDANCE.includes(key) && key !== "artifact_hash"));
  if (!isDeepStrictEqual(preserved(original), preserved(current))) return "unknown";
  if (!policy) return "unknown";
  const { artifact_hash: originalHash, ...provenance } = original;
  if (createHash("sha256").update(Object.values(provenance).join("\n---\n")).digest("hex") !== originalHash)
    return "unknown";
  const matches = policy.editorial_compatibility.filter(
    (entry) =>
      entry.classification === "editorial" &&
      typeof entry.rationale === "string" &&
      entry.rationale.trim() &&
      isDeepStrictEqual(entry.from, snapshot(original)) &&
      isDeepStrictEqual(entry.to, snapshot(current)),
  );
  return matches.length === 1 ? "editorial-compatible" : "unknown";
}

export function supportingInputCompatible(inputPath, recordedSha, actualSha, root = process.cwd()) {
  if (recordedSha === actualSha) return true;
  if (typeof inputPath !== "string" || inputPath.startsWith("agent-output/")) return false;
  const registry = path.join(root, "tools/registry/review-contract.json");
  if (!fs.existsSync(registry)) return false;
  try {
    const policy = JSON.parse(fs.readFileSync(registry, "utf8"));
    const entries = policy?.supporting_input_compatibility;
    if (!Array.isArray(entries)) return false;
    return entries.some(
      (entry) =>
        entry.path === inputPath &&
        entry.from_sha256 === recordedSha &&
        entry.to_sha256 === actualSha &&
        typeof entry.rationale === "string" &&
        entry.rationale.trim().length > 0,
    );
  } catch {
    return false;
  }
}
