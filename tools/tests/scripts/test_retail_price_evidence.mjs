import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fetchRetailEvidence, retailQueryUrl } from "../../scripts/fetch-retail-price-evidence.mjs";

const query = { serviceName: "Azure DNS", meterName: "Private Zone", priceType: "Consumption", currencyCode: "USD" };
const empty = { Items: [], Count: 0, NextPageLink: null };
const request = () => ({
  query: { ...query },
  remaining_requests: 4,
  mcp_failure: {
    kind: "empty_result",
    recorded_at: new Date(Date.now() - 1000).toISOString(),
    attempts: [{ query: { ...query }, response: { result: empty } }],
  },
});
const row = {
  serviceName: "Azure DNS",
  productName: "Azure DNS",
  skuName: "Private",
  armSkuName: "",
  armRegionName: "",
  meterName: "Private Zone",
  meterId: "fixture-meter",
  type: "Consumption",
  unitOfMeasure: "1",
  currencyCode: "USD",
  retailPrice: 0.5,
  tierMinimumUnits: 0,
  effectiveStartDate: "2026-01-01",
};
const page = (next = null) => ({ BillingCurrency: "USD", Items: [row], NextPageLink: next });
const response = (body) => ({ ok: true, text: async () => JSON.stringify(body) });

test("direct fallback preserves raw responses and failure provenance without computing prices", async () => {
  let calls = 0;
  const input = request();
  const result = await fetchRetailEvidence(input, async (url, options) => {
    calls++;
    assert.equal(url.origin, "https://prices.azure.com");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal);
    return response(page());
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.mcp_failure, input.mcp_failure);
  assert.equal(result.data_source, "Azure Retail Prices API (direct fallback)");
  assert.deepEqual(JSON.parse(result.pages[0].raw_response), page());
  assert.match(result.pages[0].response_sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.monthly_total, undefined);
});

test("query building escapes OData literals and rejects arbitrary filters", () => {
  assert.match(retailQueryUrl({ ...query, meterName: "Owner's Zone" }).searchParams.get("$filter"), /Owner''s Zone/);
  assert.throws(() => retailQueryUrl({ ...query, url: "https://other.test" }));
  assert.throws(() => retailQueryUrl({ ...query, priceType: "Reservation" }));
});

test("missing, stale, unrelated or nonempty MCP evidence blocks before any fetch", async () => {
  for (const modify of [
    (input) => {
      delete input.mcp_failure;
    },
    (input) => {
      input.mcp_failure.recorded_at = "2000-01-01";
    },
    (input) => {
      input.mcp_failure.recorded_at = "2999-01-01";
    },
    (input) => {
      input.mcp_failure.attempts[0].query.meterName = "Private Queries";
    },
    (input) => {
      input.mcp_failure.attempts[0].response = page();
    },
    (input) => {
      input.mcp_failure.kind = "authentication_failure";
    },
    (input) => {
      input.remaining_requests = 0;
    },
  ]) {
    const input = request();
    modify(input);
    await assert.rejects(fetchRetailEvidence(input, () => assert.fail("must not fetch")));
  }
});

test("pagination stays on the same public query and honors remaining budget", async () => {
  const next = retailQueryUrl(query);
  next.searchParams.set("$skip", "1000");
  let calls = 0;
  const result = await fetchRetailEvidence(request(), async () => response(page(calls++ ? null : next.href)));
  assert.equal(result.requests_used, 2);
  await assert.rejects(
    fetchRetailEvidence({ ...request(), remaining_requests: 1 }, async () => response(page(next.href))),
    /budget/,
  );
  for (const link of [
    "http://prices.azure.com/api/retail/prices",
    "https://other.test/",
    "https://prices.azure.com/other",
    `${next.href}&currencyCode=EUR`,
    next.href.replace("Azure+DNS", "Storage"),
  ]) {
    let attempts = 0;
    await assert.rejects(
      fetchRetailEvidence(request(), async () => {
        attempts++;
        return response(page(link));
      }),
    );
    assert.equal(attempts, 1);
  }
});

test("invalid or incomplete API responses fail without retries or partial success", async () => {
  for (const body of [
    {},
    { ...page(), BillingCurrency: "EUR" },
    { ...page(), Items: [] },
    { ...page(), Items: [{ ...row, retailPrice: -1 }] },
    { ...page(), Items: [{ ...row, serviceName: "Storage" }] },
  ]) {
    await assert.rejects(fetchRetailEvidence(request(), async () => response(body)));
  }
  let calls = 0;
  await assert.rejects(
    fetchRetailEvidence(request(), async () => {
      calls++;
      return { ok: false, status: 503 };
    }),
    /503/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    fetchRetailEvidence(request(), async () => {
      throw new Error("timeout");
    }),
    /timeout/,
  );
});

test("transient fallback requires the exhausted HTTP retry and excludes authorization failures", async () => {
  const input = request();
  input.mcp_failure.kind = "transient_exhausted";
  input.mcp_failure.attempts = [1, 2].map(() => ({ query, http_status: 503, error: "Service unavailable" }));
  assert.equal((await fetchRetailEvidence(input, async () => response(page()))).requests_used, 1);
  input.mcp_failure.attempts[0].http_status = 403;
  await assert.rejects(
    fetchRetailEvidence(input, () => assert.fail("no fetch")),
    /authentication/,
  );
  input.mcp_failure.attempts = [{ query, http_status: 503, error: "Service unavailable" }];
  await assert.rejects(
    fetchRetailEvidence(input, () => assert.fail("no fetch")),
    /single exhausted retry/,
  );
});

test("CLI refuses existing output before reading request or making network calls", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "retail-evidence-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "evidence.json");
  writeFileSync(output, "preserve this evidence");
  const result = spawnSync(
    process.execPath,
    [
      new URL("../../scripts/fetch-retail-price-evidence.mjs", import.meta.url).pathname,
      "--request",
      path.join(directory, "missing.json"),
      "--output",
      output,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Output already exists/);
  assert.equal(readFileSync(output, "utf8"), "preserve this evidence");
});
