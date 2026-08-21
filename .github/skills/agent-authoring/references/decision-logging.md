<!-- ref:agent-decision-logging-v2 -->

# Decision Logging

Log choices that materially affect architecture, cost, security, deployment,
networking, IaC strategy, or a rejected viable alternative. Omit formatting,
filenames, and routine implementation details.

Use `apex-recall decide` rather than editing session state directly:

```bash
apex-recall decide <project> \
  --decision "<choice>" \
  --rationale "<trade-off and impact>" \
  --json
```

For registered scalar decisions:

```bash
apex-recall decide <project> --key <key> --value <value> --json
```

Each narrative decision identifies the selected option, rejected viable
alternatives, governing constraints, rationale, and downstream impact.
Valid scalar keys live in `tools/apex-recall/docs/decision-keys.md`.
