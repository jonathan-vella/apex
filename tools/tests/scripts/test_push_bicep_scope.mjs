import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const hook = fileURLToPath(new URL("../../scripts/diff-based-push-check.sh", import.meta.url));

for (const broken of [false, true]) {
  test(`pre-push validates tracked Bicep only and preserves failures: ${broken}`, (context) => {
    const directory = mkdtempSync(path.join(tmpdir(), "push-bicep-"));
    context.after(() => rmSync(directory, { recursive: true, force: true }));
    const bin = path.join(directory, "bin");
    mkdirSync(bin);
    const executable = (name, body) => writeFileSync(path.join(bin, name), body, { mode: 0o755 });
    executable(
      "git",
      `#!/bin/sh
case "$1" in
diff|ls-files) printf '%s\n' infra/bicep/first/main.bicep infra/bicep/last/main.bicep ;;
*) exit 2 ;;
esac
`,
    );
    executable("npm", "#!/bin/sh\nexit 0\n");
    executable(
      "bicep",
      `#!/bin/sh
printf '%s\n' "$*" >> "$CALL_LOG"
case "$2" in
*draft*) exit 9 ;;
*first*) ${broken ? "exit 1" : "exit 0"} ;;
esac
exit 0
`,
    );
    mkdirSync(path.join(directory, "infra/bicep/draft"), { recursive: true });
    writeFileSync(path.join(directory, "infra/bicep/draft/main.bicep"), "incomplete draft");
    const log = path.join(directory, "calls.txt");
    const result = spawnSync("bash", [hook], {
      cwd: directory,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALL_LOG: log },
      encoding: "utf8",
    });
    assert.equal(result.status, broken ? 1 : 0, result.stdout + result.stderr);
    const calls = readFileSync(log, "utf8");
    assert.doesNotMatch(calls, /draft/);
    assert.match(calls, /first\/main.bicep/);
    assert.match(calls, /last\/main.bicep/);
    assert.match(calls, /--stdout/);
  });
}
