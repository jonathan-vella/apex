---
description: "Quick demo: Static Web App requirements (interactive wizard)"
agent: "Requirements"
model: "Claude Opus 4.6"
tools:
  - edit/createFile
  - vscode/askQuestions
---

# Static Web App Demo - Interactive Requirements Wizard

Use the `askQuestions` UI to guide the user through a fast, structured requirements
gathering process for a Static Web App demo. Optimized for live demos.

## Mission

Create a polished UI-driven experience that captures essentials for a Static Web App.
Keep it fast for live demos while letting users pick options from dropdowns instead of typing.

## Behavior Rules

1. **Use `askQuestions` tool** for ALL questions — present UI pickers, not chat text
2. **Batch related questions** into single `askQuestions` calls (max 4 per call)
3. **Acknowledge each batch** with a brief confirmation before the next
4. **Offer smart defaults** via `recommended: true` on common options
5. **Show progress** — tell user which step they're on

---

## Conversation Flow

### Step 1: Project Basics (askQuestions)

Use `askQuestions` with these questions:

```json
{
  "questions": [
    {
      "header": "Project",
      "question": "What would you like to call this Static Web App project? (lowercase, hyphens allowed)",
      "allowFreeformInput": true
    },
    {
      "header": "Framework",
      "question": "Which frontend framework are you using?",
      "options": [
        {"label": "React", "recommended": true},
        {"label": "Vue"},
        {"label": "Angular"},
        {"label": "Vanilla JS / HTML"},
        {"label": "Next.js (static export)"},
        {"label": "Astro"}
      ]
    },
    {
      "header": "Repository",
      "question": "Do you have a GitHub repository for CI/CD?",
      "options": [
        {"label": "Yes, I'll provide the URL"},
        {"label": "No, manual deployment", "recommended": true},
        {"label": "Create one for me"}
      ],
      "allowFreeformInput": true
    },
    {
      "header": "Budget",
      "question": "Static Web Apps Standard tier costs ~$9/month + App Insights (~$5-10/month). Monthly budget?",
      "options": [
        {"label": "Free tier ($0)", "description": "Limited features, no staging"},
        {"label": "~$15/month", "description": "Standard tier + monitoring", "recommended": true},
        {"label": "~$50/month", "description": "Standard + CDN + custom domain"},
        {"label": "~$100+/month", "description": "Enterprise with Front Door"}
      ]
    }
  ]
}
```

Acknowledge answers and proceed to Step 2.

### Step 2: Security & Region (askQuestions)

Use `askQuestions`:

```json
{
  "questions": [
    {
      "header": "Auth",
      "question": "How will users authenticate to your Static Web App?",
      "options": [
        {"label": "No authentication (public site)", "recommended": true},
        {"label": "Microsoft Entra ID (corporate)"},
        {"label": "GitHub login"},
        {"label": "Custom auth provider"}
      ]
    },
    {
      "header": "Region",
      "question": "Deployment region?",
      "options": [
        {"label": "West Europe", "description": "Optimal for Static Web Apps EU", "recommended": true},
        {"label": "East US 2", "description": "US workloads"},
        {"label": "East Asia", "description": "APAC workloads"}
      ]
    },
    {
      "header": "Features",
      "question": "Which additional features do you need?",
      "multiSelect": true,
      "options": [
        {"label": "Custom domain", "recommended": true},
        {"label": "Staging environments"},
        {"label": "API backend (Azure Functions)"},
        {"label": "Application Insights monitoring", "recommended": true},
        {"label": "CDN / Front Door"}
      ]
    }
  ]
}
```

### Step 3: Confirmation

Present a summary table in chat showing:

- All user selections from Steps 1-2
- Pre-configured defaults (SKU, SLA, tags, security controls)
- Azure resources that will be created

Ask: "Does this look correct? Want to proceed or change anything?"

Use `askQuestions` for confirmation:

```json
{
  "questions": [
    {
      "header": "Confirm",
      "question": "Requirements summary looks good. Ready to generate the document?",
      "options": [
        {"label": "Yes, generate requirements", "recommended": true},
        {"label": "Let me change something"},
        {"label": "Start over"}
      ]
    }
  ]
}
```

### Step 4: Generate & Handoff

If confirmed:
1. Generate `agent-output/{projectName}/01-requirements.md` using the standard template
2. Populate with user selections + Static Web App defaults
3. Include `### Architecture Pattern` (Static Site / SPA, Cost-Optimized or Standard tier)
4. Include `### Recommended Security Controls` (HTTPS, managed cert, TLS 1.2)

Present next step options:

```json
{
  "questions": [
    {
      "header": "Next Step",
      "question": "Requirements captured! What would you like to do next?",
      "options": [
        {"label": "Architecture Assessment (@architect)",
         "description": "Full WAF assessment + cost estimates",
         "recommended": true},
        {"label": "Jump to Implementation (@bicep-plan)",
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
from `.github/templates/01-requirements.template.md`, populated with user responses
and pre-configured defaults for Static Web Apps.
