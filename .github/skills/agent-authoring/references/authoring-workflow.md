<!-- ref:agent-authoring-workflow-v2 -->

# Authoring Workflow

## Agent Hierarchy

Top-level agents represent workflow steps or user-facing utilities. Subagents
are not user-invocable, do not chain, and return bounded structured results.
Use the workflow graph as canonical topology rather than duplicating a step table.

## Research Before Implementation

1. Locate the owning implementation, nearest analogous agent, and template.
2. Load only skills and references required by the current change.
3. Verify external contracts through documentation or a validation subagent.
4. Retrieve predecessor state and cached decisions through `apex-recall`.
5. Clarify only information that materially changes implementation.

## Subagent Delegation

1. Compile the minimum complete input set.
2. State exact activities and constraints.
3. Require a structured verdict, schema, or bounded report.
4. Integrate the result without replaying raw working context.

Pass required paths, decisions, and output contracts explicitly because
subagents do not inherit parent history.

## Canonical Owners

| Concern | Owner |
| --- | --- |
| Workflow topology | `workflow-engine/templates/workflow-graph.json` |
| Artifact structure | `azure-artifacts/templates/` |
| Azure defaults | `.github/copilot-instructions.md` and `azure-defaults` |
| Bicep | `iac-bicep-best-practices.instructions.md` |
| Terraform | `iac-terraform-best-practices.instructions.md` |
| Markdown | `markdown.instructions.md` |
| Vendor prompting | `vendor-prompting.instructions.md` |

## Pull Request Checklist

- Frontmatter parses and uses supported fields.
- Tool and subagent declarations agree.
- Handoffs identify real targets, inputs, and outputs.
- Model changes are approved and synchronized.
- Links resolve and canonical templates remain unchanged.
- Agent, vendor, skill, and model validators pass.
