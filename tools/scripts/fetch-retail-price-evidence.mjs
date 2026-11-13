import { lstatSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import {
  assertSnapshots,
  digestObject,
  readSnapshot,
  reserveQuery,
  safePath,
  updateAttempt,
  writeExclusive,
  withLedger,
  ledgerCounts,
  verifyCapturedFailure,
  rawPageBytes,
  PRICING_ROOT,
} from "./_lib/pricing-evidence.mjs";

const ENDPOINT = "https://prices.azure.com/api/retail/prices";
const FILTERS = ["serviceName", "armSkuName", "armRegionName", "productName", "skuName", "meterName", "priceType"];
const QUERY_KEYS = [...FILTERS, "currencyCode"];
const SERVICE_FAMILY_PARSER_KINDS = new Set([
  "service_family_unsupported",
  "mcp_catalog_parser_error",
  "mcp_deserialization_error",
]);
const AI_SERVICE_ALIASES = new Set(["Foundry Models", "Azure OpenAI", "Cognitive Services"]);

function isServiceFamilyParserError(attempt) {
  const response = attempt?.response ?? attempt;
  if (!response || typeof response !== "object") return false;
  const status = response.status ?? attempt?.http_status;
  const errType = response.results?.type ?? response.type ?? attempt?.type ?? "";
  const errMessage = [response.message, response.results?.message, response.error, attempt?.error]
    .filter((part) => typeof part === "string")
    .join("\n");
  return (
    status === 400 &&
    (errType === "ArgumentOutOfRangeException" || /ArgumentOutOfRangeException/i.test(errMessage)) &&
    /Unknown ServiceFamily value/i.test(errMessage)
  );
}

function validateQuery(query, options = {}) {
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
  const allowedPriceTypes = options.allowReservation ? ["Consumption", "Reservation"] : ["Consumption"];
  if (
    !query.serviceName?.trim() ||
    !allowedPriceTypes.includes(query.priceType) ||
    !/^[A-Z]{3}$/.test(query.currencyCode ?? "")
  ) {
    throw new Error("Explicit serviceName, Consumption priceType and currencyCode are required");
  }
}

export function retailQueryUrl(query, options = {}) {
  validateQuery(query, options);
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

export function validateFailure(request, options = {}) {
  const allowReservation = Boolean(options.allowReservation ?? request.allow_reservation);
  const queryOpts = { allowReservation };
  validateQuery(request.query, queryOpts);
  const expectedPriceType = request.query.priceType;
  const failure = request.mcp_failure;
  if (!failure || !Array.isArray(failure.attempts) || failure.attempts.length === 0) {
    throw new Error("Documented MCP failure attempts are required");
  }
  const now = options.now ?? Date.now();
  const timestamp = Date.parse(failure.recorded_at);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(timestamp) ||
    timestamp > now ||
    now - timestamp > 24 * 60 * 60 * 1000
  ) {
    throw new Error("MCP failure evidence must be current (within 24 hours, not future-dated)");
  }
  if (failure.captured_recorded_at !== undefined) {
    const captured = Date.parse(failure.captured_recorded_at);
    if (!Number.isFinite(captured) || captured > now || now - captured > 24 * 60 * 60 * 1000)
      throw new Error("Actual captured native failure must be current (within 24 hours, not future-dated)");
  }
  let matching = false;
  for (const attempt of failure.attempts) {
    if (SERVICE_FAMILY_PARSER_KINDS.has(failure.kind)) {
      if (!isServiceFamilyParserError(attempt)) {
        throw new Error(
          "Service-family parser fallback requires a status-400 ArgumentOutOfRangeException ('Unknown ServiceFamily value') from pricing_get",
        );
      }
      const rawParams = attempt?.query ?? attempt?.parameters;
      if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) {
        throw new Error("MCP failure attempt must include query or parameters");
      }
      const currency = rawParams.currencyCode ?? rawParams.currency;
      const priceType = rawParams.priceType ?? rawParams["price-type"];
      if (currency !== request.query.currencyCode || priceType !== expectedPriceType) {
        throw new Error(`MCP evidence must target the same ${expectedPriceType} priceType and currency`);
      }
      const filterText = typeof rawParams.filter === "string" ? rawParams.filter : "";
      const filterService = filterText.match(/serviceName\s+eq\s+'([^']+)'/)?.[1];
      const service = rawParams.serviceName ?? rawParams.service ?? filterService;
      if (
        !AI_SERVICE_ALIASES.has(request.query.serviceName) ||
        (service &&
          service !== request.query.serviceName &&
          !(AI_SERVICE_ALIASES.has(service) && AI_SERVICE_ALIASES.has(request.query.serviceName)))
      ) {
        throw new Error("MCP evidence must target the same service and currency");
      }
      const regionMatch = filterText ? filterText.match(/armRegionName\s+eq\s+'([^']+)'/) : null;
      const attemptRegion = rawParams.armRegionName ?? rawParams.region ?? regionMatch?.[1];
      if (attemptRegion && request.query.armRegionName && attemptRegion !== request.query.armRegionName) {
        throw new Error("MCP evidence must target the same region");
      }
      for (const field of ["productName", "skuName", "meterName", "armSkuName"]) {
        const filterVal = filterText ? filterText.match(new RegExp(`${field}\\s+eq\\s+'([^']+)'`))?.[1] : undefined;
        const attemptVal = rawParams[field] ?? filterVal;
        if (attemptVal && request.query[field] && attemptVal !== request.query[field]) {
          throw new Error(`MCP evidence field '${field}' does not match request.query`);
        }
      }
      matching = true;
      continue;
    }
    if (failure.kind === "missing_tier_metadata" || failure.kind === "single_non_hourly_missing_tier_metadata") {
      const rawParams = attempt?.query ?? attempt?.parameters;
      if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) {
        throw new Error("MCP failure attempt must include query or parameters");
      }
      if (attempt.query) {
        validateQuery(attempt.query, queryOpts);
        if (
          attempt.query.serviceName !== request.query.serviceName ||
          attempt.query.currencyCode !== request.query.currencyCode ||
          attempt.query.priceType !== expectedPriceType
        ) {
          throw new Error(`MCP evidence must target the same service, ${expectedPriceType} priceType, and currency`);
        }
        for (const key of ["armRegionName", "armSkuName", "productName", "skuName", "meterName"]) {
          if (attempt.query[key] && request.query[key] && attempt.query[key] !== request.query[key]) {
            throw new Error(`MCP evidence query field '${key}' does not match request.query`);
          }
        }
      } else {
        const currency = rawParams.currencyCode ?? rawParams.currency;
        const priceType = rawParams.priceType ?? rawParams["price-type"];
        if (currency !== request.query.currencyCode || priceType !== expectedPriceType) {
          throw new Error(`MCP evidence must target the same ${expectedPriceType} priceType and currency`);
        }
      }
      const prices = attempt.response?.results?.prices;
      const matchingRows = Array.isArray(prices)
        ? prices.filter(
            (r) =>
              r &&
              typeof r === "object" &&
              r.serviceName === request.query.serviceName &&
              (!request.query.armRegionName || !r.region || r.region === request.query.armRegionName) &&
              (!request.query.armSkuName || r.armSkuName === request.query.armSkuName) &&
              (!request.query.productName || r.productName === request.query.productName) &&
              (!request.query.skuName || r.skuName === request.query.skuName) &&
              (!request.query.meterName || r.meterName === request.query.meterName) &&
              Number.isFinite(r.retailPrice),
          )
        : [];
      if (failure.kind === "single_non_hourly_missing_tier_metadata") {
        const singleNonHourlyUnpaged =
          Array.isArray(prices) &&
          prices.length < 100 &&
          matchingRows.length === 1 &&
          Boolean(request.query.productName && request.query.skuName && request.query.meterName) &&
          typeof matchingRows[0].unitOfMeasure === "string" &&
          matchingRows[0].unitOfMeasure.trim().length > 0 &&
          !/^(1\s*\/?\s*)?hours?$/i.test(matchingRows[0].unitOfMeasure) &&
          !Object.hasOwn(matchingRows[0], "tierMinimumUnits");
        if (
          attempt.response?.status !== 200 ||
          attempt.response?.error ||
          attempt.response?.isError ||
          !singleNonHourlyUnpaged
        ) {
          throw new Error(
            "Single-non-hourly missing-tier-metadata fallback requires an unpaged (<100 rows) status-200 pricing_get response with 1 exact non-hourly meter omitting tierMinimumUnits",
          );
        }
      } else {
        const distinctPrices = new Set(matchingRows.map((r) => r.retailPrice));
        const omitsTierMinimum =
          matchingRows.length >= 2 && matchingRows.every((r) => !Object.hasOwn(r, "tierMinimumUnits"));
        if (
          attempt.response?.status !== 200 ||
          attempt.response?.error ||
          attempt.response?.isError ||
          !omitsTierMinimum ||
          distinctPrices.size < 2
        ) {
          throw new Error(
            "Missing-tier-metadata fallback requires a status-200 pricing_get response with multiple rate rows that omit tierMinimumUnits",
          );
        }
      }
      matching = true;
      continue;
    }
    validateQuery(attempt.query, queryOpts);
    if (
      attempt.query.serviceName !== request.query.serviceName ||
      attempt.query.currencyCode !== request.query.currencyCode ||
      attempt.query.priceType !== expectedPriceType
    ) {
      throw new Error(`MCP evidence must target the same service, ${expectedPriceType} priceType, and currency`);
    }
    if (retailQueryUrl(attempt.query, queryOpts).href === retailQueryUrl(request.query, queryOpts).href)
      matching = true;
    const response = attempt.response?.result ?? attempt.response;
    if (failure.kind === "empty_result") {
      // Azure MCP pricing_get reports no paging metadata; status 200 with prices [] is its exhausted empty result.
      const emptyPricingGet =
        attempt.response?.status === 200 &&
        Array.isArray(attempt.response?.results?.prices) &&
        attempt.response.results.prices.length === 0;
      const emptyRetailPage =
        Array.isArray(response?.Items) &&
        response.Items.length === 0 &&
        response.Count === 0 &&
        response.NextPageLink === null;
      if (
        attempt.response?.error ||
        attempt.response?.isError ||
        response?.error ||
        !response ||
        !(emptyPricingGet || emptyRetailPage)
      ) {
        throw new Error("Empty-result fallback requires actual empty, exhausted MCP responses");
      }
    } else if (failure.kind === "transient_exhausted") {
      const nativeStatus = attempt.response?.status ?? attempt.response?.http_status;
      if (
        ![408, 429, 500, 502, 503, 504].includes(attempt.http_status) ||
        (nativeStatus !== undefined && nativeStatus !== attempt.http_status) ||
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

export function validatePage(page, query) {
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

export function validateNextPageLink(link, query, previous, options = {}) {
  const initial = retailQueryUrl(query, options);
  const candidate = new URL(link);
  const prior = new URL(previous);
  if (
    candidate.origin !== initial.origin ||
    candidate.pathname !== initial.pathname ||
    candidate.username ||
    candidate.password ||
    candidate.hash ||
    candidate.searchParams.get("$filter") !== initial.searchParams.get("$filter") ||
    candidate.searchParams.get("currencyCode") !== query.currencyCode ||
    [...candidate.searchParams.keys()].some((key) => !["$filter", "currencyCode", "$skip", "$top"].includes(key)) ||
    [...candidate.searchParams.keys()].some((key) => candidate.searchParams.getAll(key).length !== 1) ||
    !/^\d+$/.test(candidate.searchParams.get("$skip") ?? "") ||
    Number(candidate.searchParams.get("$skip")) <= Number(prior.searchParams.get("$skip") ?? 0) ||
    (candidate.searchParams.has("$top") && !/^\d+$/.test(candidate.searchParams.get("$top")))
  )
    throw new Error("Unsafe or query-changing pagination link");
  return candidate;
}

export async function fetchRetailEvidence(request, fetcher = fetch, options = {}) {
  const allowReservation = Boolean(request.allow_reservation);
  const queryOpts = { allowReservation };
  const maxBudget = request.budget_tier === "portfolio" ? 60 : 20;
  const minDelayMs = Number(options.minDelayMs ?? (fetcher === fetch ? 400 : 0));
  const initial = retailQueryUrl(request.query, queryOpts);
  if (
    !Number.isInteger(request.remaining_requests) ||
    request.remaining_requests < 1 ||
    request.remaining_requests > maxBudget
  ) {
    throw new Error(`remaining_requests must reflect 1-${maxBudget} unused requests in the shared pricing budget`);
  }
  const limit = Math.min(4, request.remaining_requests);
  const output = options.outputPath ?? request.output_path;
  if (!output) throw new Error("Durable output_path is required before issuing a direct request");
  safePath(output);
  const ledgerPath = path.join(path.dirname(path.resolve(output)), "pricing-evidence", "request-ledger.json");
  const failureSnapshots = verifyCapturedFailure(request.mcp_failure, undefined, PRICING_ROOT, ledgerPath);
  let failureReferenceTime = Date.now();
  if (existsSync(ledgerPath)) {
    const ledger = JSON.parse(readSnapshot(ledgerPath).bytes);
    const prior = ledger.attempts?.find(
      (attempt) =>
        attempt.source === "direct" &&
        attempt.state === "completed" &&
        attempt.query?.page_url === initial.href &&
        attempt.query_hash === digestObject({ ...request.query, page_url: initial.href }),
    );
    if (prior && Date.parse(failureSnapshots.failure.recorded_at) <= Date.parse(prior.issued_at))
      failureReferenceTime = Date.parse(prior.issued_at);
  }
  validateFailure(
    { ...request, mcp_failure: failureSnapshots.failure },
    { now: failureReferenceTime, allowReservation },
  );
  const sharedLedger = JSON.parse(readSnapshot(ledgerPath).bytes);
  const ledgerCap = sharedLedger.budget_tier === "portfolio" ? 60 : maxBudget;
  if (
    !Number.isInteger(sharedLedger.external_requests_used ?? 0) ||
    (sharedLedger.external_requests_used ?? 0) < 0 ||
    sharedLedger.attempts.length + (sharedLedger.external_requests_used ?? 0) > ledgerCap
  )
    throw new Error("Invalid or exhausted shared pricing request accounting");
  const nativeCaptures = failureSnapshots.flatMap((snapshot) => {
    try {
      const record = JSON.parse(snapshot.bytes);
      return record.schema_version === "pricing-response-evidence-v1" ? [record] : [];
    } catch {
      return [];
    }
  });
  const requestBinding = nativeCaptures[0]?.request_binding_path;
  if (
    nativeCaptures.some(
      (capture) =>
        capture.request_binding_path !== requestBinding ||
        capture.request_binding_sha256 !== nativeCaptures[0]?.request_binding_sha256,
    )
  )
    throw new Error("Fallback attempts must belong to the same immutable original request");
  if (existsSync(output)) {
    const saved = JSON.parse(readSnapshot(output).bytes);
    if (saved.status === "COMPLETE" && digestObject(saved.query) === digestObject(request.query)) {
      const savedFailure = verifyCapturedFailure(saved.mcp_failure, undefined, PRICING_ROOT, ledgerPath);
      validateFailure(
        { query: saved.query, allow_reservation: allowReservation, mcp_failure: savedFailure.failure },
        { now: Date.parse(saved.pages?.[0]?.queried_at), allowReservation },
      );
      if (
        saved.request_binding_path !== requestBinding ||
        saved.request_binding_sha256 !== nativeCaptures[0]?.request_binding_sha256
      )
        throw new Error("Saved direct evidence belongs to a different original request binding");
      if (!Array.isArray(saved.attempts) || !saved.pages.length || saved.requests_used !== saved.attempts.length)
        throw new Error("Saved evidence incomplete");
      for (const savedAttempt of saved.attempts) {
        const ledgerEntry = sharedLedger.attempts.find((entry) => entry.call_id === savedAttempt?.call_id);
        if (
          !ledgerEntry ||
          ledgerEntry.source !== "direct" ||
          !ledgerEntry.issued_confirmed ||
          ledgerEntry.state !== savedAttempt.state ||
          !ledgerEntry.evidence_path
        )
          throw new Error("Saved attempt lacks durable ledger provenance");
        const durableAttemptPage = JSON.parse(
          readSnapshot(path.resolve(PRICING_ROOT, ledgerEntry.evidence_path)).bytes,
        );
        if (
          createHash("sha256").update(rawPageBytes(durableAttemptPage)).digest("hex") !==
          durableAttemptPage.response_sha256
        )
          throw new Error("Saved durable attempt byte hash mismatch");
        if (
          savedAttempt.state !== "completed" &&
          !(savedAttempt.state === "error" && [429, 503].includes(savedAttempt.http_status))
        )
          throw new Error("Saved evidence contains non-retryable failed attempt");
      }
      const completedAttempts = saved.attempts.filter((a) => a.state === "completed");
      if (completedAttempts.length !== saved.pages.length) throw new Error("Saved evidence page/attempt mismatch");
      for (const [index, page] of saved.pages.entries()) {
        if (createHash("sha256").update(rawPageBytes(page)).digest("hex") !== page.response_sha256)
          throw new Error("Saved evidence byte hash mismatch");
        const parsed = JSON.parse(page.raw_response);
        validatePage(parsed, request.query);
        if (index === 0 && page.url !== initial.href) throw new Error("Saved evidence query URL mismatch");
        if (index < saved.pages.length - 1 && parsed.NextPageLink !== saved.pages[index + 1].url)
          throw new Error("Saved evidence pagination chain mismatch");
        if (parsed.NextPageLink !== null) validateNextPageLink(parsed.NextPageLink, request.query, page.url, queryOpts);
        const issued = sharedLedger.attempts.find((attempt) => attempt.call_id === completedAttempts[index]?.call_id);
        if (
          issued?.state !== "completed" ||
          issued.source !== "direct" ||
          issued.query?.page_url !== page.url ||
          issued.issued_at !== page.queried_at
        )
          throw new Error("Saved page is not a completed durable request");
        const durable = JSON.parse(readSnapshot(path.resolve(PRICING_ROOT, issued.evidence_path)).bytes);
        if (createHash("sha256").update(rawPageBytes(durable)).digest("hex") !== page.response_sha256)
          throw new Error("Saved page differs from current durable raw evidence");
        if (index === saved.pages.length - 1 && parsed.NextPageLink !== null)
          throw new Error("Saved evidence incomplete");
        const age = Date.now() - Date.parse(page.queried_at);
        if (!Number.isFinite(age) || age < 0 || age > 30 * 86400000) throw new Error("Saved evidence stale");
      }
      return { ...saved, requests_issued_this_run: 0 };
    }
    throw new Error("Existing evidence must be preserved");
  }
  const evidence = {
    schema_version: "retail-price-evidence-v1",
    status: "IN_PROGRESS",
    data_source: "Azure Retail Prices API (direct fallback)",
    query: request.query,
    mcp_failure: { ...request.mcp_failure, recorded_at: failureSnapshots.failure.recorded_at },
    requests_used: 0,
    pages: [],
    attempts: [],
    ledger_path: path
      .relative(PRICING_ROOT, path.join(path.dirname(path.resolve(output)), "pricing-evidence", "request-ledger.json"))
      .replaceAll(path.sep, "/"),
    ...(requestBinding
      ? { request_binding_path: requestBinding, request_binding_sha256: nativeCaptures[0].request_binding_sha256 }
      : {}),
  };
  const pages = [];
  const seen = new Set();
  let next = initial;
  let stage = "reservation";
  try {
    while (next) {
      stage = "budget";
      if (evidence.requests_used >= limit)
        throw new Error("Pagination exceeds remaining budget or four-page fallback limit");
      stage = "pagination";
      if (seen.has(next.href)) throw new Error("Repeated pagination URL");
      seen.add(next.href);
      const baseCallId = `direct-${digestObject({ query: request.query, page_url: next.href })}`;
      const maxRetryPasses = options.retryTransient === true ? 1 : 0;
      let pageBody = null;
      for (let retryPass = 0; retryPass <= maxRetryPasses; retryPass++) {
        if (retryPass > 0) {
          stage = "budget";
          if (evidence.requests_used >= limit)
            throw new Error("Retry exceeds remaining budget or four-request fallback limit");
        }
        const callId = retryPass === 0 ? baseCallId : `${baseCallId}-retry-${retryPass}`;
        const retryOf = retryPass === 0 ? undefined : baseCallId;
        stage = "reservation";
        const reservation = reserveQuery({
          output,
          query: { ...request.query, page_url: next.href },
          call_id: callId,
          retry_of: retryOf,
          source: "direct",
          request_binding_path: requestBinding,
          remaining_requests: request.remaining_requests,
        });
        const issued = new Date().toISOString();
        if (
          retryPass === 0 &&
          maxRetryPasses > 0 &&
          reservation.state === "error" &&
          [429, 503].includes(reservation.http_status) &&
          reservation.evidence_path
        ) {
          const failedReplay = JSON.parse(readSnapshot(path.resolve(PRICING_ROOT, reservation.evidence_path)).bytes);
          if (createHash("sha256").update(rawPageBytes(failedReplay)).digest("hex") !== failedReplay.response_sha256)
            throw new Error("Saved direct page hash mismatch");
          evidence.requests_used++;
          evidence.attempts.push({
            call_id: callId,
            url: next.href,
            state: "error",
            http_status: reservation.http_status,
            issued_at: reservation.issued_at ?? issued,
            evidence_path: reservation.evidence_path,
          });
          continue;
        }
        if (!["planned", "completed"].includes(reservation.state))
          throw new Error("Previously issued/failed direct query cannot be repeated");
        const replay =
          reservation.state === "completed"
            ? JSON.parse(readSnapshot(path.resolve(PRICING_ROOT, reservation.evidence_path)).bytes)
            : null;
        if (replay && createHash("sha256").update(rawPageBytes(replay)).digest("hex") !== replay.response_sha256)
          throw new Error("Saved direct page hash mismatch");
        if (replay) {
          const age = Date.now() - Date.parse(replay.queried_at);
          if (!Number.isFinite(age) || age < 0 || age > 30 * 86400000) throw new Error("Saved direct page stale");
        }
        if (!replay) updateAttempt(output, callId, { state: "issued", issued_at: issued });
        evidence.requests_used++;
        const attempt = {
          call_id: callId,
          url: next.href,
          state: "issued",
          ...(retryOf ? { retry_of: retryOf } : {}),
          issued_at: reservation.issued_at ?? issued,
        };
        evidence.attempts.push(attempt);
        stage = "fetch";
        let response;
        let raw;
        try {
          if (!replay && pages.length > 0 && retryPass === 0 && minDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, minDelayMs));
          }
          evidence.requests_issued_this_run = (evidence.requests_issued_this_run ?? 0) + (replay ? 0 : 1);
          response = replay
            ? { ok: true, status: 200, arrayBuffer: async () => rawPageBytes(replay) }
            : await fetcher(next, { redirect: "error", signal: AbortSignal.timeout(15000) });
          attempt.http_status = response.status ?? 200;
          stage = "http";
          const rawBytes = response.arrayBuffer
            ? Buffer.from(await response.arrayBuffer())
            : Buffer.from(await response.text(), "utf8");
          raw = rawBytes.toString("utf8");
          const pageRecord = {
            url: next.href,
            queried_at: replay?.queried_at ?? issued,
            response_sha256: createHash("sha256").update(rawBytes).digest("hex"),
            raw_response: raw,
            raw_response_base64: rawBytes.toString("base64"),
          };
          evidence.pages.push(pageRecord);
          // Failed and invalid pages remain exact evidence, but can never become EVIDENCE_READY.
          const pagePath = path.join(path.dirname(path.resolve(output)), "pricing-evidence", `${callId}.page.json`);
          if (!replay) writeExclusive(pagePath, `${JSON.stringify(pageRecord, null, 2)}\n`);
          attempt.evidence_path = path.relative(PRICING_ROOT, pagePath).replaceAll(path.sep, "/");
          if (!replay && retryPass < maxRetryPasses && (response.status === 429 || response.status === 503)) {
            attempt.state = "error";
            updateAttempt(output, callId, {
              state: "error",
              issued_confirmed: true,
              failure_stage: stage,
              http_status: response.status,
              evidence_path: attempt.evidence_path,
            });
            const retryAfterHeader = response.headers?.get?.("retry-after");
            const waitMs = Math.min(
              5000,
              Number.isFinite(Number(retryAfterHeader)) && Number(retryAfterHeader) >= 0
                ? Number(retryAfterHeader) * 1000
                : 1000,
            );
            if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
          if (!response.ok) throw new Error(`Retail API HTTP ${response.status}; no direct-API retry`);
          stage = "decode";
          if (Buffer.byteLength(raw) > 10 * 1024 * 1024) throw new Error("Retail response exceeds evidence size limit");
          if (!Buffer.from(raw, "utf8").equals(rawBytes)) throw new Error("Invalid retail response UTF-8 bytes");
          pageBody = JSON.parse(raw);
          stage = "validation";
          validatePage(pageBody, request.query);
          pages.push({
            url: next.href,
            queried_at: pageRecord.queried_at,
            response_sha256: createHash("sha256").update(rawBytes).digest("hex"),
            raw_response: raw,
            raw_response_base64: rawBytes.toString("base64"),
          });
          attempt.state = "completed";
          updateAttempt(output, callId, {
            state: "completed",
            issued_confirmed: true,
            completed_at: new Date().toISOString(),
            evidence_path: attempt.evidence_path,
            http_status: attempt.http_status,
          });
          break;
        } catch (error) {
          attempt.state = "error";
          updateAttempt(output, callId, {
            state: "error",
            issued_confirmed: true,
            failure_stage: stage,
            http_status: response?.status,
            ...(attempt.evidence_path ? { evidence_path: attempt.evidence_path } : {}),
          });
          throw error;
        }
      }
      if (pageBody.NextPageLink === null) break;
      next = validateNextPageLink(pageBody.NextPageLink, request.query, next, queryOpts);
    }
    if (!pages.some((page) => JSON.parse(page.raw_response).Items.length)) throw new Error("No retail meters returned");
    evidence.status = "COMPLETE";
    evidence.pages = pages;
    assertSnapshots(failureSnapshots.filter((snapshot) => path.basename(snapshot.path) !== "request-ledger.json"));
    verifyCapturedFailure(request.mcp_failure, undefined, PRICING_ROOT, ledgerPath);
    writeExclusive(output, `${JSON.stringify(evidence, null, 2)}\n`);
    return evidence;
  } catch (cause) {
    evidence.status = "FAILED";
    evidence.failure = {
      code: "RETAIL_EVIDENCE_FAILED",
      stage,
      diagnostic: "Direct pricing request failed; inspect preserved evidence locally",
    };
    evidence.ledger_counts = withLedger(output, (ledger) => {
      evidence.requests_used = ledger.attempts.filter((attempt) => {
        if (attempt.source !== "direct" || !attempt.issued_confirmed) return false;
        const { page_url: _page, ...query } = attempt.query;
        return digestObject(query) === digestObject(request.query);
      }).length;
      return ledgerCounts(ledger);
    });
    const failurePath = `${output}.failure.json`;
    if (!existsSync(failurePath)) writeExclusive(failurePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const httpStatus = evidence.attempts.at(-1)?.http_status;
    const error = new Error(
      `Retail evidence failed at ${stage}${Number.isInteger(httpStatus) ? ` (HTTP ${httpStatus})` : ""}`,
    );
    error.cause = { code: cause.code ?? "RETAIL_REQUEST_FAILED" };
    error.result = evidence;
    throw error;
  }
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
    const evidence = await fetchRetailEvidence(JSON.parse(readFileSync(values.request, "utf8")), fetch, {
      outputPath: values.output,
    });
    console.log(
      JSON.stringify({ status: "EVIDENCE_READY", file_path: values.output, requests_used: evidence.requests_used }),
    );
    return 0;
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "FAILED",
        code: error.result?.failure?.code ?? "PREFLIGHT_FAILED",
        stage: error.result?.failure?.stage ?? "preflight",
        requests_used: error.result?.requests_used ?? 0,
        ledger_counts: error.result?.ledger_counts,
        diagnostic: "Retail fallback failed; preserve the durable ledger and inspect local evidence",
      }),
    );
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());
