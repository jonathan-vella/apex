import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function runLinkChecks(root = process.cwd()) {
  const selection = spawnSync(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "*.md",
      ":(exclude)infra/**",
      ":(exclude).archive/**",
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (selection.error || selection.status !== 0) {
    console.error(selection.error?.message || selection.stderr || "Git file selection failed");
    return selection.status || 1;
  }
  let exitCode = 0;
  for (const file of new Set(selection.stdout.split("\0").filter(Boolean))) {
    const result = spawnSync(
      "markdown-link-check",
      [path.resolve(root, file), "--config", ".markdown-link-check.json"],
      { cwd: root, stdio: "inherit" },
    );
    if (result.error) {
      console.error(result.error.message);
      return result.error.code === "ENOENT" ? 127 : 1;
    }
    if (result.status !== 0) exitCode = result.status || 1;
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runLinkChecks());
}
