import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

export function summarizePreview(data, tool = "bicep", expectedIds) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Preview must be a JSON object");
  const counts = { creates: 0, updates: 0, destroys: 0, replaces: 0, no_change: 0, unknown: 0 };
  let diagnostics = [];
  let potentialChanges = [];
  let changes;
  if (tool === "bicep") {
    if (
      data.properties &&
      (["changes", "diagnostics", "potentialChanges"].some((key) => Object.hasOwn(data, key)) ||
        (data.status !== undefined && data.properties.status !== undefined && data.status !== data.properties.status))
    )
      throw new Error("Ambiguous preview response shape");
    const payload = data.properties ?? data;
    if (
      (payload.status ?? data.status) !== "Succeeded" ||
      data.error ||
      payload.error ||
      !Array.isArray(payload.changes)
    ) {
      throw new Error("Bicep preview must have Succeeded status, no error and a changes array");
    }
    diagnostics = payload.diagnostics ?? [];
    potentialChanges = payload.potentialChanges ?? [];
    if (!Array.isArray(diagnostics) || !Array.isArray(potentialChanges)) throw new Error("Invalid coverage arrays");
    changes = payload.changes.map((change) => {
      if (
        typeof change.resourceId !== "string" ||
        !change.resourceId.startsWith("/subscriptions/") ||
        typeof change.changeType !== "string"
      )
        throw new Error("Invalid what-if change record");
      const key = { Create: "creates", Modify: "updates", Delete: "destroys", NoChange: "no_change" }[
        change.changeType
      ];
      counts[key ?? "unknown"]++;
      return { id: change.resourceId, action: change.changeType };
    });
  } else if (tool === "terraform") {
    if (
      ["complete", "errored"].some((key) => Object.hasOwn(data, key) && typeof data[key] !== "boolean") ||
      (Object.hasOwn(data, "deferred_changes") && !Array.isArray(data.deferred_changes))
    ) {
      throw new Error("Invalid Terraform completeness/error evidence");
    }
    if (data.errored === true || typeof data.format_version !== "string" || !Array.isArray(data.resource_changes)) {
      throw new Error("Terraform preview requires format_version and resource_changes; errored plans are invalid");
    }
    if (data.complete === false || data.deferred_changes?.length) potentialChanges.push("Terraform plan incomplete");
    changes = data.resource_changes.map((change) => {
      const actions = change.change?.actions;
      if (typeof change.address !== "string" || !Array.isArray(actions) || !actions.length) {
        throw new Error("Invalid Terraform change record");
      }
      const key = {
        create: "creates",
        update: "updates",
        delete: "destroys",
        "no-op": "no_change",
        read: "no_change",
        "delete,create": "replaces",
        "create,delete": "replaces",
      }[actions.join(",")];
      counts[key ?? "unknown"]++;
      return { id: change.address, action: actions.join(",") };
    });
  } else throw new Error("--tool must be bicep or terraform");
  const normalize = (id) => (tool === "bicep" ? id.toLowerCase() : id);
  const ids = changes.map((change) => normalize(change.id));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate preview resource identity");
  if (expectedIds !== undefined && (!Array.isArray(expectedIds) || expectedIds.some((id) => typeof id !== "string"))) {
    throw new Error("Expected identities must be an explicit array of approved resource IDs/addresses");
  }
  const expected = expectedIds?.map(normalize);
  const coverage = {
    verified: expected !== undefined,
    missing: expected?.filter((id) => !ids.includes(id)) ?? [],
    unexpected: expected ? ids.filter((id) => !expected.includes(id)) : [],
  };
  coverage.verified &&= coverage.missing.length === 0 && coverage.unexpected.length === 0;
  const violations = diagnostics.filter((item) => /policy/i.test(item.code ?? "")).length;
  const errors = diagnostics.some((item) => /error/i.test(item.level ?? item.severity ?? ""));
  return {
    counts,
    changes,
    diagnostics,
    potentialChanges,
    coverage,
    policy_violations: violations,
    verdict:
      errors || violations
        ? "BLOCKED"
        : counts.unknown ||
            counts.destroys ||
            counts.replaces ||
            diagnostics.length ||
            potentialChanges.length ||
            !coverage.verified
          ? "REVIEW"
          : "PASS",
    deployment_authorized: false,
  };
}

export function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string" },
      tool: { type: "string", default: "bicep" },
      "expected-ids": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: summarize-deployment-preview.mjs --input <raw-json> --tool bicep|terraform [--expected-ids <json-array>]",
    );
    return 0;
  }
  if (!values.input) throw new Error("--input is required; formatted text is not preview evidence");
  const raw = fs.readFileSync(values.input, "utf8");
  const expected = values["expected-ids"] ? JSON.parse(fs.readFileSync(values["expected-ids"], "utf8")) : undefined;
  const result = summarizePreview(JSON.parse(raw), values.tool, expected);
  console.log(JSON.stringify({ ...result, input_sha256: createHash("sha256").update(raw).digest("hex") }, null, 2));
  return result.verdict === "PASS" ? 0 : result.verdict === "REVIEW" ? 2 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
