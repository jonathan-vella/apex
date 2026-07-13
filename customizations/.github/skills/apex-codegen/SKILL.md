---
name: apex-codegen
description: "Generate one bounded IaC batch. Use for hidden CodeGen tasks with approved intent and binding."
user-invocable: false
---

## APEX Code Generation

Use this skill only inside the hidden CodeGen worker.

## Prerequisites

- `apex/taskContext` supplies approved intent, one selected-track binding, policy obligations, output paths, and limits.
- The task identifies a single dependency-sized generation batch.

## Workflow

1. Call `apex/generateIac` for the accepted intent and selected-track binding.
2. Preserve exact module, provider, API, security, naming, ownership, and environment-input obligations.
3. Keep secret values out of generated content; use only typed references supplied by the kernel.
4. Use `apex/stageFile` only for additional assigned files; never write directly to the repository.
5. Return `needs_input` when a required binding or value is absent.

Do not execute, format, validate, preview, deploy, or write directly to repository paths.

## Output

Return the typed completion or `needs_input` result with affected field IDs.
