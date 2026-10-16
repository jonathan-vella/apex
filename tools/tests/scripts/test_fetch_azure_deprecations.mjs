import assert from "node:assert/strict";
import test from "node:test";
import { extractSunsetDate, mergeDeprecations, parseFeed } from "../../scripts/fetch-azure-deprecations.mjs";

const item = (fields) =>
  `<item>${Object.entries(fields)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("")}</item>`;

const FEED = `<?xml version="1.0"?><rss version="2.0"><channel>${[
  item({
    link: "https://azure.microsoft.com/updates?id=1",
    category: "Compute,Virtual Machines,Retirements",
    title: "Retirement Update: SAP container images removed October 14, 2026",
    description: "On September 14, 2026 the old images were retired. Please move before the final removal.",
  }),
  item({
    link: "https://azure.microsoft.com/updates?id=2",
    category: "Developer tools,DevOps,Retirements",
    title: "Retirement: Microsoft Dev Box will be retired on September 18, 2028",
    description: "Beginning on September 14, 2026, Microsoft Dev Box will begin the closing-down process.",
  }),
  item({
    link: "https://azure.microsoft.com/updates?id=3",
    category: "Retirements",
    title: "Retirement: Pod name dimension in AKS pod platform metrics",
    description: "Beginning September 30, 2027, support for the pod name dimension is retiring.",
  }),
  item({
    link: "https://azure.microsoft.com/updates?id=4",
    category: "Launched,Compute,Features",
    title: "Generally available: something new",
    description: "Support for the classic model ends on October 1, 2030.",
  }),
].join("")}</channel></rss>`;

test("parseFeed keeps only items tagged Retirements in a comma-separated category list", () => {
  const items = parseFeed(FEED);
  assert.deepEqual(
    items.map((entry) => entry.link),
    [
      "https://azure.microsoft.com/updates?id=1",
      "https://azure.microsoft.com/updates?id=2",
      "https://azure.microsoft.com/updates?id=3",
    ],
  );
  assert.ok(items.every((entry) => entry.source === "azure-updates-rss"));
});

test("a date in the title wins over an earlier date in the description", () => {
  const [sap, devBox] = parseFeed(FEED);
  assert.equal(sap.sunsetDate, "2026-10-14");
  assert.equal(devBox.sunsetDate, "2028-09-18");
});

test("a milestone date is skipped unless its own sentence announces the retirement", () => {
  assert.equal(extractSunsetDate("Retirement: X", "Beginning on September 14, 2026, X will begin closing down."), null);
  assert.equal(
    extractSunsetDate("Retirement: X", "Beginning September 30, 2027, support for X is retiring."),
    "2027-09-30",
  );
  assert.equal(extractSunsetDate("Retirement: X", "Microsoft will retire X on 5 March 2028."), "2028-03-05");
  assert.equal(extractSunsetDate("Retirement: X", "No date given."), null);
  assert.equal(extractSunsetDate("Retirement: X", "Retires on February 31, 2028."), null);
});

test("mergeDeprecations dedupes by link, stamps status and sorts undated entries last", () => {
  const known = [{ service: "Azure CDN", sku: "Standard_Microsoft", sunsetDate: "2025-09-30", source: "manual" }];
  const feed = parseFeed(FEED);
  const undated = {
    service: "Undated",
    link: "https://azure.microsoft.com/updates?id=9",
    sunsetDate: null,
    source: "azure-updates-rss",
  };
  const merged = mergeDeprecations(known, [...feed, { ...feed[0] }, undated], new Date("2026-10-13T00:00:00Z"));

  assert.equal(merged.length, 5, "the duplicate link is collapsed but distinct links sharing a service are kept");
  const byDate = Object.fromEntries(merged.map((entry) => [entry.sunsetDate, entry.status]));
  assert.equal(byDate["2025-09-30"], "retired");
  assert.equal(byDate["2026-10-14"], "upcoming");
  assert.equal(merged.at(-1).sunsetDate, null);
  assert.equal(merged.at(-1).status, undefined);
});
