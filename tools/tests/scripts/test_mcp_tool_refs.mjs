import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { azureMcpReleaseStatus } from "../../../.devcontainer/configure-mcp.mjs";
import { parseJsonc } from "../../scripts/_lib/parse-jsonc.mjs";
import { pinProblems, scanText } from "../../scripts/validate-mcp-tool-refs.mjs";
import {
  buildSnapshot,
  commandsFromLearnReply,
  parseLearnReply,
  parametersOf,
  sortKeys,
} from "../../scripts/refresh-azure-mcp-snapshot.mjs";

const snapshot = {
  schemaVersion: 1,
  serverVersion: "3.0.0",
  tools: {
    monitor: {
      commands: {
        monitor_workspace_log_query: { parameters: { query: true, subscription: false, table: true, workspace: true } },
      },
    },
    resourcehealth: {
      commands: { "resourcehealth_availability-status_get": { parameters: { resourceId: false, subscription: true } } },
    },
    extension_cli_generate: { parameters: { "cli-type": true, intent: true } },
    group_list: { parameters: { subscription: true } },
  },
};

const problems = (text) => scanText(text, snapshot).map((problem) => problem.message);

test("accepts valid tool, command and parameter references", () => {
  assert.deepEqual(
    problems(
      'Use `mcp_azure-mcp_monitor` with `command: "monitor_workspace_log_query"`, `parameters: { workspace: "w", query: "q" }`',
    ),
    [],
  );
  assert.deepEqual(problems("| `mcp_azure-mcp_group_list` | List resource groups |"), []);
  assert.deepEqual(problems('mcp_azure-mcp_extension_cli_generate\n  intent: "x"\n  cli-type: "az"'), []);
});

test("accepts the shortened client prefix and still validates against it", () => {
  assert.deepEqual(
    problems(
      'Use `mcp_azure_mcp_ser_monitor` with `command: "monitor_workspace_log_query"`, `parameters: { workspace: "w" }`',
    ),
    [],
  );
  assert.deepEqual(problems("written `mcp_azure-mcp_<tool>` or `mcp_azure_mcp_ser_<tool>`"), []);
  assert.deepEqual(problems("`mcp_azure_mcp_ser_nope`"), ["unknown tool mcp_azure-mcp_nope"]);
  assert.deepEqual(problems('`mcp_azure_mcp_ser_monitor` command: "monitor_nope"'), [
    'mcp_azure-mcp_monitor has no command "monitor_nope"',
  ]);
});

test("flags unknown tools, commands and parameters", () => {
  assert.deepEqual(problems("`mcp_azure-mcp_nope`"), ["unknown tool mcp_azure-mcp_nope"]);
  assert.deepEqual(problems('`mcp_azure-mcp_monitor` command: "monitor_nope"'), [
    'mcp_azure-mcp_monitor has no command "monitor_nope"',
  ]);
  assert.deepEqual(
    problems('`mcp_azure-mcp_monitor` command: "monitor_workspace_log_query", parameters: { "resource-group": "rg" }'),
    ['mcp_azure-mcp_monitor has no parameter "resource-group"'],
  );
});

test("parameter names are case sensitive", () => {
  assert.deepEqual(
    problems(
      'mcp_azure-mcp_resourcehealth\n  command: "resourcehealth_availability-status_get"\n  parameters:\n    resourceid: "x"',
    ),
    ['mcp_azure-mcp_resourcehealth has no parameter "resourceid"'],
  );
});

test("flags direct-tool parameters that do not exist", () => {
  assert.deepEqual(problems("mcp_azure-mcp_group_list({ subscription: 's', location: 'l' })"), [
    'mcp_azure-mcp_group_list has no parameter "location"',
  ]);
});

test("the ignore marker skips a reference on the same or previous line", () => {
  assert.deepEqual(problems("`mcp_azure-mcp_nope` <!-- mcp-ref:ignore -->"), []);
  assert.deepEqual(problems("<!-- mcp-ref:ignore -->\n`mcp_azure-mcp_nope`"), []);
});

test("snapshot builder is deterministic and keeps wrapped and direct tools apart", () => {
  const listed = [
    { name: "wrapped", inputSchema: { properties: { command: {}, intent: {} } } },
    { name: "direct", inputSchema: { properties: { b: {}, a: {} }, required: ["a"] } },
  ];
  const learned = { wrapped: [{ command: "w_get", inputSchema: { properties: { z: {} }, required: ["z"] } }] };
  const first = JSON.stringify(buildSnapshot("9.9.9", listed, learned));
  assert.equal(first, JSON.stringify(buildSnapshot("9.9.9", [...listed].reverse(), learned)));
  assert.deepEqual(JSON.parse(first).tools, {
    direct: { parameters: { a: true, b: false } },
    wrapped: { commands: { w_get: { parameters: { z: true } } } },
  });
  assert.deepEqual(parametersOf(undefined), {});
  assert.deepEqual(Object.keys(sortKeys({ b: 1, a: { d: 1, c: 2 } })), ["a", "b"]);
});

test("learn replies are parsed from prose plus JSON and fail loudly otherwise", () => {
  assert.deepEqual(parseLearnReply('Here are the commands: [{"command":"x"}]'), [{ command: "x" }]);
  assert.throws(() => parseLearnReply("no commands here"));
});

test("discovery errors identify the namespace instead of accepting incomplete metadata", () => {
  const content = [{ type: "text", text: 'Commands: [{"command":"x"}]' }];
  assert.deepEqual(commandsFromLearnReply("local", { result: { content } }), [{ command: "x" }]);
  assert.throws(
    () => commandsFromLearnReply("foundry", { result: { isError: true, content } }),
    /foundry metadata discovery failed/,
  );
  assert.throws(
    () => commandsFromLearnReply("remote", { error: { code: -32603, message: "registry unavailable" } }),
    /remote metadata discovery failed: registry unavailable/,
  );
  assert.throws(
    () => commandsFromLearnReply("broken", { result: { content: [{ text: "not a command list" }] } }),
    /broken metadata discovery failed: learn reply contains no command list/,
  );
});

test("the committed release contract matches the current stable pin independently of historical fixtures", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const current = JSON.parse(readFileSync(join(root, "tools/registry/azure-mcp-tools.json"), "utf8"));
  const config = parseJsonc(readFileSync(join(root, ".mcp.json"), "utf8"));
  assert.deepEqual(pinProblems(root, current), []);
  assert.equal(azureMcpReleaseStatus(config, [current.serverVersion, "9999.0.0-beta.1"]).status, "CURRENT");
});

test("historical pin fixtures detect drift and reject floating or prerelease versions", (context) => {
  const root = mkdtempSync(join(process.cwd(), ".mcp-pin-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".devcontainer"));
  const write = (workspace, defaults) => {
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { "azure-mcp": { args: ["-y", `@azure/mcp@${workspace}`] } } }),
    );
    writeFileSync(join(root, ".devcontainer/configure-mcp.mjs"), `args: ["-y", "@azure/mcp@${defaults}"]`);
  };
  write("3.0.0", "3.0.0");
  assert.deepEqual(pinProblems(root, snapshot), []);
  write("3.0.1", "3.0.0");
  assert.equal(pinProblems(root, snapshot).length, 1);
  write("3.0.1", "2.0.5");
  assert.equal(pinProblems(root, snapshot).length, 2);
  for (const version of ["latest", "^3.0.0", "3.0.0-beta.1", "3.0.0+build.1", "03.0.0"]) {
    write("3.0.0", version);
    assert.ok(pinProblems(root, snapshot).some((problem) => problem.includes("must use an exact stable")));
    write(version, version);
    assert.ok(
      pinProblems(root, { ...snapshot, serverVersion: version }).some((problem) =>
        problem.includes("must use an exact stable"),
      ),
    );
  }
});
