import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fetchRetailEvidence, retailQueryUrl } from "../../scripts/fetch-retail-price-evidence.mjs";
import {
  captureMcpResponse,
  ledgerCounts,
  reserveQuery,
  updateAttempt,
  withLedger,
} from "../../scripts/_lib/pricing-evidence.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const query = { serviceName: "Azure DNS", meterName: "Private Zone", priceType: "Consumption", currencyCode: "USD" };
const row = {
  serviceName: "Azure DNS",
  productName: "Azure DNS",
  skuName: "Private",
  armSkuName: "",
  armRegionName: "",
  meterName: "Private Zone",
  meterId: "synthetic-private-zone",
  type: "Consumption",
  unitOfMeasure: "1",
  currencyCode: "USD",
  retailPrice: 1,
  tierMinimumUnits: 0,
  effectiveStartDate: "2020-01-01",
};
const page = (next = null) => ({ BillingCurrency: "USD", Items: [row], NextPageLink: next });
const response = (body, status = 200) => ({ ok: status === 200, status, text: async () => JSON.stringify(body) });

function setup(t) {
  const directory = fs.mkdtempSync(path.join(HERE, ".retail-durable-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "fallback.json");
  const raw = { status: 200, results: { prices: [] } };
  const response_path = path.join(directory, "actual-native-response");
  fs.writeFileSync(response_path, JSON.stringify(raw));
  reserveQuery({ output, query, call_id: "native-empty" });
  updateAttempt(output, "native-empty", { state: "issued", issued_at: new Date(Date.now() - 1000).toISOString() });
  const capture = captureMcpResponse({ output, query, call_id: "native-empty", response_path });
  const request = {
    query,
    remaining_requests: 19,
    output_path: output,
    mcp_failure: {
      kind: "empty_result",
      recorded_at: new Date().toISOString(),
      attempts: [{ query, response: raw, evidence_path: capture.evidence_path }],
    },
  };
  return { directory, output, request };
}

test("failed direct pages count as consumed requests and preserve earlier exact pages and failure evidence", async (t) => {
  const { output, request, directory } = setup(t);
  const next = retailQueryUrl(query);
  next.searchParams.set("$skip", "1000");
  let calls = 0;
  await assert.rejects(
    fetchRetailEvidence(request, async () => {
      calls++;
      return calls === 1 ? response(page(next.href)) : response({ error: "Synthetic throttling" }, 429);
    }),
    (error) => {
      assert.equal(error.result.status, "FAILED");
      assert.equal(error.result.requests_used, 2);
      assert.equal(error.result.requests_issued_this_run, 2);
      assert.equal(error.result.pages.length, 2);
      assert.equal(error.result.failure.stage, "http");
      return true;
    },
  );
  assert.equal(calls, 2);
  assert.equal(fs.existsSync(output), false);
  const failure = JSON.parse(fs.readFileSync(`${output}.failure.json`));
  assert.equal(JSON.parse(failure.pages[0].raw_response).Items.length, 1);
  assert.equal(JSON.parse(failure.pages[1].raw_response).error, "Synthetic throttling");
  assert.deepEqual(withLedger(output, ledgerCounts), {
    issued_requests: 3,
    unknown_reservations: 0,
    reserved_requests: 3,
  });
  const renamed = { ...request, output_path: path.join(directory, "renamed.json") };
  await assert.rejects(
    fetchRetailEvidence(renamed, () => assert.fail("failed query must not repeat")),
    (error) => {
      assert.equal(error.result.requests_used, 2);
      return true;
    },
  );
});

test("network exceptions and invalid JSON persist safe machine-readable accounting without leaking diagnostics", async (t) => {
  const { output, request } = setup(t);
  await assert.rejects(
    fetchRetailEvidence(request, async () => {
      throw new Error("sensitive-example-token=never-echo");
    }),
    (error) => {
      assert.equal(error.result.requests_used, 1);
      assert.equal(error.result.requests_issued_this_run, 1);
      assert.equal(error.result.failure.stage, "fetch");
      assert.equal(error.message.includes("sensitive-example"), false);
      return true;
    },
  );
  const failure = fs.readFileSync(`${output}.failure.json`, "utf8");
  assert.equal(failure.includes("sensitive-example"), false);
});

test("successful direct evidence replays without network under a new filename and detects tampered pages", async (t) => {
  const { output, request, directory } = setup(t);
  let calls = 0;
  const first = await fetchRetailEvidence(request, async () => {
    calls++;
    return response(page());
  });
  assert.equal(calls, 1);
  const second = await fetchRetailEvidence(request, () => assert.fail("same output must replay"));
  assert.equal(second.requests_issued_this_run, 0);
  assert.deepEqual(second.pages, first.pages);
  const renamed = { ...request, output_path: path.join(directory, "replayed.json") };
  const replay = await fetchRetailEvidence(renamed, () => assert.fail("same canonical query must replay saved page"));
  assert.equal(replay.requests_issued_this_run, 0);
  assert.deepEqual(replay.pages, first.pages);
  const tampered = JSON.parse(fs.readFileSync(output));
  tampered.pages[0].raw_response += " ";
  fs.writeFileSync(output, JSON.stringify(tampered));
  await assert.rejects(
    fetchRetailEvidence(request, () => assert.fail("tampered evidence must not query")),
    /hash|encoding mismatch/,
  );
});

test("unsigned, mismatched and manually retyped failure evidence cannot authorize a direct request", async (t) => {
  const { request } = setup(t);
  for (const mutate of [
    (input) => {
      delete input.mcp_failure.attempts[0].evidence_path;
    },
    (input) => {
      input.mcp_failure.attempts[0].response.message = "not the captured bytes";
    },
  ]) {
    const invalid = structuredClone(request);
    mutate(invalid);
    await assert.rejects(fetchRetailEvidence(invalid, () => assert.fail("must not query")));
  }
});

test("durable reservations separate conservative unknown work and never reset by changing output names", (t) => {
  const { directory, output } = setup(t);
  reserveQuery({ output, query: { ...query, meterName: "unissued" }, call_id: "unissued" });
  const counts = withLedger(output, ledgerCounts);
  assert.equal(counts.issued_requests, 1);
  assert.equal(counts.unknown_reservations, 1);
  for (let index = 0; index < 18; index++)
    reserveQuery({ output, query: { ...query, meterName: `reserved-${index}` }, call_id: `reserved-${index}` });
  assert.throws(
    () =>
      reserveQuery({
        output: path.join(directory, "new-name.json"),
        query: { ...query, meterName: "over-budget" },
        call_id: "over-budget",
      }),
    /budget/,
  );
});

test("wrapped offloaded missing-tier responses authorize path-only fallback without manual query or response reconstruction", async (t) => {
  const { directory, output } = setup(t);
  const nativeQuery = {
    serviceName: "Storage",
    armRegionName: "swedencentral",
    productName: "Synthetic Blob",
    skuName: "Synthetic LRS",
    meterName: "Stored",
    priceType: "Consumption",
    currencyCode: "USD",
  };
  const nativeRows = [0, 2].map((rate) => {
    const native = {
      ...row,
      serviceName: "Storage",
      productName: "Synthetic Blob",
      skuName: "Synthetic LRS",
      armRegionName: "swedencentral",
      meterName: "Stored",
      meterId: "synthetic-tier-meter",
      unitOfMeasure: "1 GB",
      retailPrice: rate,
    };
    delete native.tierMinimumUnits;
    return native;
  });
  const actual = {
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: 200,
            message: "Success",
            results: { prices: nativeRows },
          }),
        },
      ],
    },
  };
  const response_path = path.join(directory, "offloaded-native-response.json");
  fs.writeFileSync(response_path, JSON.stringify(actual));
  reserveQuery({ output, query: nativeQuery, call_id: "wrapped-tier-reservation" });
  updateAttempt(output, "wrapped-tier-reservation", {
    state: "issued",
    issued_at: new Date(Date.now() - 1000).toISOString(),
  });
  const capture = captureMcpResponse({
    output,
    query: nativeQuery,
    call_id: "wrapped-tier-reservation",
    native_call_id: "actual-wrapped-native-call",
    response_path,
  });
  const request = {
    query: nativeQuery,
    remaining_requests: 18,
    output_path: path.join(directory, "tiers.json"),
    mcp_failure: { kind: "missing_tier_metadata", attempts: [{ evidence_path: capture.evidence_path }] },
  };
  const before = JSON.stringify(request);
  let calls = 0;
  const result = await fetchRetailEvidence(request, async () => {
    calls++;
    return response({
      BillingCurrency: "USD",
      Items: nativeRows.map((native, index) => ({
        ...native,
        tierMinimumUnits: index ? 5 : 0,
      })),
      NextPageLink: null,
    });
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.requests_used, 1);
  assert.deepEqual(result.mcp_failure.attempts, [{ evidence_path: capture.evidence_path }]);
  assert.equal(result.mcp_failure.recorded_at, capture.queried_at);
  assert.equal(JSON.stringify(request), before);
  assert.deepEqual(fs.readFileSync(capture.raw_path), fs.readFileSync(response_path));
  for (const change of [
    (invalid) => {
      invalid.mcp_failure.kind = "empty_result";
    },
    (invalid) => {
      invalid.mcp_failure.attempts[0].response = { status: 200, results: { prices: [] } };
    },
    (invalid) => {
      invalid.mcp_failure.attempts[0].query = { ...nativeQuery, skuName: "Wrong" };
    },
  ]) {
    const invalid = structuredClone(request);
    change(invalid);
    await assert.rejects(
      fetchRetailEvidence(invalid, () => assert.fail("claimed failure must not broaden native eligibility")),
    );
  }
});

test("wrapped 429 and 503 captures permit exactly one native retry and establish exhausted fallback eligibility", async (t) => {
  const { directory, output } = setup(t);
  const nativeQuery = { ...query, meterName: "Synthetic Wrapped Retry" };
  const captures = [];
  for (const [index, status] of [429, 503].entries()) {
    const call_id = `wrapped-transient-${index}`;
    reserveQuery({ output, query: nativeQuery, call_id, retry_of: index ? "wrapped-transient-0" : undefined });
    updateAttempt(output, call_id, { state: "issued", issued_at: new Date(Date.now() - 1000).toISOString() });
    const response_path = path.join(directory, `${call_id}.json`);
    fs.writeFileSync(
      response_path,
      JSON.stringify({
        result: { content: [{ type: "text", text: JSON.stringify({ status, error: "Synthetic retryable failure" }) }] },
      }),
    );
    captures.push(
      captureMcpResponse({ output, query: nativeQuery, call_id, native_call_id: `actual-${call_id}`, response_path }),
    );
    const recorded = withLedger(output, (ledger) => ledger.attempts.find((attempt) => attempt.call_id === call_id));
    assert.equal(recorded.http_status, status);
    assert.equal(recorded.state, "error");
  }
  assert.throws(
    () =>
      reserveQuery({ output, query: nativeQuery, call_id: "forbidden-second-retry", retry_of: "wrapped-transient-1" }),
    /already reserved/,
  );
  let calls = 0;
  const result = await fetchRetailEvidence(
    {
      query: nativeQuery,
      remaining_requests: 17,
      output_path: path.join(directory, "transient-fallback.json"),
      mcp_failure: { kind: "transient_exhausted", attempts: captures.map(({ evidence_path }) => ({ evidence_path })) },
    },
    async () => {
      calls++;
      return response({
        BillingCurrency: "USD",
        Items: [{ ...row, meterName: nativeQuery.meterName }],
        NextPageLink: null,
      });
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.requests_used, 1);
});
