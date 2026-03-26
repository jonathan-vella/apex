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
      "Start with the business context, the architecture snapshot, and the full step map before diving into the generated artifacts.",
    focus:
      "Orient yourself around the end-to-end flow, the audience, and the proof points that make the walkthrough credible.",
    sections: ["Scenario", "Workflow map", "Proof points"],
  },
  {
    id: "requirements",
    label: "Step 1 — Requirements Discovery",
    slug: "demo/01-requirements-discovery",
    stepLabel: "Step 1",
    chipLabel: "1",
    shortTitle: "Requirements Discovery",
    agent: "Requirements Agent",
    artifact: "Business and technical requirements",
    summary:
      "The opening artifact defines the workload goals, success criteria, non-functional requirements, compliance scope, and budget guardrails.",
    focus:
      "Read this step to understand what the platform must deliver before architecture and governance narrow the solution space.",
    sections: ["Business context", "Success criteria", "Constraints"],
    items: [
      { label: "Overview", slug: "demo/01-requirements-discovery" },
      {
        label: "Functional Requirements",
        slug: "demo/01-requirements-discovery/functional",
      },
      {
        label: "Compliance & Security",
        slug: "demo/01-requirements-discovery/compliance-security",
      },
      {
        label: "Budget & Scaling",
        slug: "demo/01-requirements-discovery/budget-scaling",
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
      "This step translates the workload into an Azure architecture, tests it against the Well-Architected Framework, and sizes the core services.",
    focus:
      "Use it to see the trade-offs between security, cost, reliability, and operational complexity before implementation begins.",
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
      "The design pass turns the architecture into visual artifacts and formal design decisions that can be reviewed by humans before coding.",
    focus:
      "Look here for the diagrams, the architecture decision record, and the supporting visuals that make the plan easier to audit.",
    sections: [
      "Architecture diagram",
      "Architecture decisions",
      "Cost estimates",
    ],
  },
  {
    id: "governance",
    label: "Step 3.5 — Governance",
    slug: "demo/04-governance",
    items: [
      { label: "Overview", slug: "demo/04-governance" },
      {
        label: "Tagging & Deployment Validation",
        slug: "demo/04-governance/tags",
      },
      { label: "Security Constraints", slug: "demo/04-governance/security" },
    ],
    stepLabel: "Step 3.5",
    chipLabel: "3.5",
    shortTitle: "Governance",
    agent: "Governance Agent",
    artifact: "Azure Policy constraints",
    summary:
      "Governance discovery checks what the target subscription will actually allow, so the implementation plan is grounded in policy reality.",
    focus:
      "This is the policy checkpoint that prevents the plan from drifting away from Azure Policy, tagging, networking, or security constraints.",
    sections: ["Policy effects", "Required tags", "Deployment blockers"],
  },
  {
    id: "plan",
    label: "Step 4 — Infra-as-Code Plan",
    slug: "demo/05-plan",
    items: [
      { label: "Overview", slug: "demo/05-plan" },
      { label: "Azure Verified Modules (AVM)", slug: "demo/05-plan/modules" },
      { label: "Implementation Phases", slug: "demo/05-plan/phases" },
    ],
    stepLabel: "Step 4",
    chipLabel: "4",
    shortTitle: "Infra-as-Code Plan",
    agent: "IaC Planner",
    artifact: "Implementation plan and dependency flow",
    summary:
      "The planner turns the approved architecture into a phased implementation sequence with dependencies, module structure, and deployment ordering.",
    focus:
      "Use this step to understand how the future codebase is organized and how the deployment is staged for safe delivery.",
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
    agent: "CodeGen Agent",
    artifact: "Bicep templates and validation results",
    summary:
      "This step shows the AVM-first Bicep output, the resulting module layout, and the validation trail that proves the generated code is viable.",
    focus:
      "Review this artifact to see how the planning decisions become concrete Azure infrastructure code and how the validation loop tightens quality.",
    sections: ["IaC modules", "Validation results", "Implementation notes"],
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
      "The deploy step records what was provisioned, what succeeded, and which post-deployment tasks remain after the infrastructure reaches Azure.",
    focus:
      "Use it to inspect the preflight checks, the deployment phases, and the final resource outputs from the live rollout.",
    sections: ["Preflight checks", "Deployment phases", "Outputs"],
  },
  {
    id: "as-built",
    label: "Step 7 — As-Built Docs",
    slug: "demo/08-as-built",
    items: [
      { label: "Overview", slug: "demo/08-as-built" },
      { label: "Operations Runbook", slug: "demo/08-as-built/runbook" },
      {
        label: "Compliance Matrix",
        slug: "demo/08-as-built/compliance-matrix",
      },
    ],
    stepLabel: "Step 7",
    chipLabel: "7",
    shortTitle: "As-Built Docs",
    agent: "As-Built Agent",
    artifact: "Operational documentation suite",
    summary:
      "The final delivery package turns the deployed workload into runbooks, architecture documentation, inventories, compliance views, and cost reporting.",
    focus:
      "This is the handover step for operators and stakeholders who need to understand what was delivered and how to run it safely.",
    sections: ["Architecture", "Resources", "Operations", "Compliance", "Cost"],
  },
  {
    id: "reviews",
    label: "Reviews",
    slug: "demo/09-reviews",
    items: [
      { label: "Overview", slug: "demo/09-reviews" },
      { label: "Architecture Review", slug: "demo/09-reviews/architecture" },
      { label: "Governance Review", slug: "demo/09-reviews/governance" },
      { label: "IaC Plan Review", slug: "demo/09-reviews/plan" },
    ],
    stepLabel: "Reviews",
    chipLabel: "R",
    shortTitle: "Adversarial reviews",
    agent: "Challenger Agent",
    artifact: "Cross-step findings",
    summary:
      "The walkthrough closes with the challenge passes that forced corrections across requirements, architecture, planning, and deployment.",
    focus:
      "Read this page to see where the system pushed back, what it caught, and how adversarial review improves the final output.",
    sections: ["Review findings", "Corrections", "Residual risks"],
  },
];

export const demoSteps = stepDefinitions.map((step) => ({
  ...step,
  href: `${SITE_BASE}/${step.slug}/`,
}));

export const demoStats = [
  { label: "Workflow steps", value: "7 + governance" },
  { label: "Challenge passes", value: "12 reviews" },
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
