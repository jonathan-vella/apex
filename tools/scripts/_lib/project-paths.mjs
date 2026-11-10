/**
 * Shared Dual-Path Resolver for agent-output/{project}/ (layout_version: 2 + legacy fallback).
 *
 * Resolves contracts/, reviews/, assets/, and _meta/ paths while transparently
 * falling back to legacy root paths when a project uses layout_version: 1.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

import { canonicalJson, readJson, sha256File } from "./json.mjs";

export const LAYOUT_SUBDIRS = ["assets", "contracts", "reviews", "_meta"];
const KNOWN_SUBDIRS = new Set([...LAYOUT_SUBDIRS, "inputs", "pricing", "previews", "scratch"]);
const SEARCH_SUBDIRS = [
  "contracts",
  "reviews",
  "_meta",
  "assets",
  path.join("_meta", "pricing"),
  path.join("_meta", "previews"),
  path.join("_meta", "scratch"),
  path.join("_meta", "inputs"),
];

/**
 * Given a file path or directory path inside a project directory, return the
 * project root directory (e.g. `agent-output/my-project`).
 */
export function projectDirFromPath(fileOrDirPath) {
  const normalized = path.resolve(fileOrDirPath);
  const parts = normalized.split(path.sep);
  const aoIdx = parts.lastIndexOf("agent-output");
  if (aoIdx >= 0 && aoIdx + 1 < parts.length) {
    return parts.slice(0, aoIdx + 2).join(path.sep) || path.sep;
  }
  let dir = normalized;
  try {
    if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
      dir = path.dirname(normalized);
    } else if (path.extname(normalized)) {
      dir = path.dirname(normalized);
    }
  } catch {
    if (path.extname(normalized)) dir = path.dirname(normalized);
  }
  while (KNOWN_SUBDIRS.has(path.basename(dir))) {
    dir = path.dirname(dir);
  }
  return dir;
}

export function isLayoutV2(projectDir) {
  return (
    fs.existsSync(path.join(projectDir, "_meta", "00-session-state.json")) ||
    fs.existsSync(path.join(projectDir, "contracts")) ||
    fs.existsSync(path.join(projectDir, "reviews"))
  );
}

export function resolveSessionStatePath(projectDir) {
  const pdir = projectDirFromPath(projectDir);
  const v2 = path.join(pdir, "_meta", "00-session-state.json");
  const v1 = path.join(pdir, "00-session-state.json");
  if (fs.existsSync(v2)) return v2;
  if (fs.existsSync(v1)) return v1;
  return isLayoutV2(pdir) ? v2 : v1;
}

function resolveInSubdir(projectDir, subdir, filename) {
  const pdir = projectDirFromPath(projectDir);
  const name = path.basename(filename);
  const v2 = path.join(pdir, subdir, name);
  const v1 = path.join(pdir, name);
  if (fs.existsSync(v2)) return v2;
  if (fs.existsSync(v1)) return v1;
  return isLayoutV2(pdir) ? v2 : v1;
}

const POLICY_FILE = /^(?:04-(?:governance-constraints|policy-feasibility)|subscription-[1-9][0-9]*)\.json$/;
const PRIVATE_PROJECT = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;
const PRIVATE_POLICY_REFERENCE =
  /^apex-private-policy:\/\/([A-Za-z0-9_.-]{1,100})\/([a-f0-9]{32})\/((?:04-(?:governance-constraints|policy-feasibility)|subscription-[1-9][0-9]*)\.json)$/;

function privatePolicyContext(projectDir, filename) {
  if (POLICY_FILE.test(filename)) {
    const pdir = projectDirFromPath(projectDir);
    const stateFile = resolveSessionStatePath(pdir);
    if (fs.existsSync(stateFile)) {
      const state = readJson(stateFile);
      const record = state.decisions?.material_inputs?.azure_read_scope;
      if (record?.value?.scope_ref) {
        const reference = record.value.scope_ref;
        if (!/^[a-f0-9]{32}$/.test(reference)) throw new Error("Invalid private policy scope reference");
        const workspace = fs.realpathSync(path.dirname(path.dirname(pdir)));
        const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
        if (!path.isAbsolute(stateHome)) throw new Error("Private policy state home must be absolute");
        const hash = (value) => crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
        const directory = path.join(stateHome, "apex", "policy", hash(workspace), reference);
        const inside = (parent, target) => {
          const relative = path.relative(parent, target);
          return (
            relative === "" ||
            (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
          );
        };
        if (inside(workspace, path.resolve(directory)) || fs.realpathSync(directory) !== path.resolve(directory)) {
          throw new Error("Private policy storage must be outside the repository without symlinks");
        }
        const scopeFile = path.join(directory, "scope.json");
        const privateFile = (file) => {
          const metadata = fs.lstatSync(file);
          if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
            throw new Error("Private policy evidence requires an owner-only regular file");
          }
        };
        privateFile(scopeFile);
        const scope = readJson(scopeFile);
        if (
          scope.project !== path.basename(pdir) ||
          scope.workspace !== hash(workspace) ||
          hash(scope) !== record.value.scope_sha256 ||
          scope.authorized !== true ||
          scope.policy_read_scope !== "subscription-and-inherited" ||
          scope.request_id !== record.request_id ||
          scope.owner !== record.owner ||
          JSON.stringify(scope.environments) !== JSON.stringify(record.environments)
        ) {
          throw new Error("Private policy scope is changed or differently authorized");
        }
        const target = path.join(directory, filename);
        if (fs.existsSync(target)) privateFile(target);
        return { target, reference, scope, state, record };
      }
    }
  }
  return null;
}

export function resolveContractPath(projectDir, filename) {
  if (["04-governance-constraints.json", "04-policy-feasibility.json"].includes(filename)) {
    const context = privatePolicyContext(projectDir, filename);
    if (context) return context.target;
  }
  return resolveInSubdir(projectDir, "contracts", filename);
}

export function isPrivatePolicyReference(value) {
  return typeof value === "string" && value.startsWith("apex-private-policy:");
}

export function resolvePrivatePolicyReference(root, reference, expectedProject) {
  const match = typeof reference === "string" && PRIVATE_POLICY_REFERENCE.exec(reference);
  if (!match || !PRIVATE_PROJECT.test(match[1]) || (expectedProject && match[1] !== expectedProject)) {
    throw new Error("Invalid or differently scoped private policy reference");
  }
  const projectDir = path.join(root, "agent-output", match[1]);
  const context = privatePolicyContext(projectDir, match[3]);
  if (!context || context.reference !== match[2]) {
    throw new Error("Private policy reference does not match the current authorized scope");
  }
  return context.target;
}

export function requiredPrivateReviewInputs(root, project, artifactType, artifactPath) {
  if (
    !["architecture", "cost-estimate", "governance-constraints", "implementation-plan", "iac-code"].includes(
      artifactType,
    )
  ) {
    return [];
  }
  if (artifactPath) {
    const relative = path.relative(path.join(root, "agent-output"), path.resolve(root, artifactPath));
    if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
      const artifactProject = relative.split(path.sep)[0];
      if (artifactProject !== project) throw new Error("Review project differs from its primary artifact scope");
    }
  }
  if (!PRIVATE_PROJECT.test(project)) throw new Error("Private policy review requires a valid project slug");
  const projectDir = path.join(root, "agent-output", project);
  const stateFile = resolveSessionStatePath(projectDir);
  if (!fs.existsSync(stateFile)) return [];
  const state = readJson(stateFile);
  if (
    !state.decisions?.material_inputs?.azure_read_scope?.value?.scope_ref ||
    state.decisions?.material_inputs?.policy_source?.value?.kind === "assumed-corp"
  ) {
    return [];
  }
  const context = privatePolicyContext(projectDir, "04-policy-feasibility.json");
  if (!context) throw new Error("Private policy review scope is no longer current");
  const binding = state.metadata?.policy_feasibility;
  const scopeHash = crypto.createHash("sha256").update(canonicalJson(context.record)).digest("hex");
  if (
    !binding?.private ||
    binding.read_scope !== scopeHash ||
    !binding.snapshots ||
    !Array.isArray(context.scope.subscription_ids) ||
    !context.scope.subscription_ids.length ||
    Object.keys(binding.snapshots).length !== context.scope.subscription_ids.length
  ) {
    throw new Error("Private policy review requires current full-scope evidence binding");
  }
  const files = new Map([[binding.path, binding.sha256], ...Object.entries(binding.snapshots)]);
  if (artifactType === "governance-constraints") files.set("04-governance-constraints.json", null);
  return [...files].map(([filename, expectedHash]) => {
    const reference = `apex-private-policy://${project}/${context.reference}/${filename}`;
    const file = resolvePrivatePolicyReference(root, reference, project);
    if (artifactType === "governance-constraints" && filename === "04-governance-constraints.json") {
      const envelope = readJson(file);
      if (
        typeof envelope.subscription_id !== "string" ||
        !context.scope.subscription_ids.some((id) => id.toLowerCase() === envelope.subscription_id.toLowerCase())
      ) {
        throw new Error("Private governance rule evidence is differently scoped");
      }
      const result = spawnSync(
        "python3",
        [
          path.join(root, ".github/skills/apex-azure-governance-discovery/scripts/discover.py"),
          "--project",
          project,
          "--subscription",
          envelope.subscription_id,
          "--out",
          file,
          "--validate-only",
          "--retain-rule-evidence",
        ],
        { cwd: root, encoding: "utf8", timeout: 30000 },
      );
      if (result.error || result.status !== 0) {
        throw new Error("Private governance rule evidence is missing, changed or invalid; offline validation required");
      }
    }
    const actual = sha256File(file);
    if (expectedHash !== null && actual !== expectedHash) {
      throw new Error("Private policy review evidence changed; refresh its current binding");
    }
    return { path: reference, sha256: actual };
  });
}

export function resolveReviewPath(projectDir, filename) {
  return resolveInSubdir(projectDir, "reviews", filename);
}

export function resolveAssetPath(projectDir, filename) {
  return resolveInSubdir(projectDir, "assets", filename);
}

export function resolveMetaPath(projectDir, filename) {
  return resolveInSubdir(projectDir, "_meta", filename);
}

export function resolveProjectFile(projectDir, relOrName) {
  const pdir = projectDirFromPath(projectDir);
  let rel = String(relOrName);
  const aoPrefixMatch = rel.match(/(?:^|[\\/])agent-output[\\/][^\\/]+[\\/](.+)$/);
  if (aoPrefixMatch) rel = aoPrefixMatch[1];

  const direct = path.resolve(pdir, rel);
  if (fs.existsSync(direct)) return direct;

  for (const prefix of [
    path.join(pdir, "_meta", "inputs", rel),
    path.join(pdir, "_meta", rel),
    path.join(pdir, "_meta", "scratch", rel),
    path.join(pdir, "_meta", "pricing", rel),
    path.join(pdir, "_meta", "previews", rel),
  ]) {
    if (fs.existsSync(prefix)) return prefix;
  }

  const name = path.basename(rel);
  for (const sub of SEARCH_SUBDIRS) {
    const candidate = path.join(pdir, sub, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  const rootCandidate = path.join(pdir, name);
  if (fs.existsSync(rootCandidate)) return rootCandidate;
  return direct;
}

export function projectRelativeEvidencePath(
  projectRoot,
  reference,
  workspaceRoot = path.resolve(import.meta.dirname, "../../.."),
) {
  if (typeof reference !== "string" || !reference.trim() || reference.includes("\0")) {
    throw new Error("Evidence reference must be a nonempty path string");
  }
  const project = fs.realpathSync(projectRoot);
  let base =
    reference.startsWith("agent-output/") && path.basename(path.dirname(project)) === "agent-output"
      ? path.dirname(path.dirname(project))
      : project;
  const workspaceReference = path.resolve(workspaceRoot, reference);
  const workspaceRelative = path.relative(project, workspaceReference);
  if (
    ["agent-output/", "tools/", ".github/"].some((prefix) => reference.startsWith(prefix)) &&
    workspaceRelative &&
    workspaceRelative !== ".." &&
    !workspaceRelative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(workspaceRelative)
  ) {
    base = workspaceRoot;
  }
  const relative = path.relative(project, path.resolve(base, reference));
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Evidence must remain project-relative to the approved project root");
  }
  return relative.split(path.sep).join("/");
}
