# Orchestrator Handoff

Project: nordic-foods
Current Step: 1
Status: ready-for-requirements

## Completed Steps

- Project initialized and normalized workshop input prepared.

## Key Decisions

- IaC defaults: `swedencentral`, CAF naming, AVM-first modules, and secure-by-default Azure baseline.

## Open Challenger Findings (must_fix only)

- None at handoff creation.

## Context for Next Step

- Delegate to agent: 02-Requirements.
- Use the normalized input file and source URL as primary customer requirement context.

## Skill Context
- Default region: swedencentral (EU/GDPR aligned)
- Required tags are policy-enforced and must be present in all resource definitions
- Naming uses CAF patterns and globally unique suffixes where required
- AVM-first policy applies for Bicep/Terraform resource modules
- Security baseline is mandatory (managed identity, secure defaults, no public data exposure for protected services)

## Artifacts

- agent-output/nordic-foods/README.md
- agent-output/nordic-foods/00-handoff.md
- agent-output/nordic-foods/00-requirements-input-workshop-prep.md
- agent-output/nordic-foods/09-lessons-learned.json

## Step 1 Inputs
- External source URL: https://jonathan-vella.github.io/microhack-agentic-infraops/getting-started/workshop-prep/
- Normalized input file: agent-output/nordic-foods/00-requirements-input-workshop-prep.md

## Next Action

- Delegate to agent: 02-Requirements.
- Instruction for Requirements agent: use the normalized input file and source URL before drafting 01-requirements.md.
