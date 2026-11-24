<!-- ref:pursuit-advisory-packages-v1 -->

# Pursuit, RFI, RFP & BAFO Advisory Packages in `agent-output/`

Ad hoc commercial and technical pursuit packages (RFIs, RFPs, RFQs, and Best-and-Final-Offer
schedules authored via [`.github/skills/apex-rfi-rfp/SKILL.md`](../../apex-rfi-rfp/SKILL.md))
coexist under `agent-output/{project}/` alongside numbered infrastructure delivery projects and
standalone Well-Architected assessments without initializing `apex-recall` deployment steps.

## Coexistence Rules

1. **Mandatory `README.md` H2 Skeleton**:
   Every pursuit folder in `agent-output/{project}/` (and any self-contained modular child package
   containing its own `README.md`) MUST include the five `PROJECT-README` H2 headings in exact order:
   - `## 📋 Project Summary`
   - `## ✅ Workflow Progress`
   - `## 🏛️ Architecture`
   - `## 📄 Generated Artifacts`
   - `## 🔗 Related Resources`

2. **Non-Delivery Workflow Progress Statement**:
   In `## ✅ Workflow Progress`, state explicitly that the folder is an ad hoc pursuit advisory
   package rather than an initialized `apex-recall` infrastructure delivery or standalone WAF
   assessment run, and assert no numbered delivery-step completion.

3. **Avoid Reserved Delivery-Step Filenames**:
   `tools/scripts/validate-artifacts.mjs` and `tools/scripts/validate-challenger-presence.mjs`
   match reserved delivery filenames across `agent-output/**`. Pursuit deliverables MUST NOT end
   with reserved delivery-step suffixes unless the project is a genuine `apex-recall` run with
   valid challenger sidecars:
   - Reserved suffixes to avoid: `01-requirements.md`, `01-assessment-brief.md`,
     `02-architecture-assessment.md`, `03-des-cost-estimate.md`, `03-cost-management-report.md`,
     `04-assessment-action-register.md`, `04-governance-constraints.md`,
     `04-implementation-plan.md`, `04-preflight-check.md`, `05-implementation-reference.md`,
     `06-deployment-summary.md`, and `07-*.md`.
   - Allowed pursuit filenames include `{slug}.azure-response.md`, `{slug}.azure-rom-estimate.md`,
     `{slug}.evidence-and-provenance.md`, `{slug}.model-changelog.md`, `00-partner-briefing.md`,
     `00-partner-handoff-email.md`, `briefs/brief-*.md`, `appendices/appendix-*.md`, and
     Architecture Decision Records (`03-des-adr-NNNN-*.md` using the 7 canonical ADR H2s).

4. **Read-Only Customer Source Containment & Sensitivity Gates**:
   - Store original customer/partner schedules, questionnaires, and emails in a read-only subfolder
     (`rfi-docs/`, `emails/`, or `_meta/`) locked with a `SHA-256` manifest.
   - Derived narratives, `.xlsx` schedules, `.pptx` decks, and diagrams retain customer-sensitive
     data even when raw originals are omitted; external archive packaging requires explicit
     sensitivity-label clearance per [`.github/skills/apex-rfi-rfp/SKILL.md`](../../apex-rfi-rfp/SKILL.md).

5. **Artifact Lint Delegation Preserved**:
   Never run `npm run lint:artifact-templates`, `npm run lint:h2-sync`, or `markdownlint-cli2`
   directly against `agent-output/**`; use `.github/skills/apex-rfi-rfp/scripts/verify_pursuit_package.py`
   for pursuit-level verification while pre-commit hooks own repository artifact checks.
