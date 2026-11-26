#!/usr/bin/env node
/**
 * Offline Microsoft Learn Azure Well-Architected Review CSV exporter.
 *
 * Bridges an APEX standalone brownfield assessment bundle (`agent-output/<project>`)
 * into Microsoft's `Azure_Well_Architected_Review_Template_Export.csv` / WARP format:
 * - Populates `Selected Answer` with the exact `Answers` text (Microsoft portal/WARP convention)
 *   only when backed by observed Azure/IaC evidence or explicit human-attested discovery answers.
 * - Never fabricates `"None of the above."` for unknown/unassessed questions; marks unknowns in `Note`.
 * - Neutralizes spreadsheet formula prefixes (`=`, `+`, `-`, `@`) on free-text `Context`/`Note` cells.
 */

import crypto, { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeWafScores, verifyWafScores } from "./assessment-waf-scores.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PILLAR_WAF_URLS = Object.freeze({
  Reliability: {
    code: "RE:05",
    url: "https://learn.microsoft.com/azure/well-architected/reliability/checklist",
  },
  Security: {
    code: "SE:06",
    url: "https://learn.microsoft.com/azure/well-architected/security/checklist",
  },
  "Cost Optimization": {
    code: "CO:07",
    url: "https://learn.microsoft.com/azure/well-architected/cost-optimization/checklist",
  },
  "Operational Excellence": {
    code: "OE:07",
    url: "https://learn.microsoft.com/azure/well-architected/operational-excellence/checklist",
  },
  "Performance Efficiency": {
    code: "PE:05",
    url: "https://learn.microsoft.com/azure/well-architected/performance-efficiency/checklist",
  },
});

const PRIORITY_WEIGHTS = Object.freeze({
  Critical: "95",
  High: "80",
  Medium: "65",
  Low: "50",
});

/** Built-in canonical Microsoft WAF Review question/option subset when no external --template CSV is provided. */
export const DEFAULT_WAF_TEMPLATE_QUESTIONS = Object.freeze([
  [
    "Reliability",
    "How do you identify and rate the workload's flows?",
    [
      "We identify all user and system flows in the workload.",
      "We assigned a criticality rating to each flow.",
      "None of the above.",
    ],
  ],
  [
    "Reliability",
    "How do you define reliability targets?",
    ["We have availability targets.", "We have recovery targets.", "None of the above."],
  ],
  [
    "Reliability",
    "How do you implement redundancy?",
    [
      "We use platform-provided capabilities to introduce and manage the redundancy of our compute resources.",
      "We replicate data across physical locations by using platform-provided capabilities whenever possible.",
      "None of the above.",
    ],
  ],
  [
    "Reliability",
    "How do you test your resiliency and availability strategies?",
    [
      "We run tests in a production-like environment, and we run a targeted subset of tests in production.",
      "None of the above.",
    ],
  ],
  [
    "Reliability",
    "How do you plan for disaster scenarios?",
    ["We implement robust backup strategies.", "We do regular drills to practice recovery.", "None of the above."],
  ],
  [
    "Reliability",
    "How do you monitor workload health?",
    ["We send out alerts when the health of a flow degrades.", "None of the above."],
  ],
  [
    "Security",
    "What steps have you taken to define and maintain a security baseline for your workload?",
    [
      "Our baseline is enforced through automated guardrails and policies.",
      "We use a cloud security posture management (CSPM) tool to detect drift and gaps from our baseline.",
      "We have identified all regulatory and geographic compliance requirements applicable to our workload.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "How are you securing your application code, development environment, and software supply chain?",
    [
      "We use threat modeling to identify and rank threats, map them to mitigations, and share findings with stakeholders.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "How do you classify your workload data and ensure it is protected according to its sensitivity?",
    ["We have aligned the classification categories for our data to our business requirements.", "None of the above."],
  ],
  [
    "Security",
    "How are you isolating components within your architecture to contain breaches and apply controls in layers?",
    [
      "Workload resources are organized using management groups, subscriptions, and resource groups to limit access to only those who need it.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "What identity and access controls are in place to ensure only trusted identities can access your workload?",
    [
      "All identity types are identified for this workload, and managed identities or service principals are preferred over hard-coded credentials.",
      "Role-based Access Control (RBAC) is used, and roles follow the principle of least privilege.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "How is network connectivity secured for this workload?",
    [
      "Firewalls are used to control ingress and egress traffic at the network edge.",
      "Network security groups (NSGs) are used to isolate and protect traffic within virtual networks.",
      "Individual services are not accessible from public IP addresses and are protected with service-level firewall rules.",
      "Connectivity to PaaS services uses private endpoints.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "What encryption controls do you have in place to protect data at rest and in transit?",
    [
      "We use native platform encryption for cloud-hosted resources.",
      "All data in transit is encrypted with TLS 1.2 or higher.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "How are you securing the secrets and credentials used by your workload?",
    [
      "Application secrets are stored in a dedicated secret management system, outside of the source code.",
      "We use automated tools to detect and prevent hard-coded secrets in source code and build artifacts.",
      "Role-based access control (RBAC) is used to manage who and what can access secrets.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "How are you monitoring the application and infrastructure for security threats?",
    ["We use cloud-native monitoring tools for our workload resources and infrastructure.", "None of the above."],
  ],
  [
    "Security",
    "What security testing practices are in place for your workload before and after it reaches production?",
    [
      "Security tests are integrated into our DevOps build and deployment pipelines.",
      "We periodically simulate attacks through penetration testing and war-game exercises.",
      "We perform manual security testing and use scanning tools to find vulnerabilities that automated tests miss.",
      "None of the above.",
    ],
  ],
  [
    "Security",
    "What documented procedures are in place to respond when a security incident occurs involving your workload?",
    [
      "A designated incident contact is established with documented communication and reporting procedures.",
      "Post-incident reviews and tabletop exercises are conducted systematically.",
      "A Security Operations Center (SOC) or central security team is involved in monitoring, detection, and response.",
      "None of the above.",
    ],
  ],
  [
    "Cost Optimization",
    "How do you create a culture of financial responsibility?",
    ["We communicate financial expectations.", "We make budgets and workload costs transparent.", "None of the above."],
  ],
  [
    "Cost Optimization",
    "How do you perform cost modeling?",
    ["We determine cost drivers.", "We have a budget for the workload.", "None of the above."],
  ],
  [
    "Cost Optimization",
    "How do you monitor costs?",
    [
      "We enable data collection on all resources.",
      "We group cost data for easier analysis.",
      "We generate cost reports.",
      "We assign a resource owner for each cost item.",
      "We regularly review cost reports with stakeholders against the budget and cost model.",
      "None of the above.",
    ],
  ],
  [
    "Cost Optimization",
    "How do you govern your spending?",
    [
      "We use governance policies to provide spending guardrails.",
      "We use infrastructure as code to standardize deployments.",
      "None of the above.",
    ],
  ],
  [
    "Cost Optimization",
    "How do you get the best rates from providers?",
    [
      "We evaluate and determine the right billing model.",
      "We evaluate and commit to available discounts.",
      "None of the above.",
    ],
  ],
  [
    "Operational Excellence",
    "How do you formalize routine and nonroutine tasks?",
    [
      "We have operational instructions that have easily understood checklist items.",
      "We detail responsibilities and provide guidance in our operating procedures for improvised and incident response tasks.",
      "None of the above.",
    ],
  ],
  [
    "Operational Excellence",
    "How do you use infrastructure as code (IaC)?",
    [
      "We prefer declarative instead of imperative scripting approaches.",
      "We use modules only where they add a relevant layer of abstraction.",
      "None of the above.",
    ],
  ],
  [
    "Operational Excellence",
    "How did you build your workload supply chain?",
    [
      "We ensure all deployments, to all environments, happen through deployment pipelines.",
      "We deploy repeatable and immutable infrastructure with code.",
      "We have a standard deployment method to the production environment.",
      "We use quality gates to promote code to higher environments.",
      "None of the above.",
    ],
  ],
  [
    "Operational Excellence",
    "How did you design your observability platform?",
    [
      "We collect telemetry or events like logs and metrics.",
      "We prefer, where possible, platform services and capabilities for collecting metrics and log information over custom solutions.",
      "We have created an alerting strategy that focuses on actionable alerts directed to appropriate parties.",
      "None of the above.",
    ],
  ],
  [
    "Operational Excellence",
    "How do you implement your incident management (IcM) process?",
    [
      "We document our incident response plan.",
      "We test our incident response strategy regularly.",
      "We use RCA findings to implement improvements.",
      "None of the above.",
    ],
  ],
  [
    "Operational Excellence",
    "What safe deployment practices do you use?",
    ["We rely on health signals to provide go, no-go decisions during rollouts.", "None of the above."],
  ],
  [
    "Performance Efficiency",
    "How do you define performance targets?",
    [
      "We understand the performance requirements for the workload.",
      "We set targets for the identified performance metrics.",
      "None of the above.",
    ],
  ],
  [
    "Performance Efficiency",
    "How do you conduct capacity planning?",
    ["We gather capacity data to forecast future demand.", "None of the above."],
  ],
  [
    "Performance Efficiency",
    "How do you collect performance data?",
    [
      "We store performance metrics and logs in a central location.",
      "We define retention policies for log and metrics data to enable effective troubleshooting and monitoring.",
      "We collect metrics and logs for every resource.",
      "None of the above.",
    ],
  ],
  [
    "Performance Efficiency",
    "How do you conduct performance testing?",
    [
      "We have well-defined acceptance criteria for the success of performance tests.",
      "We have created performance test scenarios, and the test environment is in place.",
      "We run performance testing for every change.",
      "None of the above.",
    ],
  ],
  [
    "Performance Efficiency",
    "How do you prioritize the performance of critical flows?",
    ["We identify all critical flows.", "None of the above."],
  ],
]);

/** RFC 4180 CSV parser supporting quoted multiline fields, UTF-8 BOM stripping, and quote validation. */
export function parseCsv(rawContent) {
  const content = String(rawContent ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (content[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    throw new Error("Malformed CSV: unclosed quoted field");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function sanitizeSpreadsheetText(value) {
  const str = String(value ?? "");
  if (/^[\t\r]/.test(str) || /^[=+\-@]/.test(str.trimStart())) {
    return `'${str}`;
  }
  return str;
}

function escapeCsvCell(value) {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function serializeCsv(rows, width = 6) {
  return `${rows
    .map((r) => {
      const padded = [...r];
      while (padded.length < width) padded.push("");
      return padded.map(escapeCsvCell).join(",");
    })
    .join("\r\n")}\r\n`;
}

function assertNoSymlinkChain(targetPath, label) {
  const resolved = path.resolve(targetPath);
  const stopRoots = new Set(
    [ROOT, process.cwd(), os.tmpdir()].map((dir) => {
      try {
        return path.resolve(dir);
      } catch {
        return dir;
      }
    }),
  );
  let cur = resolved;
  while (true) {
    if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) {
      throw new Error(`Symlink forbidden for ${label}: ${cur}`);
    }
    if (stopRoots.has(cur)) break;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return resolved;
}

function safeReadJson(projectDir, relPath) {
  const target = path.join(projectDir, relPath);
  if (!fs.existsSync(target)) return null;
  assertNoSymlinkChain(target, relPath);
  const raw = fs.readFileSync(target);
  const sha = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
  try {
    return { data: JSON.parse(raw.toString("utf8")), relPath, sha };
  } catch (err) {
    throw new Error(`Malformed JSON in ${target}: ${err.message}`, { cause: err });
  }
}

const isTrue = (v) => v === true || v === 1;
const isFalse = (v) => v === false || v === 0;

function isKnownClause(clause) {
  const trimmed = String(clause ?? "")
    .replace(/[.]+$/, "")
    .trim();
  if (!trimmed) return false;
  if (/^(?:unknown|not supplied|not sure|not decided|n\/a|none supplied)\b/i.test(trimmed)) return false;
  if (/\b(?:is|are|:)\s*(?:unknown|not supplied|unverified)\b/i.test(trimmed)) return false;
  if (
    /\bno\b[^.;]*\b(?:budget|target|cap|amount|sla|rto|rpo|limit)\b[^.;]*\b(?:supplied|known|defined|set|provided|established)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  return true;
}

export function isKnownAnswer(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => isKnownClause(entry));
  }
  const text = String(value).trim();
  if (!text) return false;
  const clauses = text
    .split(/[.;]+(?:\s+|$)/)
    .map((c) => c.trim())
    .filter(Boolean);
  return clauses.length > 0 && clauses.some((clause) => isKnownClause(clause));
}

function normalizeKey(text) {
  return String(text ?? "")
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapLegacyItems(doc) {
  if (!doc || typeof doc !== "object") return [];
  const subs = Array.isArray(doc.subscriptions) ? doc.subscriptions : [];
  const out = [];
  for (const sub of subs) {
    const res = sub?.result;
    if (Array.isArray(res)) {
      for (const block of res) {
        if (Array.isArray(block?.items)) out.push(...block.items);
      }
    } else if (Array.isArray(res?.items)) {
      out.push(...res.items);
    }
  }
  return out;
}

function loadCapturedAnswers(projectDir, explicitAnswersPath) {
  if (explicitAnswersPath) {
    const safePath = assertNoSymlinkChain(explicitAnswersPath, "--answers");
    try {
      return JSON.parse(fs.readFileSync(safePath, "utf8"));
    } catch (err) {
      throw new Error(`Malformed JSON in ${safePath}: ${err.message}`, { cause: err });
    }
  }
  for (const candidate of [
    "_meta/requirements-answers.json",
    "_meta/inputs/requirements-led-answers.json",
    "_meta/user-brief.json",
  ]) {
    const loaded = safeReadJson(projectDir, candidate);
    if (loaded?.data && typeof loaded.data === "object" && !Array.isArray(loaded.data)) {
      return loaded.data;
    }
  }
  return {};
}

function ratingFromScore(score, status) {
  if (status === "not_assessed" || score === null || score === undefined) {
    return { label: "Not Assessed", ratio: "'0/0" };
  }
  const scaled = Math.round(Number(score) * 10);
  const label = scaled >= 67 ? "Excellent" : scaled >= 33 ? "Moderate" : "Critical";
  return { label, ratio: `'${scaled}/100` };
}

function collectSignals(projectDir, answers) {
  const inventory = safeReadJson(projectDir, "_meta/live-inventory.json");
  const controls = safeReadJson(projectDir, "_meta/controls-evidence.json");
  const controlsExtra = safeReadJson(projectDir, "_meta/scalar-configuration-extra.json");
  const topology = safeReadJson(projectDir, "_meta/scalar-topology.json");
  const diagRec = safeReadJson(projectDir, "_meta/diagnostics-recovery-evidence.json");
  const opsFallback = safeReadJson(projectDir, "_meta/scalar-operations.json");
  const advisorDef = safeReadJson(projectDir, "_meta/advisor-defender-evidence.json");
  const policy = safeReadJson(projectDir, "_meta/scoped-policy-observations.json");
  const metrics = safeReadJson(projectDir, "_meta/metrics-evidence.json");
  const staticIac = safeReadJson(projectDir, "_meta/static-iac-evidence.json");
  const cost = safeReadJson(projectDir, "contracts/03-cost-management.json");
  const actionRegister = safeReadJson(projectDir, "contracts/assessment-action-register.json");
  const wafChecks = safeReadJson(projectDir, "_meta/waf-checks.json");
  const wafScores = safeReadJson(projectDir, "_meta/waf-scores.json");

  const invResources = (inventory?.data?.inventories ?? []).flatMap((inv) => inv.resources ?? []);

  const rawCfgItems = [
    ...(controls?.data?.configuration ?? []).flatMap((s) => s.items ?? []),
    ...(controlsExtra?.data?.items ?? []),
    ...unwrapLegacyItems(controlsExtra?.data),
  ];
  const cfgMap = new Map();
  rawCfgItems.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const key = item.id ? String(item.id).toLowerCase() : `anon-${idx}`;
    const prev = cfgMap.get(key) ?? {};
    const merged = { ...prev };
    for (const [k, v] of Object.entries(item)) {
      if (v !== null && v !== undefined && v !== "") merged[k] = v;
      else if (!(k in merged)) merged[k] = v;
    }
    cfgMap.set(key, merged);
  });
  const cfgItems = [...cfgMap.values()];
  const cfgSrc = (controls?.data?.configuration ?? []).some((s) => (s.items ?? []).length > 0)
    ? controls
    : (controlsExtra ?? controls);

  const modernTopoScopes =
    (topology?.data?.topology ?? []).length > 0 ? topology.data.topology : (controls?.data?.topology ?? []);
  const legacyTopoItems = unwrapLegacyItems(topology?.data);
  const peConns = [
    ...modernTopoScopes.flatMap((s) => s.private_endpoint_connections ?? []),
    ...legacyTopoItems.filter((i) => (i.connectionStatus ?? i.connectionState) !== undefined),
  ];
  const topoItems = [...modernTopoScopes.flatMap((s) => s.items ?? []), ...legacyTopoItems];
  const topoSrc = topology ?? controls;

  const diagOps = diagRec?.data?.operations ?? [];
  const primaryMon = diagOps.flatMap((s) => s.monitoring_resources ?? []);
  const legacyMon = [
    ...(opsFallback?.data?.operations ?? []).flatMap((s) => s.monitoring_resources ?? []),
    ...unwrapLegacyItems(opsFallback?.data),
  ];
  const monResources = primaryMon.length > 0 ? primaryMon : legacyMon;
  const monSrc = primaryMon.length > 0 ? diagRec : (opsFallback ?? diagRec);
  const diagSamples = diagOps.flatMap((s) => s.diagnostic_settings ?? []);

  const recScopes = diagRec?.data?.recovery ?? [];
  const recItems = recScopes.flatMap((s) => s.items ?? []);
  const protectedItems = recScopes.flatMap((s) => s.protected_items ?? []);
  const defItems = (advisorDef?.data?.defender ?? controls?.data?.defender ?? []).flatMap((s) => s.items ?? []);
  const polItems = [
    ...(policy?.data?.policy ?? controls?.data?.policy ?? []).flatMap((s) => s.assignments ?? []),
    ...unwrapLegacyItems(policy?.data),
  ];
  const metricItems = (metrics?.data?.utilization ?? []).flatMap((s) => s.items ?? []);
  const costComplete = (cost?.data?.evidence ?? []).some((e) => e.status === "complete");

  const answerNotes = new Map();
  const noneQuestions = new Set();
  const mark = (answerOptions, note) => {
    const list = Array.isArray(answerOptions) ? answerOptions : [answerOptions];
    for (const opt of list) {
      const key = normalizeKey(opt);
      if (!answerNotes.has(key)) answerNotes.set(key, note);
    }
  };
  const markQuestionNone = (questionVariants) => {
    for (const q of Array.isArray(questionVariants) ? questionVariants : [questionVariants]) {
      noneQuestions.add(normalizeKey(q));
    }
  };

  if (invResources.length > 0 && inventory) {
    const cite = `[Observed: ${inventory.relPath}#sha256=${inventory.sha}, ${invResources.length} resources]`;
    mark(
      [
        "Workload resources are organized using management groups, subscriptions, and resource groups to limit access to only those who need it.",
        "We use management groups, subscriptions, and resource groups to organize resources so that only those who need access to them have it.",
      ],
      cite,
    );
    if (invResources.some((r) => /systemassigned|userassigned/i.test(String(r.identityType ?? "")))) {
      mark(
        [
          "All identity types are identified for this workload, and managed identities or service principals are preferred over hard-coded credentials.",
          "We identified all identity types and prefer managed identities or service principals over user identities for applications and services.",
        ],
        cite,
      );
    }
  }

  if (cfgItems.length > 0 && cfgSrc) {
    const cite = `[Observed: ${cfgSrc.relPath}#sha256=${cfgSrc.sha}]`;
    const encryptedResourceTypes = new Set([
      "microsoft.storage/storageaccounts",
      "microsoft.sql/managedinstances",
      "microsoft.sql/servers",
      "microsoft.sql/servers/databases",
      "microsoft.documentdb/databaseaccounts",
      "microsoft.dbforpostgresql/flexibleservers",
      "microsoft.keyvault/vaults",
      "microsoft.compute/virtualmachines",
      "microsoft.servicebus/namespaces",
      "microsoft.containerregistry/registries",
    ]);
    const dataResources = [...cfgItems, ...invResources].filter((r) =>
      encryptedResourceTypes.has(String(r.type || "").toLowerCase()),
    );
    if (dataResources.length > 0) {
      mark(
        [
          "We use native platform encryption for cloud-hosted resources.",
          "We employ native encryption methods for cloud-hosted environments.",
        ],
        cite,
      );
    }

    const tlsBearingTypes = new Set([
      "microsoft.web/sites",
      "microsoft.storage/storageaccounts",
      "microsoft.sql/servers",
      "microsoft.sql/managedinstances",
      "microsoft.cache/redis",
    ]);
    const tlsTargets = cfgItems.filter((c) => tlsBearingTypes.has(String(c.type || "").toLowerCase()));
    const hasTls12 = (c) => {
      const t = String(c.type || "").toLowerCase();
      const tlsVal = String(
        c.minTlsVersion || c.storageMinTls || c.minimumTlsVersion || c.sqlMinTls || c.redisMinTlsVersion || "",
      );
      if (/^1\.[01]\b|^tls1_[01]\b/i.test(tlsVal)) return false;
      if (/^1\.[23]\b|^tls1_[23]\b/i.test(tlsVal)) return true;
      if (t === "microsoft.web/sites") return isTrue(c.httpsOnly);
      if (t === "microsoft.storage/storageaccounts") return isTrue(c.storageHttpsOnly);
      return false;
    };
    if (tlsTargets.length > 0 && tlsTargets.every(hasTls12)) {
      mark(
        [
          "All data in transit is encrypted with TLS 1.2 or higher.",
          "We encrypt data in transit with Transport Layer Security (TLS) version 1.2 or later.",
        ],
        cite,
      );
    }

    if (cfgItems.some((c) => isTrue(c.kvRbac ?? c.keyVaultRbac) || isTrue(c.entraOnlySql) || isTrue(c.aksEnableRbac))) {
      mark(
        [
          "Role-based Access Control (RBAC) is used, and roles follow the principle of least privilege.",
          "We use role-based access control (RBAC) to assign permissions based on identity roles.",
        ],
        cite,
      );
    }

    const vaults = cfgItems.filter((c) => String(c.type || "").toLowerCase() === "microsoft.keyvault/vaults");
    if (vaults.length > 0) {
      mark(
        [
          "Application secrets are stored in a dedicated secret management system, outside of the source code.",
          "We store application secrets outside of the source code in a secret management system.",
        ],
        cite,
      );
      if (vaults.every((v) => isTrue(v.kvRbac ?? v.keyVaultRbac))) {
        mark(
          [
            "Role-based access control (RBAC) is used to manage who and what can access secrets.",
            "We employ role-based access control (RBAC) to manage access to keys.",
          ],
          cite,
        );
      }
    }

    const endpointTypes = new Set([
      "microsoft.web/sites",
      "microsoft.storage/storageaccounts",
      "microsoft.keyvault/vaults",
      "microsoft.sql/servers",
      "microsoft.sql/managedinstances",
      "microsoft.servicebus/namespaces",
      "microsoft.containerregistry/registries",
      "microsoft.documentdb/databaseaccounts",
      "microsoft.dbforpostgresql/flexibleservers",
      "microsoft.cache/redis",
    ]);
    const endpointTargets = cfgItems.filter((c) => endpointTypes.has(String(c.type || "").toLowerCase()));
    const isPrivateOnly = (c) => {
      const pna = String(c.publicNetworkAccess || "").toLowerCase();
      if (pna === "enabled") return false;
      if (pna === "disabled") return true;
      if (isFalse(c.sqlPublicDataEndpointEnabled)) return true;
      return false;
    };
    if (endpointTargets.length > 0 && endpointTargets.every(isPrivateOnly)) {
      mark(
        [
          "Individual services are not accessible from public IP addresses and are protected with service-level firewall rules.",
          "We restrict public IP addresses from accessing individual services, and we protect them with service-level firewall rules.",
        ],
        cite,
      );
    }

    if (
      cfgItems.some(
        (c) =>
          isTrue(c.zoneRedundant) ||
          /^zoneredundant$/i.test(String(c.pgHaMode || "")) ||
          /\b[123]\b/.test(String(c.availabilityZones || "")),
      )
    ) {
      mark(
        "We use platform-provided capabilities to introduce and manage the redundancy of our compute resources.",
        cite,
      );
      mark(
        "We replicate data across physical locations by using platform-provided capabilities whenever possible.",
        cite,
      );
    }
  }

  if ((topoItems.length > 0 || peConns.length > 0) && topoSrc) {
    const cite = `[Observed: ${topoSrc.relPath}#sha256=${topoSrc.sha}]`;
    if (peConns.some((p) => String(p.connectionStatus ?? p.connectionState ?? "").toLowerCase() === "approved")) {
      mark(
        [
          "Connectivity to PaaS services uses private endpoints.",
          "We've secured connectivity to platform as a service (PaaS) endpoints.",
        ],
        cite,
      );
    }
    if (topoItems.some((i) => String(i.type || "").toLowerCase() === "microsoft.network/networksecuritygroups")) {
      mark(
        [
          "Network security groups (NSGs) are used to isolate and protect traffic within virtual networks.",
          "We use network security groups (NSGs) to isolate and protect traffic within virtual networks.",
        ],
        cite,
      );
    }
    if (
      topoItems.some((i) =>
        ["microsoft.network/azurefirewalls", "microsoft.network/applicationgateways"].includes(
          String(i.type || "").toLowerCase(),
        ),
      )
    ) {
      mark(
        [
          "Firewalls are used to control ingress and egress traffic at the network edge.",
          "We use firewalls to control ingress and egress traffic at the network edge.",
        ],
        cite,
      );
    }
  }

  if (polItems.length > 0) {
    const src = policy ?? controls;
    if (src) {
      const cite = `[Observed: ${src.relPath}#sha256=${src.sha}, ${polItems.length} policy records]`;
      mark(
        [
          "Our baseline is enforced through automated guardrails and policies.",
          "We enforce the security baseline with automated guardrails and governance policies.",
        ],
        cite,
      );
      mark("We use governance policies to provide spending guardrails.", cite);
    }
  }

  if (defItems.length > 0) {
    const src = advisorDef ?? controls;
    if (src) {
      const cite = `[Observed: ${src.relPath}#sha256=${src.sha}, ${defItems.length} Defender assessments]`;
      mark(
        [
          "We use a cloud security posture management (CSPM) tool to detect drift and gaps from our baseline.",
          "We use a cloud security posture management (CSPM) tool to detect drift from our security baseline.",
        ],
        cite,
      );
      mark(
        [
          "We use cloud-native monitoring tools for our workload resources and infrastructure.",
          "We use cloud-native security monitoring tools for our workload.",
        ],
        cite,
      );
    }
  }

  if (monResources.length > 0 && monSrc) {
    const cite = `[Observed: ${monSrc.relPath}#sha256=${monSrc.sha}]`;
    mark("We collect telemetry or events like logs and metrics.", cite);
    mark(
      "We prefer, where possible, platform services and capabilities for collecting metrics and log information over custom solutions.",
      cite,
    );
    if (monResources.some((m) => String(m.type || "").toLowerCase() === "microsoft.operationalinsights/workspaces")) {
      mark("We store performance metrics and logs in a central location.", cite);
      if (monResources.some((m) => Number(m.retentionInDays) > 0)) {
        mark(
          "We define retention policies for log and metrics data to enable effective troubleshooting and monitoring.",
          cite,
        );
      }
    }
    if (
      monResources.some((m) =>
        ["microsoft.insights/metricalerts", "microsoft.insights/scheduledqueryrules"].includes(
          String(m.type || "").toLowerCase(),
        ),
      )
    ) {
      mark("We send out alerts when the health of a flow degrades.", cite);
      mark(
        "We have created an alerting strategy that focuses on actionable alerts directed to appropriate parties.",
        cite,
      );
    }
  }

  const hasSubstantiatedBackup =
    protectedItems.length > 0 ||
    recItems.some((r) =>
      ["microsoft.recoveryservices/vaults", "microsoft.dataprotection/backupvaults"].includes(
        String(r.type || "").toLowerCase(),
      ),
    ) ||
    recItems.some((r) =>
      /^(?:grs|gzrs|zrs|georedundant|zoneredundant)$/i.test(
        String(r.currentBackupStorageRedundancy || r.requestedBackupStorageRedundancy || ""),
      ),
    ) ||
    cfgItems.some((c) => /^enabled$/i.test(String(c.pgGeoBackup || "")));
  if (hasSubstantiatedBackup && (diagRec ?? cfgSrc)) {
    const src = diagRec ?? cfgSrc;
    mark(
      [
        "We implement robust backup strategies.",
        "We have a disaster recovery plan with processes to recover the workload, components, and data.",
      ],
      `[Observed: ${src.relPath}#sha256=${src.sha}]`,
    );
  }

  const allMetricsOk = metricItems.length > 0 && metricItems.every((m) => m.status === "ok");
  const allDiagsEnabled =
    diagSamples.length > 0 &&
    diagSamples.every((d) =>
      (d.settings ?? []).some((s) => Number(s.enabled_log_count) > 0 || Number(s.enabled_metric_count) > 0),
    );
  if (allMetricsOk && allDiagsEnabled && metrics) {
    mark("We collect metrics and logs for every resource.", `[Observed: ${metrics.relPath}#sha256=${metrics.sha}]`);
  }

  if (costComplete && cost) {
    const cite = `[Observed: ${cost.relPath}#sha256=${cost.sha}]`;
    mark("We enable data collection on all resources.", cite);
    mark("We group cost data for easier analysis.", cite);
    mark("We generate cost reports.", cite);
    mark("We determine cost drivers.", cite);
  }

  if (staticIac?.data) {
    const counts = staticIac.data.counts ?? {};
    const sig = staticIac.data.signals ?? {};
    const cite = `[Declared IaC: ${staticIac.relPath}#sha256=${staticIac.sha}]`;
    if ((counts.bicep_file_count ?? 0) + (counts.terraform_file_count ?? 0) > 0) {
      mark("We prefer declarative instead of imperative scripting approaches.", cite);
      mark("We use infrastructure as code to standardize deployments.", cite);
      mark("We deploy repeatable and immutable infrastructure with code.", cite);
    }
    if ((counts.bicep_module_count ?? 0) + (counts.terraform_module_count ?? 0) > 0 || sig.avm_modules) {
      mark("We use modules only where they add a relevant layer of abstraction.", cite);
    }
    if (sig.https_or_tls && cfgItems.length === 0) {
      mark(
        [
          "All data in transit is encrypted with TLS 1.2 or higher.",
          "We encrypt data in transit with Transport Layer Security (TLS) version 1.2 or later.",
        ],
        cite,
      );
    }
    if (sig.private_networking) {
      mark(
        [
          "Connectivity to PaaS services uses private endpoints.",
          "We've secured connectivity to platform as a service (PaaS) endpoints.",
        ],
        cite,
      );
    }
    if (sig.cicd_security_scanning) {
      mark(
        [
          "We use automated tools to detect and prevent hard-coded secrets in source code and build artifacts.",
          "We use tools to scan for and block hard-coded credentials in source code and build artifacts.",
        ],
        cite,
      );
      mark(
        [
          "Security tests are integrated into our DevOps build and deployment pipelines.",
          "We integrate security testing into our build and deployment pipelines.",
        ],
        cite,
      );
    }
  }

  // Human context & attested operational/security practices (never treated as runtime verification)
  if (isKnownAnswer(answers.critical_flows)) {
    const flowText = Array.isArray(answers.critical_flows) ? answers.critical_flows.join("; ") : answers.critical_flows;
    const cite = `[Human-attested: critical_flows="${flowText}"]`;
    mark(
      [
        "We identify all user and system flows in the workload.",
        "We published a catalog of all supported flows to provide awareness for our team.",
      ],
      cite,
    );
    mark(
      [
        "We assigned a criticality rating to each flow.",
        "We assigned criticality to each flow and published our decisions.",
      ],
      cite,
    );
    mark(["We identify all critical flows.", "We identify and document all critical flows."], cite);
  }
  if (isKnownAnswer(answers.availability_target)) {
    mark("We have availability targets.", `[Human-attested: availability_target="${answers.availability_target}"]`);
  }
  if (isKnownAnswer(answers.recovery_profile)) {
    mark("We have recovery targets.", `[Human-attested: recovery_profile="${answers.recovery_profile}"]`);
  }
  if (isKnownAnswer(answers.performance_target)) {
    const cite = `[Human-attested: performance_target="${answers.performance_target}"]`;
    mark("We understand the performance requirements for the workload.", cite);
    mark("We set targets for the identified performance metrics.", cite);
  }
  if (isKnownAnswer(answers.compliance)) {
    mark(
      [
        "We have identified all regulatory and geographic compliance requirements applicable to our workload.",
        "We identified all regulatory and geographic compliance requirements applicable to our workload.",
      ],
      `[Human-attested: compliance="${Array.isArray(answers.compliance) ? answers.compliance.join("; ") : answers.compliance}"]`,
    );
  }
  if (
    isKnownAnswer(answers.monthly_budget_amount) &&
    !/^no fixed budget/i.test(String(answers.monthly_budget_amount))
  ) {
    mark(
      "We have a budget for the workload.",
      `[Human-attested: monthly_budget_amount="${answers.monthly_budget_amount}"]`,
    );
  }

  const dr = String(answers.dr_testing_cadence ?? "");
  if (/regular restore and failover drills/i.test(dr)) {
    const cite = `[Human-attested: dr_testing_cadence="${dr}"]`;
    mark("We run tests in a production-like environment, and we run a targeted subset of tests in production.", cite);
    mark(
      [
        "We do regular drills to practice recovery.",
        "We regularly perform disaster recovery drills to validate our recovery processes.",
      ],
      cite,
    );
  } else if (/no formal recovery or resilience testing/i.test(dr)) {
    markQuestionNone("How do you test your resiliency and availability strategies?");
  }

  const sec = String(answers.security_sdlc_practices ?? "");
  if (/threat modeling, data classification, and automated/i.test(sec)) {
    const cite = `[Human-attested: security_sdlc_practices="${sec}"]`;
    mark(
      [
        "We use threat modeling to identify and rank threats, map them to mitigations, and share findings with stakeholders.",
        "We perform threat modeling to identify threats and plan mitigations.",
      ],
      cite,
    );
    mark(
      [
        "We have aligned the classification categories for our data to our business requirements.",
        "We've aligned our data classification categories to our business requirements.",
      ],
      cite,
    );
    mark(
      [
        "We use automated tools to detect and prevent hard-coded secrets in source code and build artifacts.",
        "We use tools to scan for and block hard-coded credentials in source code and build artifacts.",
      ],
      cite,
    );
    mark(
      [
        "Security tests are integrated into our DevOps build and deployment pipelines.",
        "We integrate security testing into our build and deployment pipelines.",
      ],
      cite,
    );
  } else if (/automated secret and dependency scanning/i.test(sec)) {
    const cite = `[Human-attested: security_sdlc_practices="${sec}"]`;
    mark(
      [
        "We use automated tools to detect and prevent hard-coded secrets in source code and build artifacts.",
        "We use tools to scan for and block hard-coded credentials in source code and build artifacts.",
      ],
      cite,
    );
    mark(
      [
        "Security tests are integrated into our DevOps build and deployment pipelines.",
        "We integrate security testing into our build and deployment pipelines.",
      ],
      cite,
    );
  } else if (/periodic manual security reviews or penetration testing/i.test(sec)) {
    const cite = `[Human-attested: security_sdlc_practices="${sec}"]`;
    mark(
      [
        "We periodically simulate attacks through penetration testing and war-game exercises.",
        "We simulate attacks regularly through penetration tests and war-game exercises.",
      ],
      cite,
    );
    mark(
      "We perform manual security testing and use scanning tools to find vulnerabilities that automated tests miss.",
      cite,
    );
  } else if (/no formal application or supply-chain security/i.test(sec)) {
    markQuestionNone([
      "How are you securing your application code, development environment, and software supply chain?",
      "How do you establish a secure software development lifecycle?",
    ]);
  }

  const dep = String(answers.deployment_release_practices ?? "");
  if (/all changes ship via ci\/cd pipelines with iac and automated health gates/i.test(dep)) {
    const cite = `[Human-attested: deployment_release_practices="${dep}"]`;
    mark("We prefer declarative instead of imperative scripting approaches.", cite);
    mark("We ensure all deployments, to all environments, happen through deployment pipelines.", cite);
    mark("We deploy repeatable and immutable infrastructure with code.", cite);
    mark("We use quality gates to promote code to higher environments.", cite);
    mark("We rely on health signals to provide go, no-go decisions during rollouts.", cite);
  } else if (/ci\/cd pipelines for app or iac with manual promotion/i.test(dep)) {
    const cite = `[Human-attested: deployment_release_practices="${dep}"]`;
    mark("We have a standard deployment method to the production environment.", cite);
  } else if (/primarily manual deployments/i.test(dep)) {
    markQuestionNone("What safe deployment practices do you use?");
  }

  const icm = String(answers.incident_response_practices ?? "");
  if (/documented runbooks, on-call or soc escalation, exercises, and formal rcas/i.test(icm)) {
    const cite = `[Human-attested: incident_response_practices="${icm}"]`;
    mark("We have operational instructions that have easily understood checklist items.", cite);
    mark(
      "We detail responsibilities and provide guidance in our operating procedures for improvised and incident response tasks.",
      cite,
    );
    mark(["We document our incident response plan.", "We have a documented emergency response plan."], cite);
    mark(
      ["We test our incident response strategy regularly.", "We regularly test our emergency response processes."],
      cite,
    );
    mark(
      ["We use RCA findings to implement improvements.", "We conduct post-incident reviews and apply lessons learned."],
      cite,
    );
    mark(
      [
        "A designated incident contact is established with documented communication and reporting procedures.",
        "We've established an incident contact and documented communication and reporting procedures.",
      ],
      cite,
    );
    mark("Post-incident reviews and tabletop exercises are conducted systematically.", cite);
    mark(
      "A Security Operations Center (SOC) or central security team is involved in monitoring, detection, and response.",
      cite,
    );
  } else if (/runbooks and escalation paths exist/i.test(icm)) {
    const cite = `[Human-attested: incident_response_practices="${icm}"]`;
    mark(["We document our incident response plan.", "We have a documented emergency response plan."], cite);
    mark(
      [
        "A designated incident contact is established with documented communication and reporting procedures.",
        "We've established an incident contact and documented communication and reporting procedures.",
      ],
      cite,
    );
  } else if (/handled by a central platform or security operations team/i.test(icm)) {
    mark(
      "A Security Operations Center (SOC) or central security team is involved in monitoring, detection, and response.",
      `[Human-attested: incident_response_practices="${icm}"]`,
    );
  } else if (/reactive troubleshooting without formal runbooks/i.test(icm)) {
    markQuestionNone([
      "How do you implement your incident management (IcM) process?",
      "What is your emergency operations practice?",
    ]);
  }

  const finops = String(answers.finops_governance_practices ?? "");
  if (/regular stakeholder spend reviews, cost owners, and rate or commitment/i.test(finops)) {
    const cite = `[Human-attested: finops_governance_practices="${finops}"]`;
    mark("We communicate financial expectations.", cite);
    mark("We make budgets and workload costs transparent.", cite);
    mark("We assign a resource owner for each cost item.", cite);
    mark("We regularly review cost reports with stakeholders against the budget and cost model.", cite);
    mark("We evaluate and determine the right billing model.", cite);
    mark("We evaluate and commit to available discounts.", cite);
  } else if (/periodic spend review against a rough budget/i.test(finops)) {
    mark(
      "We make budgets and workload costs transparent.",
      `[Human-attested: finops_governance_practices="${finops}"]`,
    );
  }

  const perf = String(answers.performance_testing_practices ?? "");
  if (/automated load testing against targets with proactive capacity forecasting/i.test(perf)) {
    const cite = `[Human-attested: performance_testing_practices="${perf}"]`;
    mark("We gather capacity data to forecast future demand.", cite);
    mark("We have well-defined acceptance criteria for the success of performance tests.", cite);
    mark("We have created performance test scenarios, and the test environment is in place.", cite);
    mark("We run performance testing for every change.", cite);
  } else if (/point-in-time load testing before major releases/i.test(perf)) {
    mark(
      "We have created performance test scenarios, and the test environment is in place.",
      `[Human-attested: performance_testing_practices="${perf}"]`,
    );
  } else if (/no formal load testing or capacity planning/i.test(perf)) {
    markQuestionNone("How do you conduct performance testing?");
  }

  // Derive or verify WAF scores for header block
  let scores = wafScores?.data ?? null;
  if (scores && wafChecks?.data) {
    verifyWafScores(wafChecks.data, scores);
  } else if (!scores && wafChecks?.data) {
    scores = computeWafScores(wafChecks.data, {
      project: wafChecks.data.project ?? path.basename(projectDir),
      asOf: wafChecks.data.as_of ?? wafChecks.data.generated_at ?? new Date().toISOString(),
    });
  }

  // Build WARP-compatible recommendation rows from Action Register or risk checks
  const recommendations = [];
  if (actionRegister?.data?.actions) {
    for (const action of actionRegister.data.actions) {
      const primaryPillar = action.pillars?.[0] ?? "Operational Excellence";
      const meta = PILLAR_WAF_URLS[primaryPillar] ?? PILLAR_WAF_URLS["Operational Excellence"];
      recommendations.push([
        sanitizeSpreadsheetText(primaryPillar),
        sanitizeSpreadsheetText(`${action.id} - ${action.task}`),
        meta.url,
        sanitizeSpreadsheetText(action.priority ?? "Medium"),
        sanitizeSpreadsheetText(meta.code),
        sanitizeSpreadsheetText(action.disposition ?? ""),
        PRIORITY_WEIGHTS[action.priority] ?? "65",
        sanitizeSpreadsheetText((action.resource_ids ?? []).join("; ") || "Workload / process scope"),
        "N",
        sanitizeSpreadsheetText(
          `[APEX ${actionRegister.relPath}#sha256=${actionRegister.sha}] ${(action.notes ?? []).join(" ")}`.trim(),
        ),
      ]);
    }
  } else if (wafChecks?.data?.checks) {
    for (const chk of wafChecks.data.checks.filter((c) => c.state === "risk")) {
      const meta = PILLAR_WAF_URLS[chk.pillar] ?? PILLAR_WAF_URLS["Operational Excellence"];
      recommendations.push([
        sanitizeSpreadsheetText(chk.pillar),
        sanitizeSpreadsheetText(`${chk.id} - ${chk.check}`),
        meta.url,
        "High",
        sanitizeSpreadsheetText(chk.waf_code ?? meta.code),
        "",
        "80",
        sanitizeSpreadsheetText(chk.evidence),
        "N",
        sanitizeSpreadsheetText(`[APEX ${wafChecks.relPath}#sha256=${wafChecks.sha}] ${chk.notes ?? ""}`.trim()),
      ]);
    }
  }

  return { answerNotes, noneQuestions, scores, recommendations };
}

function extractQuestionRows(templateCsvText) {
  if (!templateCsvText) {
    const built = [];
    for (const [category, question, options] of DEFAULT_WAF_TEMPLATE_QUESTIONS) {
      for (const option of options) {
        built.push({ category, question, answer: option });
      }
    }
    return built;
  }
  const parsed = parseCsv(templateCsvText);
  const headerIdx = parsed.findIndex(
    (r) => normalizeKey(r[0]) === "category" && normalizeKey(r[1]) === "question" && normalizeKey(r[2]) === "answers",
  );
  if (headerIdx === -1) {
    throw new Error("Template CSV is missing the 'Category,Question,Answers,Selected Answer,Note' header row");
  }
  const rows = [];
  for (let i = headerIdx + 1; i < parsed.length; i += 1) {
    const r = parsed[i];
    if (!r || (!r[0]?.trim() && !r[1]?.trim() && !r[2]?.trim())) continue;
    rows.push({ category: r[0], question: r[1], answer: r[2] });
  }
  return rows;
}

export function exportWafReviewCsv(options = {}) {
  if (!options.projectDir) {
    throw new Error("Valid non-symlink --project-dir is required");
  }
  const projectDir = assertNoSymlinkChain(options.projectDir, "--project-dir");
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    throw new Error("Valid non-symlink --project-dir is required");
  }
  let templateText = null;
  if (options.templatePath) {
    const resolvedTemplate = assertNoSymlinkChain(options.templatePath, "--template");
    templateText = fs.readFileSync(resolvedTemplate, "utf8");
  }
  const answers = options.answers ?? loadCapturedAnswers(projectDir, options.answersPath);
  const { answerNotes, noneQuestions, scores, recommendations } = collectSignals(projectDir, answers);
  const questionRows = extractQuestionRows(templateText);

  const groups = [];
  const groupMap = new Map();
  for (const item of questionRows) {
    const qKey = `${normalizeKey(item.category)}::${normalizeKey(item.question)}`;
    let group = groupMap.get(qKey);
    if (!group) {
      group = { qKey, items: [] };
      groupMap.set(qKey, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  let selectedOptionCount = 0;
  let answeredQuestionCount = 0;
  let unknownQuestionCount = 0;
  const outputQuestionRows = [];

  for (const group of groups) {
    const qNorm = group.qKey.split("::")[1];
    let anyPositiveSelected = false;
    const mapped = group.items.map((item) => {
      const aNorm = normalizeKey(item.answer);
      const isNone = aNorm === "none of the above." || aNorm === "none of the above";
      const matchedNote = !isNone ? answerNotes.get(aNorm) : undefined;
      const safeCat = sanitizeSpreadsheetText(item.category);
      const safeQ = sanitizeSpreadsheetText(item.question);
      const safeAns = sanitizeSpreadsheetText(item.answer);
      if (matchedNote) {
        anyPositiveSelected = true;
        selectedOptionCount += 1;
        return [safeCat, safeQ, safeAns, safeAns, sanitizeSpreadsheetText(matchedNote)];
      }
      return [safeCat, safeQ, safeAns, "", ""];
    });

    if (anyPositiveSelected) {
      answeredQuestionCount += 1;
    } else if (noneQuestions.has(qNorm)) {
      const noneRow = mapped.find((r) => /^none of the above\.?$/i.test(r[2].trim()));
      if (noneRow) {
        noneRow[3] = noneRow[2];
        noneRow[4] = sanitizeSpreadsheetText(
          `[Human-attested: explicit negative practice reported in discovery answers]`,
        );
        selectedOptionCount += 1;
        answeredQuestionCount += 1;
      }
    } else {
      unknownQuestionCount += 1;
      if (mapped.length > 0) {
        mapped[0][4] = "[Unknown / Not assessed in APEX evidence — confirm manually before portal import]";
      }
    }
    outputQuestionRows.push(...mapped);
  }

  // Omit not_assessed pillars above the blank separator row so WARP does not score unassessed pillars as 0
  const pillarRows = [];
  const scoredNumeric = [];
  if (scores?.pillars) {
    const byName = new Map(scores.pillars.map((p) => [p.pillar, p]));
    for (const pillar of [
      "Reliability",
      "Security",
      "Cost Optimization",
      "Operational Excellence",
      "Performance Efficiency",
    ]) {
      const entry = byName.get(pillar);
      if (entry?.status === "scored" && typeof entry.score === "number") {
        scoredNumeric.push(entry.score);
        const { label, ratio } = ratingFromScore(entry.score, "scored");
        pillarRows.push([pillar, label, ratio]);
      }
    }
  }
  const overallAvg =
    scoredNumeric.length > 0 ? scoredNumeric.reduce((acc, v) => acc + v, 0) / scoredNumeric.length : null;
  const overall = ratingFromScore(overallAvg, overallAvg === null ? "not_assessed" : "scored");

  const width = 10;
  const csvRows = [
    [sanitizeSpreadsheetText(`Azure Well-Architected Review - APEX Export (${path.basename(projectDir)})`)],
    [],
    ["Recommendations for your workload"],
    ["Your overall results", overall.label, overall.ratio],
    ...pillarRows,
    [],
    [],
    [
      "Category",
      "Link-Text",
      "Link",
      "Priority",
      "ReportingCategory",
      "ReportingSubcategory",
      "Weight",
      "Context",
      "CompleteY/N",
      "Note",
    ],
    ...recommendations,
    ["-----------"],
    [],
    ["Category", "Question", "Answers", "Selected Answer", "Note"],
    ...outputQuestionRows,
  ];

  const csv = serializeCsv(csvRows, width);
  if (options.outPath) {
    const outResolved = assertNoSymlinkChain(options.outPath, "--out");
    fs.mkdirSync(path.dirname(outResolved), { recursive: true });
    assertNoSymlinkChain(path.dirname(outResolved), "--out directory");
    const tmp = path.join(path.dirname(outResolved), `.${path.basename(outResolved)}.${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(tmp, csv, { encoding: "utf8", flag: "wx" });
      fs.renameSync(tmp, outResolved);
    } catch (err) {
      if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
      throw err;
    }
  }

  return {
    csv,
    stats: {
      total_questions: groups.length,
      answered_questions: answeredQuestionCount,
      unknown_questions: unknownQuestionCount,
      selected_options: selectedOptionCount,
      recommendation_rows: recommendations.length,
    },
  };
}

export function runCli(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes("--help")) {
    console.log(
      "Usage: export-waf-review-csv.mjs --project-dir <agent-output/project> [--template <Azure_Well_Architected_Review_Template_Export.csv>] [--answers <captured-answers.json>] [--out <output.csv>]",
    );
    return 0;
  }
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (!val || val.startsWith("-")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--project-dir") opts.projectDir = val;
    else if (flag === "--template") opts.templatePath = val;
    else if (flag === "--answers") opts.answersPath = val;
    else if (flag === "--out") opts.outPath = val;
    else throw new Error(`Unknown option: ${flag}`);
  }
  const result = exportWafReviewCsv(opts);
  if (opts.outPath) {
    console.log(JSON.stringify({ valid: true, out: path.resolve(opts.outPath), ...result.stats }));
  } else {
    process.stdout.write(result.csv);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(`WAF CSV export failed: ${error.message}`);
    process.exitCode = 1;
  }
}
