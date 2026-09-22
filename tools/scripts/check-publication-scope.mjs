import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function artifactTrigger(name) {
  return (
    name.startsWith("agent-output/") ||
    name.startsWith(".github/skills/apex-azure-artifacts/") ||
    name.startsWith(".github/instructions/azure-artifacts") ||
    /^tools\/scripts\/(validate-artifacts|validate-challenger-presence|check-publication-scope|_lib\/artifact-headings)/.test(
      name,
    ) ||
    name === "lefthook.yml"
  );
}

export function runPublicationCheck(mode, root = process.cwd()) {
  if (!["markdown", "artifacts"].includes(mode))
    throw new Error("Usage: check-publication-scope.mjs markdown|artifacts");
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const changed = git("diff", "--cached", "--name-only", "-z").split("\0").filter(Boolean);
  const entries = git("ls-files", "--stage", "-z")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [metadata, ...name] = entry.split("\t");
      const [fileMode, , stage] = metadata.split(" ");
      return { fileMode, stage, name: name.join("\t") };
    });
  const tracked = new Set(entries.map((entry) => entry.name));
  const markdown = changed.filter((name) => name.endsWith(".md") && tracked.has(name));
  if (mode === "markdown" ? !markdown.length : !changed.some(artifactTrigger)) {
    console.log(`No staged ${mode} checks required`);
    return 0;
  }
  if (entries.some((entry) => entry.stage !== "0" || !["100644", "100755"].includes(entry.fileMode))) {
    throw new Error(
      "Publication snapshot requires regular, resolved index entries; symlinks/submodules need explicit handling",
    );
  }
  const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), "apex-publication-"));
  try {
    git("checkout-index", "--all", `--prefix=${snapshot}${path.sep}`);
    const modules = path.join(root, "node_modules");
    if (!fs.existsSync(modules)) throw new Error("Local node_modules is required; run npm install before committing");
    if (fs.existsSync(path.join(snapshot, "node_modules"))) throw new Error("Tracked node_modules is not supported");
    fs.symlinkSync(modules, path.join(snapshot, "node_modules"), "dir");
    const run = (script, args = []) => {
      const result = spawnSync(process.execPath, [script, ...args], { cwd: snapshot, stdio: "inherit" });
      if (result.error) throw result.error;
      return result.status ?? 1;
    };
    if (mode === "markdown") {
      const metadata = JSON.parse(fs.readFileSync(path.join(modules, "markdownlint-cli2/package.json"), "utf8"));
      const bin = typeof metadata.bin === "string" ? metadata.bin : metadata.bin["markdownlint-cli2"];
      if (!bin) throw new Error("Installed markdownlint-cli2 has no executable entrypoint");
      return run(path.resolve(modules, "markdownlint-cli2", bin), [
        "--no-globs",
        ...markdown.map((name) => `./${name}`),
      ]);
    }
    const artifactStatus = run(path.join(snapshot, "tools/scripts/validate-artifacts.mjs"));
    if (artifactStatus !== 0) return artifactStatus;
    return run(path.join(snapshot, "tools/scripts/validate-challenger-presence.mjs"));
  } finally {
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runPublicationCheck(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
