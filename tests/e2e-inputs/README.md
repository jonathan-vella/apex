# E2E Test Inputs

Permanent source documents consumed by E2E evaluation prompts (RALPH loop).

- **Prompts** are in `tests/prompts/`
- **Agent output** goes to `agent-output/{project}/`
- **IaC code** goes to `infra/bicep/{project}/` or `infra/terraform/{project}/`

This folder holds only the **input fixtures** — RFPs, RFQs, sample requirements,
and reference documents that seed the evaluation pipeline.

## Contents

| File             | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| `contoso-rfq.md` | Contoso Service Hub RFQ — 15 cloud services, 3 environments, GDPR, EU-only |
