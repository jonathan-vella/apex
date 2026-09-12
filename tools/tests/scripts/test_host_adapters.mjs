import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";

const repository = new URL("../../../", import.meta.url);
const source = (relative) => readFileSync(new URL(relative, repository), "utf8");

const procedure = readFileSync(
  new URL("../../../.github/skills/apex-context-management/references/debug-log-export.md", import.meta.url),
  "utf8",
);
const blocks = [...procedure.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1]);
const setup = blocks[0].split('echo "ws_debug_root=')[0];
const stage = blocks.find((block) => block.includes('STAGE=".apex-logs/_staging/'));
const archive = blocks.find((block) => block.includes("if tar -czf"));

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "apex-host-adapters-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const debugRoot = path.join(root, "Host debug logs");
  const active = path.join(debugRoot, "active session");
  const local = path.join(root, "Local debug logs", "local session");
  mkdirSync(active, { recursive: true });
  mkdirSync(local, { recursive: true });
  const selected = path.join(debugRoot, "selected session");
  mkdirSync(selected);
  for (const session of [active, local, selected]) {
    writeFileSync(path.join(session, "main.jsonl"), `${JSON.stringify({ session: path.basename(session) })}\n`);
  }
  utimesSync(selected, 200, 200);
  utimesSync(active, 100, 100);
  return {
    root,
    debugRoot,
    active,
    local,
    selected,
    env: {
      PATH: process.env.PATH,
      HARNESS: "host",
      HOST_PATHS_CONFIRMED: "yes",
      WS_DEBUG_ROOT: debugRoot,
      ACTIVE_SESSION_DIR: active,
      VSCODE_TARGET_SESSION_LOG: local,
      SESSION_DIR: selected,
      SESSION_PICK_CONFIRMED: "yes",
      INCLUDE_OLDER: "no",
      INCLUDE_XCRIPT: "no",
      INCLUDE_WS: "no",
      REDACT: "yes",
    },
  };
}

function run(fixture, script, env = {}) {
  return spawnSync("bash", ["--noprofile", "--norc"], {
    input: script,
    cwd: fixture.root,
    env: { ...fixture.env, ...env },
    encoding: "utf8",
  });
}

test("confirmed Host paths survive a conflicting Local session variable", (context) => {
  const sample = fixture(context);
  const result = run(sample, `${setup}\nprintf '%s\\n' "$WS_DEBUG_ROOT" "$ACTIVE_SESSION_DIR"`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${sample.debugRoot}\n${sample.active}\n`);
});

test("unconfirmed, missing, relative and cross-workspace Host paths fail closed", (context) => {
  const sample = fixture(context);
  for (const override of [
    { HARNESS: "" },
    { HOST_PATHS_CONFIRMED: "" },
    { WS_DEBUG_ROOT: "" },
    { ACTIVE_SESSION_DIR: "" },
    { ACTIVE_SESSION_DIR: "relative" },
    { ACTIVE_SESSION_DIR: path.join(sample.debugRoot, "absent") },
    { ACTIVE_SESSION_DIR: sample.local },
  ]) {
    const result = run(sample, setup, override);
    assert.equal(result.status, 1, JSON.stringify(override));
    assert.match(result.stdout, /ERROR:/);
  }
});

test("Local resolution uses the Local variable, not stale Host inputs", (context) => {
  const sample = fixture(context);
  const result = run(sample, `${setup}\nprintf '%s\\n' "$WS_DEBUG_ROOT" "$ACTIVE_SESSION_DIR"`, {
    HARNESS: "local",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${path.dirname(sample.local)}\n${sample.local}\n`);
  assert.equal(run(sample, setup, { HARNESS: "local", VSCODE_TARGET_SESSION_LOG: "" }).status, 1);
});

function staged(sample, env = {}, extra = "") {
  const result = run(sample, `${setup}\n${stage}\n${extra}`, env);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const stagingRoot = path.join(sample.root, ".apex-logs/_staging");
  return path.join(stagingRoot, readdirSync(stagingRoot)[0]);
}

test("candidate enumeration handles spaces and marks the active session", (context) => {
  const sample = fixture(context);
  const result = run(sample, blocks[0]);
  assert.equal(result.status, 0, result.stderr);
  const rows = readFileSync(path.join(sample.root, "tmp/apex-debug-sessions.tsv"), "utf8").trim().split("\n");
  assert.equal(rows.length, 2);
  assert.ok(rows[0].startsWith("selected session\t"));
  assert.match(rows[1], /^active session\t.*ACTIVE/);
});

test("capture refuses unconfirmed selections and paths outside the debug root", (context) => {
  const sample = fixture(context);
  symlinkSync(sample.local, path.join(sample.debugRoot, "escape"));
  for (const override of [
    { SESSION_PICK_CONFIRMED: "" },
    { SESSION_DIR: sample.local },
    { SESSION_DIR: path.join(sample.debugRoot, "escape") },
  ]) {
    assert.equal(run(sample, `${setup}\n${stage}`, override).status, 1);
    assert.equal(existsSync(path.join(sample.root, ".apex-logs")), false);
  }
});

test("default capture excludes active logs and all optional trees", (context) => {
  const sample = fixture(context);
  const output = staged(sample);
  assert.deepEqual(readdirSync(output).sort(), ["filtered", "session"]);
  assert.equal(JSON.parse(readFileSync(path.join(output, "session/main.jsonl"))).session, "selected session");
});

test("older capture is workspace-scoped, strictly older, bounded and excludes active", (context) => {
  const sample = fixture(context);
  utimesSync(sample.active, 195, 195);
  for (const [name, timestamp] of [
    ["newer", 300],
    ["equal", 200],
    ...Array.from({ length: 6 }, (_, index) => [`old ${index}`, 190 - index]),
  ]) {
    const directory = path.join(sample.debugRoot, name);
    mkdirSync(directory);
    writeFileSync(path.join(directory, "main.jsonl"), `${name}\n`);
    utimesSync(directory, timestamp, timestamp);
  }
  symlinkSync(sample.local, path.join(sample.debugRoot, "outside link"));
  const output = staged(sample, { INCLUDE_OLDER: "yes" });
  assert.deepEqual(readdirSync(path.join(output, "older-sessions")).sort(), [
    "old 0",
    "old 1",
    "old 2",
    "old 3",
    "old 4",
  ]);
});

test("active debug logs are captured only by an explicit active selection", (context) => {
  const sample = fixture(context);
  assert.equal(
    run(sample, `${setup}\n${stage}`, {
      SESSION_DIR: sample.active,
      SESSION_PICK_CONFIRMED: "no",
    }).status,
    1,
  );
  const output = staged(sample, { SESSION_DIR: sample.active });
  assert.equal(JSON.parse(readFileSync(path.join(output, "session/main.jsonl"))).session, "active session");
});

test("Host transcript opt-in requires a confirmed existing absolute path", (context) => {
  const sample = fixture(context);
  const transcript = path.join(sample.root, "Host transcript.jsonl");
  writeFileSync(transcript, '{"transcript":"active"}\n');
  for (const override of [
    {},
    { XCRIPT_FILE: transcript },
    { HOST_TRANSCRIPT_CONFIRMED: "yes", XCRIPT_FILE: "relative.jsonl" },
    { HOST_TRANSCRIPT_CONFIRMED: "yes", XCRIPT_FILE: `${transcript}.missing` },
  ]) {
    assert.equal(run(sample, `${setup}\n${stage}`, { INCLUDE_XCRIPT: "yes", ...override }).status, 1);
    assert.equal(existsSync(path.join(sample.root, ".apex-logs")), false);
  }
  const output = staged(sample, {
    INCLUDE_XCRIPT: "yes",
    HOST_TRANSCRIPT_CONFIRMED: "yes",
    XCRIPT_FILE: transcript,
  });
  assert.equal(
    readFileSync(path.join(output, "transcript", path.basename(transcript)), "utf8"),
    readFileSync(transcript, "utf8"),
  );
  assert.equal(JSON.parse(readFileSync(path.join(output, "session/main.jsonl"))).session, "selected session");
});

test("Local transcript opt-in resolves the active transcript, not the selected session", (context) => {
  const sample = fixture(context);
  const selected = path.join(path.dirname(sample.local), "previous");
  mkdirSync(selected);
  const transcripts = path.join(sample.root, "transcripts");
  mkdirSync(transcripts);
  writeFileSync(path.join(transcripts, "local session.jsonl"), "active transcript\n");
  writeFileSync(path.join(transcripts, "previous.jsonl"), "wrong transcript\n");
  const output = staged(sample, { HARNESS: "local", SESSION_DIR: selected, INCLUDE_XCRIPT: "yes" });
  assert.deepEqual(readdirSync(path.join(output, "transcript")), ["local session.jsonl"]);
  assert.equal(readFileSync(path.join(output, "transcript/local session.jsonl"), "utf8"), "active transcript\n");
});

test("archive failure returns tar status and retains staging even without errexit", (context) => {
  const sample = fixture(context);
  const binaries = path.join(sample.root, "bin");
  mkdirSync(binaries);
  writeFileSync(
    path.join(binaries, "tar"),
    '#!/bin/sh\necho "fixture tar failure: session/main.jsonl" >&2\nexit 23\n',
    { mode: 0o755 },
  );
  const result = run(sample, `${setup}\n${stage}\n${archive}`, { PATH: `${binaries}:${process.env.PATH}` });
  assert.equal(result.status, 23, result.stdout + result.stderr);
  assert.match(result.stderr, /fixture tar failure: session\/main.jsonl/);
  assert.match(result.stderr, /staging retained/);
  assert.doesNotMatch(result.stdout, /archive:/);
  const stagingRoot = path.join(sample.root, ".apex-logs/_staging");
  const output = path.join(stagingRoot, readdirSync(stagingRoot)[0]);
  assert.equal(
    readFileSync(path.join(output, "session/main.jsonl"), "utf8"),
    readFileSync(path.join(sample.selected, "main.jsonl"), "utf8"),
  );
});

test("successful archive contains selected logs and removes only its staging tree", (context) => {
  const sample = fixture(context);
  const sibling = path.join(sample.root, ".apex-logs/_staging/retained");
  mkdirSync(sibling, { recursive: true });
  const result = run(sample, `${setup}\n${stage}\n${archive}`);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(readdirSync(path.dirname(sibling)), ["retained"]);
  const bundle = readdirSync(path.join(sample.root, ".apex-logs")).find((name) => name.endsWith(".tar.gz"));
  const listing = spawnSync("tar", ["-tzf", path.join(sample.root, ".apex-logs", bundle)], { encoding: "utf8" });
  assert.equal(listing.status, 0, listing.stderr);
  assert.match(listing.stdout, /\/session\/main.jsonl/);
  assert.doesNotMatch(listing.stdout, /older-sessions|transcript|workspace-logs/);
});

test("all documented export blocks are valid Bash", (context) => {
  const sample = fixture(context);
  const result = spawnSync("bash", ["-n"], { input: blocks.join("\n"), cwd: sample.root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("complete synthetic export preserves raw logs, filters, redacts by default and honors workspace opt-in", (context) => {
  for (const optIn of [false, true]) {
    const sample = fixture(context);
    const agents = path.join(sample.root, ".github/agents");
    const registry = path.join(sample.root, "tools/registry");
    mkdirSync(agents, { recursive: true });
    mkdirSync(registry, { recursive: true });
    writeFileSync(path.join(agents, "fixture.agent.md"), "fixture agent\n");
    writeFileSync(path.join(registry, "agent-registry.json"), JSON.stringify({ agents: { fixture: {} } }));
    const workspaceLogs = path.join(sample.root, "logs/copilot");
    mkdirSync(workspaceLogs, { recursive: true });
    writeFileSync(path.join(workspaceLogs, "workspace.log"), "workspace log\n");
    for (const excluded of ["agent-output", "infra", "node_modules", ".git"]) {
      mkdirSync(path.join(sample.root, excluded));
      writeFileSync(path.join(sample.root, excluded, "excluded.txt"), "must not capture\n");
    }
    const raw = `${[
      JSON.stringify({ agent: ".github/agents/fixture.agent.md", password: "synthetic-value" }),
      JSON.stringify({ unrelated: "not custom agent activity" }),
    ].join("\n")}\n`;
    writeFileSync(path.join(sample.selected, "main.jsonl"), raw);
    const result = run(sample, `${setup}\n${blocks.slice(1).join("\n")}`, {
      INCLUDE_WS: optIn ? "yes" : "no",
      REDACT: optIn ? "no" : "yes",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const bundle = readdirSync(path.join(sample.root, ".apex-logs")).find((name) => name.endsWith(".tar.gz"));
    const bundleId = bundle.slice(0, -".tar.gz".length);
    const archived = (relative) => {
      const extracted = spawnSync(
        "tar",
        ["-xOzf", path.join(sample.root, ".apex-logs", bundle), `${bundleId}/${relative}`],
        { encoding: "utf8" },
      );
      assert.equal(extracted.status, 0, extracted.stderr);
      return extracted.stdout;
    };
    const manifest = JSON.parse(archived("MANIFEST.json"));
    assert.equal(manifest.session_id, "selected session");
    assert.equal(manifest.capture.include_workspace_logs, optIn);
    assert.equal(manifest.capture.redacted, !optIn);
    assert.equal(manifest.capture.include_older, false);
    assert.equal(manifest.capture.include_transcript, false);
    assert.equal(manifest.file_count, manifest.files.length);
    assert.equal(
      manifest.total_bytes,
      manifest.files.reduce((total, file) => total + file.size, 0),
    );
    assert.equal(archived("session/main.jsonl"), raw);
    const filtered = archived("filtered/session__main.jsonl.custom-agents.jsonl");
    assert.equal(filtered.trim().split("\n").length, 1);
    assert.equal(JSON.parse(filtered).password, optIn ? "synthetic-value" : "<redacted>");
    assert.equal(
      manifest.files.some((file) => file.path === "workspace-logs/workspace.log"),
      optIn,
    );
    assert.ok(manifest.files.every((file) => !file.path.includes("excluded.txt")));
  }
});

const hostEntries = [
  ["apex-host-debug-log-export", "apex-context-management/references/debug-log-export.md"],
  ["apex-host-git-commit", "apex-github-operations/references/git-commit.md"],
  ["apex-host-resume-workflow", "apex-workflow-engine/references/workflow-entry.md#resume"],
  ["apex-host-workflow-start", "apex-workflow-engine/references/workflow-entry.md"],
];

for (const [entry, reference] of hostEntries) {
  test(`${entry} is manual-only and grants no model or tool overrides`, () => {
    const content = source(`.github/skills/${entry}/SKILL.md`);
    const metadata = parseFrontmatter(content);
    assert.equal(metadata.name, entry);
    assert.equal(metadata["user-invocable"], true);
    assert.equal(metadata["disable-model-invocation"], true);
    for (const forbidden of ["agent", "agents", "model", "tools", "allowed-tools", "context", "hooks"]) {
      assert.equal(Object.hasOwn(metadata, forbidden), false, `${entry}: ${forbidden}`);
    }
    assert.ok(content.includes(`../${reference}`));
    assert.ok(existsSync(new URL(`.github/skills/${reference.split("#")[0]}`, repository)));
    assert.match(content, /\*\*STOP\*\*/);
    assert.match(content, /(?:cannot|does not) bind/);
    assert.match(content, /(?:widen tools|widening tools|tool widening)/);
    assert.match(content, /manual and unverified/);
  });
}

test("debug and commit Local adapters and Host prerequisites retain the built-in owner and exact tool ceiling", () => {
  for (const [operation, expectedTools, sharedPath] of [
    [
      "debug-log-export",
      ["vscode/askQuestions", "execute/runInTerminal", "read"],
      "apex-context-management/references/debug-log-export.md",
    ],
    [
      "git-commit",
      ["vscode/askQuestions", "execute/runInTerminal", "read", "todo"],
      "apex-github-operations/references/git-commit.md",
    ],
  ]) {
    const adapter = source(`.github/prompts/apex-${operation}.prompt.md`);
    const metadata = parseFrontmatter(adapter);
    const host = source(`.github/skills/apex-host-${operation}/SKILL.md`);
    const shared = source(`.github/skills/${sharedPath}`);
    assert.equal(metadata.agent, "agent");
    assert.equal(metadata.model, "MAI-Code-1.1-Flash");
    assert.deepEqual(metadata.tools, expectedTools);
    assert.ok(adapter.includes(`../skills/${sharedPath}`));
    assert.doesNotMatch(adapter, /```(?:bash|sh)/);
    for (const contract of [host, shared]) {
      assert.match(contract, /built-in owner `agent`/);
      assert.match(contract, /`MAI-Code-1\.1-Flash`/);
      for (const tool of expectedTools) assert.ok(contract.includes(`\`${tool}\``));
      assert.match(contract, /within\s+the owner's permissions|intersected with the active owner's permissions/);
    }
    assert.match(host, /do not widen tools or inherit a different model/);
    assert.match(adapter, /never silently inherit a different model, widen access/);
  }
});

test("Host resume and workflow-start route to current human-selected owners", () => {
  const entry = source(".github/skills/apex-workflow-engine/references/workflow-entry.md");
  const expectedOwners = new Map([
    ["fresh or resume", "01-Orchestrator"],
    ["requirements", "02-Requirements"],
    ["architecture", "03-Architect"],
    ["design", "04-Design"],
    ["governance", "04g-Governance"],
    ["plan", "05-IaC Planner"],
    ["bicep-codegen", "06b-Bicep CodeGen"],
    ["terraform-codegen", "06t-Terraform CodeGen"],
    ["bicep-deploy", "07b-Bicep Deploy"],
    ["terraform-deploy", "07t-Terraform Deploy"],
    ["as-built", "08-As-Built"],
    ["diagnose", "09-Diagnose"],
    ["challenge", "10-Challenger"],
  ]);
  const actualOwners = new Map(
    entry
      .split("\n")
      .filter((line) => /^\| [^|]+ \| `[^`]+` \|/.test(line))
      .map((line) => {
        const [, operation, owner] = line.split("|").map((cell) => cell.trim());
        return [operation, owner.slice(1, -1)];
      }),
  );
  assert.deepEqual(actualOwners, expectedOwners);
  const agents = readdirSync(new URL(".github/agents/", repository))
    .filter((name) => name.endsWith(".agent.md"))
    .map((name) => parseFrontmatter(source(`.github/agents/${name}`)));
  for (const owner of expectedOwners.values()) {
    const metadata = agents.find((agent) => agent.name === owner);
    assert.ok(metadata, `Missing owner ${owner}`);
    assert.equal(metadata["disable-model-invocation"], true, owner);
    assert.ok(metadata.model.length > 0, owner);
    assert.ok(Array.isArray(metadata.tools) && metadata.tools.length > 0, owner);
  }
  const orchestrator = agents.find((agent) => agent.name === "01-Orchestrator");
  assert.deepEqual(orchestrator.model, ["MAI-Code-1.1-Flash"]);
  assert.deepEqual(orchestrator.agents, []);
  const resume = source(".github/skills/apex-host-resume-workflow/SKILL.md");
  assert.match(resume, /selected owner `01-Orchestrator`/);
  assert.match(resume, /`MAI-Code-1\.1-Flash`/);
  assert.match(resume, /Never dispatch Sol or any step agent under MAI/);
  const local = parseFrontmatter(source(".github/prompts/apex-resume-workflow.prompt.md"));
  assert.equal(local.agent, orchestrator.name);
  assert.equal(local.model, undefined);
  assert.equal(local.tools, undefined);
  assert.match(entry, /its model from that agent's current frontmatter/);
  assert.match(entry, /\*\*STOP\*\* and request manual owner/);
  assert.match(entry, /Do not continue under an inherited picker model/);
  assert.match(entry, /Do not add tools to compensate for missing access/);
});

test("workflow entry preserves current Design, Challenger and CodeGen source contracts", () => {
  const entry = source(".github/skills/apex-workflow-engine/references/workflow-entry.md");
  const design = source(".github/agents/04-design.agent.md");
  const challenger = source(".github/agents/10-challenger.agent.md");
  for (const content of [entry, design]) {
    assert.match(content, /only when ADRs were produced and\s+`decisions\.review_depth == "deep"`/);
    assert.match(content, /informational and does not block Step 3/);
  }
  for (const content of [entry, challenger]) {
    assert.match(content, /Per-Finding Decision Protocol/);
    assert.match(content, /Revise \(apply Accepted findings\)/);
    assert.match(content, /challenged artifact/);
    assert.match(content, /upstream ownership/);
    assert.match(content, /re-review/);
  }
  assert.match(challenger, /apply any\s+Accepted fixes to the challenged artifact/);
  assert.match(entry, /applies only Accepted\s+fixes to the challenged artifact/);
  assert.doesNotMatch(entry, /Challenger returns findings without editing/);
  const challengeRow = entry.split("\n").find((line) => line.startsWith("| challenge |"));
  for (const output of ["findings_path", "decisions_path", "accepted fixes", "apply summary"]) {
    assert.ok(challengeRow.includes(output), output);
  }
  for (const [operation, agent] of [
    ["bicep-codegen", "06b-bicep-codegen"],
    ["terraform-codegen", "06t-terraform-codegen"],
  ]) {
    const owner = source(`.github/agents/${agent}.agent.md`);
    assert.match(owner, /emit `agent-output\/\{project\}\/05-iac-handoff\.json`/);
    const outputRow = entry.split("\n").find((line) => line.startsWith(`| ${operation} |`));
    assert.ok(outputRow.includes("`05-implementation-reference.md`"), operation);
    assert.ok(outputRow.includes("required `05-iac-handoff.json`"), operation);
  }
});

test("export retains explicit capture and privacy warnings without automatic upload", () => {
  assert.match(procedure, /Never pick a session without showing the candidate list/);
  assert.match(procedure, /only after that\s+explicit choice/);
  assert.match(procedure, /Default all capture\s+flags to `no` and `REDACT=yes`/);
  assert.match(procedure, /Never upload from this prompt/);
  assert.match(procedure, /raw session\/ tree is NEVER redacted/);
  assert.match(procedure, /never derive a Host transcript\s+location from Local storage layout/);
  assert.match(procedure, /does not authorize\s+copying the active debug-log directory as an older session/);
});
