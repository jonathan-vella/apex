#!/usr/bin/env node
/**
 * Fetches Azure deprecation notices from multiple sources:
 * 1. Azure Updates RSS feed
 * 2. Known deprecation patterns (maintained list)
 *
 * Outputs: .github/data/azure-deprecations.json
 */

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

const OUTPUT_FILE = ".github/data/azure-deprecations.json";
// The old /updates/feed/ URL now 301s to an HTML page, which parsed as zero items.
const AZURE_UPDATES_RSS = "https://www.microsoft.com/releasecommunications/api/v2/azure/rss";

// <category> is a comma-separated tag list, e.g. "Compute,Virtual Machines,Retirements".
const RETIREMENT_CATEGORY = "Retirements";

// Known deprecated SKUs/services (fallback when RSS fails)
const KNOWN_DEPRECATIONS = [
  {
    service: "Azure CDN",
    sku: "Standard_Microsoft",
    sunsetDate: "2025-09-30",
    replacement: "Standard_AzureFrontDoor",
    source: "manual",
    addedDate: "2024-01-15",
  },
  {
    service: "Azure CDN",
    sku: "Premium_Microsoft",
    sunsetDate: "2025-09-30",
    replacement: "Premium_AzureFrontDoor",
    source: "manual",
    addedDate: "2024-01-15",
  },
  {
    service: "Application Gateway",
    sku: "Standard_v1",
    sunsetDate: "2026-04-28",
    replacement: "Standard_v2",
    source: "manual",
    addedDate: "2024-06-01",
  },
  {
    service: "Application Gateway",
    sku: "WAF_v1",
    sunsetDate: "2026-04-28",
    replacement: "WAF_v2",
    source: "manual",
    addedDate: "2024-06-01",
  },
  {
    service: "Azure Container Registry",
    sku: "Classic",
    sunsetDate: "2024-03-31",
    replacement: "Basic/Standard/Premium",
    source: "manual",
    addedDate: "2023-01-01",
  },
  {
    service: "Azure Service Bus",
    sku: "Basic (legacy)",
    sunsetDate: null,
    replacement: "Standard/Premium",
    source: "manual",
    notes: "Basic tier has limited features, consider Premium for production",
  },
  {
    service: "Azure Cache for Redis",
    sku: "Enterprise, Enterprise Flash",
    sunsetDate: "2027-03-31",
    replacement: "Azure Managed Redis",
    source: "manual",
    notes: "https://learn.microsoft.com/azure/azure-cache-for-redis/retirement-faq",
    addedDate: "2026-10-13",
  },
  {
    service: "Azure Cache for Redis",
    sku: "Basic, Standard, Premium",
    sunsetDate: "2028-09-30",
    replacement: "Azure Managed Redis",
    source: "manual",
    notes: "https://learn.microsoft.com/azure/azure-cache-for-redis/retirement-faq",
    addedDate: "2026-10-13",
  },
  {
    service: "Azure Functions",
    sku: "Linux Consumption",
    sunsetDate: "2028-09-30",
    replacement: "Flex Consumption",
    source: "manual",
    addedDate: "2026-10-13",
  },
];

async function fetchAzureUpdates() {
  console.log("Fetching Azure Updates RSS feed...");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch(AZURE_UPDATES_RSS, {
      headers: {
        "User-Agent": "Azure-Deprecation-Tracker/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Failed to fetch RSS: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const parser = new XMLParser();
    const result = parser.parse(xml);

    const items = result?.rss?.channel?.item || [];
    const deprecations = [];

    for (const item of items) {
      const isDeprecation = String(item.category ?? "")
        .split(",")
        .some((tag) => tag.trim() === RETIREMENT_CATEGORY);

      if (isDeprecation) {
        deprecations.push({
          service: extractServiceName(item.title),
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          source: "azure-updates-rss",
          sunsetDate: extractSunsetDate(item.description),
          replacement: null, // Would need NLP to extract
        });
      }
    }

    console.log(`Found ${deprecations.length} deprecation notices in RSS feed`);
    return deprecations;
  } catch (error) {
    console.error("Error fetching Azure Updates:", error.message);
    return [];
  }
}

function extractServiceName(title) {
  // Extract service name from title (basic extraction)
  const bare = title?.replace(/^Retirement:\s*/i, "");
  const match = bare?.match(/Azure\s+([A-Za-z\s]+?)(?:\s+(?:is|will|retirement|deprecation))/i);
  return match ? match[1].trim() : bare?.split(" ").slice(0, 3).join(" ") || "Unknown";
}

function extractSunsetDate(description) {
  // Try to extract date from description
  const datePatterns = [
    /(?:by|on|after|before)\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = description?.match(pattern);
    if (match) {
      try {
        return new Date(match[1]).toISOString().split("T")[0];
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function main() {
  console.log("🔍 Azure Deprecation Tracker\n");

  // Load existing data if available
  let _existingData = { deprecations: [], lastUpdated: null };
  if (existsSync(OUTPUT_FILE)) {
    try {
      _existingData = JSON.parse(readFileSync(OUTPUT_FILE, "utf8"));
    } catch {
      console.warn("Could not parse existing deprecation data");
    }
  }

  // Fetch from Azure Updates RSS
  const rssDeprecations = await fetchAzureUpdates();

  // Merge with known deprecations (deduplicate by service+sku)
  const allDeprecations = [...KNOWN_DEPRECATIONS];

  for (const rss of rssDeprecations) {
    // Feed items have no SKU, so link is the identity; service alone collapses distinct notices.
    const exists = allDeprecations.some((d) =>
      d.link ? d.link === rss.link : d.service === rss.service && d.sku === rss.sku,
    );
    if (!exists) {
      allDeprecations.push(rss);
    }
  }

  const today = new Date();
  for (const d of allDeprecations) {
    if (d.sunsetDate) d.status = new Date(d.sunsetDate) <= today ? "retired" : "upcoming";
  }

  // Sort by sunset date (soonest first)
  allDeprecations.sort((a, b) => {
    if (!a.sunsetDate) return 1;
    if (!b.sunsetDate) return -1;
    return new Date(a.sunsetDate) - new Date(b.sunsetDate);
  });

  const output = {
    lastUpdated: new Date().toISOString(),
    totalCount: allDeprecations.length,
    sources: ["manual-known", "azure-updates-rss"],
    deprecations: allDeprecations,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`\n✅ Wrote ${allDeprecations.length} deprecations to ${OUTPUT_FILE}`);

  // Summary
  const upcoming = allDeprecations.filter((d) => {
    if (!d.sunsetDate) return false;
    const sunset = new Date(d.sunsetDate);
    const now = new Date();
    const threshold = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
    return sunset > now && sunset <= threshold;
  });

  if (upcoming.length > 0) {
    console.log(`\n⚠️  ${upcoming.length} deprecation(s) within 180 days:`);
    for (const d of upcoming) {
      console.log(`   - ${d.service} (${d.sku || "various"}): ${d.sunsetDate}`);
    }
  }
}

main().catch(console.error);
