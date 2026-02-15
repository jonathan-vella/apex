---
description: "Demo: End-to-end Static Web App workflow with pre-filled approvals"
agent: "InfraOps Conductor"
model: "Claude Opus 4.6"
tools:
  - agent
  - edit/createFile
  - edit/editFiles
  - read/readFile
  - search/listDirectory
  - execute/runInTerminal
  - vscode/askQuestions
---

# Conductor Demo — Static Web App End-to-End

Demonstrate the full 7-step InfraOps workflow using a Static Web App with
CDN, custom domain, and Application Insights as the sample workload.
Suitable for live presentations and onboarding walkthroughs.

## Mission

Run the complete Conductor workflow with pre-filled context at each step
to demonstrate how the agents collaborate. Show approval gates, artifact
generation, and handoffs between agents in a controlled demo scenario.

## Demo Scenario

A mid-size marketing agency wants a fast, globally distributed website
for content-heavy campaigns with analytics tracking.

- **Industry**: Marketing / Agency
- **Company Size**: Mid-Market (80 employees)
- **System**: Company website / marketing campaigns
- **Scenario**: Greenfield
- **Region**: swedencentral (Static Web App exception: westeurope)
- **Budget**: ~$100/month
- **Compliance**: GDPR
- **Project name**: `demo-static-webapp`

## Workflow

### Step 1: Requirements

Delegate to **Requirements** agent with this context:

> We're a mid-size marketing agency (80 staff) building a new website
> for content-heavy campaigns. We need fast global delivery, analytics
> tracking, and GDPR compliance. Budget is around $100/month.

At each `askQuestions` prompt, the recommended answers should align
with the scenario above. Generate `01-requirements.md`.

**Demo gate**: Show the requirements summary. Approve to continue.

### Step 2: Architecture Assessment

Delegate to **Architect** agent. Expected recommendations:

- Azure Static Web Apps (Standard tier)
- Azure CDN or Front Door (global distribution)
- Application Insights (analytics)
- Key Vault (secrets management)

Show WAF scores and cost estimate. Approve to continue.

### Step 3: Design (Optional)

Offer to generate a diagram. For demo purposes, generate the
architecture diagram to show the Design agent in action.

### Step 4: Implementation Plan

Delegate to **Bicep Plan** agent. Run governance discovery
and AVM verification. Show the plan summary. Approve to continue.

### Step 5: Bicep Code

Delegate to **Bicep Code** agent. Generate templates with AVM
modules. Show lint and review results.

### Step 6: Deploy

Delegate to **Deploy** agent. Run what-if analysis.
Show change summary. Approve (or skip actual deployment for demo).

### Step 7: Documentation

Generate the `07-*.md` documentation suite to demonstrate
the complete project lifecycle.

## Output Expectations

Full artifact set in `agent-output/demo-static-webapp/` and
Bicep templates in `infra/bicep/demo-static-webapp/`.

## Presenter Notes

- Total demo time: ~20–30 minutes with all 7 steps
- For shorter demos: run Steps 1-3 only (~10 minutes)
- At Step 6, you can skip actual deployment and just show what-if
- Highlight the approval gates — they demonstrate human-in-the-loop control
