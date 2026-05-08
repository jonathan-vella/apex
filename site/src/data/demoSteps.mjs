import { SITE_BASE } from "./siteConfig.mjs";

const stepDefinitions = [
  {
    id: "overview",
    label: "Overview",
    slug: "demo",
    stepLabel: "Overview",
    chipLabel: "Overview",
    shortTitle: "Overview",
    agent: "Multi-agent workflow",
    artifact: "Walkthrough hub",
    summary:
      "A Maltese catering outlet needs an online ordering app on Azure. Start with the business context, architecture snapshot, and full step map.",
    focus:
      "Orient yourself around the end-to-end flow, the scenario, and the proof points that make the walkthrough credible.",
    sections: ["Scenario", "Workflow map", "Proof points"],
  },
  {
    id: "requirements",
    label: "Step 1 — Requirements",
    slug: "demo/01-requirements",
    stepLabel: "Step 1",
    chipLabel: "1",
    shortTitle: "Requirements",
    agent: "Requirements Agent",
    artifact: "Business and technical requirements",
    summary:
      "The opening artifact captures what the catering outlet needs: an online ordering app for pastizzi, Cisk, and Kinnie with GDPR compliance and a EUR 100-500 monthly budget.",
    focus:
      "Read this step to understand the workload goals, compliance scope, and budget constraints before architecture narrows the solution space.",
    sections: ["Business context", "Functional requirements", "Compliance & security", "Budget & scaling"],
    items: [
      { label: "Overview", slug: "demo/01-requirements" },
      {
        label: "Functional Requirements",
        slug: "demo/01-requirements/functional",
      },
      {
        label: "Compliance & Security",
        slug: "demo/01-requirements/compliance-security",
      },
      {
        label: "Budget & Scaling",
        slug: "demo/01-requirements/budget-scaling",
      },
    ],
  },
  {
    id: "architecture",
    label: "Step 2 — Solution Architecture",
    slug: "demo/02-architecture",
    items: [
      { label: "Overview", slug: "demo/02-architecture" },
      { label: "WAF Assessment", slug: "demo/02-architecture/waf-assessment" },
      {
        label: "SKU Sizing & Pricing",
        slug: "demo/02-architecture/sizing-pricing",
      },
    ],
    stepLabel: "Step 2",
    chipLabel: "2",
    shortTitle: "Solution Architecture",
    agent: "Architect Agent",
    artifact: "WAF assessment and SKU recommendations",
    summary:
      "App Service S1 with VNet integration and private endpoints. WAF scores: Security 8, Reliability 7, Performance 9, Cost 7, Operations 7. Estimated ~$155/month.",
    focus:
      "See the trade-offs between security posture, cost, and operational complexity before implementation begins.",
    sections: ["Service topology", "WAF assessment", "SKU recommendations"],
  },
  {
    id: "design",
    label: "Step 3 — Design Artifacts",
    slug: "demo/03-design",
    items: [
      { label: "Overview", slug: "demo/03-design" },
      { label: "Architecture Decision Records", slug: "demo/03-design/adrs" },
      { label: "Cost Estimates", slug: "demo/03-design/cost" },
    ],
    stepLabel: "Step 3",
    chipLabel: "3",
    shortTitle: "Design Artifacts",
    agent: "Design Agent",
    artifact: "ADRs, diagrams, and cost visuals",
    summary:
      "Three ADRs (App Service S1, Table Storage, public network posture), architecture diagram, and cost breakdown with distribution and projection charts.",
    focus:
      "Look here for the diagrams, architecture decisions, and cost visuals that make the plan auditable before coding starts.",
    sections: ["Architecture diagram", "Architecture decisions", "Cost estimates"],
  },
  {
    id: "governance",
    label: "Step 3.5 — Governance",
    slug: "demo/04-governance",
    items: [
      { label: "Overview", slug: "demo/04-governance" },
      { label: "Tagging Policy", slug: "demo/04-governance/tags" },
      {
        label: "Security & Network Policies",
        slug: "demo/04-governance/security",
      },
    ],
    stepLabel: "Step 3.5",
    chipLabel: "3.5",
    shortTitle: "Governance",
    agent: "Governance Agent",
    artifact: "Azure Policy constraints",
    summary:
      "Live REST API discovery found 21 policy assignments including a 9-tag deny blocker on resource groups. Storage and Key Vault hardening are audit-only.",
    focus:
      "This is the policy checkpoint that prevents the plan from drifting away from Azure Policy, tagging, and security constraints.",
    sections: ["Policy effects", "Required tags", "Deployment blockers"],
  },
  {
    id: "plan",
    label: "Step 4 — Infra-as-Code Plan",
    slug: "demo/05-plan",
    items: [
      { label: "Overview", slug: "demo/05-plan" },
      { label: "Module Architecture", slug: "demo/05-plan/modules" },
      { label: "Implementation Phases", slug: "demo/05-plan/phases" },
    ],
    stepLabel: "Step 4",
    chipLabel: "4",
    shortTitle: "Infra-as-Code Plan",
    agent: "IaC Planner",
    artifact: "Implementation plan and dependency flow",
    summary:
      "12 resources across 10 AVM Bicep modules deployed in 5 phases. Governance-adapted tag contract expands from 4 to 9 required tags.",
    focus: "Understand how the codebase is organized and how deployment is staged for safe delivery.",
    sections: ["Module structure", "Implementation tasks", "Dependency flow"],
  },
  {
    id: "code",
    label: "Step 5 — Infra-as-Code Gen",
    slug: "demo/06-code",
    items: [
      { label: "Overview", slug: "demo/06-code" },
      { label: "Generated Artifacts", slug: "demo/06-code/artifacts" },
      { label: "Validation Summary", slug: "demo/06-code/validation" },
    ],
    stepLabel: "Step 5",
    chipLabel: "5",
    shortTitle: "Infra-as-Code Gen",
    agent: "Bicep CodeGen Agent",
    artifact: "Bicep templates and validation results",
    summary:
      "AVM-first Bicep output with 10 modules. Bicep build, lint, and security baseline all pass. Preflight check confirms AVM versions.",
    focus: "Review how planning decisions become concrete Bicep code and how the validation loop tightens quality.",
    sections: ["File structure", "Validation results", "AVM modules"],
  },
  {
    id: "deploy",
    label: "Step 6 — Deployment",
    slug: "demo/07-deploy",
    items: [
      { label: "Overview", slug: "demo/07-deploy" },
      { label: "Deployment Phases", slug: "demo/07-deploy/phases" },
      { label: "Resource Outputs", slug: "demo/07-deploy/outputs" },
    ],
    stepLabel: "Step 6",
    chipLabel: "6",
    shortTitle: "Deployment",
    agent: "Deploy Agent",
    artifact: "Deployment execution summary",
    summary:
      "Deployed via azd provision in 5 minutes. S1 was unavailable in swedencentral — auto-switched to P0v3. All 12 resources provisioned successfully.",
    focus: "Inspect the preflight checks, deployment phases, and final resource outputs from the live rollout.",
    sections: ["Preflight checks", "Deployment phases", "Outputs"],
  },
  {
    id: "as-built",
    label: "Step 7 — As-Built Docs",
    slug: "demo/08-as-built",
    items: [
      { label: "Overview", slug: "demo/08-as-built" },
      { label: "Design & Inventory", slug: "demo/08-as-built/design" },
      { label: "Operations Runbook", slug: "demo/08-as-built/runbook" },
      { label: "Compliance & Cost", slug: "demo/08-as-built/compliance" },
    ],
    stepLabel: "Step 7",
    chipLabel: "7",
    shortTitle: "As-Built Docs",
    agent: "As-Built Agent",
    artifact: "Operational documentation suite",
    summary:
      "Post-deployment documentation: design document, resource inventory, operations runbook, backup/DR plan, compliance matrix, and cost estimate.",
    focus:
      "This is the handover step for operators and stakeholders who need to understand what was delivered and how to run it safely.",
    sections: ["Design", "Resources", "Operations", "Compliance", "Cost"],
  },
  {
    id: "reviews",
    label: "Reviews",
    slug: "demo/09-reviews",
    items: [
      { label: "Overview", slug: "demo/09-reviews" },
      { label: "Requirements Review", slug: "demo/09-reviews/requirements" },
      { label: "Architecture Review", slug: "demo/09-reviews/architecture" },
      { label: "Governance Review", slug: "demo/09-reviews/governance" },
      {
        label: "Implementation Review",
        slug: "demo/09-reviews/implementation",
      },
    ],
    stepLabel: "Reviews",
    chipLabel: "R",
    shortTitle: "Adversarial Reviews",
    agent: "Challenger Agent",
    artifact: "Cross-step findings",
    summary:
      "Four independent adversarial reviews found 1 critical (ACR SKU mismatch), 2 high, 10 medium, and 13 low findings across all workflow steps.",
    focus: "See where the system pushed back, what it caught, and how adversarial review improves the final output.",
    sections: ["Requirements", "Architecture", "Governance", "Implementation"],
  },
];

export const demoSteps = stepDefinitions.map((step) => ({
  ...step,
  href: `${SITE_BASE}/${step.slug}/`,
}));

export const demoStats = [
  { label: "Workflow steps", value: "7 + governance" },
  { label: "Challenge passes", value: "4 reviews" },
  { label: "IaC track", value: "Bicep + AVM" },
  { label: "Primary region", value: "Sweden Central" },
];

export const demoSidebarItems = demoSteps.map(({ label, slug, items }) => {
  if (items) {
    return {
      label,
      collapsed: true,
      items: items.map((item) => ({
        label: item.label,
        slug: item.slug,
      })),
    };
  }
  return {
    label,
    slug,
  };
});

export function getDemoStepById(id) {
  return demoSteps.find((step) => step.id === id);
}

export function getDemoStepByHref(href) {
  return demoSteps.find((step) => step.href === href);
}

export function getAdjacentDemoSteps(id) {
  const currentIndex = demoSteps.findIndex((step) => step.id === id);

  if (currentIndex === -1) {
    return { previous: undefined, next: undefined };
  }

  return {
    previous: demoSteps[currentIndex - 1],
    next: demoSteps[currentIndex + 1],
  };
}
