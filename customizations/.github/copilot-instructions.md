## APEX Workspace

Use the visible `APEX` agent to start, orient, or resume a project. It routes work by direct handoff to Requirements,
Architect, Planner, or Operator.

The APEX kernel is authoritative for project state, the next task, bounded context, validation, gates, approvals, and
external operations. Fetch current state through `apex/*` MCP tools. Do not infer workflow progress from chat history or
workspace files.

Agents stage and complete work only through narrow APEX MCP tools. General shell, direct filesystem mutation, Git,
Azure, Bicep, and Terraform tools are outside the managed agent boundary.

Hidden workers do not ask users. They return typed `needs_input` results to the active interactive specialist.
