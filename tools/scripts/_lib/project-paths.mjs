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

import { readJson } from "./json.mjs";

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

export function resolveContractPath(projectDir, filename) {
  if (["04-governance-constraints.json", "04-policy-feasibility.json"].includes(filename)) {
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
        const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
        const canonicalScope = Object.fromEntries(Object.entries(scope).sort(([a], [b]) => a.localeCompare(b)));
        if (
          scope.project !== path.basename(pdir) ||
          scope.workspace !== hash(workspace) ||
          hash(canonicalScope) !== record.value.scope_sha256 ||
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
        return target;
      }
    }
  }
  return resolveInSubdir(projectDir, "contracts", filename);
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
