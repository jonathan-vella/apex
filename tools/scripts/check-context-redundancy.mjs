#!/usr/bin/env node
/** Analyze Copilot OTel reads; fail only on evidenced same-request redundant heavy reads. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HEAVY = /(?:^|\/)(?:SKILL\.md|(?:references|templates)\/[^/]+\.md|instructions\/[^/]+\.instructions\.md)$/i;
const ARTIFACT = /(?:^|\/)agent-output\//;
const BOUNDARY = /^(?:SessionStart|Stop|compact(?:ion)?|context_compaction)$/i;
const MUTATION = /(?:edit|patch|replace|create|write|delete|terminal|execute|run_in_terminal)/i;

function attributes(span) {
  return Object.fromEntries(
    (span.attributes ?? []).map(({ key, value = {} }) => [key, value.stringValue ?? value.intValue ?? value.boolValue]),
  );
}

function timestamp(value) {
  return typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : null;
}

function targetPath(value) {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("file:")) {
    try {
      return posix.normalize(fileURLToPath(value).replaceAll("\\", "/"));
    } catch {
      return value;
    }
  }
  return value.includes("://") ? value : posix.normalize(value.replaceAll("\\", "/"));
}

export function analyzeReadRedundancy(data) {
  if (!Array.isArray(data?.resourceSpans)) throw new Error("missing resourceSpans[]");
  const spans = [];
  const seen = new Set();
  let duplicateSpans = 0;
  for (const resource of data.resourceSpans) {
    for (const scope of resource.scopeSpans ?? []) {
      if (!Array.isArray(scope.spans)) throw new Error("missing scopeSpans[].spans[]");
      for (const span of scope.spans) {
        const identity = span.traceId && span.spanId ? `${span.traceId}:${span.spanId}` : null;
        if (identity && seen.has(identity)) {
          duplicateSpans += 1;
          continue;
        }
        if (identity) seen.add(identity);
        spans.push(span);
      }
    }
  }
  if (!spans.length) throw new Error("no spans found");
  const ordered = spans.every((span) => timestamp(span.startTimeUnixNano) !== null);
  if (ordered)
    spans.sort((left, right) => {
      const difference = timestamp(left.startTimeUnixNano) - timestamp(right.startTimeUnixNano);
      return difference < 0n ? -1 : difference > 0n ? 1 : 0;
    });
  const knownParents = new Map(spans.map((span) => [`${span.traceId}:${span.spanId}`, span]));
  const previous = new Map();
  const repeats = [];
  const paths = new Set();
  let reads = 0;
  let ignoredErrors = 0;
  let unparsedReads = 0;
  for (const span of spans) {
    const attrs = attributes(span);
    const tool = attrs["gen_ai.tool.name"] ?? span.name ?? "";
    const isRead = /(?:^|[/.])read_file$/.test(tool);
    if (BOUNDARY.test(span.name ?? "") || (!isRead && MUTATION.test(tool))) previous.clear();
    if (!isRead) continue;
    if (span.status?.code === 2) {
      ignoredErrors += 1;
      continue;
    }
    let args;
    try {
      args = JSON.parse(attrs["gen_ai.tool.call.arguments"]);
    } catch {
      unparsedReads += 1;
      continue;
    }
    const filePath = targetPath(args?.filePath ?? args?.uri ?? args?.path);
    if (!filePath) {
      unparsedReads += 1;
      continue;
    }
    reads += 1;
    paths.add(filePath);
    if (ARTIFACT.test(filePath)) continue;
    const start = args.startLine ?? args.start_line;
    const end = args.endLine ?? args.end_line;
    const validRange = Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start;
    const result = attrs["gen_ai.tool.call.result"];
    const digest =
      typeof result === "string" && result.length ? createHash("sha256").update(result).digest("hex") : null;
    const parent = knownParents.get(`${span.traceId}:${span.parentSpanId}`);
    const chatParent =
      parent && (parent.name?.startsWith("chat:") || attributes(parent)["gen_ai.operation.name"] === "chat");
    const entry = {
      start,
      end,
      validRange,
      digest,
      parent: span.parentSpanId,
      endTime: timestamp(span.endTimeUnixNano),
    };
    const key = JSON.stringify([span.traceId ?? "unknown", filePath]);
    const candidates = previous.get(key) ?? [];
    const overlapping = candidates.findLast(
      (prior) => !validRange || !prior.validRange || (start <= prior.end && end >= prior.start),
    );
    if (overlapping) {
      const exactRange = validRange && overlapping.validRange && start === overlapping.start && end === overlapping.end;
      const startTime = timestamp(span.startTimeUnixNano);
      const evidence =
        ordered &&
        chatParent &&
        span.traceId &&
        span.parentSpanId &&
        overlapping.parent === span.parentSpanId &&
        exactRange &&
        digest &&
        overlapping.digest === digest &&
        overlapping.endTime !== null &&
        startTime !== null &&
        overlapping.endTime <= startTime;
      repeats.push({
        filePath,
        startLine: validRange ? start : null,
        endLine: validRange ? end : null,
        heavy: HEAVY.test(filePath),
        classification: evidence ? "same-request-duplicate" : "advisory-overlap",
        reason: evidence
          ? "Same completed range and returned payload under one chat request; no observed intervening mutation."
          : "Overlapping read; context continuity, revision, timing or complete result evidence is insufficient.",
      });
    }
    candidates.push(entry);
    previous.set(key, candidates);
  }
  return {
    spans: spans.length,
    reads,
    uniquePaths: paths.size,
    duplicateSpans,
    ignoredErrors,
    unparsedReads,
    repeats,
    violations: repeats.filter((item) => item.heavy && item.classification === "same-request-duplicate").length,
    limitations:
      "Missing trace events cannot prove no compaction or external edit. Payload equality is not a file revision. Cross-request overlaps remain advisory; no token savings inferred.",
  };
}

export function runValidator(args = process.argv.slice(2)) {
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file || args.some((arg) => arg.startsWith("--") && arg !== "--json")) {
    console.error("usage: node tools/scripts/check-context-redundancy.mjs <log.json> [--json]");
    return 2;
  }
  try {
    const report = analyzeReadRedundancy(JSON.parse(readFileSync(resolve(file), "utf8")));
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        `Scanned ${report.reads} reads across ${report.spans} spans; ${report.violations} heavy same-request duplicates.`,
      );
      for (const item of report.repeats)
        console.log(`${item.classification}: ${item.filePath} (${item.startLine ?? "?"}-${item.endLine ?? "?"})`);
      console.log(report.limitations);
    }
    return report.violations ? 1 : 0;
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = runValidator();
