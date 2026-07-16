import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateManagedFileHashInventory,
  loadRepositoryModel,
  validateRepositoryModel,
} from "../../scripts/validate-vnext.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const baseline = loadRepositoryModel(root);
const mutate = (change) => {
  const model = structuredClone(baseline);
  change(model);
  return validateRepositoryModel(model);
};
const hasRule = (result, ruleId) => result.findings.some((finding) => finding.ruleId === ruleId);

test("repository model satisfies vNext contracts", () => {
  const result = validateRepositoryModel(baseline);
  assert.deepEqual(result.findings, []);
  assert.ok(Object.values(generateManagedFileHashInventory(baseline)).every((hash) => /^[a-f0-9]{64}$/.test(hash)));
});

test("rejects CI lint before the vNext build", () => {
  const result = mutate((model) => {
    model.rootManifest.scripts["validate:_node-ci"] = model.rootManifest.scripts["validate:_node-ci"].replace(
      "npm run build:vnext && ",
      "",
    );
  });
  assert.ok(hasRule(result, "ci.vnext-build-order"));
});

test("rejects cached CI lint over generated imports", () => {
  const result = mutate((model) => {
    model.rootManifest.scripts["lint:js:ci"] = model.rootManifest.scripts["lint:js:ci"].replace("--no-cache ", "");
  });
  assert.ok(hasRule(result, "ci.lint-cache"));
});

test("rejects a divergent CI validation entrypoint", () => {
  const result = mutate((model) => {
    model.ciWorkflow.jobs.ci.steps.find(({ run }) => run === "npm run validate:_node-ci").run = "npm run lint:js:ci";
  });
  assert.ok(hasRule(result, "ci.validation-entrypoint"));
});

test("rejects a subagent model escalation", () => {
  const result = mutate((model) => {
    model.customization.manifest.roles.find(({ agent }) => agent === "APEX Reviewer").costTier = "premium";
  });
  assert.ok(hasRule(result, "customization.model-escalation"));
});

test("rejects askQuestions on an autonomous subagent", () => {
  const result = mutate((model) => {
    model.customization.agents
      .find(({ frontmatter }) => frontmatter.name === "APEX Reviewer")
      .frontmatter.tools.push("vscode/askQuestions");
  });
  assert.ok(hasRule(result, "customization.subagent-questions"));
});

test("rejects a missing MCP tool", () => {
  const result = mutate((model) => {
    model.mcpTools = model.mcpTools.filter((tool) => tool !== "status");
  });
  assert.ok(hasRule(result, "customization.mcp-tool"));
});

test("rejects a PATH-dependent MCP launch", () => {
  const result = mutate((model) => {
    model.customization.mcp.servers.apex.command = "apex";
    model.customization.mcp.servers.apex.args = ["mcp", "serve"];
  });
  assert.ok(hasRule(result, "mcp.launch"));
});

test("rejects an unsafe managed path", () => {
  const result = mutate((model) => {
    model.customization.manifest.managedFiles.push("../package.json");
  });
  assert.ok(hasRule(result, "managed-path.safety"));
});

test("rejects Gate 4 inheritance", () => {
  const result = mutate((model) => {
    model.config["workflow.v1.json"].promotion.gateRules.find(({ gates }) => gates.includes(4)).inheritance = "allowed";
  });
  assert.ok(hasRule(result, "workflow.gate4-inheritance"));
});

test("rejects an internal package cycle", () => {
  const result = mutate((model) => {
    model.packages.contracts.manifest.dependencies["@apex/kernel"] = "0.1.0";
    model.packages.contracts.tsconfig.references = [{ path: "../kernel" }];
  });
  assert.ok(hasRule(result, "package.cycle"));
});

test("rejects a runtime package version mismatch", () => {
  const result = mutate((model) => {
    model.config["runtime-bundle.v1.json"].components.kernel.version = "9.9.9";
  });
  assert.ok(hasRule(result, "runtime.version"));
});

test("rejects permissive or non-object contract union branches", () => {
  for (const mutation of [
    (branch) => {
      branch.additionalProperties = true;
    },
    (branch) => {
      branch.type = "string";
    },
  ]) {
    const result = mutate((model) => {
      const schema = model.contracts.schemas.find(({ value }) => Array.isArray(value.anyOf)).value;
      mutation(schema.anyOf[0]);
    });
    assert.ok(hasRule(result, "contracts.schema-shape"));
  }
});
