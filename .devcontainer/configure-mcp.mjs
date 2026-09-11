import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, modify } from "jsonc-parser";
import { parseJsonc } from "../tools/scripts/_lib/parse-jsonc.mjs";

const defaults = {
  github: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
  "azure-resource-manager-mcp": {
    type: "http",
    url: "https://mcp.management.azure.com",
    headers: { "x-mcp-toolset": "CostManagement, Pricing" },
  },
  "azure-mcp": { type: "stdio", command: "npx", args: ["-y", "@azure/mcp@latest", "server", "start"] },
};

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
  configureMcp(path.resolve(process.argv[2] ?? ".vscode/mcp.json"));
}
