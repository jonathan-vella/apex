---
name: "Copilot Chat upstream feedback"
about: "Report a VS Code Copilot Chat behaviour that an APEX agent cannot fix in-repo."
title: "[copilot-chat] "
labels: ["upstream", "external"]
---

<!--
Use this template for issues that need to be filed against
microsoft/vscode-copilot-release (or a related Microsoft repo). APEX
agents cannot fix chat-client behaviour; this template documents
the symptom and our reproduction so an upstream maintainer can triage.

For repo-local agent / instruction issues, use bug-report.yml instead.
-->

## Summary

<!-- One-line description of what the chat client is doing. -->

## Reproduction

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->

**Expected**: <!-- What should have happened. -->

**Actual**: <!-- What did happen. -->

## Evidence

<!-- Attach OTel debug log path(s), span IDs, screenshots. The
     token-reduction baseline corpus is at
     .github/data/token-reduction-logs.tar.gz; extract and reference
     specific spans. -->

- Log file: `logs/<session>.json` (extracted from
  `.github/data/token-reduction-logs.tar.gz`)
- Span IDs / timestamps:
- Token impact (if measurable via `npm run profile:debug-log`):

## Environment

- VS Code version:
- Copilot Chat extension version:
- Dev container: yes / no
- Model(s) involved:

## Related upstream tracking

<!-- Link any related issue at microsoft/vscode-copilot-release or
     similar. If filing a new upstream issue, paste the URL here once
     opened. -->

## APEX cross-reference

<!-- Pointer to the in-repo doc that captured this symptom, e.g.
     docs/devcontainer-hygiene.md → "Parallel chat retry race". -->
