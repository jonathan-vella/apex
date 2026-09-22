import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

function verifyIgnoredResources(changes, expected, records, tool) {
  if (!Array.isArray(records)) throw new Error("Ignored evidence resources must be an array");
  if (records.length && (tool !== "bicep" || !expected))
    throw new Error("Ignored evidence requires Bicep expected IDs");
  const verified = new Map();
  const lower = (value) => (typeof value === "string" ? value.toLowerCase() : "");
  for (const record of records) {
    const id = lower(record?.resource_id);
    const owner = lower(record?.owner_id);
    const change = changes.find((item) => lower(item.id) === id);
    if (
      !id ||
      !owner ||
      /[*?]/.test(id + owner) ||
      verified.has(id) ||
      expected.includes(id) ||
      !expected.includes(owner) ||
      change?.action !== "Ignore" ||
      Object.hasOwn(change, "unsupportedReason") ||
      typeof record.reason !== "string" ||
      !record.reason.trim()
    ) {
      throw new Error(
        "Ignored evidence must identify a unique unexpected Ignore ID and an approved parent with a reason",
      );
    }
    const observation = record.observation;
    let linked = false;
    if (record.relationship === "private-endpoint-nic") {
      linked =
        /\/providers\/microsoft\.network\/privateendpoints\/[^/]+$/.test(owner) &&
        /\/providers\/microsoft\.network\/networkinterfaces\/[^/]+$/.test(id) &&
        lower(observation?.id) === owner &&
        (observation.networkInterfaces ?? observation.properties?.networkInterfaces)?.some(
          (nic) => lower(nic.id) === id,
        );
    } else if (record.relationship === "sql-system-database") {
      linked =
        /\/providers\/microsoft\.sql\/servers\/[^/]+$/.test(owner) &&
        id === `${owner}/databases/master` &&
        lower(observation?.id) === id &&
        lower(observation?.name) === "master";
    } else if (record.relationship === "storage-system-topic") {
      linked =
        /\/providers\/microsoft\.storage\/storageaccounts\/[^/]+$/.test(owner) &&
        /\/providers\/microsoft\.eventgrid\/systemtopics\/[^/]+$/.test(id) &&
        lower(observation?.id) === id &&
        lower(observation?.properties?.source) === owner &&
        lower(observation?.properties?.topicType) === "microsoft.storage.storageaccounts";
    }
    if (!linked) throw new Error(`Ignored resource relationship is not established: ${record.relationship}`);
    verified.set(id, {
      resource_id: record.resource_id,
      owner_id: record.owner_id,
      relationship: record.relationship,
      reason: record.reason,
    });
  }
  return verified;
}

export function summarizePreview(data, tool = "bicep", expectedIds, ignoredRecords = []) {
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
      return {
        id: change.resourceId,
        action: change.changeType,
        ...(change.unsupportedReason !== undefined && change.unsupportedReason !== null
          ? { unsupportedReason: change.unsupportedReason }
          : {}),
      };
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
  const ignored = verifyIgnoredResources(changes, expected, ignoredRecords, tool);
  if (ignored.size) {
    counts.unknown -= ignored.size;
    counts.ignored = ignored.size;
  }
  const coverage = {
    verified: expected !== undefined,
    missing: expected?.filter((id) => !ids.includes(id)) ?? [],
    unexpected: expected ? ids.filter((id) => !expected.includes(id) && !ignored.has(id)) : [],
    accounted_ignored: [...ignored.values()],
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

export function readPreviewEvidence(inputPath, tool, expectedPath, ignoredPath) {
  const read = (file) => {
    if (!fs.lstatSync(file).isFile()) throw new Error("Evidence must be a regular file");
    const raw = fs.readFileSync(file, "utf8");
    return { value: JSON.parse(raw), sha256: createHash("sha256").update(raw).digest("hex") };
  };
  const input = read(inputPath);
  const expected = expectedPath ? read(expectedPath) : undefined;
  const ignored = ignoredPath ? read(ignoredPath) : undefined;
  let records = [];
  if (ignored) {
    const document = ignored.value;
    if (
      tool !== "bicep" ||
      !expected ||
      document?.schema_version !== "preview-ignored-evidence-v1" ||
      document.preview_sha256 !== input.sha256 ||
      document.expected_ids_sha256 !== expected.sha256 ||
      !Array.isArray(document.resources) ||
      !document.resources.length
    ) {
      throw new Error("Ignored evidence must bind the exact preview and expected-ID file hashes");
    }
    records = document.resources.map((record) => {
      if (
        typeof record?.evidence?.path !== "string" ||
        !record.evidence.path ||
        !/^[a-f0-9]{64}$/.test(record.evidence.sha256)
      )
        throw new Error("Observation path and SHA-256 required");
      const base = fs.realpathSync(path.dirname(path.resolve(ignoredPath)));
      const observationPath = path.resolve(base, record.evidence.path);
      const relative = path.relative(base, fs.realpathSync(observationPath));
      if (
        path.isAbsolute(record.evidence.path) ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      )
        throw new Error("Observation must remain inside the evidence bundle");
      const observation = read(observationPath);
      if (observation.sha256 !== record.evidence.sha256) throw new Error("Ignored observation hash mismatch");
      return { ...record, observation: observation.value };
    });
  }
  return {
    ...summarizePreview(input.value, tool, expected?.value, records),
    input_sha256: input.sha256,
    expected_ids_sha256: expected?.sha256 ?? null,
    ignored_evidence_sha256: ignored?.sha256 ?? null,
  };
}

export function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string" },
      tool: { type: "string", default: "bicep" },
      "expected-ids": { type: "string" },
      "ignored-evidence": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: summarize-deployment-preview.mjs --input <raw-json> --tool bicep|terraform [--expected-ids <json-array>] [--ignored-evidence <bound-json>]",
    );
    return 0;
  }
  if (!values.input) throw new Error("--input is required; formatted text is not preview evidence");
  const result = readPreviewEvidence(values.input, values.tool, values["expected-ids"], values["ignored-evidence"]);
  console.log(JSON.stringify(result, null, 2));
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
