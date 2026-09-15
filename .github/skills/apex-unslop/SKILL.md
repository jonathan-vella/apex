---
name: apex-unslop
user-invocable: true
disable-model-invocation: true
argument-hint: "text or document path, audience, and review or edit scope"
description: '**UTILITY SKILL** — Manually polish authorized prose for clarity and concrete language while preserving technical facts and APEX contracts. WHEN: explicitly invoked as /apex-unslop for prose review or cleanup. DO NOT USE FOR: code changes, technical validation, or automatic workflow finalization.'
license: MIT
metadata:
  author: jonathan-vella
  version: "1.0"
  upstream: cursor/plugins/pstack/skills/unslop
  upstream_commit: e8d856f0273b42ebafe0ec3546bd645709e7c1b0
---

# APEX prose cleanup

Improve clarity when the user explicitly invokes this skill. Do not run automatically,
load it for every agent turn, or add it as a mandatory workflow step. Manual invocation
does not change the caller's model, tools, role or edit permissions. This is prose editing,
not an AI-authorship detector or a substitute for technical review.

## Prerequisites

- Identify the requested text or file, audience, tone and whether the user wants review or edits.
- Read the current selected text and applicable file instructions. Ask only for unresolved scope.
- For files, establish ownership and review status before editing. Preserve unrelated user changes.

## Scope and protected content

Edit only authorized natural-language prose. Review requests produce suggestions without file changes.
An ambiguous request does not authorize a repository-wide cleanup. The default for code, commands, identifiers,
configuration, structured data, quotations, license notices and generated content is leave unchanged.

Preserve facts, numbers, units, currencies, dates, SKU names, source URLs, citations, negation and requirement strength.
Preserve uncertainty, evidence limits, accepted risks and qualifications. Never turn "may" into "will", an estimate
into a guarantee, or accepted risk into remediation. Flag missing sources; never invent citations or delete an
unsupported claim's caveat just to make the prose sound confident. Do not invent an actor to force active voice.

APEX file contracts outrank style preferences. Preserve required H2 text/order, emoji-bearing template headings,
anchors, badge structures, links, tables, code fences and verbatim handoff lines. Use sentence case only for
unconstrained headings; do not globally replace punctuation or Unicode characters.

Do not edit approved or hash-reviewed artifacts, upstream artifacts owned by another agent, or generated files
in place as a style pass. Return proposed edits to the owner. Apply authorized artifact prose cleanup before
review finalization; later changes require owner reconciliation and fresh review evidence, never hash restamping.
This skill cannot grant approvals, resolve findings, change session state, or waive a required check.

## Workflow

1. Establish scope and protected content. Reuse current context rather than loading unrelated files or all skills.
2. Identify specific clarity problems. If the text is already clear, leave it alone.
3. Make the smallest authorized edits, preserving meaning and the intended tone. Prefer one pass and one self-check.
4. Compare the result with the original for factual changes, lost caveats, broken structure and over-compression.
5. For file edits, run the relevant existing checks. Artifact lint belongs to its hook/reviewer; do not invoke it
   directly against `agent-output/**`. Report any unverified requirement rather than claiming technical correctness.

## Editing guidance

- Remove filler, generic conclusions, flattery and conversational boilerplate when they add no information.
- State mechanisms and concrete outcomes instead of praise or decorative metaphors. Do not invent measurements.
- Prefer familiar words and consistent terminology. "Use" often replaces "utilize"; technical terms such as
  vector, API surface, harness, policy and managed identity remain when precise.
- Replace repetitive framing with a direct statement. Do not force every explanation into three items.
- Split dense sentences when it improves comprehension. Keep necessary articles, verbs and qualifications;
  fewer words are not automatically clearer.
- Prefer active voice when the actor is known and relevant. Reduce stacked hedges, not justified uncertainty.
- Reduce gratuitous bold, punctuation and decorative emojis only where the document contract allows it.
- Preserve useful lists, labels, parentheses and colons. Treat vocabulary patterns as review cues, not a blacklist.
- Keep general security or safety requirements even when the same sentence could apply to another project.

## Regression examples

| Original | Safe treatment |
| --- | --- |
| In order to validate the file, run the existing check. | To validate the file, run the existing check. |
| The estimate may exceed EUR 200 if usage increases. | Leave unchanged: uncertainty, currency and threshold matter. |
| Deployment MUST remain blocked until approval. | Preserve MUST, condition and meaning; flag technical concerns separately. |
| `P0v4`, `Standard_LRS`, `apex-recall`, `--verify-cache` | Preserve these identifiers exactly. |
| `## 🔒 Approval Gate` | Preserve the required heading and its anchor. |
| The accepted recovery risk has not been remediated. | Preserve the distinction between acceptance and remediation. |
| Industry reports suggest this is faster. | Request a source or propose a qualified rewrite; do not fabricate evidence. |

## Output

For supplied text, return the revised text or the requested review. For file edits, name the changed files and
briefly summarize meaningful edits and checks. Separate technical concerns from style suggestions. Do not add
generic reassurance, an "AI score", or a claim that the result is human-authored.

## Attribution

Adapted from Lauren Tan's [Unslop skill](https://github.com/cursor/plugins/tree/e8d856f0273b42ebafe0ec3546bd645709e7c1b0/pstack/skills/unslop),
part of Cursor's pstack plugin, under the [MIT license](LICENSE.txt).
APEX scopes the original style guidance to explicit requests and adds technical-content and review safeguards.
Upstream rule numbers are not retained as APEX rule identifiers. Updates require a reviewed adaptation, not a live import.
