import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = new Set([
  "project",
  "subscription_id",
  "tenant_id",
  "primary_region",
  "deployer_object_id",
  "sql_admin_object_id",
  "sql_admin_login",
  "sql_admin_principal_type",
  "tags",
  "alert_emails",
  "budget_monthly_usd",
]);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const usable = (value) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  !(typeof value === "string" && /^(?:0{8}-0{4}-0{4}-0{4}-0{12}|<.*>|redacted|placeholder|tbd)$/i.test(value));
const validId = (value) => typeof value === "string" && GUID.test(value) && usable(value);

export function resolveDeploymentInputs(input) {
  if (!isObject(input) || !Array.isArray(input.required) || input.required.some((field) => !FIELDS.has(field))) {
    throw new Error("Input requires an explicit list of supported required fields");
  }
  const environment = input.manifest?.environments?.[input.environment] ?? {};
  const approved = input.approved ?? {};
  const discovery = input.discovery ?? {};
  const expected = input.expected_context ?? {};
  const values = {};
  const provenance = {};
  const conflicts = [];
  const missing = [];
  const group = discovery.sql_group;
  const principal = discovery.principal;
  const discovered = {
    subscription_id: discovery.account?.subscription_id,
    tenant_id: discovery.account?.tenant_id,
    deployer_object_id:
      ["User", "ServicePrincipal", "ManagedIdentity"].includes(principal?.type) &&
      principal?.tenant_id?.toLowerCase() === expected.tenant_id?.toLowerCase()
        ? principal?.object_id
        : undefined,
  };
  const manifestValues = {
    ...environment,
    project: input.manifest?.project,
    sql_admin_object_id: environment.principal_ids?.sql_admin,
  };
  for (const field of input.required) {
    const candidates = [
      ["approved", approved[field]],
      ["manifest", manifestValues[field]],
    ];
    if (input.mode !== "manual") candidates.push(["discovery", discovered[field]]);
    const match = candidates.find(([, value]) => usable(value));
    if (match) {
      values[field] = match[1];
      provenance[field] = match[0];
    }
  }
  for (const field of ["subscription_id", "tenant_id"]) {
    if (!validId(expected[field]) || !validId(discovery.account?.[field])) {
      conflicts.push(`${field}: approved governance context and active account evidence required`);
    } else if (
      expected[field].toLowerCase() !== discovery.account[field].toLowerCase() ||
      (values[field] && String(values[field]).toLowerCase() !== expected[field].toLowerCase())
    ) {
      conflicts.push(`${field}: active, approved and governance scopes must match`);
    }
  }
  if (group && values.sql_admin_object_id) {
    if (
      !validId(group.id) ||
      group.id.toLowerCase() !== String(values.sql_admin_object_id).toLowerCase() ||
      group.securityEnabled !== true ||
      group.tenant_id?.toLowerCase() !== expected.tenant_id?.toLowerCase()
    ) {
      conflicts.push("sql_admin_object_id: verified security group must match approved ID and tenant");
    } else {
      for (const [field, value] of [
        ["sql_admin_login", group.displayName],
        ["sql_admin_principal_type", "Group"],
      ]) {
        if (!input.required.includes(field)) continue;
        if (values[field] && values[field] !== value) conflicts.push(`${field}: conflicts with verified group`);
        else {
          values[field] = value;
          provenance[field] = "verified-group";
        }
      }
    }
  } else if (input.required.includes("sql_admin_object_id") && values.sql_admin_object_id) {
    conflicts.push("sql_admin_object_id: read-only group verification required");
  }
  if (
    values.deployer_object_id &&
    (!validId(discovered.deployer_object_id) ||
      String(values.deployer_object_id).toLowerCase() !== discovered.deployer_object_id.toLowerCase())
  ) {
    conflicts.push("deployer_object_id: authenticated principal verification required; client ID is not object ID");
  }
  for (const field of input.required) {
    const value = values[field];
    if (!usable(value)) {
      missing.push(field);
      continue;
    }
    if (field.endsWith("_id") && !validId(value)) conflicts.push(`${field}: valid non-placeholder object ID required`);
    if (
      ["project", "primary_region", "sql_admin_login"].includes(field) &&
      (typeof value !== "string" || !value.trim())
    )
      conflicts.push(`${field}: nonempty string required`);
    if (field === "sql_admin_principal_type" && value !== "Group") conflicts.push(`${field}: Group required`);
    if (field === "budget_monthly_usd" && (!Number.isFinite(value) || value <= 0))
      conflicts.push(`${field}: positive number required`);
    if (
      field === "alert_emails" &&
      (!Array.isArray(value) ||
        !value.length ||
        value.some(
          (email) =>
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            /[<>(),:;]/.test(email) ||
            email.includes("[") ||
            email.includes("]"),
        ))
    ) {
      conflicts.push(`${field}: plain email addresses required, not Markdown links`);
    }
    if (field === "tags") {
      if (!isObject(value) || Object.values(value).some((tag) => typeof tag !== "string" || !usable(tag))) {
        conflicts.push("tags: approved string values required");
      }
      for (const key of input.required_tag_keys ?? []) {
        if (!usable(value?.[key])) missing.push(`tags.${key}`);
      }
      if (value?.SecurityControl === "Ignore" && input.security_control_exception_approved !== true) {
        conflicts.push("tags.SecurityControl: exception effect and separate approval required");
      }
    }
  }
  const questions = [...new Set([...missing, ...conflicts])];
  return { status: questions.length ? "BLOCKED" : "RESOLVED", values, provenance, missing, conflicts, questions };
}

export function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string" },
      "include-values": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log("Usage: resolve-deployment-inputs.mjs --input <approved-discovery-snapshot.json> [--include-values]");
    return 0;
  }
  if (!values.input) throw new Error("--input is required; this command performs no discovery or mutations");
  const result = resolveDeploymentInputs(JSON.parse(fs.readFileSync(values.input, "utf8")));
  const { values: resolved, ...report } = result;
  console.log(
    JSON.stringify(
      values["include-values"] && result.status === "RESOLVED" ? { ...report, values: resolved } : report,
      null,
      2,
    ),
  );
  return result.status === "RESOLVED" ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
