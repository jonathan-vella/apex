import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { applyEdits, modify } from "jsonc-parser";
import { parseJsonc } from "../tools/scripts/_lib/parse-jsonc.mjs";

const defaults = {
  github: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
  "azure-resource-manager-mcp": {
    type: "http",
    url: "https://mcp.management.azure.com",
    headers: { "x-mcp-toolset": "CostManagement, Pricing" },
  },
  "azure-mcp": {
    type: "stdio",
    command: "npx",
    args: ["-y", "@azure/mcp@2.0.5", "server", "start"],
    env: { NPM_CONFIG_ALLOW_REMOTE: "all" },
  },
};

export function azureMcpReleaseStatus(config, versions) {
  const stablePattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  if (!Array.isArray(versions) || !versions.every((version) => typeof version === "string")) {
    throw new Error("Registry versions must be an array of strings");
  }
  const stable = versions
    .filter((version) => stablePattern.test(version))
    .sort((left, right) => {
      const leftParts = left.split(".").map(Number);
      const rightParts = right.split(".").map(Number);
      return leftParts[0] - rightParts[0] || leftParts[1] - rightParts[1] || leftParts[2] - rightParts[2];
    });
  const latestStable = stable.at(-1);
  if (!latestStable) throw new Error("Registry returned no stable Azure MCP release");
  const server = config?.servers?.["azure-mcp"];
  const packages = Array.isArray(server?.args)
    ? server.args.filter((arg) => typeof arg === "string" && arg.startsWith("@azure/mcp@"))
    : [];
  if (server?.command !== "npx" || packages.length !== 1) {
    throw new Error("Release check requires an explicit @azure/mcp version in the npx configuration");
  }
  const configured = packages[0].slice("@azure/mcp@".length);
  if (!stablePattern.test(configured))
    throw new Error("Azure MCP must use an exact stable version, not a tag or prerelease");
  const defaultVersion = defaults["azure-mcp"].args[1].slice("@azure/mcp@".length);
  return {
    configured,
    defaultVersion,
    latestStable,
    status: configured === latestStable && defaultVersion === configured ? "CURRENT" : "UPDATE_REQUIRED",
  };
}

export function checkAzureMcpRelease(
  filename,
  query = () =>
    execFileSync("npm", ["view", "@azure/mcp", "versions", "--json"], {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
    }),
) {
  const config = parseJsonc(fs.readFileSync(filename, "utf8"));
  return azureMcpReleaseStatus(config, JSON.parse(query()));
}

export function configureMcp(filename) {
  const original = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "{}\n";
  const config = parseJsonc(original);
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!isObject(config) || (Object.hasOwn(config, "servers") && !isObject(config.servers))) {
    throw new Error("MCP configuration and servers must be objects; file left unchanged");
  }
  let updated = original;
  for (const [name, server] of Object.entries(defaults)) {
    if (Object.hasOwn(config.servers ?? {}, name)) continue;
    updated = applyEdits(
      updated,
      modify(updated, ["servers", name], server, {
        formattingOptions: { insertSpaces: true, tabSize: 2, eol: original.includes("\r\n") ? "\r\n" : "\n" },
      }),
    );
  }
  if (updated !== original) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, updated);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--help") {
    console.log(
      "Usage: node .devcontainer/configure-mcp.mjs [mcp.json]\n" +
        "       node .devcontainer/configure-mcp.mjs --check-release [mcp.json]\n" +
        "Release checks query the configured npm registry, never write config, and exit 1 on outdated or unknown state.",
    );
  } else if (process.argv[2] === "--check-release") {
    try {
      const result = checkAzureMcpRelease(path.resolve(process.argv[3] ?? ".vscode/mcp.json"));
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.status === "CURRENT" ? 0 : 1;
    } catch (error) {
      console.error(`Azure MCP release check failed: ${error.message}`);
      process.exitCode = 1;
    }
  } else {
    configureMcp(path.resolve(process.argv[2] ?? ".vscode/mcp.json"));
  }
}
