// Unit tests for tools/scripts/azure-sla-section.mjs (pure parsing helpers and CLI argument handling).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const mod = await import(path.join(ROOT, "tools/scripts/azure-sla-section.mjs"));

const PARAGRAPHS = [
  "App Service PAGEREF _Toc1 \\h 24",
  "Azure Container Registry PAGEREF _Toc2 \\h 37",
  "App Service",
  "Additional Definitions:",
  "Uptime Percentage",
  "< 99.95%",
  "Azure Container Registry",
  "Managed Registry",
  "< 99.9%",
  "Table of Contents / Definitions",
  "Content Delivery Network (CDN)",
];

describe("docxXmlToParagraphs", () => {
  it("strips tags, decodes entities and drops empty paragraphs", () => {
    const xml =
      "<w:p><w:r><w:t>&lt; 99.95%</w:t></w:r></w:p><w:p><w:pPr/></w:p><w:p w:x='1'><w:t>A &amp; B</w:t></w:p>";
    assert.deepEqual(mod.docxXmlToParagraphs(xml), ["< 99.95%", "A & B"]);
  });

  it("leaves no tag behind, including an unterminated one", () => {
    assert.equal(mod.stripTags("a<script"), "a");
    assert.equal(mod.stripTags("<<b>script>alert(1)<</b>/script>"), "script>alert(1)/script>");
    assert.ok(!mod.stripTags("<scr<b>ipt>x<script").includes("<"));
    assert.equal(mod.stripTags("plain text"), "plain text");
  });
});

describe("tocServices", () => {
  it("returns names from PAGEREF lines only", () => {
    assert.deepEqual(mod.tocServices(PARAGRAPHS), ["App Service", "Azure Container Registry"]);
  });
});

describe("extractSections", () => {
  it("stops at the next service heading and skips table of contents lines", () => {
    const [section] = mod.extractSections(PARAGRAPHS, "app service");
    assert.equal(section.startLine, 3);
    assert.deepEqual(section.lines, ["App Service", "Additional Definitions:", "Uptime Percentage", "< 99.95%"]);
    assert.equal(section.truncated, false);
  });

  it("stops at the table of contents marker", () => {
    const [section] = mod.extractSections(PARAGRAPHS, "Azure Container Registry");
    assert.equal(section.lines.at(-1), "< 99.9%");
  });

  it("truncates to the requested line count and reports the full size", () => {
    const [section] = mod.extractSections(PARAGRAPHS, "App Service", 2);
    assert.equal(section.lines.length, 2);
    assert.equal(section.truncated, true);
    assert.equal(section.totalLines, 4);
  });

  it("returns no sections for an unknown service", () => {
    assert.deepEqual(mod.extractSections(PARAGRAPHS, "Nope"), []);
  });
});

describe("candidateMonths", () => {
  it("walks backwards across a year boundary", () => {
    const months = mod.candidateMonths(new Date(Date.UTC(2026, 0, 15)), 3);
    assert.deepEqual(months, [
      { year: 2026, month: 0 },
      { year: 2025, month: 11 },
      { year: 2025, month: 10 },
    ]);
  });
});

describe("slaDocUrl", () => {
  it("builds the consolidated SLA download URL", () => {
    assert.equal(
      mod.slaDocUrl(2026, 9),
      "https://www.microsoft.com/licensing/docs/documents/download/OnlineSvcsConsolidatedSLA(WW)(English)(October_2026)(CR).docx",
    );
  });
});

describe("parseArgs", () => {
  it("parses a service with options", () => {
    const a = mod.parseArgs(["App Service", "--max-lines", "10", "--month", "2026-10"]);
    assert.equal(a.service, "App Service");
    assert.equal(a.maxLines, 10);
    assert.equal(a.month, "2026-10");
  });

  it("rejects bad input", () => {
    assert.ok(mod.parseArgs([]).error);
    assert.ok(mod.parseArgs(["a", "b"]).error);
    assert.ok(mod.parseArgs(["a", "--max-lines", "0"]).error);
    assert.ok(mod.parseArgs(["a", "--month", "2026-13"]).error);
    assert.ok(mod.parseArgs(["a", "--bogus"]).error);
  });

  it("treats the positional as a filter with --list", () => {
    assert.equal(mod.parseArgs(["--list", "storage"]).filter, "storage");
  });
});

describe("run", () => {
  it("returns exit 2 when only non-docx responses are available", async () => {
    const errors = [];
    const fetchImpl = async () => new Response("<html>not a docx</html>", { status: 200 });
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-sla-test-"));
    const code = await mod.run(["App Service", "--month", "2026-10"], {
      out: () => {},
      err: (m) => errors.push(m),
      fetchImpl,
      cacheDir,
      now: new Date(Date.UTC(2026, 9, 1)),
    });
    fs.rmSync(cacheDir, { recursive: true, force: true });
    assert.equal(code, 2);
    assert.match(errors.join("\n"), /could not download/);
  });

  it("returns exit 2 for a missing local file", async () => {
    const errors = [];
    const code = await mod.run(["App Service", "--file", "/nonexistent/sla.docx"], {
      out: () => {},
      err: (m) => errors.push(m),
    });
    assert.equal(code, 2);
  });
});
