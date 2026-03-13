<!-- ref:compression-templates-v1 -->

# Compression Templates

Per-artifact compression rules at each tier. H2 sections to keep/drop
and character budget targets.

## 01-requirements.md

| Tier       | Keep H2 Sections                                                                              | Budget      |
| ---------- | --------------------------------------------------------------------------------------------- | ----------- |
| full       | All                                                                                           | No limit    |
| summarized | Project Overview, Functional Requirements, Non-Functional Requirements, Technical Constraints | ~3000 chars |
| minimal    | Project Overview (first paragraph only), Key Decisions table                                  | ~500 chars  |

## 02-architecture-assessment.md

| Tier       | Keep H2 Sections                                                      | Budget      |
| ---------- | --------------------------------------------------------------------- | ----------- |
| full       | All                                                                   | No limit    |
| summarized | Architecture Pattern, WAF Assessment, Key Decisions, Resource Summary | ~4000 chars |
| minimal    | Architecture Pattern (first paragraph), Key Decisions table           | ~500 chars  |

## 03-des-cost-estimate.md

| Tier       | Keep H2 Sections                             | Budget      |
| ---------- | -------------------------------------------- | ----------- |
| full       | All                                          | No limit    |
| summarized | Cost Summary, Monthly Total, Key Assumptions | ~2000 chars |
| minimal    | Monthly Total line only                      | ~200 chars  |

## 04-implementation-plan.md

| Tier       | Keep H2 Sections                                                       | Budget      |
| ---------- | ---------------------------------------------------------------------- | ----------- |
| full       | All                                                                    | No limit    |
| summarized | Module Inventory, Deployment Strategy, Parameter Summary, Dependencies | ~5000 chars |
| minimal    | Module Inventory table, Deployment Strategy (first paragraph)          | ~800 chars  |

## 04-governance-constraints.md

| Tier       | Keep H2 Sections                                    | Budget      |
| ---------- | --------------------------------------------------- | ----------- |
| full       | All                                                 | No limit    |
| summarized | Deny Policies, Mandatory Tags, Network Restrictions | ~3000 chars |
| minimal    | Deny Policies table only                            | ~500 chars  |

## 05-implementation-reference.md

| Tier       | Keep H2 Sections                                        | Budget      |
| ---------- | ------------------------------------------------------- | ----------- |
| full       | All                                                     | No limit    |
| summarized | Files Generated, Validation Results, Key Configurations | ~3000 chars |
| minimal    | Files Generated list only                               | ~400 chars  |

## 06-deployment-summary.md

| Tier       | Keep H2 Sections                                     | Budget      |
| ---------- | ---------------------------------------------------- | ----------- |
| full       | All                                                  | No limit    |
| summarized | Deployment Result, Resources Deployed, Configuration | ~3000 chars |
| minimal    | Deployment Result (status + resource count)          | ~300 chars  |

## 07-\* (As-Built Documents)

As-built documents are terminal — they are not loaded by downstream agents.
Compression is only needed when the As-Built agent loads predecessor artifacts.

## General Rules

- When compressing, preserve all **tables** within kept sections (tables are dense)
- Drop **code blocks** first (they are verbose)
- Keep **decision rationale** over implementation details
- Keep **resource names and SKUs** over configuration details
- Always preserve the document title (H1) and first paragraph
- At the `minimal` tier, prefer reading `decision_log` from `00-session-state.json`
  over loading full artifact prose for rationale behind prior choices
