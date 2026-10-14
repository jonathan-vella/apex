import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repo = new URL("../../../", import.meta.url);
const template = ".github/skills/apex-azure-artifacts/templates/00-session-state.template.json";

function validate(context, decisionLog) {
  const root = mkdtempSync(join(tmpdir(), "session-state-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "tools/scripts"), { recursive: true });
  cpSync(new URL("tools/scripts/_lib", repo), join(root, "tools/scripts/_lib"), { recursive: true });
  cpSync(
    new URL("tools/scripts/validate-session-state.mjs", repo),
    join(root, "tools/scripts/validate-session-state.mjs"),
  );
  mkdirSync(join(root, ".github/skills/apex-azure-artifacts/templates"), { recursive: true });
  cpSync(new URL(template, repo), join(root, template));
  mkdirSync(join(root, "agent-output/demo"), { recursive: true });
  const state = JSON.parse(readFileSync(new URL(template, repo), "utf8"));
  state.project = "demo";
  state.decision_log = decisionLog;
  writeFileSync(join(root, "agent-output/demo/00-session-state.json"), JSON.stringify(state));
  return spawnSync(process.execPath, [join(root, "tools/scripts/validate-session-state.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
}

test("accepts the entries apex-recall and the risk gate actually write", (context) => {
  const result = validate(context, [
    { decision: "review_depth=default", timestamp: "2026-10-14T14:23:35Z", rationale: "boot default" },
    { decision: "pin sql", timestamp: "2026-10-14T14:28:33Z", step: "1" },
    { decision: "gate", timestamp: "2026-10-14T14:28:33Z", step: "3_5" },
    {
      id: "D003",
      step: 4,
      agent: "apex-recall",
      title: "Explicit lab risk authorization",
      choice: "EXCEPTION_AUTHORIZED",
      rationale: "r",
      decision: "d",
      timestamp: "2026-10-14T14:28:33Z",
    },
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("rejects entries with no decision text, a bad id, an unknown step or a non-object", (context) => {
  for (const entry of [
    { timestamp: "2026-10-14T14:28:33Z" },
    { decision: "x", id: "first" },
    { decision: "x", step: "9" },
    { decision: "x", step: 0 },
    "text",
  ]) {
    const result = validate(context, [entry]);
    assert.notEqual(result.status, 0, JSON.stringify(entry));
  }
});
