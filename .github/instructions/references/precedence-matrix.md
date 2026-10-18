# Instruction Precedence Matrix

When multiple instruction files apply to the same file type (via overlapping
`applyTo` globs), this matrix defines which rules take precedence. Files under
`references/` have no `applyTo`; they load only when an instruction or agent links
to them, so they appear here as canonical sources, not as instruction layers.
This is APEX's authoring ownership contract; it does not override the harness's
instruction hierarchy or certify runtime attachment.

## Entry-Point Ownership

- Root `AGENTS.md`: build/contribution conventions, workflow table and concise runtime safety summary.
- `.github/copilot-instructions.md`: canonical Azure defaults, recall usage and harness/runtime boundaries.
- Nested IaC `AGENTS.md`: track-specific commands and layout.
- Agent bodies: essential role, approval, output and stop constraints, even when references exist.

Update the topic owner first, then reconcile summaries and tests. Do not independently
evolve duplicate policy text; unresolved conflicts block the affected action.

## Precedence Order (highest wins)

1. **Azure Policy constraints** — discovered policy, whose rules are canonical in
   `references/iac-policy-compliance.md` and `references/iac-security-baseline.md`
   - Azure Policy ALWAYS wins. If a governance Deny policy conflicts with
     any other instruction, the policy constraint takes precedence.
2. **Domain-specific instructions** — for example `iac-bicep-best-practices`,
   `iac-terraform-best-practices`, `azure-artifacts`, `agent-authoring`.
3. **Cross-cutting instructions** — for example `iac-plan-best-practices`,
   `context-optimization`, `no-interactive-shell`, `no-heredoc`, `docs-trigger`,
   `no-hardcoded-counts`.
4. **General style** — `code-quality`, `markdown` and the language files.

## Overlap Map

### Files matching `**/*.bicep` or `**/*.tf`

| Instruction                                   | Priority   | Key Rules                                                     |
| --------------------------------------------- | ---------- | ------------------------------------------------------------- |
| iac-bicep / iac-terraform best practices      | 2          | Policy precedence, AVM-first, naming, track-specific rules    |
| no-heredoc                                    | 3          | File-editing tools, never shell redirects                     |
| code-quality                                  | 4 (lowest) | WHY comments, security review priority                        |

`iac-plan-best-practices` applies only to `04-implementation-plan.md`, not to IaC source.

### Files matching `agent-output/**/*.md`

| Instruction    | Priority   | Key Rules                              |
| -------------- | ---------- | -------------------------------------- |
| azure-artifacts | 2         | H2 heading compliance, template-first  |
| markdown       | 4 (lowest) | General style only; template headings win, Markdownlint excludes artifacts |

### Files matching `.github/agents/*.agent.md`

| Instruction           | Priority   | Key Rules                                                  |
| --------------------- | ---------- | ---------------------------------------------------------- |
| agent-authoring       | 2          | Frontmatter schema, handoffs, model ownership              |
| vendor-prompting      | 2          | Rule-ID-tagged vendor and repository conventions           |
| agent-operating-frame | 2          | Read-once skills, recall lookups, upstream immutability    |
| lesson-collection     | 2          | Orchestrator agents only                                   |
| context-optimization  | 3          | Body and context budgets                                   |
| no-interactive-shell  | 3          | No prompts, bounded terminal output                        |
| docs-trigger          | 3          | Required product documentation updates                     |
| no-hardcoded-counts   | 3          | Descriptive counts, `count-manifest.json` as the source    |

`_subagents/*.agent.md` receive the same set except `agent-operating-frame` and
`lesson-collection`. Local `.prompt.md` adapters and their prompt-specific
instruction are archived, outside active discovery.
`SKILL.md` files receive `agent-skills`, `context-optimization`, `no-interactive-shell`,
`docs-trigger` and `no-hardcoded-counts`.

## Conflict Resolution

When two instructions at the same priority level conflict:

1. The MORE SPECIFIC instruction wins (domain > general)
2. If equally specific, the instruction with automated enforcement wins
3. If neither has enforcement, document the exception in the artifact
