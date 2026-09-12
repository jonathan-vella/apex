---
description: "GPT-family variant of the execution-subagent invocation prompt contract. Markdown H2 form (outcome-first), matching the GPT-5.x prompting guide. Use this when invoking a GPT-family subagent. Reference: issue #425, Wave 3a follow-up."
agent: agent
model: "GPT-5.6-Terra"
tools: [read, edit, search]
---

# Execution-Subagent Invocation Contract

Reference-only Local compatibility adapter. Read the
[canonical contract](../../../.github/skills/apex-workflow-engine/references/execution-subagent.md)
before constructing a named worker invocation. This file's Local metadata does
not select the worker or override its model/tools. Do not execute this template.

## Inputs

Supply the canonical required inputs, current evidence, allowed writes, and
observable success criterion. Return missing inputs to the parent.

## Activities

Copy the canonical bounded activities contract. Workers do not ask user
questions, manage parent todos, or dispatch nested subagents.

## Outputs

Use the named worker's source contract: file JSON with path/schema and compact
summary, or its fixed verdict/text summary without a findings-file write. Preserve
its exact failure shape. The parent persists evidence only if its own contract
owns and authorizes that artifact; recovery and approvals remain with the parent.
