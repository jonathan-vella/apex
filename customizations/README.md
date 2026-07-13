## Managed Workspace Source

This directory is the versioned source bundle installed into consumer repositories by `apex init` and updated by
`apex update`. Its payload uses supported workspace discovery paths:

- `.github/agents/`
- `.github/skills/`
- `.github/copilot-instructions.md`
- `.vscode/mcp.json`

`manifest.json` records the bundle version, managed files, agent roles, invocation edges, interaction types, recommended
models, and cost tiers.

## Editing Policy

Make source changes in this directory and release them as a new bundle version. Consumer copies are managed files; do
not edit them manually. The installer records base and current hashes so update can preserve user changes with a
three-way merge or stop with an actionable conflict instead of silently overwriting them.

The prompts are guidance, not an authorization boundary. The APEX kernel and its narrow MCP tools remain authoritative
for state transitions, validation, approvals, and external operations.
