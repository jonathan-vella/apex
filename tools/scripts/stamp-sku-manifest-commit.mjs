#!/usr/bin/env node
/**
 * Stamp commit_sha onto the latest revision in any SKU manifest
 * that was modified in the most recent commit.
 *
 * Designed to be invoked from a post-commit Git hook. Safe to re-run.
 *
 * Pattern:
 *   1. Agent writes a new revision to agent-output/{project}/sku-manifest.json
 *      with `apex_recall_checkpoint` set but `commit_sha` absent.
 *   2. User/CI commits the change.
 *   3. This script runs post-commit, finds manifests in the commit's diff,
 *      and stamps `revisions[<latest>].commit_sha = HEAD short SHA`.
 *
 * No-ops:
 *   - If the latest revision already has commit_sha set, leave it.
 *   - If no manifests are in HEAD's diff, exit 0 silently.
 *   - If git is unavailable, exit 0 (best-effort).
 *
 * Important: this script does NOT amend the commit. It stages the
 * stamped change for the user to include in a follow-up commit if
 * desired. For CI pipelines, integrate via a "fix-up" PR step instead
 * of inline amendment.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function tryGit(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function shortSha(sha) {
  return sha?.slice(0, 7) ?? null;
}

function main() {
  const root = process.cwd();
  const headSha = tryGit("git rev-parse HEAD");
  if (!headSha) {
    return;
  }
  const changedRaw = tryGit("git diff-tree --no-commit-id --name-only -r HEAD") ?? "";
  const manifests = changedRaw
    .split("\n")
    .map((s) => s.trim())
    .filter((p) => /^agent-output\/[^/]+\/sku-manifest\.json$/.test(p));

  if (manifests.length === 0) {
    return;
  }

  const short = shortSha(headSha);
  let stamped = 0;

  for (const rel of manifests) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(abs, "utf-8"));
    } catch {
      continue;
    }
    if (!Array.isArray(data.revisions) || data.revisions.length === 0) continue;
    const last = data.revisions[data.revisions.length - 1];
    if (last.commit_sha) continue;
    last.commit_sha = short;
    fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`);
    stamped++;
    console.log(`  ✓ Stamped ${rel} rev ${last.rev} with commit_sha=${short}`);
  }

  if (stamped > 0) {
    console.log(`  ℹ️  ${stamped} manifest(s) stamped. Stage and commit the update separately.`);
  }
}

main();
