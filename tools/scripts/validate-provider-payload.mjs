import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export function validateProviderPayload(resources, options = {}) {
  if (!Array.isArray(resources) || !resources.length) throw new Error("Expected a nonempty resolved resource array");
  const errors = [];
  const unverified = [];
  let checked = 0;
  for (const resource of resources) {
    if (!resource || typeof resource !== "object" || Array.isArray(resource) || typeof resource.type !== "string") {
      throw new Error("Each extracted resource requires an explicit provider type");
    }
    const type = resource.type?.toLowerCase();
    if (type === "microsoft.web/serverfarms") {
      checked++;
      const properties = resource.properties ?? {};
      if (typeof properties.isCustomMode === "string") unverified.push("App Service Plan custom mode is unresolved");
      if (properties.network && properties.isCustomMode !== true) {
        errors.push(
          "Ordinary App Service Plans must not receive network/subnet properties; do not enable custom mode as a workaround",
        );
      }
      if (
        resource.identity &&
        (typeof resource.identity !== "object" ||
          !["None", "SystemAssigned", "UserAssigned", "SystemAssigned, UserAssigned"].includes(resource.identity.type))
      ) {
        unverified.push("App Service Plan identity requires a resolved provider-supported shape");
      }
    }
    if (type === "microsoft.sql/servers/databases") {
      checked++;
      const sku = resource.sku;
      if (!sku || typeof sku.name !== "string" || sku.name.startsWith("[")) {
        unverified.push("SQL SKU is unresolved");
        continue;
      }
      if (sku.name.toUpperCase() !== "S2") continue;
      const size = resource.properties?.maxSizeBytes;
      if (!Number.isSafeInteger(size) || size <= 0) {
        unverified.push("S2 maxSizeBytes must be explicit and resolved; verify the pinned AVM default");
      } else if (size === 34359738368) {
        errors.push("S2 32-GiB default matches the captured InvalidMaxSizeTierCombination failure");
      }
      if (!Number.isSafeInteger(options.s2MaxSizeBytes) || options.s2MaxSizeBytes <= 0) {
        unverified.push("S2 requires an approved byte-size value backed by current target-region capability evidence");
      } else if (size !== options.s2MaxSizeBytes) {
        errors.push("S2 maxSizeBytes differs from the approved capability-backed byte-size value");
      }
    }
  }
  if (!checked) unverified.push("No supported provider regression targets were checked");
  return {
    checked,
    errors,
    unverified,
    passed: !errors.length && !unverified.length,
    limitation: "Bounded known-regression checks, not complete provider validation or deployment acceptance",
  };
}

export function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: { input: { type: "string" }, "s2-max-bytes": { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help) {
    console.log(
      "Usage: validate-provider-payload.mjs --input <resolved-resources.json> [--s2-max-bytes <approved-bytes>]",
    );
    return 0;
  }
  if (!values.input) throw new Error("--input is required; extract concrete resources with source provenance first");
  const result = validateProviderPayload(JSON.parse(fs.readFileSync(values.input, "utf8")), {
    s2MaxSizeBytes: values["s2-max-bytes"] === undefined ? undefined : Number(values["s2-max-bytes"]),
  });
  console.log(JSON.stringify(result, null, 2));
  return result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
