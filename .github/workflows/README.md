# GitHub Actions Ownership

## Product Automation

APEX runs product CI, branch enforcement, consumer-template validation and devcontainer checks.
Read each active workflow for its exact triggers and permissions.
The long-lived Sensei branch maintenance remains separate from consumer infrastructure operations.

## Consumer Automation

Governance, project IaC and data refresh jobs are maintained as inactive
[consumer templates](../consumer-workflows/). The accelerator distributes guarded copies;
consumer repositories own execution and refreshed data. See
[consumer workflow ownership](../../tools/scripts/consumer-workflows.md).

## Documentation

Build, browser acceptance, link maintenance and Pages publishing belong to
[apex-docs](https://github.com/jonathan-vella/apex-docs).
APEX no longer hosts Astro or publishes the documentation site.
The old gh-pages branch may remain as rollback history, not an active publisher.

## Explorer Metadata

APEX owns the source inventory generator and schema. The default generated product registry is
`tools/registry/architecture-explorer-graph.json`. Consumers can select an explicit destination:

```bash
node tools/scripts/generate-explorer-graph.mjs --output /path/to/graph.json
node tools/scripts/validate-explorer-graph.mjs --input /path/to/graph.json
```

Docs builds use a pinned APEX checkout and write metadata directly into their own public directory.
No site directory is required in APEX. Regenerate the registry when product inventory changes.
