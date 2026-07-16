#!/usr/bin/env node
/**
 * Validate the APEX vNext package, contract, configuration, and customization surface.
 *
 * @example
 * node tools/scripts/validate-vnext.mjs --json
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const REQUIRED_PACKAGES = ["contracts", "kernel", "capabilities", "renderers", "testkit", "cli"];
const CORE_PACKAGES = new Set(["kernel", "capabilities", "renderers"]);
const COST_TIERS = { fast: 0, standard: 1, premium: 2 };
const CONFIG_SHAPES = {
  "workflow.v1.json": [
    "schemaVersion",
    "id",
    "determinism",
    "runModel",
    "nodes",
    "edges",
    "returnRoutes",
    "failureRoutes",
    "promotion",
    "terminalStates",
    "blockedStates",
  ],
  "defaults.v1.json": [
    "schemaVersion",
    "securityInvariants",
    "azureDefaults",
    "evidence",
    "tasks",
    "previews",
    "journalBenchmarks",
    "telemetry",
  ],
  "runtime-bundle.v1.json": [
    "schemaVersion",
    "bundleVersion",
    "capabilityProtocolVersion",
    "components",
    "config",
    "schemas",
    "validators",
    "requiredCapabilityPacks",
    "compatibility",
  ],
  "quality-scorecard.v1.json": ["schemaVersion", "frozenAt", "rules"],
  "capability-packs.v1.json": ["schemaVersion", "protocolVersion", "installationPolicy", "packs"],
  "toolchain.v1.json": [
    "schemaVersion",
    "observationCutoff",
    "supportPolicy",
    "core",
    "compatibilitySet",
    "optionalCapabilityPackRuntimes",
    "approvedExceptions",
  ],
};
const FORBIDDEN_TOOL = /(^|\/)(shell|terminal|filesystem|fs|edit|write|git|azure|az|bicep|terraform)(\/|$)/i;
const SECRET_KEY = /(secret|password|passwd|token|privateKey|clientSecret|connectionString)/i;
const SOURCE_IMPORT = /(?:from\s+|import\s*\()["']([^"']+)["']/g;

const clone = (value) => structuredClone(value);
const array = (value) => (Array.isArray(value) ? value : []);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const walk = (directory, predicate = () => true) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file, predicate) : predicate(file) ? [file] : [];
  });
};

function parseScalar(text) {
  const value = text.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "[]") return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  return value.replace(/^['"]|['"]$/g, "");
}

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const result = {};
  let listKey;
  let listItem;
  for (const raw of match[1].split(/\r?\n/)) {
    const top = raw.match(/^([\w-]+):(?:\s*(.*))?$/);
    if (top) {
      const [, key, rest = ""] = top;
      if (rest === "") {
        result[key] = [];
        listKey = key;
      } else {
        result[key] = parseScalar(rest);
        listKey = undefined;
      }
      listItem = undefined;
      continue;
    }
    const item = raw.match(/^\s{2}-\s*(.*)$/);
    if (item && listKey) {
      const pair = item[1].match(/^([\w-]+):\s*(.*)$/);
      if (pair) {
        listItem = { [pair[1]]: parseScalar(pair[2]) };
        result[listKey].push(listItem);
      } else {
        result[listKey].push(parseScalar(item[1]));
        listItem = undefined;
      }
      continue;
    }
    const nested = raw.match(/^\s{4}([\w-]+):\s*(.*)$/);
    if (nested && listItem) listItem[nested[1]] = parseScalar(nested[2]);
  }
  return result;
}

function parseMcpTools(source) {
  return [...source.matchAll(/registerTool\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function parseContractRegistry(source) {
  const ids = [...source.matchAll(/["'](https:\/\/schemas\.apexops\.dev\/[^"']+\.json)["']:\s*metadata\(/g)].map(
    (match) => match[1],
  );
  return { ids };
}

export function loadRepositoryModel(root = process.cwd()) {
  const rootManifest = readJson(path.join(root, "package.json"));
  const config = Object.fromEntries(
    Object.keys(CONFIG_SHAPES).map((name) => [name, readJson(path.join(root, "config", name))]),
  );
  const packageEntries = Object.fromEntries(
    REQUIRED_PACKAGES.map((name) => [
      name,
      {
        manifest: readJson(path.join(root, "packages", name, "package.json")),
        tsconfig: readJson(path.join(root, "packages", name, "tsconfig.json")),
      },
    ]),
  );
  const agentFiles = walk(path.join(root, "customizations", ".github", "agents"), (file) => file.endsWith(".agent.md"));
  const skillFiles = walk(
    path.join(root, "customizations", ".github", "skills"),
    (file) => path.basename(file) === "SKILL.md",
  );
  const schemaDirectory = path.join(root, "packages", "contracts", "schemas");
  const schemaFiles = walk(schemaDirectory, (file) => file.endsWith(".schema.json"));
  const contractSource = readFileSync(path.join(root, "packages", "contracts", "src", "index.ts"), "utf8");
  const mcpSource = readFileSync(path.join(root, "packages", "cli", "src", "mcp.ts"), "utf8");
  const sourceFiles = walk(path.join(root, "packages"), (file) => file.endsWith(".ts"));
  return {
    root,
    rootManifest,
    ciWorkflow: yaml.load(readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8")),
    config,
    packages: packageEntries,
    customization: {
      manifest: readJson(path.join(root, "customizations", "manifest.json")),
      agents: agentFiles.map((file) => ({
        path: relative(path.join(root, "customizations"), file),
        content: readFileSync(file, "utf8"),
        frontmatter: parseFrontmatter(readFileSync(file, "utf8")),
      })),
      skills: skillFiles.map((file) => ({
        path: relative(path.join(root, "customizations"), file),
        content: readFileSync(file, "utf8"),
        frontmatter: parseFrontmatter(readFileSync(file, "utf8")),
      })),
      mcp: readJson(path.join(root, "customizations", ".vscode", "mcp.json")),
    },
    contracts: {
      registry: parseContractRegistry(contractSource),
      metadata: readJson(path.join(schemaDirectory, "contract-metadata.json")),
      schemas: schemaFiles.map((file) => ({ path: relative(root, file), value: readJson(file) })),
    },
    mcpTools: parseMcpTools(mcpSource),
    sources: sourceFiles.map((file) => ({ path: relative(root, file), content: readFileSync(file, "utf8") })),
    plan: readFileSync(path.join(root, ".github", "prompts", "plan-buildApexVnext.prompt.md"), "utf8"),
  };
}

function validateCiLintPrerequisites(model, findings) {
  const command = model.rootManifest.scripts?.["validate:_node-ci"] ?? "";
  const phases = command.split("&&").map((phase) => phase.trim());
  const buildPhase = phases.findIndex((phase) => phase === "npm run build:vnext");
  const lintPhase = phases.findIndex((phase) => phase.split(/\s+/).includes("lint:js:ci"));
  if (buildPhase < 0 || lintPhase < 0 || buildPhase >= lintPhase)
    finding(
      findings,
      "ci.vnext-build-order",
      "validate:_node-ci must complete build:vnext before the phase containing lint:js:ci",
      "package.json",
    );
  const lintCommand = model.rootManifest.scripts?.["lint:js:ci"] ?? "";
  if (!lintCommand.split(/\s+/).includes("--no-cache"))
    finding(
      findings,
      "ci.lint-cache",
      "lint:js:ci must disable the ESLint cache because generated import targets can change independently",
      "package.json",
    );
  const ciSteps = array(model.ciWorkflow?.jobs?.ci?.steps);
  if (!ciSteps.some(({ run }) => run === "npm run validate:_node-ci"))
    finding(
      findings,
      "ci.validation-entrypoint",
      "The CI workflow must invoke validate:_node-ci so local and CI lint use the same prerequisites",
      ".github/workflows/ci.yml",
    );
}

const finding = (findings, ruleId, message, file = undefined) =>
  findings.push({ severity: "error", ruleId, message, ...(file ? { file } : {}) });

function validatePackages(model, findings) {
  const names = new Set(Object.values(model.packages).map(({ manifest }) => manifest.name));
  const versions = new Set(Object.values(model.packages).map(({ manifest }) => manifest.version));
  if (versions.size !== 1) finding(findings, "package.version", "All vNext packages must use one release version");
  for (const packageName of REQUIRED_PACKAGES) {
    const entry = model.packages[packageName];
    if (!entry) {
      finding(findings, "package.inventory", `Missing package ${packageName}`);
      continue;
    }
    const { manifest, tsconfig } = entry;
    const file = `packages/${packageName}/package.json`;
    if (manifest.name !== `@apex/${packageName}`)
      finding(findings, "package.name", `${file} has an unexpected package name`, file);
    for (const key of ["version", "type", "exports", "scripts", "engines"])
      if (!(key in manifest)) finding(findings, "package.shape", `${file} is missing ${key}`, file);
    if (
      manifest.type !== "module" ||
      !manifest.types ||
      !manifest.scripts?.build ||
      !manifest.scripts?.test ||
      !manifest.engines?.node
    )
      finding(findings, "package.shape", `${file} does not expose the required ESM/build/test/engine surface`, file);
    const dependencies = Object.keys(manifest.dependencies ?? {})
      .filter((name) => names.has(name))
      .map((name) => name.slice("@apex/".length));
    for (const dependency of dependencies)
      if (manifest.dependencies[`@apex/${dependency}`] !== model.packages[dependency]?.manifest.version)
        finding(
          findings,
          "package.version",
          `${packageName} must pin ${dependency} to its exact package version`,
          file,
        );
    const references = array(tsconfig.references).map((ref) => path.basename(ref.path));
    if (dependencies.length !== references.length || dependencies.some((name) => !references.includes(name)))
      finding(
        findings,
        "package.tsconfig-references",
        `${packageName} TypeScript references must match internal dependencies`,
        `packages/${packageName}/tsconfig.json`,
      );
    if (packageName === "contracts" && dependencies.length > 0)
      finding(findings, "package.direction", "contracts must not depend on internal packages", file);
    if (CORE_PACKAGES.has(packageName) && dependencies.some((name) => name !== "contracts"))
      finding(findings, "package.direction", `${packageName} may depend only on contracts`, file);
    if (
      packageName === "cli" &&
      !["contracts", "kernel", "capabilities", "renderers"].every((name) => dependencies.includes(name))
    )
      finding(
        findings,
        "package.cli-composition",
        "cli must compose contracts, kernel, capabilities, and renderers",
        file,
      );
    if (packageName === "testkit" && manifest.bin)
      finding(findings, "package.testkit-role", "testkit must not expose a CLI", file);
    if (packageName !== "testkit" && dependencies.includes("testkit"))
      finding(findings, "package.testkit-role", `${packageName} must not use testkit as a runtime dependency`, file);
  }
  const graph = Object.fromEntries(
    REQUIRED_PACKAGES.map((name) => [
      name,
      Object.keys(model.packages[name]?.manifest.dependencies ?? {})
        .filter((dep) => dep.startsWith("@apex/"))
        .map((dep) => dep.slice(6)),
    ]),
  );
  const visiting = new Set();
  const visited = new Set();
  const visit = (node) => {
    if (visiting.has(node)) {
      finding(findings, "package.cycle", `Internal package cycle includes ${node}`);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dependency of graph[node] ?? []) visit(dependency);
    visiting.delete(node);
    visited.add(node);
  };
  for (const packageName of REQUIRED_PACKAGES) visit(packageName);
}

function validateContracts(model, findings) {
  const schemaIds = model.contracts.schemas.map(({ value }) => value.$id);
  const registryIds = model.contracts.registry.ids;
  const metadataIds = Object.keys(model.contracts.metadata);
  for (const id of new Set([...schemaIds, ...registryIds, ...metadataIds])) {
    if (!schemaIds.includes(id) || !registryIds.includes(id) || !metadataIds.includes(id))
      finding(findings, "contracts.inventory", `Schema inventory mismatch for ${id}`, "packages/contracts/schemas");
  }
  for (const { path: schemaPath, value } of model.contracts.schemas) {
    const strictObject = (schema) =>
      object(schema) && schema.type === "object" && schema.additionalProperties === false;
    const strictObjectUnion =
      object(value) && Array.isArray(value.anyOf) && value.anyOf.length > 0 && value.anyOf.every(strictObject);
    if (!value.$id || (!strictObject(value) && !strictObjectUnion))
      finding(
        findings,
        "contracts.schema-shape",
        `${schemaPath} lacks required schema identity or strict object shape`,
        schemaPath,
      );
    const metadata = model.contracts.metadata[value.$id];
    if (
      !metadata ||
      !Number.isInteger(metadata.maxBytes) ||
      metadata.maxBytes <= 0 ||
      metadata.compatibility !== "strict-v1"
    )
      finding(findings, "contracts.metadata", `${schemaPath} has invalid contract metadata`, schemaPath);
  }
}

function findSecret(value, trail = []) {
  if (!object(value) && !Array.isArray(value)) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key) && typeof child === "string" && child !== "") return [...trail, key].join(".");
    const nested = findSecret(child, [...trail, key]);
    if (nested) return nested;
  }
  return undefined;
}

function validateConfig(model, findings) {
  for (const [name, requiredKeys] of Object.entries(CONFIG_SHAPES)) {
    const value = model.config[name];
    const keys = Object.keys(value ?? {});
    for (const key of requiredKeys)
      if (!keys.includes(key)) finding(findings, "config.shape", `${name} is missing ${key}`, `config/${name}`);
    for (const key of keys)
      if (!requiredKeys.includes(key))
        finding(findings, "config.shape", `${name} has unknown top-level field ${key}`, `config/${name}`);
  }
  const workflow = model.config["workflow.v1.json"];
  const nodes = array(workflow.nodes);
  const nodeIds = nodes.map(({ id }) => id);
  if (new Set(nodeIds).size !== nodeIds.length)
    finding(findings, "workflow.unique-nodes", "Workflow node IDs must be unique", "config/workflow.v1.json");
  const gateNumbers = nodes.filter(({ kind }) => kind === "gate").map(({ gateNumber }) => gateNumber);
  if (new Set(gateNumbers).size !== gateNumbers.length)
    finding(findings, "workflow.unique-gates", "Workflow gate numbers must be unique", "config/workflow.v1.json");
  const nodeSet = new Set(nodeIds);
  for (const collection of ["edges", "returnRoutes"]) {
    const identities = new Set();
    for (const edge of array(workflow[collection])) {
      if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to))
        finding(
          findings,
          "workflow.edge-reference",
          `${collection} contains an unknown node reference`,
          "config/workflow.v1.json",
        );
      const identity = JSON.stringify(edge);
      if (identities.has(identity))
        finding(
          findings,
          "workflow.unique-edges",
          `${collection} contains a duplicate edge`,
          "config/workflow.v1.json",
        );
      identities.add(identity);
    }
  }
  for (const node of nodes) {
    const invalidations = array(node.invalidates);
    if (new Set(invalidations).size !== invalidations.length)
      finding(
        findings,
        "workflow.unique-invalidations",
        `${node.id} has duplicate invalidation references`,
        "config/workflow.v1.json",
      );
    for (const invalidated of invalidations)
      if (!nodeSet.has(invalidated))
        finding(
          findings,
          "workflow.invalidation-reference",
          `${node.id} invalidates unknown node ${invalidated}`,
          "config/workflow.v1.json",
        );
  }
  const conditions = JSON.stringify(workflow).match(/"(all|equals|in|exists|not)"\s*:/g) ?? [];
  const allowedOperators = new Set(array(workflow.determinism?.conditionOperators));
  for (const condition of conditions)
    if (!allowedOperators.has(condition.match(/"([^"]+)"/)[1]))
      finding(findings, "workflow.condition", `Undeclared condition operator ${condition}`, "config/workflow.v1.json");
  if (!["bicep", "terraform"].every((track) => array(workflow.runModel?.iacTracks).includes(track)))
    finding(findings, "workflow.tracks", "Workflow must declare both IaC tracks", "config/workflow.v1.json");
  const gate4 = array(workflow.promotion?.gateRules).find(({ gates }) => array(gates).includes(4));
  if (!gate4 || gate4.inheritance !== "never")
    finding(
      findings,
      "workflow.gate4-inheritance",
      "Gate 4 must never be inherited during promotion",
      "config/workflow.v1.json",
    );
  const secret = findSecret(model.config["defaults.v1.json"]);
  if (secret)
    finding(
      findings,
      "defaults.secret",
      `Defaults contains a secret-like value at ${secret}`,
      "config/defaults.v1.json",
    );
  const runtime = model.config["runtime-bundle.v1.json"];
  for (const packageName of ["cli", "contracts", "kernel", "capabilities", "renderers"])
    if (runtime.components?.[packageName]?.version !== model.packages[packageName].manifest.version)
      finding(
        findings,
        "runtime.version",
        `Runtime ${packageName} version does not match its package`,
        "config/runtime-bundle.v1.json",
      );
  if (runtime.components?.customizationBundle?.version !== model.customization.manifest.version)
    finding(
      findings,
      "runtime.version",
      "Runtime customization bundle version does not match its manifest",
      "config/runtime-bundle.v1.json",
    );
  const scorecard = model.config["quality-scorecard.v1.json"];
  const metrics = new Set();
  for (const rule of array(scorecard.rules)) {
    for (const key of [
      "metric",
      "direction",
      "target",
      "tolerance",
      "scenario",
      "minimumSamples",
      "source",
      "owner",
      "unavailable",
    ])
      if (!(key in rule))
        finding(findings, "scorecard.shape", `Scorecard rule is missing ${key}`, "config/quality-scorecard.v1.json");
    if (
      metrics.has(rule.metric) ||
      !["min", "max", "exact"].includes(rule.direction) ||
      typeof rule.target !== "number" ||
      typeof rule.tolerance !== "number"
    )
      finding(
        findings,
        "scorecard.mechanical",
        `Scorecard rule ${rule.metric ?? "<unknown>"} is not mechanically decidable`,
        "config/quality-scorecard.v1.json",
      );
    metrics.add(rule.metric);
  }
  const packs = model.config["capability-packs.v1.json"];
  const packIds = new Set();
  for (const pack of array(packs.packs)) {
    if (!pack.id || packIds.has(pack.id))
      finding(
        findings,
        "capability-pack.id",
        `Capability pack ID ${pack.id ?? "<missing>"} is invalid`,
        "config/capability-packs.v1.json",
      );
    packIds.add(pack.id);
    for (const workflowId of array(pack.requiredWorkflows))
      if (!nodeSet.has(workflowId))
        finding(
          findings,
          "capability-pack.workflow",
          `Capability pack ${pack.id} references unknown workflow ${workflowId}`,
          "config/capability-packs.v1.json",
        );
  }
}

function validateCustomizations(model, findings) {
  const customization = model.customization;
  const expectedFiles = new Set([
    ...customization.agents.map(({ path: file }) => file),
    ...customization.skills.map(({ path: file }) => file),
    ".github/copilot-instructions.md",
    ".vscode/mcp.json",
  ]);
  const managedFiles = array(customization.manifest.managedFiles);
  if (
    managedFiles.length !== new Set(managedFiles).size ||
    managedFiles.some((file) => !expectedFiles.has(file)) ||
    [...expectedFiles].some((file) => !managedFiles.includes(file))
  )
    finding(
      findings,
      "customization.coverage",
      "Managed-file manifest must exactly cover agents, skills, instructions, and MCP config",
      "customizations/manifest.json",
    );
  const roles = new Map(array(customization.manifest.roles).map((role) => [role.agent, role]));
  const agents = new Map(customization.agents.map((agent) => [agent.frontmatter?.name, agent]));
  const allowedMcp = new Set(model.mcpTools.map((tool) => `apex/${tool}`));
  for (const skill of customization.skills)
    if (!skill.frontmatter?.name || !skill.frontmatter?.description)
      finding(
        findings,
        "customization.frontmatter",
        `${skill.path} needs name and description frontmatter`,
        skill.path,
      );
  for (const [name, agent] of agents) {
    const frontmatter = agent.frontmatter;
    const role = roles.get(name);
    if (
      !frontmatter ||
      !name ||
      !frontmatter.description ||
      !array(frontmatter.model).length ||
      typeof frontmatter["user-invocable"] !== "boolean"
    )
      finding(findings, "customization.frontmatter", `${agent.path} has incomplete frontmatter`, agent.path);
    if (!role)
      finding(findings, "customization.role-reference", `${name} has no manifest role`, "customizations/manifest.json");
    if (role && (!array(frontmatter.model).includes(role.model) || !(role.costTier in COST_TIERS)))
      finding(
        findings,
        "customization.model-role",
        `${name} frontmatter model or cost tier disagrees with its manifest role`,
        agent.path,
      );
    const interactive = role?.interactionType === "interactive-handoff";
    if (interactive && frontmatter["user-invocable"] !== true)
      finding(findings, "customization.interactive", `${name} must be user-invocable`, agent.path);
    if (
      !interactive &&
      (frontmatter["user-invocable"] !== false || array(frontmatter.tools).includes("vscode/askQuestions"))
    )
      finding(
        findings,
        "customization.subagent-questions",
        `${name} is autonomous and cannot ask questions or be user-invocable`,
        agent.path,
      );
    for (const tool of array(frontmatter.tools)) {
      if (tool === "agent" || tool === "vscode/askQuestions") continue;
      if (FORBIDDEN_TOOL.test(tool))
        finding(findings, "customization.forbidden-tool", `${name} references forbidden tool ${tool}`, agent.path);
      else if (!allowedMcp.has(tool))
        finding(findings, "customization.mcp-tool", `${name} references unknown MCP tool ${tool}`, agent.path);
    }
    for (const handoff of array(frontmatter.handoffs)) {
      if (
        !agents.has(handoff.agent) ||
        !/\bInput:/i.test(handoff.prompt ?? "") ||
        !/\bOutput:/i.test(handoff.prompt ?? "")
      )
        finding(
          findings,
          "customization.handoff",
          `${name} has an invalid handoff to ${handoff.agent ?? "<missing>"}`,
          agent.path,
        );
    }
    for (const child of array(frontmatter.agents))
      if (!agents.has(child))
        finding(findings, "customization.agent-reference", `${name} references unknown child ${child}`, agent.path);
  }
  for (const roleName of roles.keys())
    if (!agents.has(roleName))
      finding(
        findings,
        "customization.role-reference",
        `Manifest role ${roleName} has no agent`,
        "customizations/manifest.json",
      );
  for (const edge of array(customization.manifest.invocationEdges)) {
    const parent = roles.get(edge.from);
    const child = roles.get(edge.to);
    if (!parent || !child || !["handoff", "subagent"].includes(edge.type)) {
      finding(
        findings,
        "customization.edge-reference",
        `Invalid invocation edge ${edge.from} -> ${edge.to}`,
        "customizations/manifest.json",
      );
      continue;
    }
    const requiresHandoff =
      child.interactionType === "interactive-handoff" || COST_TIERS[child.costTier] > COST_TIERS[parent.costTier];
    if (requiresHandoff && edge.type !== "handoff")
      finding(
        findings,
        "customization.model-escalation",
        `${edge.from} -> ${edge.to} must be a handoff`,
        "customizations/manifest.json",
      );
    if (edge.type === "subagent" && COST_TIERS[child.costTier] > COST_TIERS[parent.costTier])
      finding(
        findings,
        "customization.model-escalation",
        `Subagent ${edge.to} exceeds parent ${edge.from} cost tier`,
        "customizations/manifest.json",
      );
  }
  const referencedTools = new Set(
    customization.agents.flatMap(({ frontmatter }) =>
      array(frontmatter?.tools).filter((tool) => tool.startsWith("apex/")),
    ),
  );
  for (const tool of referencedTools)
    if (!allowedMcp.has(tool))
      finding(
        findings,
        "customization.mcp-tool",
        `Referenced MCP tool ${tool} is not registered`,
        "packages/cli/src/mcp.ts",
      );
  const unsafeMcpTools = new Set(["deploy", "gateDecide", "preview", "reconcile"]);
  for (const tool of unsafeMcpTools)
    if (model.mcpTools.includes(tool) && !referencedTools.has(`apex/${tool}`))
      finding(
        findings,
        "customization.unreferenced-unsafe-tool",
        `Unsafe MCP tool apex/${tool} is not assigned to an agent`,
        "packages/cli/src/mcp.ts",
      );
}

function validateMcp(model, findings) {
  const servers = model.customization.mcp.servers;
  const apex = servers && Object.keys(servers).length === 1 ? servers.apex : undefined;
  if (
    !apex ||
    apex.type !== "stdio" ||
    apex.command !== "node" ||
    JSON.stringify(apex.args) !==
      JSON.stringify(["${workspaceFolder}/node_modules/@apex/cli/dist/cli.js", "mcp", "serve"]) ||
    apex.cwd !== "${workspaceFolder}" ||
    (apex.env && Object.keys(apex.env).length > 0)
  )
    finding(
      findings,
      "mcp.launch",
      "Managed MCP config must launch the workspace-local APEX CLI through Node without environment secrets",
      "customizations/.vscode/mcp.json",
    );
}

export function generateManagedFileHashInventory(model) {
  const base = path.join(model.root, "customizations");
  return Object.fromEntries(
    array(model.customization.manifest.managedFiles).map((managedPath) => {
      const absolute = path.resolve(base, managedPath);
      const inside = absolute.startsWith(`${path.resolve(base)}${path.sep}`);
      if (
        !inside ||
        !existsSync(absolute) ||
        lstatSync(absolute).isSymbolicLink() ||
        !realpathSync(absolute).startsWith(`${realpathSync(base)}${path.sep}`)
      )
        throw new Error(`Unsafe managed path: ${managedPath}`);
      return [managedPath, createHash("sha256").update(readFileSync(absolute)).digest("hex")];
    }),
  );
}

function validateManagedPaths(model, findings) {
  try {
    generateManagedFileHashInventory(model);
  } catch (error) {
    finding(findings, "managed-path.safety", error.message, "customizations/manifest.json");
  }
}

function validateSourceBoundaries(model, findings) {
  for (const source of model.sources) {
    for (const match of source.content.matchAll(SOURCE_IMPORT)) {
      const imported = match[1];
      if (imported.includes("/tools/") && !imported.includes("capability-pack"))
        finding(findings, "source.v1-import", `${source.path} imports v1 implementation ${imported}`, source.path);
    }
  }
}

function validateDeferredPlan(model, findings) {
  if (!/plugin packaging is an optional convenience/i.test(model.plan))
    finding(
      findings,
      "plan.deferred",
      "Plan must keep plugin packaging optional",
      ".github/prompts/plan-buildApexVnext.prompt.md",
    );
  if (model.packages.plugin || model.packages["copilot-cli"])
    finding(findings, "plan.deferred", "Deferred plugin or Copilot CLI package must not be mandatory");
  for (const { manifest } of Object.values(model.packages))
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }))
      if (/copilot.*cli|plugin/i.test(dependency))
        finding(findings, "plan.deferred", `Deferred dependency ${dependency} must not be mandatory`);
}

export function validateRepositoryModel(model) {
  const findings = [];
  validateCiLintPrerequisites(model, findings);
  validatePackages(model, findings);
  validateContracts(model, findings);
  validateConfig(model, findings);
  validateCustomizations(model, findings);
  validateMcp(model, findings);
  validateManagedPaths(model, findings);
  validateSourceBoundaries(model, findings);
  validateDeferredPlan(model, findings);
  return { ok: findings.length === 0, errors: findings.length, findings };
}

export function runSchemaCheck(root, quiet = false) {
  execFileSync("npm", ["run", "schemas:check", "--workspace", "@apex/contracts"], {
    cwd: root,
    stdio: quiet ? "pipe" : "inherit",
  });
}

function parseArguments(argv) {
  return {
    json: argv.includes("--json"),
    schemaCheck: !argv.includes("--no-schema-check"),
    hashes: argv.includes("--hashes"),
  };
}

function report(result, options, hashes) {
  if (options.json) {
    console.log(JSON.stringify({ ...result, ...(hashes ? { managedFileHashes: hashes } : {}) }, null, 2));
    return;
  }
  for (const item of result.findings)
    console.error(`❌ [${item.ruleId}]${item.file ? ` ${item.file}:` : ""} ${item.message}`);
  if (result.ok) console.log("✅ APEX vNext validation passed");
  else console.error(`❌ APEX vNext validation failed with ${result.errors} error(s)`);
  if (hashes) console.log(JSON.stringify(hashes, null, 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const options = parseArguments(process.argv.slice(2));
  let result;
  let model;
  try {
    model = loadRepositoryModel(process.cwd());
    result = validateRepositoryModel(model);
    if (options.schemaCheck) runSchemaCheck(model.root, options.json);
  } catch (error) {
    result = {
      ok: false,
      errors: 1,
      findings: [{ severity: "error", ruleId: "validator.runtime", message: error.message }],
    };
  }
  const hashes = options.hashes && model ? generateManagedFileHashInventory(model) : undefined;
  report(result, options, hashes);
  process.exit(result.ok ? 0 : 1);
}

export { clone };
