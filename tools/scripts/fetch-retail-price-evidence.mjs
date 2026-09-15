import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

const ENDPOINT = "https://prices.azure.com/api/retail/prices";
const FILTERS = ["serviceName", "armSkuName", "armRegionName", "meterName", "priceType"];
const QUERY_KEYS = [...FILTERS, "currencyCode"];

function validateQuery(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) throw new Error("query must be an object");
  for (const [key, value] of Object.entries(query)) {
    if (
      !QUERY_KEYS.includes(key) ||
      typeof value !== "string" ||
      value.length > 200 ||
      [...value].some((character) => character.charCodeAt(0) < 32)
    ) {
      throw new Error(`Invalid query field: ${key}`);
    }
  }
  if (!query.serviceName?.trim() || query.priceType !== "Consumption" || !/^[A-Z]{3}$/.test(query.currencyCode ?? "")) {
    throw new Error("Explicit serviceName, Consumption priceType and currencyCode are required");
  }
}

export function retailQueryUrl(query) {
  validateQuery(query);
  const url = new URL(ENDPOINT);
  url.searchParams.set(
    "$filter",
    FILTERS.filter((key) => Object.hasOwn(query, key))
      .map((key) => `${key} eq '${query[key].replaceAll("'", "''")}'`)
      .join(" and "),
  );
  url.searchParams.set("currencyCode", query.currencyCode);
  return url;
}

function validateFailure(request) {
  const failure = request.mcp_failure;
  if (!failure || !Array.isArray(failure.attempts) || failure.attempts.length === 0) {
    throw new Error("Documented MCP failure attempts are required");
  }
  const now = Date.now();
  const timestamp = Date.parse(failure.recorded_at);
  if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > 24 * 60 * 60 * 1000) {
    throw new Error("MCP failure evidence must be current (within 24 hours, not future-dated)");
  }
  let matching = false;
  for (const attempt of failure.attempts) {
    validateQuery(attempt.query);
    if (
      attempt.query.serviceName !== request.query.serviceName ||
      attempt.query.currencyCode !== request.query.currencyCode
    ) {
      throw new Error("MCP evidence must target the same service and currency");
    }
    if (retailQueryUrl(attempt.query).href === retailQueryUrl(request.query).href) matching = true;
    const response = attempt.response?.result ?? attempt.response;
    if (failure.kind === "empty_result") {
      if (
        attempt.response?.error ||
        attempt.response?.isError ||
        response?.error ||
        !response ||
        !Array.isArray(response.Items) ||
        response.Items.length ||
        response.Count !== 0 ||
        response.NextPageLink !== null
      ) {
        throw new Error("Empty-result fallback requires actual empty, exhausted MCP responses");
      }
    } else if (failure.kind === "transient_exhausted") {
      if (
        ![408, 429, 500, 502, 503, 504].includes(attempt.http_status) ||
        typeof attempt.error !== "string" ||
        !attempt.error.trim()
      ) {
        throw new Error("Transient fallback requires recorded retryable HTTP errors, not authentication failures");
      }
    } else throw new Error("Unsupported MCP failure kind");
  }
  if (!matching) throw new Error("Direct query must match a recorded failed MCP query");
  if (failure.kind === "transient_exhausted" && failure.attempts.length !== 2) {
    throw new Error("Transient failure requires original attempt and the single exhausted retry");
  }
}

function validatePage(page, query) {
  if (
    !page ||
    !Array.isArray(page.Items) ||
    page.BillingCurrency !== query.currencyCode ||
    !Object.hasOwn(page, "NextPageLink") ||
    (page.NextPageLink !== null && typeof page.NextPageLink !== "string")
  ) {
    throw new Error("Malformed or wrong-currency retail response");
  }
  for (const row of page.Items) {
    if (
      !row ||
      typeof row !== "object" ||
      row.currencyCode !== query.currencyCode ||
      row.type !== query.priceType ||
      !Number.isFinite(row.retailPrice) ||
      row.retailPrice < 0 ||
      !Number.isFinite(row.tierMinimumUnits) ||
      row.tierMinimumUnits < 0
    ) {
      throw new Error("Invalid retail meter value or currency/type");
    }
    for (const key of ["meterId", "productName", "skuName", "meterName", "unitOfMeasure", "effectiveStartDate"]) {
      if (typeof row[key] !== "string" || !row[key]) throw new Error(`Missing meter field: ${key}`);
    }
    for (const key of FILTERS.filter((key) => key !== "priceType" && Object.hasOwn(query, key))) {
      if (row[key] !== query[key]) throw new Error(`Returned meter does not match ${key}`);
    }
  }
}

export async function fetchRetailEvidence(request, fetcher = fetch) {
  const initial = retailQueryUrl(request.query);
  validateFailure(request);
  if (
    !Number.isInteger(request.remaining_requests) ||
    request.remaining_requests < 1 ||
    request.remaining_requests > 20
  ) {
    throw new Error("remaining_requests must reflect 1-20 unused requests in the shared pricing budget");
  }
  const limit = Math.min(4, request.remaining_requests);
  const pages = [];
  const seen = new Set();
  let next = initial;
  while (next) {
    if (pages.length >= limit) throw new Error("Pagination exceeds remaining budget or four-page fallback limit");
    if (seen.has(next.href)) throw new Error("Repeated pagination URL");
    seen.add(next.href);
    const response = await fetcher(next, { redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Retail API HTTP ${response.status}; no direct-API retry`);
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 10 * 1024 * 1024) throw new Error("Retail response exceeds evidence size limit");
    const body = JSON.parse(raw);
    validatePage(body, request.query);
    pages.push({
      url: next.href,
      queried_at: new Date().toISOString(),
      response_sha256: createHash("sha256").update(raw).digest("hex"),
      raw_response: raw,
    });
    if (body.NextPageLink === null) break;
    const candidate = new URL(body.NextPageLink);
    if (
      candidate.origin !== initial.origin ||
      candidate.pathname !== initial.pathname ||
      candidate.username ||
      candidate.password ||
      candidate.hash ||
      candidate.searchParams.get("$filter") !== initial.searchParams.get("$filter") ||
      candidate.searchParams.get("currencyCode") !== request.query.currencyCode ||
      [...candidate.searchParams.keys()].some((key) => !["$filter", "currencyCode", "$skip", "$top"].includes(key)) ||
      [...candidate.searchParams.keys()].some((key) => candidate.searchParams.getAll(key).length !== 1) ||
      !/^\d+$/.test(candidate.searchParams.get("$skip") ?? "") ||
      Number(candidate.searchParams.get("$skip")) <= Number(next.searchParams.get("$skip") ?? 0) ||
      (candidate.searchParams.has("$top") && !/^\d+$/.test(candidate.searchParams.get("$top")))
    ) {
      throw new Error("Unsafe or query-changing pagination link");
    }
    next = candidate;
  }
  if (!pages.some((page) => JSON.parse(page.raw_response).Items.length)) throw new Error("No retail meters returned");
  return {
    schema_version: "retail-price-evidence-v1",
    data_source: "Azure Retail Prices API (direct fallback)",
    query: request.query,
    mcp_failure: request.mcp_failure,
    requests_used: pages.length,
    pages,
  };
}

export async function main(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args,
      options: { request: { type: "string" }, output: { type: "string" }, help: { type: "boolean" } },
    });
    if (values.help) {
      console.log(
        "Usage: node tools/scripts/fetch-retail-price-evidence.mjs --request REQUEST.json --output NEW-EVIDENCE.json\n" +
          "Requires query, current mcp_failure {kind, recorded_at, attempts}, remaining_requests.\n" +
          "Public Consumption prices only; no auth, no redirects, no retry; max four pages, 15s/page.\n" +
          "Writes evidence exclusively after complete validation; never overwrites or calculates an estimate.",
      );
      return 0;
    }
    if (!values.request || !values.output) throw new Error("--request and --output are required");
    try {
      lstatSync(values.output);
      throw new Error("Output already exists; preserve prior evidence and select a new path");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const evidence = await fetchRetailEvidence(JSON.parse(readFileSync(values.request, "utf8")));
    writeFileSync(values.output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(
      JSON.stringify({ status: "EVIDENCE_READY", file_path: values.output, requests_used: evidence.requests_used }),
    );
    return 0;
  } catch (error) {
    console.error(`Retail fallback FAILED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());
