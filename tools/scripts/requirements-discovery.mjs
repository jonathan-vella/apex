#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const choice = (title, description, options) => ({
  type: "string",
  title,
  description: `${description} You may enter a custom answer in this same field.`,
  enum: options,
});
const multiple = (title, description, options) => ({
  type: "array",
  title,
  description: `${description} A custom answer is available in this same field.`,
  items: { type: "string", enum: options },
});
const supplied = (value) =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim() !== "";

const companySizes = ["Startup / small business", "Mid-market", "Enterprise", "Not sure yet"];
const patterns = [
  "Web application with a database",
  "Internal API / integration service",
  "Static website",
  "Event-driven / background processing",
  "Data / analytics platform",
  "Development / test platform",
  "Not sure — guide me",
];
const scenarioTerm =
  "(?:(?:a|an|any)\\s+)?(?:greenfield|migrat\\w*|moderni[sz]\\w*|lift[\\s-]and[\\s-]shift|assess\\w*|existing|brownfield)\\b";
const negatedScenarioTypes = new RegExp(
  `\\b(?:no|not|without)\\s+${scenarioTerm}(?:\\s*(?:,|and|or|nor)\\s*${scenarioTerm})*`,
  "gi",
);

function positiveScenarioText(value) {
  return String(value ?? "").replace(negatedScenarioTypes, "");
}

function isAssessmentScenario(value) {
  return /\bassess\w*\b/i.test(positiveScenarioText(value));
}

export const DISCOVERY_STAGES = ["business", "migration", "workload", "access"];

export function answersFromRecall(view, environment) {
  if (!view?.session?.material_inputs || !environment)
    throw new Error("Actual scoped recall material inputs and environment required");
  return Object.fromEntries(
    Object.entries(view.session.material_inputs)
      .filter(([, record]) => Array.isArray(record.environments) && record.environments.includes(environment))
      .map(([key, record]) => [key, structuredClone(record.value)]),
  );
}

function evidenceDefaults(evidence) {
  if (evidence === undefined) return {};
  if (!evidence || typeof evidence !== "object" || !Array.isArray(evidence.items)) {
    throw new Error("Evidence must be an object containing an items array");
  }
  const defaults = {};
  for (const item of evidence.items) {
    if (
      !item ||
      typeof item.input_id !== "string" ||
      !/^[A-Za-z0-9_.-]+$/.test(item.input_id) ||
      !supplied(item.value) ||
      !["iac", "diagram", "azure-arg"].includes(item.provenance) ||
      !["observed", "inferred"].includes(item.confidence)
    ) {
      throw new Error("Evidence items require input_id, value, provenance and confidence");
    }
    if (Object.hasOwn(defaults, item.input_id)) {
      throw new Error(`Ambiguous evidence: duplicate input_id ${item.input_id}`);
    }
    Object.defineProperty(defaults, item.input_id, { value: structuredClone(item.value), enumerable: true });
  }
  return defaults;
}

export function buildDiscoveryForm(stage, answers = {}, evidence) {
  if (!DISCOVERY_STAGES.includes(stage)) throw new Error(`Unknown discovery stage: ${stage}`);
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new Error("Answers must be an object containing the complete captured answer ledger");
  }
  const defaults = evidenceDefaults(evidence);
  const assessmentFromAnswers = isAssessmentScenario(answers.scenario);
  const assessmentSuggestedByEvidence = !supplied(answers.scenario) && isAssessmentScenario(defaults.scenario);
  const properties = {};
  const add = (key, field) => {
    if (supplied(answers[key])) return;
    if (Object.hasOwn(defaults, key)) {
      const value = defaults[key];
      if (
        (field.type === "string" && typeof value !== "string") ||
        (field.type === "array" && (!Array.isArray(value) || !value.every((item) => typeof item === "string")))
      ) {
        throw new Error(`Evidence value for ${key} does not match question type ${field.type}`);
      }
      field.default = value;
      field.description += " Suggested from discovered evidence; explicitly confirm or correct this value.";
    }
    properties[key] = field;
  };
  if (assessmentFromAnswers && stage !== "business") {
    return { stage, complete: true, form: null };
  }
  if (stage === "business" && (assessmentFromAnswers || assessmentSuggestedByEvidence)) {
    add(
      "system_description",
      choice("Workload in scope", "Describe the existing service or workload being assessed.", patterns),
    );
    add(
      "business_objective",
      choice("Assessment objective", "What should this assessment clarify?", [
        "Understand current Well-Architected posture and evidence gaps",
        "Compare current state with organizational objectives",
        "Investigate a known reliability, security or cost concern",
        "Identify a prioritized improvement roadmap",
        "Not sure — help define the assessment scope",
      ]),
    );
    add(
      "scenario",
      choice("Project scenario", "Confirm that this is an assessment of an existing workload.", [
        "Assessment — evaluate an existing workload",
        "Not sure — guide me",
      ]),
    );
    add(
      "target_environments",
      multiple("In-scope environments", "Which existing environments are included in this assessment?", [
        "dev",
        "test",
        "staging",
        "prod",
        "sandbox",
        "Not sure yet",
      ]),
    );
  } else if (stage === "business") {
    add(
      "industry",
      choice("Industry", "Which sector best matches the organization?", [
        "Technology / software",
        "Financial services",
        "Healthcare / life sciences",
        "Retail / consumer services",
        "Manufacturing / logistics",
        "Government / education",
        "Cross-industry / internal IT",
        "Not sure yet",
      ]),
    );
    // Employee counts from an existing brief already answer company size; do not ask both.
    if (!supplied(answers.employee_count)) {
      add(
        "company_size",
        choice(
          "Company size",
          "Choose a broad organization size; an exact employee count is unnecessary.",
          companySizes,
        ),
      );
    }
    add(
      "system_description",
      choice("What are we building?", "Pick the closest workload or describe it in one sentence.", patterns),
    );
    add(
      "business_objective",
      choice(
        "What should this help your team do?",
        "Pick the main outcome. For a dev platform, faster development/testing is a valid answer.",
        [
          "Build and test applications faster",
          "Launch a new customer-facing service",
          "Improve an existing internal process",
          "Reduce operating cost / manual work",
          "Meet security or compliance requirements",
          "Learn / explore Azure",
          "Not sure — help me define it",
        ],
      ),
    );
    add(
      "scenario",
      choice("Project scenario", "Are we creating something new or changing an existing workload?", [
        "Greenfield — new workload",
        "Migration — move an existing workload",
        "Modernization — improve an existing workload",
        "Assessment — evaluate an existing workload",
        "Extension — add to an existing platform",
        "Not sure — guide me",
      ]),
    );
    add(
      "target_environments",
      multiple("Target environments", "Which environments are needed?", [
        "dev",
        "test",
        "staging",
        "prod",
        "sandbox",
        "Not sure yet",
      ]),
    );
    add(
      "timeline",
      choice("Target timeline", "When would you like the first usable version?", [
        "Within 2 weeks",
        "Within 1 month",
        "Within 3 months",
        "Within 6 months",
        "A specific date — enter it here",
        "No fixed date / exploratory",
      ]),
    );
  } else if (stage === "migration") {
    if (!supplied(answers.scenario)) {
      throw new Error("Migration discovery requires the captured scenario; restore the business answer ledger first");
    }
    const changes = positiveScenarioText(answers.scenario);
    const isGreenfield = /\bgreenfield\b/i.test(changes);
    const extensionOnly =
      /\b(?:extend\w*|extension)\b/i.test(changes) &&
      !/\b(?:migrat\w*|moderni[sz]\w*|lift[\s-]and[\s-]shift|assess\w*|brownfield)\b/i.test(changes);
    if (
      !isGreenfield &&
      !extensionOnly &&
      /\b(?:migrat\w*|moderni[sz]\w*|lift[\s-]and[\s-]shift|assess\w*|existing|brownfield)\b/i.test(changes)
    ) {
      add(
        "current_platform",
        choice("Current platform", "Where does the existing workload run?", [
          "On-premises / datacenter",
          "Azure",
          "AWS",
          "Google Cloud",
          "Another hosting provider",
          "Not sure yet",
        ]),
      );
      add(
        "pain_points",
        multiple("What needs to improve?", "Select the reasons for this migration, modernization or assessment.", [
          "Cost",
          "Reliability / downtime",
          "Performance / scale",
          "Security / compliance",
          "Operations / maintenance",
          "Developer experience",
          "Not sure yet",
        ]),
      );
      add(
        "preservation_requirements",
        multiple("What must stay compatible?", "Select the important things to preserve.", [
          "Data",
          "Application behavior / APIs",
          "Existing integrations",
          "Identity / sign-in",
          "Minimal downtime",
          "No special constraints",
          "Not sure yet",
        ]),
      );
    }
  } else if (stage === "workload") {
    if (!patterns.includes(answers.system_description)) {
      add(
        "workload_pattern",
        choice(
          "Confirm the workload",
          supplied(answers.system_description)
            ? `You described: ${answers.system_description}. Choose the closest pattern; this is not a hosting or SKU decision.`
            : "Choose the closest pattern; this is not a hosting or SKU decision.",
          patterns,
        ),
      );
    }
    add(
      "daily_users",
      choice("Expected users", "A rough range is enough for initial planning.", [
        "Up to 50",
        "50–500",
        "500–5,000",
        "5,000–50,000",
        "More than 50,000",
        "Not sure — start with a small pilot",
      ]),
    );
    const workload = [answers.workload_pattern, answers.system_description].join(" ");
    if (/\b(web|api|app|portal)\b/i.test(workload)) {
      add(
        "peak_concurrent_users",
        choice("Users at the same time", "Estimate peak simultaneous users, not employees.", [
          "Fewer than 10",
          "10–100",
          "100–1,000",
          "More than 1,000",
          "Not sure — help estimate",
        ]),
      );
    } else if (/\b(data|analytics|event|iot|processing)\b/i.test(workload)) {
      add(
        "throughput",
        choice("Processing volume", "Choose a rough workload size; exact throughput can be refined later.", [
          "Occasional / batch",
          "Low steady volume",
          "High sustained volume",
          "Bursty / seasonal",
          "Not sure — help estimate",
        ]),
      );
    }
    if (!supplied(answers.monthly_budget_amount)) {
      add(
        "monthly_budget",
        choice(
          "Monthly Azure budget",
          "Pick a planning range or enter an exact amount and currency. This is not deployment spend authorization.",
          [
            "Under 100/month",
            "100–500/month",
            "500–2,000/month",
            "2,000–10,000/month",
            "Above 10,000/month",
            "Not decided — show me a costed recommendation",
          ],
        ),
      );
    }
    add(
      "budget_currency",
      choice("Budget currency", "Which currency should the later estimate use?", ["EUR", "USD", "GBP", "Not sure yet"]),
    );
    add(
      "data_sensitivity",
      multiple("Data sensitivity", "Which kinds of data will the workload handle?", [
        "Public",
        "Internal business data",
        "Personal / customer data",
        "Regulated / highly confidential",
        "Synthetic test data",
        "Not sure yet",
      ]),
    );
    add(
      "availability_target",
      choice("Availability needs", "Choose by business impact rather than an unexplained percentage.", [
        "Dev/test — occasional downtime acceptable",
        "Business hours — recover within the working day",
        "Production — about 99.9% availability",
        "Critical — about 99.99% availability",
        "Not sure — recommend a suitable target",
      ]),
    );
    add(
      "recovery_profile",
      choice("Recovery needs", "How much interruption or recent data loss could the business tolerate?", [
        "Relaxed — recover within a day; up to half a day of data loss",
        "Standard — recover within 4 hours; up to 1 hour of data loss",
        "Critical — recover within 15 minutes; up to 5 minutes of data loss",
        "Not sure — recommend and explain",
      ]),
    );
    add(
      "iac_tool",
      choice(
        "Infrastructure-as-code preference",
        "Bicep is Azure-native; Terraform is useful for existing Terraform skills or multi-cloud estates.",
        ["Bicep", "Terraform", "Not sure — guide me"],
      ),
    );
    add(
      "target_region",
      choice(
        "Preferred Azure region",
        "Sweden Central is the repository's EU fallback, not an automatically confirmed answer.",
        [
          "Sweden Central (swedencentral)",
          "West Europe (westeurope)",
          "Germany West Central (germanywestcentral)",
          "No preference — recommend an allowed region",
        ],
      ),
    );
  } else {
    const selected = Object.values(answers)
      .flat()
      .filter((value) => typeof value === "string")
      .join(" ");
    const privateData = /\b(sql|database|postgres|mysql|blob|storage|private|api)\b/i.test(selected);
    if (privateData) {
      add(
        "private_client_access",
        choice(
          "How should people and callers reach private services?",
          "No networking expertise is required. Private data access and DNS remain mandatory; the Architect will design the path.",
          [
            "Existing corporate network / VPN",
            "A new secure remote-access path is needed",
            "Only applications need access; no direct human data access",
            "Private build/deployment runners are available",
            "Not sure — design a suitable secure path",
          ],
        ),
      );
    }
    add(
      "monitoring_network_requirement",
      choice(
        "Monitoring connectivity",
        "This applies only to Azure Monitor. Effective policy may require a private path.",
        [
          "Authenticated public monitoring permitted if policy allows",
          "Private-only monitoring is a known requirement",
          "Not sure — follow policy and recommend",
        ],
      ),
    );
    add(
      "monitoring_access_scope",
      choice(
        "Monitoring access responsibility",
        "Capture scope only; contact names, group IDs and handoff owners are not needed for requirements discovery.",
        [
          "Include suitable monitoring access in this project",
          "An existing platform/team handles monitoring access",
          "Not decided — carry this to Architecture",
        ],
      ),
    );
    if (/\b(sql|postgres|mysql|relational)\b/i.test(selected)) {
      add(
        "database_identity_requirement",
        choice(
          "Database administration",
          "Entra/managed identity is the baseline. Exact administrator IDs and grants are resolved before deployment, not guessed here.",
          [
            "Use an existing approved administration group",
            "Propose a suitable group-based setup",
            "No direct human database access is needed",
            "Not sure — guide me",
          ],
        ),
      );
    }
    add(
      "authentication_requirement",
      choice("Who signs in?", "Choose the user population; application registrations are designed later.", [
        "Employees with existing Entra sign-in",
        "External customers / partners",
        "Applications/services only",
        "No interactive sign-in needed",
        "Not sure — guide me",
      ]),
    );
    add(
      "compliance",
      multiple("Compliance and residency", "Select only known requirements. Unknown is a valid discovery result.", [
        "No specific regulatory framework",
        "GDPR / EU residency",
        "Financial services requirements",
        "Healthcare requirements",
        "Organization-specific policy",
        "Not sure — assess with me",
      ]),
    );
  }
  return {
    stage,
    complete: Object.keys(properties).length === 0,
    ...(Object.keys(properties).length
      ? {
          request_id: `requirements-${randomUUID()}`,
          request_id_source: "apex-local",
          context: {
            answers: structuredClone(answers),
            fields: Object.fromEntries(Object.keys(properties).map((key) => [key, { input_id: key, kind: "input" }])),
          },
        }
      : {}),
    form: Object.keys(properties).length
      ? {
          message: `Requirements discovery: ${stage}. Choose suggested answers or type a custom value in the same field. “Not sure” is valid; no architecture or deployment is approved.`,
          requestedSchema: { properties },
        }
      : null,
  };
}

export function runDiscovery(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) {
    console.log(
      "Usage: requirements-discovery.mjs --stage business|migration|workload|access [--answers <captured-answers.json> | --recall-view <view.json> --environment <env>] [--evidence <01-discovered-evidence.json>]\nPersist the envelope and its APEX-local request_id before displaying only form through ask_user; retain the ID with the actual response. No SDK-issued request ID is required.\nEvidence: {items:[{input_id,value,provenance:iac|diagram|azure-arg,confidence:observed|inferred}]}. Suggestions require explicit owner confirmation before recording material inputs.",
    );
    return 0;
  }
  let stage;
  let answers = {};
  let recallView;
  let environment;
  let evidence;
  let answersProvided = false;
  for (let index = 0; index < argv.length; index += 2) {
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${argv[index]}`);
    if (argv[index] === "--stage") stage = value;
    else if (argv[index] === "--answers") {
      answers = JSON.parse(fs.readFileSync(path.resolve(value), "utf8"));
      answersProvided = true;
    } else if (argv[index] === "--recall-view") recallView = JSON.parse(fs.readFileSync(path.resolve(value), "utf8"));
    else if (argv[index] === "--environment") environment = value;
    else if (argv[index] === "--evidence") evidence = JSON.parse(fs.readFileSync(path.resolve(value), "utf8"));
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  if (recallView) {
    if (answersProvided) throw new Error("Use captured answers or an authoritative recall view, not both");
    answers = answersFromRecall(recallView, environment);
  } else if (environment) throw new Error("--environment requires --recall-view");
  console.log(JSON.stringify(buildDiscoveryForm(stage, answers, evidence), null, 2));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runDiscovery();
  } catch (error) {
    console.error(`Requirements discovery failed: ${error.message}`);
    process.exitCode = 1;
  }
}
