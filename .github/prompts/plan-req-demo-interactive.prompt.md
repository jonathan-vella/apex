---
description: "Quick demo: EU ecommerce migration (business-first wizard)"
agent: "Requirements"
model: "Claude Opus 4.6"
tools:
  - edit/createFile
  - edit/editFiles
  - vscode/askQuestions
---

# EU Ecommerce Migration Demo - Business-First Requirements Wizard

Use the `askQuestions` UI to guide the user through a business-first requirements
discovery for a mid-size EU retailer migrating their ecommerce platform to Azure.
Demonstrates how the agent translates business context into technical requirements.

## Mission

Create a polished UI-driven experience starting from a business-level prompt —
no Azure jargon upfront. Show how the agent infers architecture from business
context, asks smart follow-ups for migration scenarios, and presents services
in business-friendly language.

## Behavior Rules

1. **Use `askQuestions` tool** for ALL questions — present UI pickers, not chat text
2. **Batch related questions** into single `askQuestions` calls (max 4 per call)
3. **Start with business** — do NOT mention Azure services until Phase 3
4. **Acknowledge each batch** with a brief summary showing you understood
5. **Show progress** — tell user which step they're on
6. **Infer, don't ask** — recommend the workload pattern instead of asking the user to pick

---

## Conversation Flow

### Step 1: Business Context (askQuestions)

Pre-fill for the demo scenario. Use `askQuestions`:

```json
{
  "questions": [
    {
      "header": "Industry",
      "question": "What industry is this project for?",
      "options": [
        {"label": "Retail / Ecommerce", "recommended": true},
        {"label": "Healthcare"},
        {"label": "Financial Services"},
        {"label": "Technology / SaaS"}
      ],
      "allowFreeformInput": true
    },
    {
      "header": "Company Size",
      "question": "How large is your organization?",
      "options": [
        {"label": "Startup / Small (< 50 employees)"},
        {"label": "Mid-Market (50-500 employees)", "recommended": true},
        {"label": "Enterprise (500+ employees)"}
      ]
    },
    {
      "header": "System",
      "question": "What kind of system do you need?",
      "options": [
        {"label": "Online store / ecommerce platform", "recommended": true},
        {"label": "Customer or employee portal"},
        {"label": "Company website or marketing site"},
        {"label": "Business reporting / analytics dashboard"},
        {"label": "Backend API for mobile or web apps"},
        {"label": "Automated processing (orders, invoices, notifications)"}
      ],
      "allowFreeformInput": true
    },
    {
      "header": "Scenario",
      "question": "Is this a new project or are you changing an existing system?",
      "options": [
        {"label": "New project (greenfield)"},
        {"label": "Migrating an existing system to Azure", "recommended": true},
        {"label": "Modernizing / re-architecting an existing system"},
        {"label": "Extending an existing Azure deployment"}
      ]
    }
  ]
}
```

Acknowledge: summarize what you heard in business terms.

### Step 2: Migration Follow-Up (askQuestions)

Since this is a migration scenario, ask about the current system:

```json
{
  "questions": [
    {
      "header": "Current",
      "question": "What does your current ecommerce system run on?",
      "options": [
        {"label": "On-premises servers (Windows/Linux)", "recommended": true},
        {"label": "Hosted platform (Shopify, Magento Cloud)"},
        {"label": "Another cloud (AWS, GCP)"},
        {"label": "Legacy or custom-built system"}
      ],
      "allowFreeformInput": true
    },
    {
      "header": "Pain Points",
      "question": "What are the main problems driving this change?",
      "multiSelect": true,
      "options": [
        {"label": "Scaling limitations — can't handle growth", "recommended": true},
        {"label": "High maintenance costs"},
        {"label": "Security or compliance concerns", "recommended": true},
        {"label": "Performance issues"},
        {"label": "End of life / vendor support ending"},
        {"label": "Need new features the current system can't support"}
      ]
    },
    {
      "header": "Keep",
      "question": "What parts of the current system must be preserved?",
      "multiSelect": true,
      "options": [
        {"label": "Existing database and data", "recommended": true},
        {"label": "Current user accounts and authentication"},
        {"label": "Third-party integrations", "recommended": true},
        {"label": "Custom business logic / code"},
        {"label": "Nothing — complete rebuild is fine"}
      ]
    }
  ]
}
```

Acknowledge: explain what migration approach the answers point to.

### Step 3: Pattern Inference + Service Recommendation (askQuestions)

Based on "ecommerce" + "migration" + "on-prem", infer N-Tier Web App
and present the recommendation:

```json
{
  "questions": [
    {
      "header": "Pattern",
      "question": "Based on your ecommerce platform, I recommend a **web app with database backend** (N-Tier). Sound right?",
      "options": [
        {"label": "Yes, that sounds right", "recommended": true},
        {"label": "Not quite — let me pick differently"}
      ]
    },
    {
      "header": "Customers",
      "question": "How many customers visit your store daily?",
      "options": [
        {"label": "Under 100 (small shop)"},
        {"label": "100-1,000 (growing business)", "recommended": true},
        {"label": "1,000-10,000 (established retailer)"},
        {"label": "10,000+ (large-scale retail)"}
      ]
    },
    {
      "header": "Budget",
      "question": "Approximate monthly cloud budget?",
      "options": [
        {"label": "Under $50/month (testing first)"},
        {"label": "$200-1,000/month (production)", "recommended": true},
        {"label": "$1,000+/month (enterprise scale)"}
      ],
      "allowFreeformInput": true
    },
    {
      "header": "Data",
      "question": "What customer data does your store handle?",
      "multiSelect": true,
      "options": [
        {"label": "Personal customer data (names, emails, addresses)", "recommended": true},
        {"label": "Payment or credit card data", "recommended": true},
        {"label": "Internal business data"},
        {"label": "Public product catalog only"}
      ]
    }
  ]
}
```

### Step 4: Security & Region (askQuestions)

Pre-select based on EU + Retail + payment data:

```json
{
  "questions": [
    {
      "header": "Compliance",
      "question": "As an EU retailer handling payment data, these frameworks apply. Confirm which you need:",
      "multiSelect": true,
      "options": [
        {"label": "EU data protection (GDPR)", "recommended": true},
        {"label": "Payment card security (PCI-DSS)", "recommended": true},
        {"label": "Security controls audit (SOC 2)"},
        {"label": "None of these apply"}
      ]
    },
    {
      "header": "Security",
      "question": "Recommended security measures for ecommerce:",
      "multiSelect": true,
      "options": [
        {"label": "Passwordless service connections (Managed Identity)", "recommended": true},
        {"label": "Centralized secrets management (Key Vault)", "recommended": true},
        {"label": "Private database connections (Private Endpoints)", "recommended": true},
        {"label": "Web application firewall (WAF)", "recommended": true},
        {"label": "Encrypted connections (TLS 1.2+)", "recommended": true}
      ]
    },
    {
      "header": "Auth",
      "question": "How will customers log in to your store?",
      "options": [
        {"label": "Customer accounts (Entra ID B2C)", "recommended": true,
         "description": "For external customer sign-up and login"},
        {"label": "Company accounts (Entra ID)",
         "description": "For internal admin users only"},
        {"label": "Third-party login (social, Okta)"}
      ]
    },
    {
      "header": "Region",
      "question": "Where should your store be hosted?",
      "options": [
        {"label": "Sweden (EU, GDPR-compliant)", "recommended": true,
         "description": "Default — sustainable, GDPR-compliant"},
        {"label": "Netherlands (Western Europe)"},
        {"label": "Germany (strict data sovereignty)"}
      ]
    }
  ]
}
```

### Step 5: Operational Details & Confirmation

```json
{
  "questions": [
    {
      "header": "Project",
      "question": "Project name? (lowercase, hyphens — used for file naming)",
      "allowFreeformInput": true
    },
    {
      "header": "Environment",
      "question": "Which environments do you need?",
      "options": [
        {"label": "Dev + Production", "recommended": true},
        {"label": "Dev + Staging + Production"},
        {"label": "Dev + Test + Staging + Production"}
      ]
    },
    {
      "header": "Timeline",
      "question": "Target go-live timeline?",
      "options": [
        {"label": "1-3 months", "recommended": true},
        {"label": "3-6 months"},
        {"label": "6+ months (phased migration)"}
      ]
    }
  ]
}
```

Present a summary table in chat showing all selections, then confirm:

```json
{
  "questions": [
    {
      "header": "Confirm",
      "question": "Requirements summary ready. Generate the document?",
      "options": [
        {"label": "Yes, generate requirements", "recommended": true},
        {"label": "Let me change something"},
        {"label": "Start over"}
      ]
    }
  ]
}
```

### Step 6: Generate & Handoff

If confirmed:

1. Generate `agent-output/{projectName}/01-requirements.md` using the standard template
2. Populate `### Business Context` with industry (Retail), size (Mid-Market),
   scenario (Migration), migration source, pain points, and success criteria
3. Populate `### Architecture Pattern` (N-Tier, Balanced tier, migration justification)
4. Populate `### Recommended Security Controls` (GDPR + PCI-DSS stack)

Present next step options:

```json
{
  "questions": [
    {
      "header": "Next Step",
      "question": "Requirements captured! What would you like to do next?",
      "options": [
        {"label": "Architecture Assessment (Architect agent)",
         "description": "Full WAF assessment + cost estimates",
         "recommended": true},
        {"label": "Jump to Implementation (Bicep Plan agent)",
         "description": "Skip assessment for simple workloads"},
        {"label": "Review the document first"}
      ]
    }
  ]
}
```

---

## Output Artifact

Generate `agent-output/{projectName}/01-requirements.md` using the standard template
from `.github/skills/azure-artifacts/templates/01-requirements.template.md`, populated with user responses
and demonstrating the business-to-technical translation in every section.
